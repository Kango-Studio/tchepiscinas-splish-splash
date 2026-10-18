-- Visitas, clientes, planos, piscineiros, casos de atraso, produtos e envios
-- de relatório. Aplique no SQL Editor do Supabase ou com `supabase db push`.
-- Tudo restrito a administradores (public.is_admin()), como os leads.
-- "Hoje" é sempre a data de São Paulo.

-- ---------------------------------------------------------------------------
-- Planos (regras de frequência editáveis)
-- ---------------------------------------------------------------------------
create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(btrim(name)) between 2 and 60),
  default_price numeric(10, 2) not null check (default_price >= 0),
  visits_per_month smallint not null check (visits_per_month between 1 and 31),
  -- Dias sem visita: até ok_max_days = OK; até attention_max_days = Atenção;
  -- acima disso = Atrasado.
  ok_max_days smallint not null check (ok_max_days >= 0),
  attention_max_days smallint not null,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (attention_max_days > ok_max_days)
);

insert into public.plans (name, default_price, visits_per_month, ok_max_days, attention_max_days, sort_order)
values
  ('Prata Antigo', 300.00, 2, 10, 15, 1),
  ('Prata Novo', 400.00, 2, 10, 15, 2),
  ('Recorrente', 397.00, 4, 7, 9, 3),
  ('Gold + Produtos', 599.80, 4, 7, 9, 4)
