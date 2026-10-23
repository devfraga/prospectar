// Ciclo de vida de uma busca, sem worker em segundo plano.
// avancarBusca(id) é chamada a cada polling (painel ou CLI) e dá UM passo por vez:
//   1. inicia a próxima célula pendente (nunca duas ao mesmo tempo, para não provocar bloqueio do Google)
//   2. quando a célula termina, baixa e importa os lugares
//   3. com todas as células prontas, enriquece os sites em lotes pequenos
// Fechar o painel só pausa a busca; ela continua no próximo polling.

import { obterPesos } from "./config";
import { db } from "./db";
import { analisarSite, emParalelo } from "./enriquecer";
import * as gosom from "./fontes/gosom";
import { buscarPlaces } from "./fontes/places";
import { geocodificar } from "./geocode";
import { celulasDaGrade, type Bbox, type Celula } from "./grade";
import { importarLugares } from "./importar";
import { calcularPontuacao } from "./pontuacao";
import { GRADE_MAXIMA, type Fonte, type Presenca, type StatusBusca } from "./tipos";

export interface NovaBusca {
  nicho: string;
  cidade: string;
  fonte?: Fonte;
  /** Quantas vezes o motor rola a lista de resultados. Mais = mais resultados, mais lento, mais risco. */
  profundidade?: number;
  /** Cobertura: divide a cidade em grade x grade partes, uma busca em cada (1 a GRADE_MAXIMA). */
  grade?: number;
  /** metros, só para grade 1 */
  raio?: number;
  proxies?: string[];
}

export interface ResumoBusca {
  id: string;
  nicho: string;
  cidade: string;
  fonte: string;
  status: StatusBusca;
  erro: string | null;
  tarefas: { total: number; pendentes: number; rodando: number; ok: number; falhou: number };
  totalLeads: number;
  novosLeads: number;
  aEnriquecer: number;
  criadoEm: Date;
}

const TEMPO_MAXIMO_JOB = 900; // segundos
const LOTE_ENRIQUECIMENTO = 8;
const DICA_BLOQUEIO =
  "Pode ser bloqueio temporário do seu IP pelo Google. Espere alguns minutos, reduza a profundidade ou configure PROXIES no .env.";

/** Aviso para buscas grandes. Avisa, não bloqueia. */
export function avisoVolume(n: Pick<NovaBusca, "profundidade" | "grade" | "fonte">): string | null {
  const celulas = (n.grade ?? 1) ** 2;
  if ((n.fonte ?? "gosom") === "places") {
    return celulas > 1 ? `Cobertura de ${celulas} buscas na Places API faz até ${celulas * 3} requisições pagas.` : null;
  }
  if ((n.profundidade ?? 10) >= 15 || celulas >= 4) {
    return `Busca grande (${celulas} busca(s), profundidade ${n.profundidade ?? 10}). Sem proxy, buscas grandes seguidas podem bloquear seu IP por algumas horas.`;
  }
  return null;
}

export async function criarBusca(n: NovaBusca) {
  const nicho = n.nicho.trim();
  const cidade = n.cidade.trim();
  if (!nicho || !cidade) throw new Error("Informe o nicho e a cidade.");
  const fonte: Fonte = n.fonte ?? ((process.env.FONTE_PADRAO as Fonte) || "gosom");
  const grade = Math.max(1, Math.round(n.grade ?? 1));
  if (grade > GRADE_MAXIMA) {
    throw new Error(
      `A cobertura vai até ${GRADE_MAXIMA}x${GRADE_MAXIMA} (${GRADE_MAXIMA ** 2} buscas) para evitar bloqueio do Google.`,
    );
  }
  const profundidade = Math.min(30, Math.max(1, Math.round(n.profundidade ?? 10)));
  const raio = Math.min(50_000, Math.max(1000, Math.round(n.raio ?? 10_000)));

  const local = await geocodificar(cidade);
  if (!local) throw new Error(`Não encontrei a cidade "${cidade}". Tente "Cidade, UF".`);

  const celulas: Celula[] =
    grade > 1 ? celulasDaGrade(local.bbox, grade) : [{ lat: local.lat, lon: local.lon, raio, zoom: 14 }];
  const proxies = n.proxies?.length ? n.proxies : proxiesDoEnv();

  return db.busca.create({
    data: {
      nicho,
      cidade,
      lat: local.lat,
      lon: local.lon,
      raio,
      profundidade,
      grade,
      fonte,
      bbox: grade > 1 ? JSON.stringify(local.bbox) : null,
      proxies: proxies.length ? JSON.stringify(proxies) : null,
      tarefas: { create: celulas.map((c, ordem) => ({ ordem, lat: c.lat, lon: c.lon, raio: c.raio, zoom: c.zoom })) },
    },
  });
}

