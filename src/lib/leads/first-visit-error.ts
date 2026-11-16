type DatabaseError = { code?: string; message?: string };

export function describeFirstVisitError(error: unknown): string {
  const e = error as DatabaseError | null;
  if (e?.code === "P0001" && e.message) return e.message;
  if (e?.code === "PGRST202" || e?.code === "42883") {
    return "A função de primeira visita não está disponível. Confira a migração no Supabase.";
  }
  if (e?.code === "42501" || e?.code === "PGRST116") {
    return "Sem permissão para alterar este agendamento. Confira sua sessão de administrador.";
  }
  if (e?.code === "23503")
    return "O lead, cliente, plano ou piscineiro selecionado não está mais disponível. Recarregue os dados.";
  if (e?.code === "23514" || e?.code === "23502") {
    return `Confira o endereço, o piscineiro, os itens e a previsão da visita. Código: ${e.code}.`;
  }
  if (e?.message?.toLowerCase().includes("jwt")) return "Sessão expirada. Entre novamente.";
  if (e?.message?.toLowerCase().includes("failed to fetch"))
    return "Sem conexão com o servidor. Tente novamente.";
  return e?.code
    ? `Não foi possível salvar o agendamento. Código: ${e.code}.${e.message ? ` ${e.message}` : ""}`
    : "Não foi possível salvar o agendamento. Tente novamente.";
}
