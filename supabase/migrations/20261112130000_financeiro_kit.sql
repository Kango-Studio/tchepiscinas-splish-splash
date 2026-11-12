-- Financeiro (etapa 2): registrar compra de kit e gerar as parcelas de uma vez.
-- Aplique no SQL Editor do Supabase depois de 20261112120000_financeiro.sql.
-- Só cria uma função: não altera tabelas nem dados. Pode rodar mais de uma vez.
--
-- Tudo numa transação: ou grava a compra com todas as parcelas, ou nada.
-- Parcelas: valor dividido igualmente; os centavos que sobram vão na 1ª.
-- Vencimentos mensais a partir do 1º (31/01 + 1 mês = 28/02).

create or replace function public.registrar_kit(
  p_cliente_id uuid,
  p_valor_total numeric,
  p_parcelas integer,
  p_data_compra date,
  p_primeiro_vencimento date,
  p_primeira_paga boolean default false,
  p_observacao text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_kit uuid;
  v_base numeric(10, 2);
  i integer;
begin
  if not (select public.is_admin()) then
    raise exception 'not allowed' using errcode = 'insufficient_privilege';
  end if;

  insert into public.kit_compras (cliente_id, valor_total, parcelas, data_compra, observacao)
  values (p_cliente_id, p_valor_total, p_parcelas, p_data_compra, nullif(btrim(p_observacao), ''))
  returning id into v_kit;

  v_base := floor(p_valor_total * 100 / p_parcelas) / 100;

  for i in 1..p_parcelas loop
    insert into public.cobrancas (
      cliente_id, tipo, kit_compra_id, valor, vencimento,
      parcela_atual, total_parcelas, status, data_pagamento
    )
    values (
      p_cliente_id, 'kit', v_kit,
      case when i = 1 then p_valor_total - v_base * (p_parcelas - 1) else v_base end,
      (p_primeiro_vencimento + make_interval(months => i - 1))::date,
      i, p_parcelas,
      case when i = 1 and p_primeira_paga then 'pago' else 'pendente' end,
      case when i = 1 and p_primeira_paga then p_data_compra else null end
    );
  end loop;

  return v_kit;
end;
$$;

revoke all on function public.registrar_kit(uuid, numeric, integer, date, date, boolean, text)
  from public, anon;
grant execute on function public.registrar_kit(uuid, numeric, integer, date, date, boolean, text)
  to authenticated;
