"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { STATUS_LEAD, STATUS_LEAD_ROTULO } from "@/core/tipos";
import { alterarLead } from "./api";

interface Props {
  id: string;
  status: string;
  notas: string | null;
  mensagem: string | null;
  /** Template preenchido, mostrado quando não há mensagem personalizada. */
  mensagemTemplate: string;
}

export function FormLead({ id, status, notas, mensagem, mensagemTemplate }: Props) {
  const router = useRouter();
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setSalvando(true);
    setErro(null);
    try {
      const msg = String(f.get("mensagem") ?? "").trim();
      await alterarLead(id, {
        status: f.get("status"),
        notas: f.get("notas"),
        // Igual ao template = sem mensagem personalizada.
        mensagem: msg && msg !== mensagemTemplate ? msg : null,
      });
      setSalvo(true);
      setTimeout(() => setSalvo(false), 1500);
      router.refresh();
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={salvar} className="cartao space-y-4 p-4">
      <div>
        <label className="rotulo" htmlFor="status">Status</label>
        <select id="status" name="status" defaultValue={status} className="campo">
          {STATUS_LEAD.map((s) => (
            <option key={s} value={s}>{STATUS_LEAD_ROTULO[s]}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="rotulo" htmlFor="mensagem">
          Mensagem de abordagem {mensagem ? "(personalizada)" : "(do template)"}
        </label>
        <textarea id="mensagem" name="mensagem" rows={6} defaultValue={mensagem ?? mensagemTemplate} className="campo" />
        <p className="mt-1 text-xs text-slate-500">
          Gere mensagens personalizadas com o Claude Code: <code className="font-mono">/prospectar-mensagens</code>
        </p>
      </div>
      <div>
        <label className="rotulo" htmlFor="notas">Notas</label>
        <textarea id="notas" name="notas" rows={4} defaultValue={notas ?? ""} className="campo" placeholder="Falei com o dono, retornar na sexta..." />
      </div>
      {erro && <p className="text-sm text-rose-700">{erro}</p>}
      <button className="botao" disabled={salvando}>{salvo ? "Salvo!" : salvando ? "Salvando..." : "Salvar"}</button>
    </form>
  );
}
