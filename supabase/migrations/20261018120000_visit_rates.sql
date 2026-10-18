-- Valor por visita com histórico: cada valor vale a partir de um mês.
-- O fechamento de um mês usa o valor vigente naquele mês, então mudar o
-- valor não altera meses anteriores. Aplique no SQL Editor do Supabase.

create table if not exists public.visit_rates (
  -- Primeiro dia do mês a partir do qual o valor vale.
  month date primary key check (extract(day from month) = 1),
  rate numeric(10, 2) not null check (rate >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Valor atual (R$ 50,00) valendo para todo o histórico importado. Só com a
-- tabela vazia: ao rodar de novo, a trava de meses passados recusaria a linha.
insert into public.visit_rates (month, rate)
select date '2026-01-01', s.visit_rate
from public.app_settings s
where not exists (select 1 from public.visit_rates);

-- app_settings.visit_rate deixa de ser usado pelo painel.
comment on column public.app_settings.visit_rate is 'Obsoleto: use public.visit_rates.';

drop trigger if exists visit_rates_set_updated_at on public.visit_rates;
create trigger visit_rates_set_updated_at
  before update on public.visit_rates
  for each row execute function public.set_updated_at();

-- Meses que já passaram não podem ser criados, alterados nem apagados.
create or replace function public.visit_rates_protect_past()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  current_month date := date_trunc('month', (now() at time zone 'America/Sao_Paulo'))::date;
begin
  if (tg_op in ('UPDATE', 'DELETE') and old.month < current_month)
     or (tg_op in ('INSERT', 'UPDATE') and new.month < current_month) then
    raise exception 'O valor de meses anteriores não pode ser alterado.'
      using errcode = 'check_violation';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists visit_rates_protect_past on public.visit_rates;
create trigger visit_rates_protect_past
  before insert or update or delete on public.visit_rates
  for each row execute function public.visit_rates_protect_past();

-- RLS: só administradores, como as outras tabelas.
alter table public.visit_rates enable row level security;
revoke all on public.visit_rates from anon;
grant select, insert, update, delete on public.visit_rates to authenticated;

drop policy if exists "visit_rates_admin_select" on public.visit_rates;
create policy "visit_rates_admin_select" on public.visit_rates for select
  to authenticated using ((select public.is_admin()));
drop policy if exists "visit_rates_admin_insert" on public.visit_rates;
create policy "visit_rates_admin_insert" on public.visit_rates for insert
  to authenticated with check ((select public.is_admin()));
drop policy if exists "visit_rates_admin_update" on public.visit_rates;
create policy "visit_rates_admin_update" on public.visit_rates for update
  to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "visit_rates_admin_delete" on public.visit_rates;
create policy "visit_rates_admin_delete" on public.visit_rates for delete
  to authenticated using ((select public.is_admin()));
