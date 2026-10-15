-- Nova etapa do funil: "proposta_enviada" (detalhes do plano, sem valores),
-- entre "em_atendimento" (aguardando endereço) e "orcamento_enviado" (valor enviado).
alter table public.leads drop constraint if exists leads_stage_check;
alter table public.leads
  add constraint leads_stage_check
  check (
    stage in (
      'novo',
      'em_atendimento',
      'proposta_enviada',
      'orcamento_enviado',
      'fechado',
      'perdido'
    )
  );
