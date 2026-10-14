-- Follow-ups (checkpoints de contato) por lead.
-- Aplique no SQL Editor do Supabase ou com `supabase db push`.

create table if not exists public.lead_followups (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  -- Quando o follow-up foi feito (pode ser registrado retroativamente).
  done_at timestamptz not null default now(),
  note text check (note is null or char_length(note) <= 500),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists lead_followups_lead_idx
  on public.lead_followups (lead_id, done_at);

alter table public.lead_followups enable row level security;

revoke all on public.lead_followups from anon;
grant select, insert, update, delete on public.lead_followups to authenticated;

drop policy if exists "lead_followups_admin_select" on public.lead_followups;
create policy "lead_followups_admin_select"
  on public.lead_followups for select
  to authenticated
  using ((select public.is_admin()));

drop policy if exists "lead_followups_admin_insert" on public.lead_followups;
create policy "lead_followups_admin_insert"
  on public.lead_followups for insert
  to authenticated
  with check ((select public.is_admin()));

drop policy if exists "lead_followups_admin_update" on public.lead_followups;
create policy "lead_followups_admin_update"
  on public.lead_followups for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "lead_followups_admin_delete" on public.lead_followups;
create policy "lead_followups_admin_delete"
  on public.lead_followups for delete
  to authenticated
  using ((select public.is_admin()));
