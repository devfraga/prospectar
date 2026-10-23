"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search, TriangleAlert } from "lucide-react";
import { COBERTURAS } from "@/core/tipos";

/** Desenho do mapa da cidade dividido em partes x partes. */
function MapaDividido({ partes, ativo }: { partes: number; ativo: boolean }) {
  return (
    <div
      className="mx-auto grid size-10 gap-0.5"
      style={{ gridTemplateColumns: `repeat(${partes}, minmax(0, 1fr))` }}
      aria-hidden
    >
      {Array.from({ length: partes * partes }, (_, i) => (
        <div key={i} className={`rounded-[2px] ${ativo ? "bg-marca-500" : "bg-slate-300"}`} />
      ))}
    </div>
  );
}

interface Props {
  motorNoAr: boolean;
  placesConfigurado: boolean;
  fontePadrao: string;
}

export function NovaBusca({ motorNoAr, placesConfigurado, fontePadrao }: Props) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [fonte, setFonte] = useState(fontePadrao);
  const [grade, setGrade] = useState(1);
  const [profundidade, setProfundidade] = useState(10);

  const grande = fonte === "gosom" && (grade >= 2 || profundidade >= 15);
  const coberturaAtual = COBERTURAS.find((c) => c.grade === grade) ?? COBERTURAS[0];

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setEnviando(true);
    setErro(null);
    setAviso(null);
    const dados = Object.fromEntries(new FormData(form));
    const r = await fetch("/api/buscas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados),
    });
    const corpo = await r.json();
    setEnviando(false);
    if (!r.ok) return setErro(corpo.erro ?? "Erro ao criar a busca");
    setAviso(corpo.aviso);
    (form.elements.namedItem("nicho") as HTMLInputElement).value = "";
    router.refresh();
  }

  return (
    <form onSubmit={enviar} className="cartao space-y-4 p-4">
      <h2 className="font-semibold">Nova busca</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="rotulo" htmlFor="nicho">Nicho</label>
          <input id="nicho" name="nicho" required className="campo" placeholder="barbearia, dentista, pet shop..." />
        </div>
        <div>
          <label className="rotulo" htmlFor="cidade">Cidade</label>
          <input id="cidade" name="cidade" required className="campo" placeholder="Campinas, SP" />
        </div>
      </div>
      <fieldset>
        <legend className="rotulo">Cobertura da cidade</legend>
        <div className="grid grid-cols-2 gap-2">
          {COBERTURAS.map((c) => (
            <label
              key={c.grade}
              className={`cursor-pointer rounded-md border p-2.5 text-center ${grade === c.grade ? "border-marca-600 bg-marca-50 ring-1 ring-marca-600" : "border-slate-300 bg-white hover:bg-slate-50"}`}
            >
              <input type="radio" name="grade" value={c.grade} checked={grade === c.grade} onChange={() => setGrade(c.grade)} className="sr-only" />
              <MapaDividido partes={c.grade} ativo={grade === c.grade} />
              <div className="mt-1.5 text-sm font-medium text-slate-900">{c.nome}</div>
              <div className="text-xs text-slate-600">{c.buscas} {c.buscas === 1 ? "busca" : "buscas"}</div>
              <div className="text-xs text-slate-500">até ~{c.ate.toLocaleString("pt-BR")} negócios</div>
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-slate-600">
          O Google Maps mostra no máximo ~120 negócios por busca. A cobertura divide o mapa da cidade em partes e faz uma busca em cada uma,
          juntando tudo sem repetidos. <strong className="font-medium text-slate-800">{coberturaAtual.nome}</strong>: indicada para {coberturaAtual.indicada}.
          {grade > 1 && " Encontra mais negócios, mas a busca demora mais e aumenta o risco de bloqueio do Google."}
        </p>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="rotulo" htmlFor="fonte">Fonte</label>
          <select id="fonte" name="fonte" className="campo" value={fonte} onChange={(e) => setFonte(e.target.value)}>
            <option value="gosom">Motor local (grátis)</option>
            <option value="places" disabled={!placesConfigurado}>
              Places API (paga){placesConfigurado ? "" : " · sem chave"}
            </option>
          </select>
        </div>
        <div>
          <label className="rotulo" htmlFor="profundidade">Profundidade</label>
          <input
            id="profundidade"
            name="profundidade"
            type="number"
            min={1}
            max={30}
            className="campo"
            value={profundidade}
            onChange={(e) => setProfundidade(Number(e.target.value))}
            disabled={fonte === "places"}
          />
          <p className="mt-1 text-xs text-slate-500">Quanto rolar a lista em cada busca. 10 traz até ~120.</p>
        </div>
        {grade === 1 && (
          <div>
            <label className="rotulo" htmlFor="raio">Raio da busca (metros)</label>
            <input id="raio" name="raio" type="number" min={1000} max={50000} step={1000} defaultValue={10000} className="campo" />
          </div>
        )}
      </div>
      {fonte === "gosom" && (
        <details className="text-sm">
          <summary className="cursor-pointer text-slate-600">Proxies (opcional)</summary>
          <textarea
            name="proxies"
            rows={2}
            className="campo mt-2 font-mono text-xs"
            placeholder={"socks5://usuario:senha@host:porta\nhttp://host2:porta"}
          />
          <p className="mt-1 text-xs text-slate-500">Vazio usa PROXIES do .env. Um por linha.</p>
        </details>
      )}

      {fonte === "gosom" && !motorNoAr && (
        <p className="flex items-center gap-2 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">
          <TriangleAlert className="size-4" /> Motor fora do ar. Rode <code className="font-mono">docker compose up -d</code>.
        </p>
      )}
      {grande && (
        <p className="flex items-center gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <TriangleAlert className="size-4 shrink-0" /> Busca grande: sem proxy, buscas grandes seguidas podem bloquear seu IP no Google por algumas horas.
        </p>
      )}
      {erro && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">{erro}</p>}
      {aviso && !grande && <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{aviso}</p>}

      <button className="botao" disabled={enviando || (fonte === "gosom" && !motorNoAr)}>
        <Search className="size-4" /> {enviando ? "Criando..." : "Buscar"}
      </button>
    </form>
  );
}
