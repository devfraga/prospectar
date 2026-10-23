// Divide a cidade em N x N células para passar do limite de ~120 resultados por busca do Google Maps.
// Adaptado de scripts/scrape.py (grid_cells, in_bbox) do google-maps-scraper-kit.

/** [sul, norte, oeste, leste], no formato do Nominatim. */
export type Bbox = [number, number, number, number];

export interface Celula {
  lat: number;
  lon: number;
  /** metros */
  raio: number;
  zoom: number;
}

const M_POR_GRAU = (6371000 * Math.PI) / 180;

/**
 * raio = 1,15 x metade da diagonal da célula (mínimo 1000 m).
 * zoom = o zoom do Maps em que uma tela de ~1000 px cobre a largura da célula (11 a 17).
 */
export function celulasDaGrade(bbox: Bbox, n: number): Celula[] {
  const [s, nn, w, e] = bbox;
  const dlat = (nn - s) / n;
  const dlon = (e - w) / n;
  const celulas: Celula[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const lat = s + (i + 0.5) * dlat;
      const lon = w + (j + 0.5) * dlon;
      const cos = Math.cos((lat * Math.PI) / 180);
      const largura = Math.max(1, dlon * M_POR_GRAU * cos);
      const diagonal = Math.hypot(dlat * M_POR_GRAU, largura);
      const zoom = Math.round(Math.log2((156543.03 * cos * 1000) / largura));
      celulas.push({
        lat: Number(lat.toFixed(6)),
        lon: Number(lon.toFixed(6)),
        raio: Math.max(1000, Math.ceil((1.15 * diagonal) / 2)),
        zoom: Math.min(17, Math.max(11, zoom)),
      });
    }
  }
  return celulas;
}

/** Dentro do bbox aumentado em `margem` de cada lado. Sem coordenadas: mantém. */
export function dentroDoBbox(lat: number | undefined, lon: number | undefined, bbox: Bbox, margem = 0.1): boolean {
  if (lat == null || lon == null || Number.isNaN(lat) || Number.isNaN(lon)) return true;
  const [s, n, w, e] = bbox;
  const my = (n - s) * margem;
  const mx = (e - w) * margem;
  return lat >= s - my && lat <= n + my && lon >= w - mx && lon <= e + mx;
}
