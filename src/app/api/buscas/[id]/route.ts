import { avancarBusca } from "@/core/busca";
import { db } from "@/core/db";

type Ctx = { params: Promise<{ id: string }> };

/** Cada GET dá um passo na busca (inicia célula, importa, enriquece) e devolve o andamento. */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    return Response.json(await avancarBusca((await params).id));
  } catch (e) {
    return Response.json({ erro: (e as Error).message }, { status: 404 });
  }
}

/** Apaga a busca. Os leads continuam no banco. */
export async function DELETE(_req: Request, { params }: Ctx) {
  await db.busca.delete({ where: { id: (await params).id } }).catch(() => undefined);
  return new Response(null, { status: 204 });
}
