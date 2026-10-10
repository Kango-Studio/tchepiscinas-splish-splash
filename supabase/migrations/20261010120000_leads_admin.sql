-- Tchê Piscinas — leads + área administrativa
-- Aplique no SQL Editor do Supabase ou com `supabase db push`.

-- ---------------------------------------------------------------------------
-- Administradores autorizados
-- ---------------------------------------------------------------------------
-- Estar autenticado não basta: o usuário precisa ter uma linha nesta tabela.
-- Linhas só são inseridas manualmente (SQL Editor / service_role).
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

-- security definer: consulta admin_users sem depender das policies dela,
-- evitando recursão e sem expor a lista de administradores.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_users where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Cada admin pode ver apenas a própria linha (usado para checar permissão).
drop policy if exists "admin_users_select_self" on public.admin_users;
create policy "admin_users_select_self"
  on public.admin_users for select
  to authenticated
  using (user_id = (select auth.uid()));

-- Nenhuma policy de insert/update/delete: só service_role/SQL Editor alteram.
revoke all on public.admin_users from anon;
revoke insert, update, delete, truncate on public.admin_users from authenticated;

-- ---------------------------------------------------------------------------
-- Leads
-- ---------------------------------------------------------------------------
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  -- Somente dígitos, formato 55 + DDD + número (ex.: 5551991757029)
  whatsapp text not null check (whatsapp ~ '^55[1-9][0-9][0-9]{8,9}$'),
  email text check (email is null or (char_length(email) <= 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  city text check (city is null or char_length(city) <= 80),
  neighborhood text check (neighborhood is null or char_length(neighborhood) <= 80),
  client_type text not null default 'residencial'
    check (client_type in ('residencial', 'condominio', 'outro')),
  interest text not null default 'outro'
    check (interest in ('manutencao_recorrente', 'limpeza_avulsa', 'produtos', 'equipamentos', 'outro')),
  source text not null default 'manual'
    check (source in ('site', 'instagram', 'indicacao', 'manual', 'outro')),
  stage text not null default 'novo'
    check (stage in ('novo', 'em_atendimento', 'orcamento_enviado', 'fechado', 'perdido')),
  initial_message text check (initial_message is null or char_length(initial_message) <= 2000),
  internal_notes text check (internal_notes is null or char_length(internal_notes) <= 5000),
  next_contact_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leads_created_at_idx on public.leads (created_at desc);
create index if not exists leads_whatsapp_idx on public.leads (whatsapp);
create index if not exists leads_stage_idx on public.leads (stage);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists leads_set_updated_at on public.leads;
create trigger leads_set_updated_at
  before update on public.leads
  for each row execute function public.set_updated_at();

alter table public.leads enable row level security;

-- anon não tem nenhum acesso direto. O formulário do site grava pelo servidor
-- (service_role), que ignora RLS e aplica validação + rate limit.
revoke all on public.leads from anon;
grant select, insert, update, delete on public.leads to authenticated;

drop policy if exists "leads_admin_select" on public.leads;
create policy "leads_admin_select"
  on public.leads for select
  to authenticated
  using ((select public.is_admin()));

drop policy if exists "leads_admin_insert" on public.leads;
create policy "leads_admin_insert"
  on public.leads for insert
  to authenticated
  with check ((select public.is_admin()));

drop policy if exists "leads_admin_update" on public.leads;
create policy "leads_admin_update"
  on public.leads for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "leads_admin_delete" on public.leads;
create policy "leads_admin_delete"
  on public.leads for delete
  to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Rate limit do formulário público (usado apenas pelo servidor)
-- ---------------------------------------------------------------------------
create table if not exists public.lead_submission_attempts (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  whatsapp text,
  created_at timestamptz not null default now()
);

create index if not exists lead_submission_attempts_ip_idx
  on public.lead_submission_attempts (ip_hash, created_at desc);
create index if not exists lead_submission_attempts_whatsapp_idx
  on public.lead_submission_attempts (whatsapp, created_at desc);

-- RLS ligado e sem policies: só service_role acessa.
alter table public.lead_submission_attempts enable row level security;
revoke all on public.lead_submission_attempts from anon, authenticated;
