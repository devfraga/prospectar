// Google Places API (New): Text Search. Oficial e sem risco de bloqueio, mas paga por requisição.
// Até 20 resultados por página e 3 páginas (60) por busca. Telefone, site e nota caem no SKU "Enterprise".
// Docs: https://developers.google.com/maps/documentation/places/web-service/text-search

import type { LugarBruto } from "../tipos";

const CAMPOS = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.googleMapsUri",
  "places.primaryTypeDisplayName",
  "places.businessStatus",
  "places.internationalPhoneNumber",
  "places.nationalPhoneNumber",
  "places.websiteUri",
  "places.rating",
  "places.userRatingCount",
  "nextPageToken",
].join(",");

interface PlaceApi {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  googleMapsUri?: string;
  primaryTypeDisplayName?: { text: string };
  businessStatus?: string;
  internationalPhoneNumber?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
}

export interface ParametrosPlaces {
  texto: string;
  lat: number;
  lon: number;
  /** metros (a API aceita até 50 000) */
  raio: number;
  paginas?: number;
}

export function placesConfigurado(): boolean {
  return !!process.env.GOOGLE_PLACES_API_KEY;
}

export function placeParaLugar(p: PlaceApi): LugarBruto | null {
  if (!p.id || !p.displayName?.text) return null;
  return {
    placeId: p.id,
    nome: p.displayName.text,
    categoria: p.primaryTypeDisplayName?.text,
    endereco: p.formattedAddress,
    lat: p.location?.latitude,
    lon: p.location?.longitude,
    linkMaps: p.googleMapsUri,
    telefone: p.internationalPhoneNumber ?? p.nationalPhoneNumber,
    website: p.websiteUri,
    nota: p.rating,
    avaliacoes: p.userRatingCount,
    ativo: p.businessStatus !== "CLOSED_PERMANENTLY",
  };
}

export async function buscarPlaces(p: ParametrosPlaces): Promise<LugarBruto[]> {
  const chave = process.env.GOOGLE_PLACES_API_KEY;
  if (!chave) throw new Error("GOOGLE_PLACES_API_KEY não configurada no .env (necessária para a fonte \"places\").");

  const lugares: LugarBruto[] = [];
  let pageToken: string | undefined;
  for (let pagina = 0; pagina < (p.paginas ?? 3); pagina++) {
    const corpo = {
      textQuery: p.texto,
      languageCode: "pt-BR",
      regionCode: "BR",
      pageSize: 20,
      locationBias: {
        circle: { center: { latitude: p.lat, longitude: p.lon }, radius: Math.min(50_000, p.raio) },
      },
      ...(pageToken ? { pageToken } : {}),
    };
    const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": chave, "X-Goog-FieldMask": CAMPOS },
      body: JSON.stringify(corpo),
      signal: AbortSignal.timeout(30_000),
    });
    if (!r.ok) {
      const erro = await r.text();
      throw new Error(`Places API respondeu HTTP ${r.status}: ${erro.slice(0, 300)}`);
    }
    const dados = (await r.json()) as { places?: PlaceApi[]; nextPageToken?: string };
    for (const place of dados.places ?? []) {
      const l = placeParaLugar(place);
      if (l) lugares.push(l);
    }
    pageToken = dados.nextPageToken;
    if (!pageToken) break;
  }
  return lugares;
}