function proxiesDoEnv(): string[] {
  return (process.env.PROXIES ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
}

// Evita dois pollings simultâneos (painel + CLI) avançando a mesma busca no mesmo processo.
const emAndamento = new Map<string, Promise<ResumoBusca>>();

export function avancarBusca(id: string): Promise<ResumoBusca> {
  const atual = emAndamento.get(id);
  if (atual) return atual;
  const p = passo(id).finally(() => emAndamento.delete(id));
  emAndamento.set(id, p);
  return p;
}

async function passo(id: string): Promise<ResumoBusca> {
  const busca = await db.busca.findUnique({ where: { id }, include: { tarefas: { orderBy: { ordem: "asc" } } } });
  if (!busca) throw new Error("Busca não encontrada.");
  if (busca.status === "concluida" || busca.status === "falhou") return resumoBusca(id);

  const palavras = [busca.grade > 1 ? busca.nicho : `${busca.nicho} em ${busca.cidade}`];
  const bbox = busca.bbox ? (JSON.parse(busca.bbox) as Bbox) : undefined;
  const proxies = busca.proxies ? (JSON.parse(busca.proxies) as string[]) : undefined;
  const pesos = await obterPesos();

  // 1-2. Células
  const rodando = busca.tarefas.find((t) => t.status === "rodando");
  const pendente = busca.tarefas.find((t) => t.status === "pendente");

  if (rodando && !rodando.jobId) {
    // Processo caiu entre reservar a célula e criar o job: devolve para a fila depois de 2 min.
    if (rodando.iniciadoEm && Date.now() - rodando.iniciadoEm.getTime() > 120_000) {
      await db.tarefaMotor.update({ where: { id: rodando.id }, data: { status: "pendente", iniciadoEm: null } });
    }
  } else if (rodando && rodando.jobId) {
    try {
      const st = await gosom.statusJob(rodando.jobId);
      if (st === "ok") {
        const lugares = await gosom.baixarResultado(rodando.jobId);
        const r = await importarLugares(id, lugares, { cidade: busca.cidade, pesos, bbox });
        await db.tarefaMotor.update({
          where: { id: rodando.id },
          data: { status: "ok", linhas: r.importados, concluidoEm: new Date() },
        });
        await db.busca.update({ where: { id }, data: { novosLeads: { increment: r.novos } } });
        await gosom.apagarJob(rodando.jobId);
      } else if (st === "failed" || expirou(rodando.iniciadoEm)) {
        await db.tarefaMotor.update({
          where: { id: rodando.id },
          data: { status: "falhou", erro: `Job ${st === "failed" ? "falhou" : "passou do tempo"} no motor. ${DICA_BLOQUEIO}`, concluidoEm: new Date() },
        });
        await gosom.apagarJob(rodando.jobId);
      }
    } catch (e) {
      // Motor fora do ar: não marca falha, tenta de novo no próximo polling.
      if (e instanceof gosom.MotorIndisponivel) {
        await db.busca.update({ where: { id }, data: { erro: e.message } });
        return resumoBusca(id);
      }
      throw e;
    }
  } else if (pendente) {
    // Um job do motor por vez, mesmo entre buscas diferentes: as outras esperam na fila.
    if (busca.fonte === "gosom") {
      const outros = await db.tarefaMotor.count({ where: { status: "rodando", busca: { fonte: "gosom" }, NOT: { buscaId: id } } });
      if (outros > 0) return resumoBusca(id);
    }
    // Reserva a célula de forma atômica: só quem mudar pendente -> rodando executa.
    const reservada = await db.tarefaMotor.updateMany({
      where: { id: pendente.id, status: "pendente" },
      data: { status: "rodando", iniciadoEm: new Date() },
    });
    if (reservada.count === 1) {
      await db.busca.update({ where: { id }, data: { status: "rodando", erro: null } });
      try {
        if (busca.fonte === "places") {
          const lugares = await buscarPlaces({ texto: palavras[0], lat: pendente.lat, lon: pendente.lon, raio: pendente.raio });
          const r = await importarLugares(id, lugares, { cidade: busca.cidade, pesos, bbox });
          await db.tarefaMotor.update({
            where: { id: pendente.id },
            data: { status: "ok", linhas: r.importados, concluidoEm: new Date() },
          });
          await db.busca.update({ where: { id }, data: { novosLeads: { increment: r.novos } } });
        } else {
          const jobId = await gosom.criarJob({
            palavras,
            lat: pendente.lat,
            lon: pendente.lon,
            zoom: pendente.zoom,
            raio: pendente.raio,
            profundidade: busca.profundidade,
            tempoMaximo: TEMPO_MAXIMO_JOB,
            proxies,
          });
          await db.tarefaMotor.update({ where: { id: pendente.id }, data: { jobId } });
        }
      } catch (e) {
        const motorFora = e instanceof gosom.MotorIndisponivel;
        // Motor fora do ar: devolve a célula para a fila. Outro erro: marca a célula como falha.
        await db.tarefaMotor.update({
          where: { id: pendente.id },
          data: motorFora
            ? { status: "pendente", iniciadoEm: null }
            : { status: "falhou", erro: (e as Error).message, concluidoEm: new Date() },
        });
        await db.busca.update({ where: { id }, data: { erro: (e as Error).message } });
      }
    }
  } else {
    // 3. Todas as células terminaram
    const tarefas = busca.tarefas;
    if (tarefas.every((t) => t.status === "falhou")) {
      await db.busca.update({
        where: { id },
        data: { status: "falhou", erro: tarefas[0]?.erro ?? `Todas as buscas da cobertura falharam. ${DICA_BLOQUEIO}` },
      });
      return resumoBusca(id);
    }
    const { restantes } = await enriquecerLote({ buscaId: id, limite: LOTE_ENRIQUECIMENTO });
    await db.busca.update({ where: { id }, data: { status: restantes > 0 ? "enriquecendo" : "concluida", erro: null } });
  }

  return resumoBusca(id);
}

function expirou(inicio: Date | null): boolean {
  return !!inicio && Date.now() - inicio.getTime() > (TEMPO_MAXIMO_JOB + 300) * 1000;
}

/** Só leads "com_site" precisam de visita: sem site e rede social já estão classificados. */
function filtroAEnriquecer(buscaId?: string) {
  return {
    presenca: "com_site",
    enriquecidoEm: null,
    website: { not: null },
    ...(buscaId ? { buscas: { some: { buscaId } } } : {}),
  };
}

export async function enriquecerLote(opcoes: { buscaId?: string; limite?: number } = {}) {
  const pesos = await obterPesos();
  const leads = await db.lead.findMany({
    where: filtroAEnriquecer(opcoes.buscaId),
    take: opcoes.limite ?? LOTE_ENRIQUECIMENTO,
    orderBy: { pontuacao: "desc" },
  });

  await emParalelo(leads, 8, async (l) => {
    const a = await analisarSite(l.website!);
    const presenca: Presenca = a.online ? "com_site" : "site_fora_do_ar";
    const emails = l.emails || a.emails.join(", ") || null;
    await db.lead.update({
      where: { id: l.id },
      data: {
        presenca,
        siteHttps: a.online ? a.https : null,
        siteNota: a.nota,
        emails,
        instagram: l.instagram ?? a.redes.instagram ?? null,
        facebook: l.facebook ?? a.redes.facebook ?? null,
        linkedin: l.linkedin ?? a.redes.linkedin ?? null,
        enriquecidoEm: new Date(),
        pontuacao: calcularPontuacao({ ...l, presenca, emails }, pesos),
      },
    });
  });

  const restantes = await db.lead.count({ where: filtroAEnriquecer(opcoes.buscaId) });
  return { processados: leads.length, restantes };
}

/** Marca todos os sites para nova verificação (sites mudam: saem do ar, voltam, ganham https). */
export async function reverificarSites(): Promise<number> {
  const r = await db.lead.updateMany({
    where: { presenca: { in: ["com_site", "site_fora_do_ar"] }, website: { not: null } },
    data: { presenca: "com_site", enriquecidoEm: null, siteNota: null },
  });
  return r.count;
}

export async function resumoBusca(id: string): Promise<ResumoBusca> {
  const b = await db.busca.findUnique({ where: { id }, include: { tarefas: { select: { status: true } } } });
  if (!b) throw new Error("Busca não encontrada.");
  const conta = (s: string) => b.tarefas.filter((t) => t.status === s).length;
  const [totalLeads, aEnriquecer] = await Promise.all([
    db.buscaLead.count({ where: { buscaId: id } }),
    db.lead.count({ where: filtroAEnriquecer(id) }),
  ]);
  return {
    id: b.id,
    nicho: b.nicho,
    cidade: b.cidade,
    fonte: b.fonte,
    status: b.status as StatusBusca,
    erro: b.erro,
    tarefas: { total: b.tarefas.length, pendentes: conta("pendente"), rodando: conta("rodando"), ok: conta("ok"), falhou: conta("falhou") },
    totalLeads,
    novosLeads: b.novosLeads,
    aEnriquecer,
    criadoEm: b.criadoEm,
  };
}

export async function listarBuscas(limite = 50): Promise<ResumoBusca[]> {
  const buscas = await db.busca.findMany({ orderBy: { criadoEm: "desc" }, take: limite, select: { id: true } });
  return Promise.all(buscas.map((b) => resumoBusca(b.id)));
}
