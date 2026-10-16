-- Etapa do funil em que o lead estava quando o follow-up foi registrado.
-- Preenchida pelo banco a partir de leads.stage, então o painel não precisa enviá-la.
alter table public.lead_followups
  add column if not exists stage text
  check (
    stage is null
    or stage in (
      'novo',
      'em_atendimento',
      'proposta_enviada',
      'orcamento_enviado',
      'fechado',
      'perdido'
    )
  );

create or replace function public.set_followup_stage()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.stage is null then
    select l.stage into new.stage from public.leads l where l.id = new.lead_id;
  end if;
  return new;
end;
$$;

drop trigger if exists lead_followups_set_stage on public.lead_followups;
create trigger lead_followups_set_stage
  before insert on public.lead_followups
  for each row execute function public.set_followup_stage();

-- Follow-ups anteriores a esta migration: não há histórico de etapa, então
-- usam a etapa atual do lead como melhor aproximação.
update public.lead_followups f
set stage = l.stage
from public.leads l
where f.stage is null and l.id = f.lead_id;
