import Link from "next/link";
import { connection } from "next/server";
import { Download } from "lucide-react";
import { Kanban, type CartaoLead, type Colunas } from "@/components/Kanban";
import { ListaRemovidos } from "@/components/ListaRemovidos";
import { Recolhivel } from "@/components/Recolhivel";
import { estatisticas, filtrosDeParams, listarLeads, type LeadComLinks } from "@/core/leads";
import { COLUNAS_KANBAN, PRESENCA_ROTULO, PRESENCAS } from "@/core/tipos";

type Params = Promise<Record<string, string | string[] | undefined>>;

// Cartões por coluna. O resto aparece filtrando.
const POR_COLUNA = 100;

function paraUrlParams(sp: Record<string, string | string[] | undefined>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    for (const item of Array.isArray(v) ? v : v ? [v] : []) if (item) p.append(k, item);
  }
  return p;
}

function com(p: URLSearchParams, mudancas: Record<string, string | null>) {
  const n = new URLSearchParams(p);
  for (const [k, v] of Object.entries(mudancas)) {
    if (v === null) n.delete(k);
    else n.set(k, v);
  }
  const s = n.toString();
  return s ? `/?${s}` : "/";
}

function paraCartao(l: LeadComLinks): CartaoLead {
  return {
    id: l.id,
    nome: l.nome,
    categoria: l.categoria,
    presenca: l.presenca,
    siteNota: l.siteNota,
    pontuacao: l.pontuacao,
    status: l.status,
    telefone: l.telefone,
    ehCelular: l.ehCelular,
    nota: l.nota,
    avaliacoes: l.avaliacoes,
    linkMaps: l.linkMaps,
    linkWhatsApp: l.linkWhatsApp,
    mensagemFinal: l.mensagemFinal,
  };
}

