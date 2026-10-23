import { PRESENCA_ROTULO, STATUS_LEAD_ROTULO, type Presenca, type StatusLead } from "@/core/tipos";

const COR_PRESENCA: Record<Presenca, string> = {
  sem_site: "bg-rose-100 text-rose-800",
  so_rede_social: "bg-amber-100 text-amber-800",
  site_fora_do_ar: "bg-orange-100 text-orange-800",
  com_site: "bg-slate-100 text-slate-700",
};

export function SeloPresenca({ presenca }: { presenca: string }) {
  const p = presenca as Presenca;
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${COR_PRESENCA[p] ?? ""}`}>
      {PRESENCA_ROTULO[p] ?? presenca}
    </span>
  );
}

export function SeloStatus({ status }: { status: string }) {
  return <span className="text-xs text-slate-600">{STATUS_LEAD_ROTULO[status as StatusLead] ?? status}</span>;
}

export function Pontuacao({ valor }: { valor: number }) {
  const cor = valor >= 70 ? "bg-emerald-600" : valor >= 40 ? "bg-marca-500" : "bg-slate-400";
  return (
    <span className={`inline-flex h-7 w-9 items-center justify-center rounded-md text-xs font-semibold text-white ${cor}`}>
      {valor}
    </span>
  );
}
