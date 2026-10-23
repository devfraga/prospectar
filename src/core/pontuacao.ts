// Pontuação de 0 a 100 para priorizar quem abordar primeiro.
// Os pesos ficam na tabela Config e podem ser editados no painel (Configurações).

import type { Presenca } from "./tipos";

export interface Pesos {
  semSite: number;
  soRedeSocial: number;
  siteForaDoAr: number;
  comSite: number;
  celular: number;
  /** Negócio ativo: pelo menos `minAvaliacoes` avaliações. */
  avaliacoes: number;
  minAvaliacoes: number;
  /** Nota igual ou acima de `notaMinima`. */
  notaBoa: number;
  notaMinima: number;
  email: number;
}

export const PESOS_PADRAO: Pesos = {
  semSite: 35,
  soRedeSocial: 30,
  siteForaDoAr: 30,
  comSite: 0,
  celular: 20,
  avaliacoes: 15,
  minAvaliacoes: 20,
  notaBoa: 10,
  notaMinima: 4,
  email: 5,
};

export interface DadosPontuacao {
  presenca: Presenca;
  ehCelular: boolean;
  avaliacoes?: number | null;
  nota?: number | null;
  emails?: string | null;
  naoContatar?: boolean;
}

export function calcularPontuacao(l: DadosPontuacao, pesos: Pesos = PESOS_PADRAO): number {
  if (l.naoContatar) return 0;
  const porPresenca: Record<Presenca, number> = {
    sem_site: pesos.semSite,
    so_rede_social: pesos.soRedeSocial,
    site_fora_do_ar: pesos.siteForaDoAr,
    com_site: pesos.comSite,
  };
  let p = porPresenca[l.presenca];
  if (l.ehCelular) p += pesos.celular;
  if ((l.avaliacoes ?? 0) >= pesos.minAvaliacoes) p += pesos.avaliacoes;
  if ((l.nota ?? 0) >= pesos.notaMinima) p += pesos.notaBoa;
  if (l.emails) p += pesos.email;
  return Math.max(0, Math.min(100, Math.round(p)));
}
