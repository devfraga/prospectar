import { filtrosDeParams, listarLeads } from "@/core/leads";

export async function GET(req: Request) {
  const filtros = filtrosDeParams(new URL(req.url).searchParams);
  return Response.json(await listarLeads(filtros));
}
