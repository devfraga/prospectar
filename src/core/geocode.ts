// Cidade -> coordenadas e bbox, pelo Nominatim (OpenStreetMap). Gratuito e sem chave.
// Regras de uso: no máximo 1 requisição por segundo e User-Agent que identifique o app.

import type { Bbox } from "./grade";

export const USER_AGENT = "prospectar/0.1 (template de prospeccao via Google Maps)";

export interface Local {
  lat: number;
  lon: number;
  bbox: Bbox;
  nome: string;
}

let ultimaChamada = 0;

export async function geocodificar(lugar: string): Promise<Local | null> {
  const espera = ultimaChamada + 1100 - Date.now();
  if (espera > 0) await new Promise((r) => setTimeout(r, espera));
  ultimaChamada = Date.now();

  const q = new URLSearchParams({ format: "json", limit: "1", q: lugar, "accept-language": "pt-BR" });
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${q}`, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Nominatim respondeu HTTP ${res.status}`);
  const hits = (await res.json()) as Array<{ lat: string; lon: string; boundingbox: string[]; display_name: string }>;
  if (!hits.length) return null;
  const h = hits[0];
  return {
    lat: Number(h.lat),
    lon: Number(h.lon),
    bbox: h.boundingbox.map(Number) as Bbox,
    nome: h.display_name,
  };
}
