import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Briefcase, Camera, Globe, Mail, MapPin, MessageCircle, Phone, Star, Users } from "lucide-react";
import { FormLead } from "@/components/FormLead";
import { Pontuacao, SeloPresenca } from "@/components/Selos";
import { obterTemplate } from "@/core/config";
import { obterLead } from "@/core/leads";
import { renderizarMensagem } from "@/core/mensagem";
import { normalizarUrl } from "@/core/presenca";
import type { Presenca } from "@/core/tipos";

export default async function PaginaLead({ params }: { params: Promise<{ id: string }> }) {
  const l = await obterLead((await params).id);
  if (!l) notFound();
  const mensagemTemplate = renderizarMensagem(await obterTemplate(), {
    nome: l.nome,
    categoria: l.categoria,
    cidade: l.cidade,
    presenca: l.presenca as Presenca,
  });

  const links = [
    l.linkWhatsApp && { href: l.linkWhatsApp, icone: MessageCircle, texto: "Abrir WhatsApp com a mensagem" },
    l.linkMaps && { href: l.linkMaps, icone: MapPin, texto: "Ver no Google Maps" },
    l.website && l.presenca !== "so_rede_social" && { href: normalizarUrl(l.website), icone: Globe, texto: l.website },
    l.instagram && { href: l.instagram, icone: Camera, texto: l.instagram },
    l.facebook && { href: l.facebook, icone: Users, texto: l.facebook },
    l.linkedin && { href: l.linkedin, icone: Briefcase, texto: l.linkedin },
  ].filter(Boolean) as Array<{ href: string; icone: typeof Globe; texto: string }>;

  return (
    <div className="space-y-4">
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft className="size-4" /> Leads
      </Link>
      <div className="flex flex-wrap items-start gap-3">
        <Pontuacao valor={l.pontuacao} />
        <div>
          <h1 className="text-xl font-semibold">{l.nome}</h1>
          <p className="text-sm text-slate-600">{[l.categoria, l.endereco].filter(Boolean).join(" · ")}</p>
        </div>
        <SeloPresenca presenca={l.presenca} />
        {l.naoContatar && <span className="rounded-full bg-rose-600 px-2 py-0.5 text-xs font-medium text-white">Não contatar</span>}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_minmax(0,480px)]">
        <div className="space-y-4">
          <div className="cartao space-y-3 p-4 text-sm">
            <Linha icone={Phone}>
              {l.telefone ?? "Sem telefone"} {l.ehCelular && <span className="text-emerald-700">· WhatsApp</span>}
            </Linha>
            <Linha icone={Mail}>{l.emails ?? "Nenhum e-mail encontrado"}</Linha>
            <Linha icone={Star}>
              {l.nota != null ? `${l.nota.toFixed(1)} (${l.avaliacoes ?? 0} avaliações)` : "Sem avaliações"}
            </Linha>
            {l.siteNota && <p className="rounded-md bg-amber-50 px-3 py-2 text-amber-800">{l.siteNota}.</p>}
            {!l.enriquecidoEm && l.presenca === "com_site" && <p className="text-xs text-slate-500">Site ainda não verificado.</p>}
          </div>
          <div className="cartao divide-y divide-slate-100 text-sm">
            {links.map((k) => (
              <a key={k.href} href={k.href} target="_blank" rel="noopener" className="flex items-center gap-2 px-4 py-2.5 text-marca-700 hover:bg-slate-50">
                <k.icone className="size-4 shrink-0" />
                <span className="truncate">{k.texto}</span>
              </a>
            ))}
          </div>
          {l.buscas.length > 0 && (
            <div className="text-xs text-slate-500">
              Encontrado em: {l.buscas.map((b) => `${b.nicho} / ${b.cidade} (${new Date(b.criadoEm).toLocaleDateString("pt-BR")})`).join(", ")}
            </div>
          )}
        </div>
        <FormLead id={l.id} status={l.status} notas={l.notas} mensagem={l.mensagem} mensagemTemplate={mensagemTemplate} />
      </div>
    </div>
  );
}

function Linha({ icone: Icone, children }: { icone: typeof Phone; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-slate-800">
      <Icone className="size-4 shrink-0 text-slate-400" />
      <span>{children}</span>
    </div>
  );
}
