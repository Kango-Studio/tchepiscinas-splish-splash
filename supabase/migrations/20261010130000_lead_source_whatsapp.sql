-- Nova origem de lead: "whatsapp" (cadastro a partir de print de conversa).
alter table public.leads drop constraint if exists leads_source_check;
alter table public.leads
  add constraint leads_source_check
  check (source in ('site', 'instagram', 'whatsapp', 'indicacao', 'manual', 'outro'));
