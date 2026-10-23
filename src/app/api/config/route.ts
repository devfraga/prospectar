import { obterPesos, obterTemplate, salvarPesos, salvarTemplate } from "@/core/config";
import { PESOS_PADRAO, type Pesos } from "@/core/pontuacao";

export async function GET() {
  return Response.json({ template: await obterTemplate(), pesos: await obterPesos() });
}

export async function PUT(req: Request) {
  const corpo = (await req.json()) as { template?: string; pesos?: Partial<Record<keyof Pesos, unknown>> };
  if (typeof corpo.template === "string") await salvarTemplate(corpo.template.trim());
  let recalculados = 0;
  if (corpo.pesos) {
    const pesos: Partial<Pesos> = {};
    for (const k of Object.keys(PESOS_PADRAO) as Array<keyof Pesos>) {
      const v = Number(corpo.pesos[k]);
      if (Number.isFinite(v)) pesos[k] = v;
    }
    recalculados = await salvarPesos(pesos);
  }
  return Response.json({ ok: true, recalculados });
}