on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- Piscineiros (não acessam o painel)
-- ---------------------------------------------------------------------------
create table if not exists public.pool_techs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  -- Somente dígitos, formato 55 + DDD + número
  whatsapp text check (whatsapp is null or whatsapp ~ '^55[1-9][0-9][0-9]{8,9}$'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists pool_techs_name_key on public.pool_techs (lower(btrim(name)));

-- ---------------------------------------------------------------------------
-- Clientes
-- ---------------------------------------------------------------------------
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  whatsapp text check (whatsapp is null or whatsapp ~ '^55[1-9][0-9][0-9]{8,9}$'),
  active boolean not null default true,
  neighborhood text check (neighborhood is null or char_length(neighborhood) <= 80),
  pool_tech_id uuid references public.pool_techs (id) on delete restrict,
  plan_id uuid not null references public.plans (id) on delete restrict,
  -- Vazio = usa o valor padrão do plano.
  custom_price numeric(10, 2) check (custom_price is null or custom_price >= 0),
  billing_type text not null default 'pago' check (billing_type in ('pago', 'parceria')),
  -- Contrapartida combinada com parceiros (ex.: "2 posts/mês").
  partnership_terms text check (partnership_terms is null or char_length(partnership_terms) <= 500),
  notes text check (notes is null or char_length(notes) <= 5000),
  -- ID da linha na planilha original (só para conferência da importação).
  legacy_id integer unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clients_pool_tech_idx on public.clients (pool_tech_id);
create index if not exists clients_plan_idx on public.clients (plan_id);

-- ---------------------------------------------------------------------------
-- Visitas
-- ---------------------------------------------------------------------------
create table if not exists public.visits (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete restrict,
  -- Quem fez a visita (pode ser diferente do responsável pelo cliente).
  pool_tech_id uuid not null references public.pool_techs (id) on delete restrict,
  -- Toda a frequência usa esta data, nunca a data do registro.
  visit_date date not null,
  -- Chaves dos serviços (lista fixa no código, ex.: 'peneiracao').
  services text[] not null default '{}',
  service_other text check (service_other is null or char_length(service_other) <= 200),
  notes text check (notes is null or char_length(notes) <= 2000),
  -- Data/hora do registro (separada da data da visita).
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  -- Mesma lista de src/lib/visits/services.ts.
  constraint visits_services_known check (services <@ array[
    'peneiracao', 'aspiracao_drenar', 'aspiracao_filtrar', 'escovacao', 'limpeza_bordas',
    'limpeza_filtro', 'retrolavagem', 'ajuste_parametros', 'cloro', 'ph',
    'tratamento_choque', 'ajuste_nivel_agua', 'outro'
  ]::text[])
);

create index if not exists visits_client_date_idx on public.visits (client_id, visit_date desc);
create index if not exists visits_tech_date_idx on public.visits (pool_tech_id, visit_date);
create index if not exists visits_date_idx on public.visits (visit_date);

-- Datas retroativas são permitidas; futuras não.
create or replace function public.visits_check_date()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.visit_date > (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'A data da visita não pode ser no futuro.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists visits_check_date on public.visits;
create trigger visits_check_date
  before insert or update of visit_date on public.visits
  for each row execute function public.visits_check_date();

-- ---------------------------------------------------------------------------
-- Casos de atraso
-- ---------------------------------------------------------------------------
create table if not exists public.late_cases (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  -- Piscineiro responsável quando o caso abriu (para o relatório de motivos).
  pool_tech_id uuid references public.pool_techs (id) on delete set null,
  -- Data em que o cliente entrou em Atrasado (calculada, não a data de abertura no painel).
  late_since date not null,
  -- Última visita (ou cadastro) que originou o atraso.
  reference_date date not null,
  status text not null default 'pendente'
    check (status in ('pendente', 'acionado', 'resolvido', 'lancamento_atrasado')),
  reason text check (reason is null or reason in
    ('cliente_viajou', 'cliente_pediu_pausa', 'chuva_clima', 'piscineiro_sem_agenda', 'esquecimento', 'outro')),
  reason_text text check (reason_text is null or char_length(reason_text) <= 500),
  contacted_at timestamptz,
  closed_at timestamptz,
  closed_by_visit_id uuid references public.visits (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- No máximo um caso aberto por cliente.
create unique index if not exists late_cases_one_open_idx
  on public.late_cases (client_id) where status in ('pendente', 'acionado');
create index if not exists late_cases_tech_idx on public.late_cases (pool_tech_id, late_since);

-- ---------------------------------------------------------------------------
-- Produtos e gasto por piscineiro
-- ---------------------------------------------------------------------------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  unit_price numeric(10, 2) check (unit_price is null or unit_price >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists products_name_key on public.products (lower(btrim(name)));

create table if not exists public.product_usages (
  id uuid primary key default gen_random_uuid(),
  used_on date not null,
  pool_tech_id uuid not null references public.pool_techs (id) on delete restrict,
  product_id uuid not null references public.products (id) on delete restrict,
  quantity numeric(10, 2) not null check (quantity > 0),
  notes text check (notes is null or char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists product_usages_tech_date_idx on public.product_usages (pool_tech_id, used_on);

-- ---------------------------------------------------------------------------
-- Envios de relatório (só o registro; as imagens não são guardadas)
-- ---------------------------------------------------------------------------
create table if not exists public.report_sends (
  id uuid primary key default gen_random_uuid(),
  -- pendentes: semanal, para o piscineiro. atendimentos: mensal, para o cliente.
  kind text not null check (kind in ('pendentes', 'atendimentos')),
  pool_tech_id uuid references public.pool_techs (id) on delete cascade,
  client_id uuid references public.clients (id) on delete cascade,
  -- Semana (segunda a domingo) ou mês do relatório.
  period_start date not null,
  period_end date not null,
  sent_at timestamptz not null default now(),
  check (period_end >= period_start),
  check (
    (kind = 'pendentes' and pool_tech_id is not null and client_id is null)
    or (kind = 'atendimentos' and client_id is not null and pool_tech_id is null)
  )
);

create unique index if not exists report_sends_unique_idx
  on public.report_sends (kind, coalesce(pool_tech_id, client_id), period_start);

-- ---------------------------------------------------------------------------
-- Configurações (linha única)
-- ---------------------------------------------------------------------------
create table if not exists public.app_settings (
  id boolean primary key default true check (id),
  -- Valor pago ao piscineiro por visita no fechamento.
  visit_rate numeric(10, 2) not null default 50.00 check (visit_rate >= 0),
  updated_at timestamptz not null default now()
);

insert into public.app_settings (id) values (true) on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- updated_at automático
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['plans', 'pool_techs', 'clients', 'visits', 'late_cases',
                           'products', 'product_usages', 'app_settings']
  loop
    execute format('drop trigger if exists %1$s_set_updated_at on public.%1$I', t);
    execute format(
      'create trigger %1$s_set_updated_at before update on public.%1$I
         for each row execute function public.set_updated_at()', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS: só administradores. anon não tem acesso nenhum.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['plans', 'pool_techs', 'clients', 'visits', 'late_cases',
                           'products', 'product_usages', 'report_sends', 'app_settings']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);

    execute format('drop policy if exists "%1$s_admin_select" on public.%1$I', t);
    execute format('create policy "%1$s_admin_select" on public.%1$I for select
                      to authenticated using ((select public.is_admin()))', t);
    execute format('drop policy if exists "%1$s_admin_insert" on public.%1$I', t);
    execute format('create policy "%1$s_admin_insert" on public.%1$I for insert
                      to authenticated with check ((select public.is_admin()))', t);
    execute format('drop policy if exists "%1$s_admin_update" on public.%1$I', t);
    execute format('create policy "%1$s_admin_update" on public.%1$I for update
                      to authenticated using ((select public.is_admin()))
                      with check ((select public.is_admin()))', t);
    execute format('drop policy if exists "%1$s_admin_delete" on public.%1$I', t);
    execute format('create policy "%1$s_admin_delete" on public.%1$I for delete
                      to authenticated using ((select public.is_admin()))', t);
  end loop;
end;
$$;

-- A linha de configurações nunca é apagada nem duplicada.
revoke insert, delete on public.app_settings from authenticated;

-- ---------------------------------------------------------------------------
-- Frequência calculada (nada é digitado à mão)
-- ---------------------------------------------------------------------------
-- security_invoker: a view respeita o RLS das tabelas de quem consulta.
create or replace view public.client_frequency
with (security_invoker = true)
as
with today as (
  select (now() at time zone 'America/Sao_Paulo')::date as d
),
base as (
  select
    c.id as client_id,
    c.active,
    c.pool_tech_id,
    c.plan_id,
    p.visits_per_month,
    p.ok_max_days,
    p.attention_max_days,
    lv.last_visit_date,
    -- Cliente sem visita conta a partir da data de cadastro.
    coalesce(lv.last_visit_date, (c.created_at at time zone 'America/Sao_Paulo')::date) as reference_date,
    coalesce(m.visits_this_month, 0) as visits_this_month,
    t.d as today
  from public.clients c
  join public.plans p on p.id = c.plan_id
  cross join today t
  left join lateral (
    select max(v.visit_date) as last_visit_date
    from public.visits v
    where v.client_id = c.id
  ) lv on true
  left join lateral (
    select count(*)::int as visits_this_month
    from public.visits v
    where v.client_id = c.id
      and v.visit_date >= date_trunc('month', t.d)::date
      and v.visit_date <= t.d
  ) m on true
)
select
  client_id,
  active,
  pool_tech_id,
  plan_id,
  last_visit_date,
  reference_date,
  (today - reference_date) as days_without_visit,
  case
    when today - reference_date <= ok_max_days then 'ok'
    when today - reference_date <= attention_max_days then 'atencao'
    else 'atrasado'
  end as status,
  -- Dia em que o cliente passa (ou passou) a ficar Atrasado.
  reference_date + attention_max_days + 1 as late_since,
  visits_this_month,
  visits_per_month as expected_visits
from base;

grant select on public.client_frequency to authenticated;
revoke all on public.client_frequency from anon;

-- ---------------------------------------------------------------------------
-- Abre casos para clientes ativos que estão Atrasados e ainda sem caso aberto.
-- Chamada pelo painel ao carregar (não depende de tarefa agendada).
-- ---------------------------------------------------------------------------
create or replace function public.sync_late_cases()
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  opened integer;
begin
  if not (select public.is_admin()) then
    raise exception 'not allowed' using errcode = 'insufficient_privilege';
  end if;

  insert into public.late_cases (client_id, pool_tech_id, late_since, reference_date)
  select f.client_id, f.pool_tech_id, f.late_since, f.reference_date
  from public.client_frequency f
  where f.active
    and f.status = 'atrasado'
    and not exists (
      select 1 from public.late_cases lc
      where lc.client_id = f.client_id and lc.status in ('pendente', 'acionado')
    )
  on conflict do nothing;

  get diagnostics opened = row_count;
  return opened;
end;
$$;

revoke all on function public.sync_late_cases() from public, anon;
grant execute on function public.sync_late_cases() to authenticated;

-- ---------------------------------------------------------------------------
-- Uma visita nova fecha o caso aberto do cliente.
-- Só conta se a visita for posterior à visita que originou o atraso.
-- Se a data da visita for anterior à entrada em atraso, não foi atraso real:
-- fecha como "lancamento_atrasado" (fica fora do relatório de motivos).
-- ---------------------------------------------------------------------------
create or replace function public.visits_close_late_case()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.late_cases lc
  set status = case when new.visit_date < lc.late_since then 'lancamento_atrasado' else 'resolvido' end,
      closed_at = now(),
      closed_by_visit_id = new.id
  where lc.client_id = new.client_id
    and lc.status in ('pendente', 'acionado')
    and new.visit_date > lc.reference_date;
  return null;
end;
$$;

drop trigger if exists visits_close_late_case on public.visits;
create trigger visits_close_late_case
  after insert or update of visit_date, client_id on public.visits
  for each row execute function public.visits_close_late_case();