export default async function PaginaLeads({ searchParams }: { searchParams: Params }) {
  await connection();
  const params = paraUrlParams(await searchParams);
  params.delete("status"); // o status é a coluna do quadro
  const verRemovidos = params.get("ver") === "removidos";
  const filtros = filtrosDeParams(params);

  const [stats, removidos, ...porColuna] = await Promise.all([
    estatisticas(),
    listarLeads({ ...filtros, status: ["descartado"], incluirNaoContatar: true, limite: verRemovidos ? 500 : 1 }),
    ...COLUNAS_KANBAN.map((s) => listarLeads({ ...filtros, status: [s], limite: POR_COLUNA })),
  ]);
  const colunas = Object.fromEntries(
    COLUNAS_KANBAN.map((s, i) => [s, { leads: porColuna[i].leads.map(paraCartao), total: porColuna[i].total }]),
  ) as Colunas;
  const presencaAtual = params.get("presenca");
  const filtrosAtivos = [filtros.texto, filtros.nicho, filtros.cidade, filtros.pontuacaoMin, filtros.whatsapp].filter(
    (v) => v !== undefined && v !== "",
  ).length;

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-3 gap-2 sm:gap-3 lg:grid-cols-6">
        <Numero rotulo="Leads" valor={stats.total} />
        <Numero rotulo="Com WhatsApp" valor={stats.comWhatsapp} />
        {PRESENCAS.map((p) => (
          <Numero key={p} rotulo={PRESENCA_ROTULO[p]} valor={stats.presenca[p] ?? 0} />
        ))}
      </section>

      {/* No celular as etiquetas ficam numa linha só, rolando de lado. */}
      <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
        <Aba href={com(params, { presenca: null })} ativa={!presencaAtual}>
          Todos
        </Aba>
        {PRESENCAS.map((p) => (
          <Aba key={p} href={com(params, { presenca: p })} ativa={presencaAtual === p}>
            {PRESENCA_ROTULO[p]}
          </Aba>
        ))}
        <Aba href={com(params, { presenca: "sem_site,so_rede_social,site_fora_do_ar" })} ativa={presencaAtual === "sem_site,so_rede_social,site_fora_do_ar"}>
          Sem site próprio
        </Aba>
      </div>

      <Recolhivel titulo="Filtros" ativos={filtrosAtivos}>
      <form className="cartao grid grid-cols-2 gap-3 p-4 md:grid-cols-6" method="get">
        {presencaAtual && <input type="hidden" name="presenca" value={presencaAtual} />}
        {filtros.buscaId && <input type="hidden" name="buscaId" value={filtros.buscaId} />}
        {verRemovidos && <input type="hidden" name="ver" value="removidos" />}
        <div className="col-span-2">
          <label className="rotulo" htmlFor="texto">Nome ou endereço</label>
          <input id="texto" name="texto" defaultValue={filtros.texto} className="campo" placeholder="Buscar..." />
        </div>
        <div>
          <label className="rotulo" htmlFor="nicho">Nicho</label>
          <input id="nicho" name="nicho" defaultValue={filtros.nicho} className="campo" placeholder="barbearia" />
        </div>
        <div>
          <label className="rotulo" htmlFor="cidade">Cidade</label>
          <input id="cidade" name="cidade" defaultValue={filtros.cidade} className="campo" placeholder="Campinas" />
        </div>
        <div>
          <label className="rotulo" htmlFor="pontuacaoMin">Pontuação mín.</label>
          <input id="pontuacaoMin" name="pontuacaoMin" type="number" min={0} max={100} defaultValue={filtros.pontuacaoMin} className="campo" />
        </div>
        <div className="flex flex-col justify-end gap-2">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="whatsapp" value="1" defaultChecked={filtros.whatsapp} /> Só WhatsApp
          </label>
          <button className="botao" type="submit">Filtrar</button>
        </div>
      </form>
      </Recolhivel>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <nav className="flex gap-1 rounded-lg bg-slate-200/70 p-1">
          <Link href={com(params, { ver: null })} className={`rounded-md px-3 py-1 ${!verRemovidos ? "bg-white font-medium shadow-sm" : "text-slate-600"}`}>
            Quadro
          </Link>
          <Link href={com(params, { ver: "removidos" })} className={`rounded-md px-3 py-1 ${verRemovidos ? "bg-white font-medium shadow-sm" : "text-slate-600"}`}>
            Removidos ({removidos.total})
          </Link>
        </nav>
        <div className="flex items-center gap-3 text-slate-600">
          {filtros.buscaId && (
            <span>
              Só a busca selecionada ·{" "}
              <Link className="text-marca-600 hover:underline" href={com(params, { buscaId: null })}>ver todas</Link>
            </span>
          )}
          <a className="botao-sec" href={`/api/leads/exportar?${params.toString()}`}>
            <Download className="size-4" /> Exportar CSV
          </a>
        </div>
      </div>

      {verRemovidos ? (
        <ListaRemovidos
          leads={removidos.leads.map((l) => ({
            id: l.id,
            nome: l.nome,
            categoria: l.categoria,
            presenca: l.presenca,
            naoContatar: l.naoContatar,
            atualizadoEm: l.atualizadoEm.toISOString(),
          }))}
        />
      ) : (
        <>
          <p className="hidden text-xs text-slate-500 lg:block">
            Arraste os cartões entre as colunas (ou use as setas). O lixo remove do quadro; o ícone de proibido marca quem pediu para não ser contatado.
          </p>
          <Kanban colunas={colunas} />
        </>
      )}
    </div>
  );
}

function Numero({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div className="cartao px-3 py-2 sm:px-4 sm:py-3">
      <div className="truncate text-[11px] text-slate-500 sm:text-xs">{rotulo}</div>
      <div className="text-lg font-semibold tabular-nums sm:text-xl">{valor}</div>
    </div>
  );
}

function Aba({ href, ativa, children }: { href: string; ativa: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-sm ${ativa ? "border-marca-600 bg-marca-600 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"}`}
    >
      {children}
    </Link>
  );
}
