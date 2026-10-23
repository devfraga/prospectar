"use client";

import { useState } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";

/** No celular mostra só um botão que abre o conteúdo; a partir de `md` mostra sempre. */
export function Recolhivel({ titulo, ativos = 0, children }: { titulo: string; ativos?: number; children: React.ReactNode }) {
  const [aberto, setAberto] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        className="botao-sec w-full justify-between md:hidden"
      >
        <span className="flex items-center gap-2">
          <SlidersHorizontal className="size-4" />
          {titulo}
          {ativos > 0 && <span className="rounded-full bg-marca-600 px-1.5 text-xs text-white">{ativos}</span>}
        </span>
        <ChevronDown className={`size-4 transition-transform ${aberto ? "rotate-180" : ""}`} />
      </button>
      <div className={`${aberto ? "mt-2 block" : "hidden"} md:mt-0 md:block`}>{children}</div>
    </div>
  );
}
