// Consulta, atualização e exportação de leads. Usado pelo painel (API) e pela CLI.

import type { Prisma } from "../generated/prisma/client";
import { obterPesos, obterTemplate } from "./config";
import { db } from "./db";
import { renderizarMensagem } from "./mensagem";
import { calcularPontuacao } from "./pontuacao";
import { linkWhatsApp } from "./telefone";
import { ehPresenca, ehStatusLead, type Presenca, type StatusLead } from "./tipos";

export interface FiltrosLead {
  /** Nicho da busca de origem ou categoria do Maps. */
  nicho?: string;
  cidade?: string;
  presenca?: Presenca[];
  status?: StatusLead[];
  pontuacaoMin?: number;
  whatsapp?: boolean;
  buscaId?: string;
  texto?: string;
  /** Só quem ainda não tem mensagem personalizada. */
  semMensagem?: boolean;
  /** Por padrão quem pediu para não ser contatado fica de fora. */
  incluirNaoContatar?: boolean;
  limite?: number;
  pagina?: number;
}

export function filtrosDeParams(p: URLSearchParams): FiltrosLead {
  const lista = (k: string) =>
    p
      .getAll(k)
      .flatMap((v) => v.split(","))
      .map((v) => v.trim())
      .filter(Boolean);
  const numero = (k: string) => (p.get(k) ? Number(p.get(k)) : undefined);
  return {
    nicho: p.get("nicho") || undefined,
    cidade: p.get("cidade") || undefined,
    presenca: lista("presenca").filter(ehPresenca),
    status: lista("status").filter(ehStatusLead),
    pontuacaoMin: numero("pontuacaoMin"),
    whatsapp: p.get("whatsapp") === "1" || p.get("whatsapp") === "true" ? true : undefined,
    buscaId: p.get("buscaId") || undefined,
    texto: p.get("texto") || undefined,
    semMensagem: p.get("semMensagem") === "1" || undefined,
    incluirNaoContatar: p.get("incluirNaoContatar") === "1",
    limite: numero("limite"),
    pagina: numero("pagina"),
  };
}

function where(f: FiltrosLead): Prisma.LeadWhereInput {
  const e: Prisma.LeadWhereInput[] = [];
  if (f.nicho) {
    e.push({ OR: [{ categoria: { contains: f.nicho } }, { buscas: { some: { busca: { nicho: { contains: f.nicho } } } } }] });
  }
  if (f.cidade) e.push({ OR: [{ cidade: { contains: f.cidade } }, { endereco: { contains: f.cidade } }] });
  if (f.presenca?.length) e.push({ presenca: { in: f.presenca } });
  // Removidos só aparecem quando pedidos explicitamente (status "descartado").
  if (f.status?.length) e.push({ status: { in: f.status } });
  else e.push({ status: { not: "descartado" } });
  if (f.pontuacaoMin != null && !Number.isNaN(f.pontuacaoMin)) e.push({ pontuacao: { gte: f.pontuacaoMin } });
  if (f.whatsapp) e.push({ ehCelular: true });
  if (f.buscaId) e.push({ buscas: { some: { buscaId: f.buscaId } } });
  if (f.texto) e.push({ OR: [{ nome: { contains: f.texto } }, { endereco: { contains: f.texto } }] });
  if (f.semMensagem) e.push({ mensagem: null });
  // Pedir os removidos mostra todos eles, inclusive quem pediu para não ser contatado.
  if (!f.incluirNaoContatar && !f.status?.includes("descartado")) e.push({ naoContatar: false });
  return { AND: e };
}

type LeadDb = Prisma.LeadGetPayload<object>;

export type LeadComLinks = LeadDb & {
  /** Mensagem final: a gerada por IA ou o template preenchido. */
  mensagemFinal: string;
  linkWhatsApp: string | null;
};

function comLinks(l: LeadDb, template: string): LeadComLinks {
  const mensagemFinal =
    l.mensagem ||
    renderizarMensagem(template, { nome: l.nome, categoria: l.categoria, cidade: l.cidade, presenca: l.presenca as Presenca });
  return {
    ...l,
    mensagemFinal,
    linkWhatsApp: l.ehCelular && l.telefoneE164 ? linkWhatsApp(l.telefoneE164, mensagemFinal) : null,
  };
}

export async function listarLeads(f: FiltrosLead = {}) {
  const limite = Math.min(500, Math.max(1, f.limite ?? 50));
  const pagina = Math.max(1, f.pagina ?? 1);
  const w = where(f);
  const [total, leads, template] = await Promise.all([
    db.lead.count({ where: w }),
    db.lead.findMany({
      where: w,
      orderBy: [{ pontuacao: "desc" }, { avaliacoes: "desc" }],
      take: limite,
      skip: (pagina - 1) * limite,
    }),
    obterTemplate(),
  ]);
  return { total, pagina, limite, leads: leads.map((l) => comLinks(l, template)) };
}

