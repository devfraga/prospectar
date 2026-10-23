// Configurações editáveis pelo painel, guardadas na tabela Config.

import { db } from "./db";
import { TEMPLATE_PADRAO } from "./mensagem";
import { calcularPontuacao, PESOS_PADRAO, type Pesos } from "./pontuacao";
import type { Presenca } from "./tipos";

async function ler<T>(chave: string): Promise<T | null> {
  const c = await db.config.findUnique({ where: { chave } });
  if (!c) return null;
  try {
    return JSON.parse(c.valor) as T;
  } catch {
    return null;
  }
}

async function gravar(chave: string, valor: unknown): Promise<void> {
  const v = JSON.stringify(valor);
  await db.config.upsert({ where: { chave }, create: { chave, valor: v }, update: { valor: v } });
}

export async function obterPesos(): Promise<Pesos> {
  return { ...PESOS_PADRAO, ...((await ler<Partial<Pesos>>("pesos")) ?? {}) };
}

export async function obterTemplate(): Promise<string> {
  return (await ler<string>("template")) || TEMPLATE_PADRAO;
}

export async function salvarTemplate(template: string): Promise<void> {
  await gravar("template", template);
}

/** Salva os pesos e recalcula a pontuação de todos os leads. */
export async function salvarPesos(pesos: Partial<Pesos>): Promise<number> {
  const completos = { ...PESOS_PADRAO, ...pesos };
  await gravar("pesos", completos);
  return recalcularPontuacoes(completos);
}

export async function recalcularPontuacoes(pesos?: Pesos): Promise<number> {
  const p = pesos ?? (await obterPesos());
  const leads = await db.lead.findMany({
    select: { id: true, presenca: true, ehCelular: true, avaliacoes: true, nota: true, emails: true, naoContatar: true, pontuacao: true },
  });
  let alterados = 0;
  for (const l of leads) {
    const pontuacao = calcularPontuacao({ ...l, presenca: l.presenca as Presenca }, p);
    if (pontuacao !== l.pontuacao) {
      await db.lead.update({ where: { id: l.id }, data: { pontuacao } });
      alterados++;
    }
  }
  return alterados;
}
