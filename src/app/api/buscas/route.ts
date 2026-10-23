import { avisoVolume, criarBusca, listarBuscas, type NovaBusca } from "@/core/busca";
import { motorDisponivel } from "@/core/fontes/gosom";
import { placesConfigurado } from "@/core/fontes/places";
import type { Fonte } from "@/core/tipos";

export async function GET() {
  return Response.json(await listarBuscas());
}

export async function POST(req: Request) {
  const corpo = (await req.json()) as Partial<NovaBusca> & { proxies?: string | string[] };
  const fonte = (corpo.fonte ?? process.env.FONTE_PADRAO ?? "gosom") as Fonte;

  if (fonte === "gosom" && !(await motorDisponivel())) {
    return Response.json({ erro: 'Motor fora do ar. Rode "docker compose up -d" e tente de novo.' }, { status: 503 });
  }
  if (fonte === "places" && !placesConfigurado()) {
    return Response.json({ erro: "Configure GOOGLE_PLACES_API_KEY no .env para usar a Places API." }, { status: 400 });
  }

  const proxies = (Array.isArray(corpo.proxies) ? corpo.proxies : (corpo.proxies ?? "").split(/[\n,]/))
    .map((p) => p.trim())
    .filter(Boolean);
  const nova: NovaBusca = {
    nicho: String(corpo.nicho ?? ""),
    cidade: String(corpo.cidade ?? ""),
    fonte,
    profundidade: corpo.profundidade ? Number(corpo.profundidade) : undefined,
    grade: corpo.grade ? Number(corpo.grade) : undefined,
    raio: corpo.raio ? Number(corpo.raio) : undefined,
    proxies,
  };
  try {
    const busca = await criarBusca(nova);
    return Response.json({ id: busca.id, aviso: avisoVolume(nova) }, { status: 201 });
  } catch (e) {
    return Response.json({ erro: (e as Error).message }, { status: 400 });
  }
}