export async function obterLead(id: string) {
  const l = await db.lead.findUnique({
    where: { id },
    include: { buscas: { include: { busca: { select: { id: true, nicho: true, cidade: true, criadoEm: true } } } } },
  });
  if (!l) return null;
  const { buscas, ...lead } = l;
  return { ...comLinks(lead, await obterTemplate()), buscas: buscas.map((b) => b.busca) };
}

export interface AlteracaoLead {
  status?: StatusLead;
  notas?: string | null;
  mensagem?: string | null;
  naoContatar?: boolean;
}

export async function atualizarLead(id: string, a: AlteracaoLead) {
  const atual = await db.lead.findUnique({ where: { id } });
  if (!atual) throw new Error("Lead não encontrado.");
  if (a.status !== undefined && !ehStatusLead(a.status)) throw new Error(`Status inválido: ${a.status}`);
  const naoContatar = a.naoContatar ?? atual.naoContatar;
  const pontuacao = calcularPontuacao({ ...atual, presenca: atual.presenca as Presenca, naoContatar }, await obterPesos());
  return db.lead.update({
    where: { id },
    data: {
      ...(a.status !== undefined ? { status: a.status } : {}),
      ...(a.notas !== undefined ? { notas: a.notas } : {}),
      ...(a.mensagem !== undefined ? { mensagem: a.mensagem?.trim() || null } : {}),
      ...(a.naoContatar !== undefined ? { naoContatar } : {}),
      // Pedir para não ser contatado também descarta o lead.
      ...(a.naoContatar ? { status: "descartado" } : {}),
      pontuacao,
    },
  });
}

const COLUNAS: Array<[string, (l: LeadComLinks) => unknown]> = [
  ["nome", (l) => l.nome],
  ["categoria", (l) => l.categoria],
  ["presenca", (l) => l.presenca],
  ["pontuacao", (l) => l.pontuacao],
  ["status", (l) => l.status],
  ["telefone", (l) => l.telefone],
  ["whatsapp", (l) => l.linkWhatsApp],
  ["emails", (l) => l.emails],
  ["website", (l) => l.website],
  ["instagram", (l) => l.instagram],
  ["facebook", (l) => l.facebook],
  ["nota", (l) => l.nota],
  ["avaliacoes", (l) => l.avaliacoes],
  ["endereco", (l) => l.endereco],
  ["cidade", (l) => l.cidade],
  ["maps", (l) => l.linkMaps],
  ["mensagem", (l) => l.mensagemFinal],
  ["notas", (l) => l.notas],
];

/** CSV com ";" e BOM: abre direto no Excel em português e no Google Sheets. */
export function paraCsv(leads: LeadComLinks[]): string {
  const celula = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const linhas = [COLUNAS.map(([c]) => c).join(";")];
  for (const l of leads) linhas.push(COLUNAS.map(([, f]) => celula(f(l))).join(";"));
  return `﻿${linhas.join("\r\n")}\r\n`;
}

export async function exportarCsv(f: FiltrosLead) {
  const { leads } = await listarLeads({ ...f, limite: 500, pagina: 1 });
  // Para exportar tudo, pagina além dos primeiros 500.
  const todos = [...leads];
  for (let pagina = 2; todos.length === (pagina - 1) * 500; pagina++) {
    const r = await listarLeads({ ...f, limite: 500, pagina });
    if (!r.leads.length) break;
    todos.push(...r.leads);
  }
  return paraCsv(todos);
}

export async function estatisticas() {
  // Contagens do quadro: sem removidos nem quem pediu para não ser contatado.
  const noQuadro = { naoContatar: false, status: { not: "descartado" } };
  const [total, porPresenca, porStatus, comWhatsapp] = await Promise.all([
    db.lead.count({ where: noQuadro }),
    db.lead.groupBy({ by: ["presenca"], where: noQuadro, _count: true }),
    db.lead.groupBy({ by: ["status"], _count: true }),
    db.lead.count({ where: { ...noQuadro, ehCelular: true } }),
  ]);
  return {
    total,
    comWhatsapp,
    presenca: Object.fromEntries(porPresenca.map((p) => [p.presenca, p._count])) as Partial<Record<Presenca, number>>,
    status: Object.fromEntries(porStatus.map((s) => [s.status, s._count])) as Partial<Record<StatusLead, number>>,
  };
}
