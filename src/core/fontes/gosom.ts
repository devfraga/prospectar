// Cliente do motor gosom/google-maps-scraper rodando no Docker (docker-compose.yml).
// Fluxo: POST /api/v1/jobs -> GET /api/v1/jobs/{id} até Status "ok" -> GET /api/v1/jobs/{id}/download (CSV).

import { parse } from "csv-parse/sync";
import type { LugarBruto } from "../tipos";

const motorUrl = () => (process.env.MOTOR_URL || "http://localhost:8080").replace(/\/$/, "");

export type StatusJob = "pending" | "working" | "ok" | "failed";

export interface ParametrosJob {
  palavras: string[];
  lat: number;
  lon: number;
  zoom: number;
  /** metros */
  raio: number;
  profundidade: number;
  /** segundos */
  tempoMaximo: number;
  proxies?: string[];
}

export class MotorIndisponivel extends Error {
  constructor(causa?: unknown) {
    super(`Motor de busca fora do ar em ${motorUrl()}. Rode "docker compose up -d" e tente de novo.`);
    this.name = "MotorIndisponivel";
    this.cause = causa;
  }
}

async function chamar(caminho: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(motorUrl() + caminho, { ...init, signal: AbortSignal.timeout(60_000) });
  } catch (e) {
    throw new MotorIndisponivel(e);
  }
}

export async function motorDisponivel(): Promise<boolean> {
  try {
    const r = await fetch(`${motorUrl()}/api/v1/jobs`, { signal: AbortSignal.timeout(5_000) });
    return r.ok;
  } catch {
    return false;
  }
}

export async function criarJob(p: ParametrosJob): Promise<string> {
  const corpo = {
    name: "prospectar",
    keywords: p.palavras,
    lang: "pt",
    zoom: p.zoom,
    lat: String(p.lat),
    lon: String(p.lon),
    radius: p.raio,
    depth: p.profundidade,
    fast_mode: false,
    // E-mails, redes e status do site ficam com o nosso enriquecimento (src/core/enriquecer.ts).
    email: false,
    max_time: p.tempoMaximo,
    ...(p.proxies?.length ? { proxies: p.proxies } : {}),
  };
  const r = await chamar("/api/v1/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(`Motor recusou o job (HTTP ${r.status}): ${texto.slice(0, 200)}`);
  const id = (JSON.parse(texto) as { id?: string }).id;
  if (!id) throw new Error("Motor não devolveu o id do job.");
  return id;
}

export async function statusJob(id: string): Promise<StatusJob> {
  const r = await chamar(`/api/v1/jobs/${id}`);
  if (r.status === 404) return "failed";
  if (!r.ok) throw new Error(`Motor respondeu HTTP ${r.status} ao consultar o job.`);
  const job = (await r.json()) as { Status?: string };
  return (job.Status ?? "pending") as StatusJob;
}

export async function apagarJob(id: string): Promise<void> {
  await chamar(`/api/v1/jobs/${id}`, { method: "DELETE" }).catch(() => undefined);
}

const num = (v: string | undefined) => {
  if (!v) return undefined;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
};

/** Converte uma linha do CSV do motor (34 colunas) para LugarBruto. */
export function linhaParaLugar(r: Record<string, string>): LugarBruto | null {
  const placeId = r.place_id || r.cid || r.link;
  if (!placeId || !r.title) return null;
  const nome = r.title.trim();
  // O motor às vezes devolve o endereço como "Nome do Negócio - Rua X, 123".
  const endereco = r.address?.startsWith(`${nome} - `) ? r.address.slice(nome.length + 3) : r.address;
  return {
    placeId,
    nome,
    categoria: r.category || undefined,
    endereco: endereco || undefined,
    lat: num(r.latitude),
    lon: num(r.longitude),
    linkMaps: r.link || undefined,
    telefone: r.phone || undefined,
    website: r.website || undefined,
    emails: r.emails || undefined,
    nota: num(r.review_rating),
    avaliacoes: num(r.review_count),
    ativo: !/permanently closed|fechado permanentemente/i.test(r.status ?? ""),
  };
}

export function lerCsv(csv: string): LugarBruto[] {
  const linhas = parse(csv, { columns: true, skip_empty_lines: true, relax_column_count: true, bom: true }) as Array<
    Record<string, string>
  >;
  return linhas.map(linhaParaLugar).filter((l): l is LugarBruto => l !== null);
}

export async function baixarResultado(id: string): Promise<LugarBruto[]> {
  const r = await chamar(`/api/v1/jobs/${id}/download`);
  if (!r.ok) throw new Error(`Não consegui baixar o resultado do job (HTTP ${r.status}).`);
  return lerCsv(await r.text());
}
