// CLI do prospectar:  npm run cli -- <comando>   (ajuda: npm run cli -- --help)
// Usa o mesmo src/core do painel, então tudo que a CLI faz aparece no painel e vice-versa.

import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
import { Command, InvalidArgumentError, Option } from "commander";
import {
  avancarBusca,
  avisoVolume,
  criarBusca,
  enriquecerLote,
  listarBuscas,
  resumoBusca,
  reverificarSites,
  type ResumoBusca,
} from "../core/busca";
import { recalcularPontuacoes } from "../core/config";
import { db } from "../core/db";
import { motorDisponivel } from "../core/fontes/gosom";
import { atualizarLead, estatisticas, exportarCsv, listarLeads, obterLead, type FiltrosLead } from "../core/leads";
import { COBERTURAS, FONTES, GRADE_MAXIMA, PRESENCA_ROTULO, PRESENCAS, STATUS_LEAD, ehStatusLead, type Fonte, type Presenca, type StatusLead } from "../core/tipos";

const programa = new Command()
  .name("prospectar")
  .description("Prospecção de clientes pelo Google Maps")
  .showHelpAfterError();

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));
const FINAL = new Set(["concluida", "falhou"]);

function linhaProgresso(r: ResumoBusca): string {
  const t = r.tarefas;
  const enr = r.status === "enriquecendo" ? ` | sites a verificar: ${r.aEnriquecer}` : "";
  return `[${r.status}] buscas ${t.ok + t.falhou}/${t.total}${t.falhou ? ` (${t.falhou} falharam)` : ""} | leads: ${r.totalLeads} (${r.novosLeads} novos)${enr}`;
}

async function acompanhar(id: string, intervaloMs: number): Promise<ResumoBusca> {
  let ultima = "";
  for (;;) {
    const r = await avancarBusca(id);
    const linha = linhaProgresso(r);
    if (linha !== ultima) {
      console.log(`${new Date().toLocaleTimeString("pt-BR")} ${linha}`);
      ultima = linha;
    }
    if (r.erro && !FINAL.has(r.status)) console.log(`  aviso: ${r.erro}`);
    if (FINAL.has(r.status)) return r;
    // Enriquecimento não depende do motor: pode seguir sem pausa longa.
    await esperar(r.status === "enriquecendo" ? 500 : intervaloMs);
  }
}

async function imprimirResumoFinal(r: ResumoBusca) {
  if (r.status === "falhou") {
    console.log(`\n✗ Busca falhou: ${r.erro}`);
    return;
  }
  const { leads, total } = await listarLeads({ buscaId: r.id, limite: 5 });
  const porPresenca = await db.lead.groupBy({ by: ["presenca"], where: { buscas: { some: { buscaId: r.id } } }, _count: true });
  console.log(`\n✓ ${total} leads em "${r.nicho}" / ${r.cidade}`);
  for (const p of porPresenca) console.log(`  ${PRESENCA_ROTULO[p.presenca as Presenca]}: ${p._count}`);
  console.log("\nMelhores pontuações:");
  for (const l of leads) console.log(`  ${String(l.pontuacao).padStart(3)}  ${l.nome} | ${PRESENCA_ROTULO[l.presenca as Presenca]} | ${l.telefone ?? "sem telefone"}`);
  console.log(`\nVeja todos no painel: npm run dev  ->  http://localhost:3000/?buscaId=${r.id}`);
}

const inteiro = (v: string) => {
  const n = Number.parseInt(v, 10);
  if (Number.isNaN(n)) throw new Error(`"${v}" não é um número`);
  return n;
};

programa
  .command("buscar")
  .description("Cria uma busca por nicho + cidade")
  .argument("<nicho>", 'ex.: "barbearia"')
  .requiredOption("-c, --cidade <cidade>", 'ex.: "Campinas, SP"')
  .addOption(new Option("-f, --fonte <fonte>", "gosom (Docker, grátis) ou places (API paga)").choices([...FONTES]))
  .option("-p, --profundidade <n>", "quanto rolar a lista do Maps (1-30, padrão 10)", inteiro)
  .option(
    "-g, --grade <n>",
    `cobertura da cidade: ${COBERTURAS.map((c) => `${c.grade} = ${c.nome.toLowerCase()} (${c.buscas} busca(s), até ~${c.ate})`).join(", ")}`,
    (v: string) => {
      const n = inteiro(v);
      if (n < 1 || n > GRADE_MAXIMA) throw new InvalidArgumentError(`use de 1 a ${GRADE_MAXIMA} (mais que isso aumenta o risco de bloqueio).`);
      return n;
    },
  )
  .option("-r, --raio <metros>", "raio da busca na cobertura normal (padrão 10000)", inteiro)
  .option("--nao-esperar", "só cria a busca; acompanhe depois com o comando sync")
  .option("-i, --intervalo <segundos>", "intervalo do polling", inteiro, 8)
  .action(async (nicho: string, o) => {
    const aviso = avisoVolume({ profundidade: o.profundidade, grade: o.grade, fonte: o.fonte });
    if (aviso) console.log(`⚠  ${aviso}\n`);
    if ((o.fonte ?? process.env.FONTE_PADRAO ?? "gosom") === "gosom" && !(await motorDisponivel())) {
      throw new Error('Motor fora do ar. Rode "docker compose up -d" (ou npm run motor:up) e tente de novo.');
    }
    const b = await criarBusca({ nicho, cidade: o.cidade, fonte: o.fonte as Fonte, profundidade: o.profundidade, grade: o.grade, raio: o.raio });
    const cobertura = COBERTURAS.find((c) => c.grade === b.grade);
    console.log(
      `▶ Busca ${b.id}: "${b.nicho}" em ${b.cidade} (${b.fonte}, cobertura ${cobertura?.nome.toLowerCase()} = ${b.grade ** 2} busca(s), profundidade ${b.profundidade})`,
    );
    if (o.naoEsperar) {
      console.log(`Acompanhe com: npm run cli -- sync ${b.id}`);
      return;
    }
    await imprimirResumoFinal(await acompanhar(b.id, o.intervalo * 1000));
  });

