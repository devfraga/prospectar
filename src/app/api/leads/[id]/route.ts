import { atualizarLead, obterLead, type AlteracaoLead } from "@/core/leads";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const lead = await obterLead((await params).id);
  return lead ? Response.json(lead) : Response.json({ erro: "Lead não encontrado." }, { status: 404 });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const corpo = (await req.json()) as Record<string, unknown>;
  const alteracao: AlteracaoLead = {};
  if (typeof corpo.status === "string") alteracao.status = corpo.status as AlteracaoLead["status"];
  if ("notas" in corpo) alteracao.notas = typeof corpo.notas === "string" ? corpo.notas : null;
  if ("mensagem" in corpo) alteracao.mensagem = typeof corpo.mensagem === "string" ? corpo.mensagem : null;
  if (typeof corpo.naoContatar === "boolean") alteracao.naoContatar = corpo.naoContatar;
  try {
    return Response.json(await atualizarLead((await params).id, alteracao));
  } catch (e) {
    return Response.json({ erro: (e as Error).message }, { status: 400 });
  }
}
