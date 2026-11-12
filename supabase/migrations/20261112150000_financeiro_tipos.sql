-- Financeiro: novos tipos de cobrança "produtos" e "manutencao_extra".
-- Aplique no SQL Editor do Supabase. Só amplia a lista de tipos aceitos:
-- nenhum dado é apagado ou alterado. Pode rodar mais de uma vez.
-- "avulso" continua valendo (aparece no painel como "Outro").

alter table public.cobrancas drop constraint if exists cobrancas_tipo_check;
alter table public.cobrancas add constraint cobrancas_tipo_check
  check (tipo in ('mensalidade', 'kit', 'produtos', 'manutencao_extra', 'avulso'));
