// Classificação da presença web a partir do campo "website" do Google Maps.
// O Maps muitas vezes coloca um Instagram ou Facebook no lugar do site: isso NÃO é site próprio.

import type { Presenca } from "./tipos";

export type RedeSocial = "instagram" | "facebook" | "linkedin";

// Domínios que não são site próprio: redes sociais, agregadores de links e plataformas.
const NAO_E_SITE: Array<{ dominio: string; rede?: RedeSocial }> = [
  { dominio: "instagram.com", rede: "instagram" },
  { dominio: "facebook.com", rede: "facebook" },
  { dominio: "fb.com", rede: "facebook" },
  { dominio: "fb.me", rede: "facebook" },
  { dominio: "linkedin.com", rede: "linkedin" },
  { dominio: "wa.me" },
  { dominio: "whatsapp.com" },
  { dominio: "linktr.ee" },
  { dominio: "linkin.bio" },
  { dominio: "beacons.ai" },
  { dominio: "bio.site" },
  { dominio: "taplink.cc" },
  { dominio: "tiktok.com" },
  { dominio: "twitter.com" },
  { dominio: "x.com" },
  { dominio: "youtube.com" },
  { dominio: "ifood.com.br" },
  { dominio: "goo.gl" },
  { dominio: "g.page" },
  { dominio: "business.google.com" },
  // Plataformas de agendamento e cardápio: página dentro do sistema de outra empresa.
  { dominio: "trinks.com" },
  { dominio: "booksy.com" },
  { dominio: "cashbarber.com.br" },
  { dominio: "appbarber.com.br" },
  { dominio: "goomer.app" },
  { dominio: "anota.ai" },
];

// Sufixos de segundo nível: em "loja.com.br" o domínio registrável é "loja.com.br", não "com.br".
const SEGUNDO_NIVEL = new Set(["com", "net", "org", "adv", "med", "eng", "art", "blog", "eco", "edu", "gov", "ind", "inf", "odo", "psi", "co"]);

/** "www.loja.com.br" -> "loja.com.br"; "app.exemplo.com" -> "exemplo.com". */
export function dominioRegistravel(host: string): string {
  const partes = host.toLowerCase().split(".").filter(Boolean);
  if (partes.length <= 2) return partes.join(".");
  const n = SEGUNDO_NIVEL.has(partes[partes.length - 2]) && partes[partes.length - 1].length === 2 ? 3 : 2;
  return partes.slice(-n).join(".");
}

// Sites gratuitos do Google Meu Negócio: o Google desligou todos em 2024, então o link está morto.
const SITE_DESLIGADO = ["business.site", "negocio.site"];

export function normalizarUrl(url: string): string {
  const u = url.trim();
  return /^https?:\/\//i.test(u) ? u : `http://${u}`;
}

export function hostDe(url: string): string {
  try {
    const h = new URL(normalizarUrl(url)).hostname.toLowerCase();
    return h.startsWith("www.") ? h.slice(4) : h;
  } catch {
    return "";
  }
}

function casaDominio(host: string, dominio: string): boolean {
  return host === dominio || host.endsWith(`.${dominio}`);
}

export interface ClassificacaoSite {
  presenca: Presenca;
  /** Quando o "site" é na verdade um perfil de rede social. */
  rede?: RedeSocial;
  /** Motivo, quando já dá para saber sem acessar o site. */
  nota?: string;
}

/** Classificação inicial, sem acessar a internet. O enriquecimento pode trocar com_site por site_fora_do_ar. */
export function classificarWebsite(website: string | null | undefined): ClassificacaoSite {
  if (!website || !website.trim()) return { presenca: "sem_site" };
  const host = hostDe(website);
  if (!host) return { presenca: "sem_site" };
  if (SITE_DESLIGADO.some((d) => casaDominio(host, d))) {
    return { presenca: "site_fora_do_ar", nota: "Site gratuito do Google Meu Negócio, desligado pelo Google em 2024" };
  }
  const social = NAO_E_SITE.find((s) => casaDominio(host, s.dominio));
  if (social) return { presenca: "so_rede_social", rede: social.rede };
  return { presenca: "com_site" };
}

/** Frase usada no template de mensagem ({presenca}). */
export function frasePresenca(presenca: Presenca): string {
  switch (presenca) {
    case "sem_site":
      return "notei que vocês ainda não têm um site";
    case "so_rede_social":
      return "vi que vocês divulgam pelas redes sociais, mas ainda não têm um site próprio";
    case "site_fora_do_ar":
      return "tentei acessar o site de vocês e ele parece estar fora do ar";
    case "com_site":
      return "dei uma olhada no site de vocês";
  }
}
