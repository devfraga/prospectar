"use client";

import { useState } from "react";
import type { Pesos } from "@/core/pontuacao";

const CAMPOS: Array<[keyof Pesos, string]> = [
  ["semSite", "Sem site"],
  ["soRedeSocial", "Só rede social"],
  ["siteForaDoAr", "Site fora do ar"],
  ["comSite", "Com site"],
  ["celular", "Tem WhatsApp (celular)"],
  ["avaliacoes", "Negócio ativo (avaliações)"],
  ["minAvaliacoes", "…a partir de quantas avaliações"],
  ["notaBoa", "Nota boa"],
  ["notaMinima", "…a partir de qual nota"],
  ["email", "Tem e-mail"],
];

export function FormConfig({ template, pesos, padrao }: { template: string; pesos: Pesos; padrao: { template: string; pesos: Pesos } }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setSalvando(true);
    const r = await fetch("/api/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        template: f.get("template"),
        pesos: Object.fromEntries(CAMPOS.map(([k]) => [k, f.get(k)])),
      }),
    });
    const corpo = await r.json();
    setSalvando(false);
    setMsg(r.ok ? `Salvo. ${corpo.recalculados} lead(s) com pontuação recalculada.` : "Erro ao salvar.");
  }

  function restaurar() {
    const form = document.getElementById("form-config") as HTMLFormElement;
    (form.elements.namedItem("template") as HTMLTextAreaElement).value = padrao.template;
    for (const [k] of CAMPOS) (form.elements.namedItem(k) as HTMLInputElement).value = String(padrao.pesos[k]);
  }

  return (
    <form id="form-config" onSubmit={salvar} className="space-y-6">
      <section className="cartao space-y-2 p-4">
        <h2 className="font-semibold">Mensagem padrão do WhatsApp</h2>
        <p className="text-xs text-slate-500">
          Variáveis: <code>{"{nome}"}</code> <code>{"{categoria}"}</code> <code>{"{cidade}"}</code> <code>{"{presenca}"}</code>. Leads com mensagem personalizada
          (gerada pelo Claude Code ou editada à mão) usam a deles.
        </p>
        <textarea name="template" rows={5} defaultValue={template} className="campo" />
      </section>

      <section className="cartao space-y-3 p-4">
        <h2 className="font-semibold">Pesos da pontuação</h2>
        <p className="text-xs text-slate-500">A pontuação soma os pesos que o lead atende, de 0 a 100. Maior pontuação aparece primeiro.</p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {CAMPOS.map(([k, rotulo]) => (
            <div key={k}>
              <label className="rotulo" htmlFor={k}>{rotulo}</label>
              <input id={k} name={k} type="number" step="any" defaultValue={pesos[k]} className="campo" />
            </div>
          ))}
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button className="botao" disabled={salvando}>{salvando ? "Salvando..." : "Salvar"}</button>
        <button type="button" className="botao-sec" onClick={restaurar}>Restaurar padrão</button>
        {msg && <span className="text-sm text-slate-600">{msg}</span>}
      </div>
    </form>
  );
}
