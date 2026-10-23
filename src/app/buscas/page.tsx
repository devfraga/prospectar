import { connection } from "next/server";
import { NovaBusca } from "@/components/NovaBusca";
import { ProgressoBusca } from "@/components/ProgressoBusca";
import { listarBuscas } from "@/core/busca";
import { motorDisponivel } from "@/core/fontes/gosom";
import { placesConfigurado } from "@/core/fontes/places";

export default async function PaginaBuscas() {
  await connection();
  const [buscas, motorNoAr] = await Promise.all([listarBuscas(), motorDisponivel()]);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
      <div className="space-y-3">
        <NovaBusca motorNoAr={motorNoAr} placesConfigurado={placesConfigurado()} fontePadrao={process.env.FONTE_PADRAO || "gosom"} />
        <p className="px-1 text-xs leading-relaxed text-slate-500">
          A busca roda enquanto esta página estiver aberta (ou com <code className="font-mono">npm run cli -- sync</code>). Fechou? Ela continua de
          onde parou quando você voltar.
        </p>
      </div>
      <div className="space-y-3">
        <h2 className="font-semibold">Buscas</h2>
        {buscas.map((b) => (
          <ProgressoBusca key={b.id} inicial={b} />
        ))}
        {!buscas.length && <p className="text-sm text-slate-500">Nenhuma busca ainda.</p>}
      </div>
    </div>
  );
}
