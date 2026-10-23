// Chamadas do navegador para a API do painel.

export async function alterarLead(id: string, dados: Record<string, unknown>) {
  const r = await fetch(`/api/leads/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dados),
  });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).erro ?? "Erro ao salvar");
}
