// Template da mensagem de abordagem. Variáveis: {nome}, {categoria}, {cidade}, {presenca}.

import { frasePresenca } from "./presenca";
import type { Presenca } from "./tipos";

export const TEMPLATE_PADRAO =
  "Olá, {nome}! Tudo bem? Encontrei vocês no Google Maps procurando {categoria} em {cidade} e {presenca}. " +
  "Eu ajudo negócios como o de vocês a conquistar mais clientes pela internet. Posso te mostrar uma ideia rápida?";

export interface DadosMensagem {
  nome: string;
  categoria?: string | null;
  cidade?: string | null;
  presenca: Presenca;
}

export function renderizarMensagem(template: string, l: DadosMensagem): string {
  const vars: Record<string, string> = {
    nome: l.nome,
    categoria: (l.categoria ?? "negócios").toLowerCase(),
    cidade: l.cidade ?? "sua região",
    presenca: frasePresenca(l.presenca),
  };
  return template.replace(/\{(\w+)\}/g, (orig, k: string) => vars[k] ?? orig);
}
