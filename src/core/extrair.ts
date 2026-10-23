// Extração de e-mails, redes sociais e links de contato do HTML de um site.
// Só regex, sem navegador. Adaptado de scripts/scrape.py (extract_emails, contact_links, _find_socials).

import { hostDe, normalizarUrl } from "./presenca";

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const MAILTO_RE = /mailto:([^"'>\s?]+)/gi;
const HREF_RE = /<a\s[^>]*?href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

const EXT_LIXO = [".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".css", ".js"];
const DOMINIO_LIXO = [
  "example", "sentry", "wixpress", "wix.com", "godaddy", "squarespace", "wordpress",
  "domain.com", "email.com", "seudominio", "seuemail", "yourdomain", "schema.org", "w3.org",
];
const LOCAL_LIXO = new Set(["name", "email", "user", "you", "someone", "nome", "seuemail", "usuario"]);

/** E-mails do HTML, sem lixo, os do próprio domínio primeiro. Máximo 3. */
export function extrairEmails(html: string, site: string): string[] {
  const host = hostDe(site);
  const candidatos = [
    ...Array.from(html.matchAll(MAILTO_RE), (m) => m[1]),
    ...(html.match(EMAIL_RE) ?? []),
  ];
  const achados: string[] = [];
  for (const c of candidatos) {
    let e: string;
    try {
      e = decodeURIComponent(c).trim().toLowerCase();
    } catch {
      e = c.trim().toLowerCase();
    }
    const arroba = e.lastIndexOf("@");
    const local = e.slice(0, arroba);
    const dominio = e.slice(arroba + 1);
    const valido = new RegExp(`^${EMAIL_RE.source}$`).test(e);
    if (
      !valido ||
      EXT_LIXO.some((x) => e.endsWith(x)) ||
      LOCAL_LIXO.has(local) ||
      DOMINIO_LIXO.some((d) => dominio.includes(d)) ||
      achados.includes(e)
    ) {
      continue;
    }
    achados.push(e);
  }
  const doSite = (e: string) => !!host && (e.endsWith(`@${host}`) || e.endsWith(`.${host}`));
  return achados.sort((a, b) => Number(doSite(b)) - Number(doSite(a))).slice(0, 3);
}

const REDES = {
  instagram: /https?:\/\/(?:www\.)?instagram\.com\/([A-Za-z0-9_.]+)/gi,
  facebook: /https?:\/\/(?:www\.|m\.|web\.)?facebook\.com\/([A-Za-z0-9_.\-]+)/gi,
  linkedin: /https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/(?:company|in|school)\/([A-Za-z0-9_.\-%]+)/gi,
} as const;

// Caminhos que aparecem nos links mas não são perfis.
const HANDLE_LIXO = new Set([
  "", "home", "pages", "people", "help", "about", "policies", "policy", "legal", "tos", "privacy",
  "settings", "sharer", "sharer.php", "tr", "profile.php", "plugins", "dialog", "intent", "login",
  "share.php", "permalink.php", "p", "reel", "reels", "explore", "stories", "tv", "watch", "events",
  "groups", "marketplace", "gaming", "photo", "hashtag", "search",
]);

export interface Redes {
  instagram?: string;
  facebook?: string;
  linkedin?: string;
}

export function extrairRedes(html: string): Redes {
  const out: Redes = {};
  for (const [rede, re] of Object.entries(REDES) as Array<[keyof Redes, RegExp]>) {
    for (const m of html.matchAll(re)) {
      const handle = m[1].toLowerCase();
      if (HANDLE_LIXO.has(handle)) continue;
      if (rede === "facebook" && (/^\d+$/.test(handle) || handle.length < 3)) continue;
      out[rede] = m[0].replace(/["'/\\]+$/, "");
      break;
    }
  }
  return out;
}

const CONTATO_RE = /contato|contact|fale-conosco|fale conosco|sobre|about|quem-somos|quem somos/i;
const CAMINHOS_PADRAO = ["/contato", "/fale-conosco", "/sobre", "/contact"];

/** Até 3 links de contato/sobre do mesmo site: os encontrados no HTML primeiro, depois caminhos comuns. */
export function linksDeContato(html: string, site: string): string[] {
  const base = normalizarUrl(site);
  const host = hostDe(base);
  const out: string[] = [];
  for (const m of html.matchAll(HREF_RE)) {
    const [, href, texto] = m;
    if (!CONTATO_RE.test(`${href} ${texto}`)) continue;
    let url: string;
    try {
      const u = new URL(href.trim(), base);
      u.hash = "";
      url = u.toString();
    } catch {
      continue;
    }
    if (/^https?:/.test(url) && hostDe(url) === host && !out.includes(url)) out.push(url);
  }
  for (const caminho of CAMINHOS_PADRAO) {
    const url = new URL(caminho, base).toString();
    if (out.length < 3 && !out.includes(url)) out.push(url);
  }
  return out.slice(0, 3);
}
