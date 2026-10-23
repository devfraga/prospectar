// Grava lugares no banco: um lead por placeId, sem duplicar entre buscas.
// Num lead que já existe, atualiza só os dados do Maps; status, notas e mensagem do usuário ficam intactos.

import { db } from "./db";
import { dentroDoBbox, type Bbox } from "./grade";
import { calcularPontuacao, type Pesos } from "./pontuacao";
import { classificarWebsite } from "./presenca";
import { normalizarTelefone } from "./telefone";
import type { LugarBruto, Presenca } from "./tipos";

export interface ResultadoImportacao {
  recebidos: number;
  importados: number;
  novos: number;
  ignorados: number;
}

export async function importarLugares(
  buscaId: string,
  lugares: LugarBruto[],
  opcoes: { cidade: string; pesos: Pesos; bbox?: Bbox },
): Promise<ResultadoImportacao> {
  const res: ResultadoImportacao = { recebidos: lugares.length, importados: 0, novos: 0, ignorados: 0 };
  const vistos = new Set<string>();

  for (const l of lugares) {
    // Fechado de vez, repetido no mesmo lote ou fora da cidade (a grade "vaza" para fora do bbox).
    if (l.ativo === false || vistos.has(l.placeId) || (opcoes.bbox && !dentroDoBbox(l.lat, l.lon, opcoes.bbox))) {
      res.ignorados++;
      continue;
    }
    vistos.add(l.placeId);

    const tel = normalizarTelefone(l.telefone);
    const site = classificarWebsite(l.website);
    const dadosMaps = {
      nome: l.nome,
      categoria: l.categoria ?? null,
      endereco: l.endereco ?? null,
      lat: l.lat ?? null,
      lon: l.lon ?? null,
      linkMaps: l.linkMaps ?? null,
      telefone: l.telefone ?? null,
      telefoneE164: tel.e164,
      ehCelular: tel.ehCelular,
      nota: l.nota ?? null,
      avaliacoes: l.avaliacoes ?? null,
    };

    const existente = await db.lead.findUnique({ where: { placeId: l.placeId } });
    let leadId: string;
    if (existente) {
      // Reclassifica se o site mudou, ou se as regras (que podem ter ganhado domínios novos) dizem que não é site próprio.
      // Caso contrário mantém o resultado do enriquecimento (ex.: site_fora_do_ar).
      const reclassificar =
        (existente.website ?? "") !== (l.website ?? "") || (site.presenca !== "com_site" && site.presenca !== existente.presenca);
      const presenca = (reclassificar ? site.presenca : existente.presenca) as Presenca;
      const emails = existente.emails || l.emails || null;
      await db.lead.update({
        where: { id: existente.id },
        data: {
          ...dadosMaps,
          emails,
          ...(reclassificar
            ? {
                website: l.website ?? null,
                presenca,
                siteHttps: null,
                siteNota: site.nota ?? null,
                enriquecidoEm: null,
                ...redeDoSite(l.website, site.rede),
              }
            : {}),
          pontuacao: calcularPontuacao({ ...dadosMaps, presenca, emails, naoContatar: existente.naoContatar }, opcoes.pesos),
        },
      });
      leadId = existente.id;
    } else {
      const emails = l.emails || null;
      const criado = await db.lead.create({
        data: {
          placeId: l.placeId,
          ...dadosMaps,
          cidade: opcoes.cidade,
          website: l.website ?? null,
          presenca: site.presenca,
          siteNota: site.nota ?? null,
          emails,
          ...redeDoSite(l.website, site.rede),
          pontuacao: calcularPontuacao({ ...dadosMaps, presenca: site.presenca, emails }, opcoes.pesos),
        },
      });
      leadId = criado.id;
      res.novos++;
    }

    await db.buscaLead.upsert({
      where: { buscaId_leadId: { buscaId, leadId } },
      create: { buscaId, leadId },
      update: {},
    });
    res.importados++;
  }
  return res;
}

/** Quando o "site" do Maps é um perfil social, guarda o link no campo da rede. */
function redeDoSite(website: string | undefined, rede: string | undefined) {
  if (!website || !rede) return {};
  return { [rede]: website } as { instagram?: string; facebook?: string; linkedin?: string };
}
