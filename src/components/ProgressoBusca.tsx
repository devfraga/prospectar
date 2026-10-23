"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import type { ResumoBusca } from "@/core/busca";
import { COBERTURAS } from "@/core/tipos";

const FINAL = new Set(["concluida", "falhou"]);
const ROTULO: Record<string, string> = {
  pendente: "Na fila",
  rodando: "Buscando no Maps",
  enriquecendo: "Verificando sites",
  concluida: "Concluída",
  falhou: "Falhou",
};

/** Enquanto a busca não termina, chama a API a cada 5 s. Cada chamada avança a busca um passo. */
export function ProgressoBusca({ inicial }: { inicial: ResumoBusca }) {
  const router = useRouter();
  const [r, setR] = useState(inicial);
  const ativo = useRef(true);

  useEffect(() => {
    ativo.current = true;
    if (FINAL.has(inicial.status)) return;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const res = await fetch(`/api/buscas/${inicial.id}`);
        if (res.ok) {
          const novo = (await res.json()) as ResumoBusca;
          if (!ativo.current) return;
          setR(novo);
          if (FINAL.has(novo.status)) return router.refresh();
        }
      } catch {
        // servidor reiniciando: tenta de novo
      }
      if (ativo.current) timer = setTimeout(tick, 5000);
    };
    tick();
    return () => {
      ativo.current = false;
      clearTimeout(timer);
    };
  }, [inicial.id, inicial.status, router]);

  const t = r.tarefas;
  const feitas = t.ok + t.falhou;
  const pct = r.status === "concluida" ? 100 : Math.round((feitas / Math.max(1, t.total)) * (r.status === "enriquecendo" ? 100 : 90));
  const cor = r.status === "falhou" ? "bg-rose-500" : r.status === "concluida" ? "bg-emerald-500" : "bg-marca-500";

  return (
    <div className="cartao p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-medium">
            {r.nicho} <span className="text-slate-500">em</span> {r.cidade}
          </div>
          <div className="text-xs text-slate-500">
            {new Date(r.criadoEm).toLocaleString("pt-BR")} · {r.fonte === "places" ? "Places API" : "motor local"} · cobertura {(COBERTURAS.find((c) => c.buscas === t.total)?.nome ?? "personalizada").toLowerCase()} ({t.total} {t.total === 1 ? "busca" : "buscas"})
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="flex items-center gap-1.5 text-slate-700">
            {!FINAL.has(r.status) && <LoaderCircle className="size-4 animate-spin text-marca-600" />}
            {ROTULO[r.status] ?? r.status}
          </span>
          <Link href={`/?buscaId=${r.id}`} className="botao-sec">
            {r.totalLeads} leads
          </Link>
        </div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full ${cor} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-2 text-xs text-slate-500">
        Buscas: {feitas}/{t.total}
        {t.falhou > 0 && <span className="text-rose-700"> ({t.falhou} falharam)</span>} · {r.novosLeads} novos
        {r.status === "enriquecendo" && <> · {r.aEnriquecer} sites a verificar</>}
      </div>
      {r.erro && <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">{r.erro}</p>}
    </div>
  );
}
