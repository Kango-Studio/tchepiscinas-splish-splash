begin;

-- Confirma a visita e registra os valores discriminados na mesma transação.
-- Valor zero indica que o item não tem cobrança separada.
create function public.confirm_first_visit_with_finance(
  p_lead_id uuid,
  p_date date,
  p_kit_value numeric,
  p_kit_installments integer,
  p_products_value numeric,
  p_due_date date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  sale public.lead_sales;
begin
  if not public.is_admin() then
    raise exception 'Sem permissão';
  end if;

  -- Mesma ordem de bloqueio usada pelo agendamento e pela confirmação.
  perform 1 from public.leads where id = p_lead_id for update;
  select * into strict sale from public.lead_sales where lead_id = p_lead_id for update;
  if sale.confirmed_at is not null then
    return;
  end if;

  if ('kit' = any(sale.items)) <> (p_kit_value is not null)
    or ('produtos' = any(sale.items)) <> (p_products_value is not null) then
    raise exception 'Informe os valores dos itens da venda.';
  end if;

  if p_kit_value not between 0 and 99999999.99 or p_kit_value <> round(p_kit_value, 2)
    or p_products_value not between 0 and 99999999.99 or p_products_value <> round(p_products_value, 2) then
    raise exception 'Informe valores válidos com até duas casas decimais.';
  end if;

  if p_kit_value > 0 and (
    p_kit_installments is null or p_kit_installments not between 1 and 3
    or p_kit_value * 100 < p_kit_installments
  ) then
    raise exception 'Informe de 1 a 3 parcelas com valor de pelo menos um centavo cada.';
  end if;

  if (p_kit_value > 0 or p_products_value > 0) and p_due_date is null then
    raise exception 'Informe o vencimento.';
  end if;

  perform public.confirm_first_visit(p_lead_id, p_date);

  if p_kit_value > 0 or p_products_value > 0 then
    select * into strict sale from public.lead_sales where lead_id = p_lead_id;
    if sale.client_id is null then
      raise exception 'Vincule um cliente para lançar os itens no Financeiro.';
    end if;

    if p_kit_value > 0 then
      perform public.registrar_kit(sale.client_id, p_kit_value, p_kit_installments, p_date, p_due_date);
    end if;

    if p_products_value > 0 then
      insert into public.cobrancas (cliente_id, tipo, valor, vencimento)
      values (sale.client_id, 'produtos', p_products_value, p_due_date);
    end if;
  end if;
end;
$$;

revoke all on function public.confirm_first_visit_with_finance(uuid, date, numeric, integer, numeric, date)
  from public, anon;
grant execute on function public.confirm_first_visit_with_finance(uuid, date, numeric, integer, numeric, date)
  to authenticated;

commit;
