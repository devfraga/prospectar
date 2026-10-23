"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Ban, Check, ChevronLeft, ChevronRight, Copy, MapPin, MessageCircle, Star, Trash2 } from "lucide-react";
import { COLUNA_ROTULO, COLUNAS_KANBAN, type ColunaKanban } from "@/core/tipos";
import { alterarLead } from "./api";
import { Pontuacao, SeloPresenca } from "./Selos";

export interface CartaoLead {
  id: string;
  nome: string;
  categoria: string | null;
  presenca: string;
  siteNota: string | null;
  pontuacao: number;
  status: string;
  telefone: string | null;
  ehCelular: boolean;
  nota: number | null;
  avaliacoes: number | null;
  linkMaps: string | null;
  linkWhatsApp: string | null;
  mensagemFinal: string;
}

export type Colunas = Record<ColunaKanban, { leads: CartaoLead[]; total: number }>;

const COR_COLUNA: Record<ColunaKanban, string> = {
  novo: "bg-slate-400",
  contatado: "bg-marca-500",
  reuniao: "bg-amber-500",
  fechado: "bg-emerald-500",
};

const porPontuacao = (a: CartaoLead, b: CartaoLead) => b.pontuacao - a.pontuacao;

export function Kanban({ colunas }: { colunas: Colunas }) {
  const router = useRouter();
  const [estado, setEstado] = useState(colunas);
  const [sobre, setSobre] = useState<ColunaKanban | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  // Coluna visível no celular/tablet (no desktop aparecem todas).
  const [ativa, setAtiva] = useState<ColunaKanban>("novo");
  const [aviso, setAviso] = useState<string | null>(null);

  // Depois de salvar, o servidor manda os dados atualizados.
  useEffect(() => setEstado(colunas), [colunas]);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 2200);
    return () => clearTimeout(t);
  }, [aviso]);

  const colunaDe = (id: string) => COLUNAS_KANBAN.find((c) => estado[c].leads.some((l) => l.id === id));

  /** Atualiza a tela na hora e salva; se der erro, volta como estava. */
  async function salvar(id: string, dados: Record<string, unknown>, novoEstado: Colunas) {
    const antes = estado;
    setEstado(novoEstado);
    setErro(null);
    try {
      await alterarLead(id, dados);
      router.refresh();
    } catch (e) {
      setEstado(antes);
      setErro((e as Error).message);
    }
  }

  function semLead(id: string): [Colunas, CartaoLead | undefined] {
    const de = colunaDe(id);
    if (!de) return [estado, undefined];
    const lead = estado[de].leads.find((l) => l.id === id);
    return [{ ...estado, [de]: { leads: estado[de].leads.filter((l) => l.id !== id), total: estado[de].total - 1 } }, lead];
  }

  function mover(id: string, para: ColunaKanban) {
    if (colunaDe(id) === para) return;
    const [sem, lead] = semLead(id);
    if (!lead) return;
    const destino = { leads: [...sem[para].leads, { ...lead, status: para }].sort(porPontuacao), total: sem[para].total + 1 };
    salvar(id, { status: para }, { ...sem, [para]: destino });
    setAviso(`${lead.nome} → ${COLUNA_ROTULO[para]}`);
  }

  function remover(id: string) {
    const [sem, lead] = semLead(id);
    salvar(id, { status: "descartado" }, sem);
    if (lead) setAviso(`${lead.nome} foi para Removidos`);
  }

  function naoContatar(id: string, nome: string) {
    if (!confirm(`${nome} pediu para não ser contatado? O lead sai do quadro e não volta em buscas novas.`)) return;
    salvar(id, { naoContatar: true }, semLead(id)[0]);
    setAviso(`${nome} não será mais contatado`);
  }

  function abrirWhatsApp(l: CartaoLead) {
    if (!l.linkWhatsApp) return;
    window.open(l.linkWhatsApp, "_blank", "noopener");
    if (l.status === "novo") mover(l.id, "contatado");
  }

  // Recebe cartões arrastados: vale para a coluna (desktop) e para a aba (celular/tablet).
  const alvoDeArraste = (col: ColunaKanban) => ({
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      setSobre(col);
    },
    onDragLeave: () => setSobre((s) => (s === col ? null : s)),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setSobre(null);
      mover(e.dataTransfer.getData("text/plain"), col);
    },
  });

  return (
    <div className="space-y-2">
      {erro && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">{erro}</p>}

      {/* Celular e tablet: uma coluna por vez, escolhida nas abas. */}
      <div role="tablist" aria-label="Colunas" className="sticky top-0 z-10 -mx-4 bg-slate-50/95 px-4 py-2 backdrop-blur lg:hidden">
        <div className="grid grid-cols-4 gap-1 rounded-lg bg-slate-200/70 p-1">
          {COLUNAS_KANBAN.map((col) => (
            <button
              key={col}
              type="button"
              role="tab"
              aria-selected={ativa === col}
              onClick={() => setAtiva(col)}
              {...alvoDeArraste(col)}
              className={`flex flex-col items-center rounded-md px-1 py-1.5 text-xs ${ativa === col ? "bg-white font-semibold text-slate-900 shadow-sm" : "text-slate-600"} ${sobre === col ? "ring-2 ring-marca-500" : ""}`}
            >
              <span className="flex items-center gap-1">
                <span className={`size-1.5 rounded-full ${COR_COLUNA[col]}`} />
                {COLUNA_ROTULO[col]}
              </span>
              <span className="tabular-nums text-slate-500">{estado[col].total}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-4 lg:gap-3">
        {COLUNAS_KANBAN.map((col, i) => {
          const { leads, total } = estado[col];
          return (
            <section
              key={col}
              aria-label={COLUNA_ROTULO[col]}
              {...alvoDeArraste(col)}
              className={`${ativa === col ? "flex" : "hidden"} flex-col transition-colors lg:flex lg:min-h-[60vh] lg:rounded-lg lg:border lg:p-2 ${sobre === col ? "lg:border-marca-500 lg:bg-marca-50" : "lg:border-slate-200 lg:bg-slate-100/70"}`}
            >
              <header className="mb-2 hidden items-center gap-2 px-1 lg:flex">
                <span className={`size-2 rounded-full ${COR_COLUNA[col]}`} />
                <h2 className="text-sm font-semibold text-slate-800">{COLUNA_ROTULO[col]}</h2>
                <span className="ml-auto rounded-full bg-white px-2 text-xs tabular-nums text-slate-600">{total}</span>
              </header>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 lg:content-start">
                {leads.map((l) => (
                    <Cartao
                      key={l.id}
                      lead={l}
                      anterior={COLUNAS_KANBAN[i - 1]}
                      proxima={COLUNAS_KANBAN[i + 1]}
                      onMover={(para) => mover(l.id, para)}
                      onWhatsApp={() => abrirWhatsApp(l)}
                      onRemover={() => remover(l.id)}
                      onNaoContatar={() => naoContatar(l.id, l.nome)}
                    />
                  ))}
                {!leads.length && (
                  <p className="px-2 py-10 text-center text-sm text-slate-400 sm:col-span-2 lg:col-span-1 lg:py-6 lg:text-xs">
                    {col === "novo" ? "Nenhum lead novo. Faça uma busca." : "Nenhum lead aqui ainda. Arraste um cartão para cá ou use as setas ‹ ›."}
                  </p>
                )}
                {total > leads.length && (
                  <p className="px-2 py-2 text-center text-xs text-slate-500 sm:col-span-2 lg:col-span-1">
                    Mostrando {leads.length} de {total}. Use os filtros para ver os outros.
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {aviso && (
        <div role="status" className="fixed inset-x-4 bottom-4 z-20 mx-auto max-w-sm rounded-lg bg-slate-900 px-4 py-3 text-center text-sm text-white shadow-lg">
          {aviso}
        </div>
      )}
    </div>
  );
}

interface PropsCartao {
  lead: CartaoLead;
  anterior?: ColunaKanban;
  proxima?: ColunaKanban;
  onMover: (para: ColunaKanban) => void;
  onWhatsApp: () => void;
  onRemover: () => void;
  onNaoContatar: () => void;
}

function Cartao({ lead: l, anterior, proxima, onMover, onWhatsApp, onRemover, onNaoContatar }: PropsCartao) {
  const [copiado, setCopiado] = useState(false);
  const copiar = async () => {
    await navigator.clipboard.writeText(l.mensagemFinal);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1500);
  };
  const botao = "rounded p-1.5 lg:p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:text-slate-300 disabled:hover:bg-transparent";

  return (
    <article
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", l.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      className="cartao cursor-grab p-3 shadow-sm active:cursor-grabbing"
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <Link href={`/leads/${l.id}`} className="line-clamp-2 text-sm font-medium text-slate-900 hover:text-marca-600">
            {l.nome}
          </Link>
          {l.categoria && <div className="truncate text-xs text-slate-500">{l.categoria}</div>}
        </div>
        <Pontuacao valor={l.pontuacao} />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <span title={l.siteNota ?? undefined}>
          <SeloPresenca presenca={l.presenca} />
        </span>
        {l.nota != null && (
          <span className="inline-flex items-center gap-0.5 text-slate-600">
            <Star className="size-3 fill-amber-400 text-amber-400" />
            {l.nota.toFixed(1)} <span className="text-slate-400">({l.avaliacoes ?? 0})</span>
          </span>
        )}
      </div>
      <div className="mt-1 text-xs text-slate-600">
        {l.telefone ?? <span className="text-slate-400">sem telefone</span>}
        {l.ehCelular && <span className="text-emerald-700"> · WhatsApp</span>}
      </div>

      <div className="mt-2 flex items-center border-t border-slate-100 pt-2">
        <button type="button" className={`${botao} text-emerald-700`} title={l.linkWhatsApp ? "Abrir no WhatsApp" : "Sem celular"} disabled={!l.linkWhatsApp} onClick={onWhatsApp}>
          <MessageCircle className="size-4" />
        </button>
        <button type="button" className={botao} title="Copiar mensagem" onClick={copiar}>
          {copiado ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
        </button>
        {l.linkMaps && (
          <a href={l.linkMaps} target="_blank" rel="noopener" className={botao} title="Abrir no Google Maps">
            <MapPin className="size-4" />
          </a>
        )}
        <span className="flex-1" />
        <button type="button" className={botao} title={anterior ? `Voltar para ${COLUNA_ROTULO[anterior]}` : undefined} disabled={!anterior} onClick={() => anterior && onMover(anterior)}>
          <ChevronLeft className="size-4" />
        </button>
        <button type="button" className={botao} title={proxima ? `Avançar para ${COLUNA_ROTULO[proxima]}` : undefined} disabled={!proxima} onClick={() => proxima && onMover(proxima)}>
          <ChevronRight className="size-4" />
        </button>
        <button type="button" className={`${botao} hover:text-rose-700`} title="Remover do quadro" onClick={onRemover}>
          <Trash2 className="size-4" />
        </button>
        <button type="button" className={`${botao} hover:text-rose-700`} title="Não contatar (pediu para não receber mensagens)" onClick={onNaoContatar}>
          <Ban className="size-4" />
        </button>
      </div>
    </article>
  );
}
