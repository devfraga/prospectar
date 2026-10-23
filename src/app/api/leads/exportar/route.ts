import { exportarCsv, filtrosDeParams } from "@/core/leads";

export async function GET(req: Request) {
  const csv = await exportarCsv(filtrosDeParams(new URL(req.url).searchParams));
  const nome = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nome}"`,
    },
  });
}