programa
  .command("sync")
  .description("Avança uma busca até terminar (ou todas as abertas, sem id)")
  .argument("[id]")
  .option("-i, --intervalo <segundos>", "intervalo do polling", inteiro, 8)
  .action(async (id: string | undefined, o) => {
    const ids = id
      ? [id]
      : (await db.busca.findMany({ where: { status: { notIn: ["concluida", "falhou"] } }, orderBy: { criadoEm: "asc" } })).map((b) => b.id);
    if (!ids.length) console.log("Nenhuma busca em aberto.");
    for (const b of ids) await imprimirResumoFinal(await acompanhar(b, o.intervalo * 1000));
  });

programa
  .command("buscas")
  .description("Lista as buscas")
  .option("--json")
  .action(async (o) => {
    const buscas = await listarBuscas();
    if (o.json) return console.log(JSON.stringify(buscas, null, 2));
    if (!buscas.length) return console.log("Nenhuma busca ainda.");
    for (const b of buscas) console.log(`${b.id}  ${b.criadoEm.toLocaleDateString("pt-BR")}  ${b.nicho} / ${b.cidade}  ${linhaProgresso(b)}`);
  });

function filtrosDaCli(o: Record<string, unknown>): FiltrosLead {
  const lista = (v: unknown) => (typeof v === "string" ? v.split(",").map((s) => s.trim()).filter(Boolean) : undefined);
  return {
    nicho: o.nicho as string | undefined,
    cidade: o.cidade as string | undefined,
    presenca: lista(o.presenca) as Presenca[] | undefined,
    status: lista(o.status) as StatusLead[] | undefined,
    pontuacaoMin: o.min as number | undefined,
    whatsapp: o.whatsapp ? true : undefined,
    buscaId: o.busca as string | undefined,
    semMensagem: o.semMensagem ? true : undefined,
    limite: o.limite as number | undefined,
  };
}

function opcoesDeFiltro(c: Command): Command {
  return c
    .option("--nicho <texto>")
    .option("--cidade <texto>")
    .option("--presenca <lista>", `separado por vírgula: ${PRESENCAS.join(", ")}`)
    .option("--status <lista>", `separado por vírgula: ${STATUS_LEAD.join(", ")}`)
    .option("--min <pontuacao>", "pontuação mínima", inteiro)
    .option("--whatsapp", "só quem tem celular")
    .option("--busca <id>", "só leads de uma busca");
}

opcoesDeFiltro(programa.command("leads").description("Lista leads, maior pontuação primeiro"))
  .option("--sem-mensagem", "só leads sem mensagem personalizada")
  .option("-l, --limite <n>", "quantidade", inteiro, 20)
  .option("--json", "saída em JSON (para a skill do Claude Code)")
  .action(async (o) => {
    const { leads: lista, total } = await listarLeads(filtrosDaCli(o));
    if (o.json) {
      const enxuto = lista.map((l) => ({
        id: l.id, nome: l.nome, categoria: l.categoria, cidade: l.cidade, endereco: l.endereco,
        presenca: l.presenca, siteNota: l.siteNota, website: l.website, instagram: l.instagram, facebook: l.facebook,
        nota: l.nota, avaliacoes: l.avaliacoes, telefone: l.telefone, whatsapp: l.ehCelular,
        pontuacao: l.pontuacao, status: l.status, mensagem: l.mensagem,
      }));
      return console.log(JSON.stringify(enxuto, null, 2));
    }
    console.log(`${total} leads (mostrando ${lista.length})\n`);
    for (const l of lista) {
      console.log(
        `${String(l.pontuacao).padStart(3)}  ${l.nome}  [${PRESENCA_ROTULO[l.presenca as Presenca]}] ${l.status}  ${l.telefone ?? ""}  ${l.id}`,
      );
    }
  });

programa
  .command("lead")
  .description("Mostra um lead em JSON")
  .argument("<id>")
  .action(async (id: string) => {
    const l = await obterLead(id);
    if (!l) throw new Error("Lead não encontrado.");
    console.log(JSON.stringify(l, null, 2));
  });

