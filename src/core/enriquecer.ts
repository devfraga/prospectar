// Visita o site de cada lead (sem navegador, só HTTP) para descobrir:
// se está no ar, se tem https, e-mails e redes sociais. Não acessa o Google.

import { extrairEmails, extrairRedes, linksDeContato, type Redes } from "./extrair";
import { dominioRegistravel, hostDe, normalizarUrl } from "./presenca";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";
const LIMITE_BYTES = 400_000;

type Pagina = { ok: boolean; status: number; urlFinal: string; html: string } | { erro: string };

async function baixar(url: string, timeoutMs: number): Promise<Pagina> {
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml", "Accept-Language": "pt-BR,pt;q=0.9" },
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
    });
    let html = "";
    if ((r.headers.get("content-type") ?? "").includes("html")) {
      html = (await r.text()).slice(0, LIMITE_BYTES);
    } else {
      await r.body?.cancel();
    }
    return { ok: r.ok, status: r.status, urlFinal: r.url || url, html };
  } catch (e) {
    const err = e as Error & { cause?: { code?: string } };
    if (err.name === "TimeoutError") return { erro: "timeout" };
    return { erro: err.cause?.code ?? err.message };
  }
}

export interface AnaliseSite {
  online: boolean;
  https: boolean;
  /** Motivo quando está fora do ar, ou observação (ex.: sem https). */
  nota: string | null;
  emails: string[];
  redes: Redes;
}

function motivoErro(erro: string): string {
  if (erro === "ENOTFOUND") return "O domínio não existe mais (provavelmente expirou)";
  if (erro === "timeout") return "O site não respondeu";
  if (erro === "ECONNREFUSED") return "O servidor do site recusou a conexão";
  return `O site não abriu (${erro})`;
}

const FORA = (nota: string): AnaliseSite => ({ online: false, https: false, nota, emails: [], redes: {} });

/**
 * Fora do ar = erro de rede, 404/410, 5xx, ou o domínio redireciona para OUTRO site
 * (domínio expirado e comprado por terceiros é comum). 403 de proteção anti-bot conta como no ar.
 */
export async function analisarSite(website: string, timeoutMs = 8000): Promise<AnaliseSite> {
  const url = normalizarUrl(website);
  let pag = await baixar(url, timeoutMs);
  // Site lento: mais uma chance, com o dobro do tempo.
  if ("erro" in pag && pag.erro === "timeout") pag = await baixar(url, timeoutMs * 2);
  // Certificado quebrado é comum em site pequeno: tenta por http.
  if ("erro" in pag && url.startsWith("https://")) {
    const http = await baixar(url.replace(/^https:/, "http:"), timeoutMs);
    if (!("erro" in http)) pag = http;
  }

  if ("erro" in pag) return FORA(motivoErro(pag.erro));
  if (pag.status >= 500) return FORA(`O site está com erro (HTTP ${pag.status})`);
  if (pag.status === 404 || pag.status === 410) return FORA("A página inicial do site não existe (HTTP 404)");

  const destino = hostDe(pag.urlFinal);
  if (dominioRegistravel(destino) !== dominioRegistravel(hostDe(url))) {
    return FORA(`O domínio redireciona para outro site (${destino})`);
  }

  const https = pag.urlFinal.startsWith("https://");
  let emails = extrairEmails(pag.html, website);
  const redes = extrairRedes(pag.html);
  if (!emails.length && pag.html) {
    const paginas = await Promise.all(linksDeContato(pag.html, pag.urlFinal).map((u) => baixar(u, timeoutMs)));
    const html = paginas.map((p) => ("erro" in p || !p.ok ? "" : p.html)).join("\n");
    emails = extrairEmails(html, website);
    Object.assign(redes, { ...extrairRedes(html), ...redes });
  }
  return { online: true, https, nota: https ? null : "O site não usa https (aparece como \"não seguro\")", emails, redes };
}

/** Executa `fn` em `itens` com no máximo `limite` ao mesmo tempo. */
export async function emParalelo<T, R>(itens: T[], limite: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const resultados: R[] = new Array(itens.length);
  let proximo = 0;
  const trabalhadores = Array.from({ length: Math.min(limite, itens.length) }, async () => {
    while (proximo < itens.length) {
      const i = proximo++;
      resultados[i] = await fn(itens[i]);
    }
  });
  await Promise.all(trabalhadores);
  return resultados;
}
