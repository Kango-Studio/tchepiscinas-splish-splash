-- Financeiro: mensalidade recorrente. Aplique no SQL Editor do Supabase depois
-- de 20261112130000_financeiro_kit.sql. Só adiciona: nada é apagado ou
-- alterado. Pode rodar mais de uma vez.
--
-- A mensalidade se repete todo mês, do mês "mensalidade_desde" até o mês
-- atual, enquanto o cliente estiver ativo. O painel chama gerar_mensalidades()
-- ao abrir (não depende de tarefa agendada).
-- - Um mês que já tem mensalidade (inclusive cancelada) não é gerado de novo.
-- - Valor = valor do cliente (custom_price) ou o padrão do plano, no momento
--   em que o mês é gerado. Mudar o valor não altera as já geradas.
-- - Cliente inativo ou de parceria não gera.
-- "Hoje" é sempre a data de São Paulo.

alter table public.clients add column if not exists mensalidade_desde date;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'clients_mensalidade_desde_check') then
    alter table public.clients add constraint clients_mensalidade_desde_check
      check (mensalidade_desde is null or extract(day from mensalidade_desde) = 1);
  end if;
end;
$$;

comment on column public.clients.mensalidade_desde is
  'Primeiro mês (dia 1) em que a mensalidade é cobrada. Vazio = sem cobrança recorrente.';

-- Cliente reativado não gera os meses em que ficou inativo: a recorrência
-- recomeça no mês da reativação.
create or replace function public.clients_reativar_mensalidade()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  current_month date := date_trunc('month', (now() at time zone 'America/Sao_Paulo'))::date;
begin
  if old.active = false and new.active = true
     and new.mensalidade_desde is not null and new.mensalidade_desde < current_month then
    new.mensalidade_desde := current_month;
  end if;
  return new;
end;
$$;

drop trigger if exists clients_reativar_mensalidade on public.clients;
create trigger clients_reativar_mensalidade
  before update of active on public.clients
  for each row execute function public.clients_reativar_mensalidade();

-- Gera as mensalidades que faltam. p_cliente_id vazio = todos os clientes.
-- Devolve quantas foram criadas.
create or replace function public.gerar_mensalidades(p_cliente_id uuid default null)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_month date := date_trunc('month', (now() at time zone 'America/Sao_Paulo'))::date;
  created integer;
begin
  if not (select public.is_admin()) then
    raise exception 'not allowed' using errcode = 'insufficient_privilege';
  end if;

  insert into public.cobrancas (cliente_id, tipo, valor, vencimento)
  select
    c.id,
    'mensalidade',
    coalesce(c.custom_price, p.default_price),
    -- Dia 29–31 em mês curto = último dia do mês.
    (m.mes + (least(c.dia_vencimento,
                    extract(day from (m.mes + interval '1 month - 1 day'))::int) - 1))::date
  from public.clients c
  join public.plans p on p.id = c.plan_id
  cross join lateral (
    select g::date as mes
    from generate_series(c.mensalidade_desde, current_month, interval '1 month') g
  ) m
  where c.active
    and c.billing_type = 'pago'
    and c.dia_vencimento is not null
    and c.mensalidade_desde is not null
    and coalesce(c.custom_price, p.default_price) > 0
    and (p_cliente_id is null or c.id = p_cliente_id)
    and not exists (
      select 1 from public.cobrancas x
      where x.cliente_id = c.id
        and x.tipo = 'mensalidade'
        and x.vencimento >= m.mes
        and x.vencimento < (m.mes + interval '1 month')::date
    )
  on conflict do nothing;

  get diagnostics created = row_count;
  return created;
end;
$$;

revoke all on function public.gerar_mensalidades(uuid) from public, anon;
grant execute on function public.gerar_mensalidades(uuid) to authenticated;