programa
  .command("status")
  .description(`Muda o status de um lead (${STATUS_LEAD.join(", ")})`)
  .argument("<id>")
  .argument("<status>")
  .action(async (id: string, status: string) => {
    if (!ehStatusLead(status)) throw new Error(`Status inválido. Use: ${STATUS_LEAD.join(", ")}`);
    const l = await atualizarLead(id, { status });
    console.log(`✓ ${l.nome}: ${l.status}`);
  });

programa
  .command("remover")
  .description("Tira o lead do quadro (vai para Removidos)")
  .argument("<id>")
  .action(async (id: string) => {
    const l = await atualizarLead(id, { status: "descartado" });
    console.log(`✓ ${l.nome} removido do quadro.`);
  });

programa
  .command("restaurar")
  .description("Volta um lead removido para a coluna Novos")
  .argument("<id>")
  .action(async (id: string) => {
    const l = await atualizarLead(id, { status: "novo", naoContatar: false });
    console.log(`✓ ${l.nome} de volta ao quadro.`);
  });

programa
  .command("nao-contatar")
  .description("Marca que o lead pediu para não ser contatado (LGPD)")
  .argument("<id>")
  .action(async (id: string) => {
    const l = await atualizarLead(id, { naoContatar: true });
    console.log(`✓ ${l.nome} não será mais listado.`);
  });

programa
  .command("mensagem")
  .description("Grava a mensagem de abordagem de um lead")
  .argument("<id>")
  .option("-t, --texto <texto>")
  .option("-a, --arquivo <caminho>", "arquivo de texto com a mensagem")
  .action(async (id: string, o) => {
    const texto = o.texto ?? (o.arquivo ? readFileSync(o.arquivo, "utf8") : undefined);
    if (!texto) throw new Error("Passe --texto ou --arquivo.");
    const l = await atualizarLead(id, { mensagem: texto });
    console.log(`✓ Mensagem salva para ${l.nome}`);
  });

programa
  .command("mensagens")
  .description('Grava várias mensagens de uma vez: arquivo JSON [{"id": "...", "mensagem": "..."}]')
  .requiredOption("-a, --arquivo <caminho>")
  .action(async (o) => {
    const itens = JSON.parse(readFileSync(o.arquivo, "utf8")) as Array<{ id: string; mensagem: string }>;
    let ok = 0;
    for (const it of itens) {
      try {
        await atualizarLead(it.id, { mensagem: it.mensagem });
        ok++;
      } catch (e) {
        console.log(`✗ ${it.id}: ${(e as Error).message}`);
      }
    }
    console.log(`✓ ${ok}/${itens.length} mensagens salvas`);
  });

opcoesDeFiltro(programa.command("exportar").description("Exporta leads filtrados para CSV"))
  .option("-s, --saida <arquivo>", "arquivo de saída", `leads-${new Date().toISOString().slice(0, 10)}.csv`)
  .action(async (o) => {
    const csv = await exportarCsv(filtrosDaCli(o));
    writeFileSync(o.saida, csv, "utf8");
    console.log(`✓ ${csv.split("\r\n").length - 2} leads em ${o.saida}`);
  });

programa
  .command("enriquecer")
  .description("Visita os sites ainda não verificados (status, e-mail, redes)")
  .option("-l, --limite <n>", "máximo de sites", inteiro, 200)
  .option("--refazer", "verifica de novo todos os sites, inclusive os já verificados")
  .action(async (o) => {
    if (o.refazer) console.log(`  ${await reverificarSites()} sites marcados para nova verificação`);
    let feitos = 0;
    while (feitos < o.limite) {
      const r = await enriquecerLote({ limite: Math.min(16, o.limite - feitos) });
      feitos += r.processados;
      console.log(`  ${feitos} verificados, ${r.restantes} restantes`);
      if (!r.processados || !r.restantes) break;
    }
  });

programa
  .command("recalcular")
  .description("Recalcula a pontuação de todos os leads com os pesos atuais")
  .action(async () => console.log(`✓ ${await recalcularPontuacoes()} leads atualizados`));

programa
  .command("resumo")
  .description("Números gerais e situação do motor")
  .action(async () => {
    const e = await estatisticas();
    console.log(`Motor gosom: ${(await motorDisponivel()) ? "no ar" : 'fora do ar (rode "docker compose up -d")'}`);
    console.log(`Places API: ${process.env.GOOGLE_PLACES_API_KEY ? "configurada" : "sem chave"}`);
    console.log(`\nLeads: ${e.total} (${e.comWhatsapp} com WhatsApp)`);
    for (const p of PRESENCAS) console.log(`  ${PRESENCA_ROTULO[p]}: ${e.presenca[p] ?? 0}`);
    console.log("Status:", STATUS_LEAD.map((s) => `${s} ${e.status[s] ?? 0}`).join(" | "));
  });

programa
  .command("busca")
  .description("Mostra o andamento de uma busca sem avançá-la")
  .argument("<id>")
  .action(async (id: string) => console.log(linhaProgresso(await resumoBusca(id))));

programa
  .parseAsync()
  .catch((e: Error) => {
    console.error(`✗ ${e.message}`);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
