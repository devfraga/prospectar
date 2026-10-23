// Valores válidos dos campos de "tipo" do banco (o SQLite guarda como String).

export const PRESENCAS = ["sem_site", "so_rede_social", "site_fora_do_ar", "com_site"] as const;
export type Presenca = (typeof PRESENCAS)[number];

export const PRESENCA_ROTULO: Record<Presenca, string> = {
  sem_site: "Sem site",
  so_rede_social: "Só rede social",
  site_fora_do_ar: "Site fora do ar",
  com_site: "Com site",
};

// "descartado" = removido do quadro (botão remover ou "não contatar"). Não aparece no kanban.
export const STATUS_LEAD = ["novo", "contatado", "reuniao", "fechado", "descartado"] as const;
export type StatusLead = (typeof STATUS_LEAD)[number];

export const STATUS_LEAD_ROTULO: Record<StatusLead, string> = {
  novo: "Novo",
  contatado: "Contatado",
  reuniao: "Reunião",
  fechado: "Fechado",
  descartado: "Removido",
};

/** Colunas do kanban, na ordem. */
export const COLUNAS_KANBAN = ["novo", "contatado", "reuniao", "fechado"] as const satisfies readonly StatusLead[];
export type ColunaKanban = (typeof COLUNAS_KANBAN)[number];

export const COLUNA_ROTULO: Record<ColunaKanban, string> = {
  novo: "Novos",
  contatado: "Contatados",
  reuniao: "Reunião",
  fechado: "Fechados",
};

export const FONTES = ["gosom", "places"] as const;
export type Fonte = (typeof FONTES)[number];

// Cobertura da cidade: divide o mapa em N x N partes e faz uma busca em cada uma,
// porque o Google Maps mostra no máximo ~120 negócios por busca.
// Vai só até 2x2 (4 buscas): mais que isso aumenta muito o risco de o Google bloquear o IP.
export const GRADE_MAXIMA = 2;

export const COBERTURAS = [
  { grade: 1, nome: "Normal", buscas: 1, ate: 120, indicada: "cidades pequenas ou um bairro" },
  { grade: 2, nome: "Ampliada", buscas: 4, ate: 480, indicada: "cidades médias e grandes" },
] as const;

export type StatusBusca = "pendente" | "rodando" | "enriquecendo" | "concluida" | "falhou";
export type StatusTarefa = "pendente" | "rodando" | "ok" | "falhou";

/** Um lugar como vem de qualquer fonte, já normalizado para os nossos nomes de campo. */
export interface LugarBruto {
  placeId: string;
  nome: string;
  categoria?: string;
  endereco?: string;
  lat?: number;
  lon?: number;
  linkMaps?: string;
  telefone?: string;
  website?: string;
  emails?: string;
  nota?: number;
  avaliacoes?: number;
  /** false quando o Google marca o negócio como fechado permanentemente. */
  ativo?: boolean;
}

export function ehPresenca(v: unknown): v is Presenca {
  return typeof v === "string" && (PRESENCAS as readonly string[]).includes(v);
}

export function ehStatusLead(v: unknown): v is StatusLead {
  return typeof v === "string" && (STATUS_LEAD as readonly string[]).includes(v);
}
