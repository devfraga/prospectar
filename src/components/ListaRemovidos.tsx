"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { alterarLead } from "./api";
import { SeloPresenca } from "./Selos";

export interface LeadRemovido {
  id: string;
  nome: string;
  categoria: string | null;
  presenca: string;
  naoContatar: boolean;
  atualizadoEm: string;
}

export function ListaRemovidos({ leads }: { leads: LeadRemovido[] }) {
  const router = useRouter();
  const [salvando, setSalvando] = useState<string | null>(null);

  async function restaurar(l: LeadRemovido) {
    if (l.naoContatar && !confirm(`${l.nome} pediu para não ser contatado. Tem certeza que quer voltar com ele para o quadro?`)) return;
    setSalvando(l.id);
    try {
      await alterarLead(l.id, { status: "novo", naoContatar: false });
      router.refresh();
    } finally {
      setSalvando(null);
    }
  }

  if (!leads.length) return <p className="cartao px-4 py-12 text-center text-sm text-slate-500">Nenhum lead removido.</p>;

  return (
    <ul className="cartao divide-y divide-slate-100">
      {leads.map((l) => (
        <li key={l.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <Link href={`/leads/${l.id}`} className="text-sm font-medium text-slate-900 hover:text-marca-600">
              {l.nome}
            </Link>
            <div className="text-xs text-slate-500">
              {l.categoria} · removido em {new Date(l.atualizadoEm).toLocaleDateString("pt-BR")}
            </div>
          </div>
          <SeloPresenca presenca={l.presenca} />
          {l.naoContatar && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-800">Pediu para não contatar</span>}
          <button type="button" className="botao-sec" disabled={salvando === l.id} onClick={() => restaurar(l)}>
            <RotateCcw className="size-4" /> Voltar para o quadro
          </button>
        </li>
      ))}
    </ul>
  );
}
