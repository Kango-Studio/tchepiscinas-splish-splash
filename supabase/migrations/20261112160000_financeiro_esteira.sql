-- Financeiro (etapas 3 e 4): esteira do cliente novo e pendências.
-- Aplique no SQL Editor do Supabase depois de 20261112150000_financeiro_tipos.sql.
-- Só adiciona colunas, funções e gatilhos: nada é apagado ou alterado.
-- Pode rodar mais de uma vez.
--
-- Esteira: venda_fechada → kit_pago → aguardando_link (1ª visita feita)
--          → link_enviado → ativo. Cada etapa guarda a sua data.
-- A esteira só anda para a frente sozinha:
-- - 1ª visita registrada (venda fechada ou kit pago) → aguardando_link
-- - parcela de kit paga (venda fechada)             → kit_pago
-- - link de mensalidade enviado (antes do envio)    → link_enviado
-- - mensalidade paga (qualquer etapa antes de ativo) → ativo
-- Voltar uma etapa só à mão, pelo painel.

alter table public.clients
  add column if not exists venda_fechada_em date,
  add column if not exists kit_pago_em date,
  add column if not exists primeira_visita_em date,
  add column if not exists link_enviado_em date,
  add column if not exists ativo_em date;

-- Aviso de reposição do kit (~3 meses): some quando a oferta é registrada.
alter table public.kit_compras add column if not exists reposicao_oferecida_em date;

-- ---------------------------------------------------------------------------
-- 1ª visita → aguardando envio do link
-- ---------------------------------------------------------------------------
create or replace function public.visits_avanca_esteira()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.clients c
  set etapa_onboarding = 'aguardando_link',
      primeira_visita_em = coalesce(c.primeira_visita_em, new.visit_date)
  where c.id = new.client_id
    and c.etapa_onboarding in ('venda_fechada', 'kit_pago');
  return null;
end;
$$;

drop trigger if exists visits_avanca_esteira on public.visits;
create trigger visits_avanca_esteira
  after insert on public.visits
  for each row execute function public.visits_avanca_esteira();

-- ---------------------------------------------------------------------------
-- Cobranças → kit pago, link enviado, ativo
-- ---------------------------------------------------------------------------
create or replace function public.cobrancas_avanca_esteira()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.tipo = 'kit' and new.status = 'pago' then
    update public.clients c
    set etapa_onboarding = 'kit_pago',
        kit_pago_em = coalesce(c.kit_pago_em, new.data_pagamento)
    where c.id = new.cliente_id and c.etapa_onboarding = 'venda_fechada';
  end if;

  if new.tipo = 'mensalidade' and new.status = 'link_enviado' then
    update public.clients c
    set etapa_onboarding = 'link_enviado',
        link_enviado_em = coalesce(c.link_enviado_em, new.data_envio_link)
    where c.id = new.cliente_id
      and c.etapa_onboarding in ('venda_fechada', 'kit_pago', 'aguardando_link');
  end if;

  if new.tipo = 'mensalidade' and new.status = 'pago' then
    update public.clients c
    set etapa_onboarding = 'ativo',
        ativo_em = coalesce(c.ativo_em, new.data_pagamento),
        link_enviado_em = coalesce(c.link_enviado_em, new.data_envio_link)
    where c.id = new.cliente_id and c.etapa_onboarding <> 'ativo';
  end if;

  return null;
end;
$$;

drop trigger if exists cobrancas_avanca_esteira on public.cobrancas;
create trigger cobrancas_avanca_esteira
  after insert or update of status on public.cobrancas
  for each row execute function public.cobrancas_avanca_esteira();
