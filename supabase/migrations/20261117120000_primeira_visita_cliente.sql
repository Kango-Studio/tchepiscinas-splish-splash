-- Promote confirmed recurring sales, including confirmations made before this migration.
begin;

create function public.register_first_visit_client()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  lead public.leads;
  payment_link_date date;
  needs_payment_link boolean;
begin
  select * into strict lead from public.leads where id = new.lead_id;

  -- Serialize conversions for leads with the same WhatsApp number.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(lead.whatsapp, 0));

  -- Reuse an unambiguous match. An explicitly linked client takes precedence
  -- because the trigger runs only when client_id is null.
  select c.id into new.client_id
  from public.clients c
  where c.whatsapp = lead.whatsapp
    and (select count(*) from public.clients where whatsapp = lead.whatsapp) = 1;

  if new.client_id is not null then
    return new;
  end if;

  -- A shared number may belong to multiple properties.
  select c.id into new.client_id
  from public.clients c
  where c.whatsapp = lead.whatsapp
    and lower(trim(c.name)) = lower(trim(lead.name))
    and c.notes = 'Endereço do atendimento: ' || left(new.address, 4900)
  order by c.created_at, c.id
  limit 1;

  if new.client_id is not null then
    return new;
  end if;

  select sent_date into payment_link_date
  from public.sale_link_tasks
  where lead_id = new.lead_id and kind = 'pagamento';

  needs_payment_link := new.service_chargeable and new.agreed_value > 0;

  insert into public.clients (
    name, whatsapp, neighborhood, plan_id, pool_tech_id, notes, custom_price,
    etapa_onboarding, venda_fechada_em, primeira_visita_em, link_enviado_em
  )
  values (
    lead.name, lead.whatsapp, lead.neighborhood, new.plan_id, new.pool_tech_id,
    'Endereço do atendimento: ' || left(new.address, 4900),
    case when new.items <@ array['plano']::text[] and new.agreed_value < 100000000
      then new.agreed_value end,
    case
      when payment_link_date is not null then 'link_enviado'
      when needs_payment_link then 'aguardando_link'
      else 'ativo'
    end,
    new.confirmed_date, new.confirmed_date, payment_link_date
  )
  returning id into new.client_id;

  insert into public.visits (client_id, pool_tech_id, visit_date)
  values (new.client_id, new.pool_tech_id, new.confirmed_date);

  return new;
end;
$$;

revoke all on function public.register_first_visit_client() from public, anon, authenticated;

create trigger register_first_visit_client
  before update of confirmed_at on public.lead_sales
  for each row
  when (
    new.confirmed_at is not null and new.confirmed_date is not null
    and new.client_id is null and new.plan_id is not null
    and 'plano' = any(new.items)
  )
  execute function public.register_first_visit_client();

update public.lead_sales
set confirmed_at = confirmed_at
where confirmed_at is not null and confirmed_date is not null
  and client_id is null and plan_id is not null and 'plano' = any(items);

commit;
