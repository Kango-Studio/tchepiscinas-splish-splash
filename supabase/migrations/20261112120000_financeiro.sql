-- Financeiro (etapa 1): forma de pagamento, vencimento e etapa de onboarding
-- do cliente; compras de kit; cobranças. Aplique no SQL Editor do Supabase.
--
-- Só ADICIONA colunas e tabelas: nada existente é apagado ou alterado.
-- Pode ser rodada mais de uma vez sem erro.
-- Valor da mensalidade = clients.custom_price (vazio = valor padrão do plano).
-- "Hoje" é sempre a data de São Paulo.

-- ---------------------------------------------------------------------------
-- Clientes: novas colunas
-- ---------------------------------------------------------------------------
alter table public.clients
  add column if not exists forma_pagamento text,
  add column if not exists dia_vencimento smallint,
  -- Clientes que já existem ficam "ativo" (já pagam normalmente).
  add column if not exists etapa_onboarding text not null default 'ativo';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'clients_forma_pagamento_check') then
    alter table public.clients add constraint clients_forma_pagamento_check
      check (forma_pagamento is null
             or forma_pagamento in ('cartao', 'pix', 'pix_automatico', 'boleto'));
  end if;
  -- Em meses mais curtos, dia 29–31 vale como o último dia do mês.
  if not exists (select 1 from pg_constraint where conname = 'clients_dia_vencimento_check') then
    alter table public.clients add constraint clients_dia_vencimento_check
      check (dia_vencimento is null or dia_vencimento between 1 and 31);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'clients_etapa_onboarding_check') then
    alter table public.clients add constraint clients_etapa_onboarding_check
      check (etapa_onboarding in
        ('venda_fechada', 'kit_pago', 'aguardando_link', 'link_enviado', 'ativo'));
  end if;
end;
$$;

comment on column public.clients.custom_price is
  'Valor da mensalidade do cliente. Vazio = valor padrão do plano.';
comment on column public.clients.forma_pagamento is
  'cartao | pix | pix_automatico | boleto (boleto só para clientes antigos).';

-- ---------------------------------------------------------------------------
-- Compras de kit (agrupa as parcelas de uma mesma compra)
-- ---------------------------------------------------------------------------
create table if not exists public.kit_compras (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clients (id) on delete restrict,
  valor_total numeric(10, 2) not null check (valor_total > 0),
  parcelas smallint not null check (parcelas between 1 and 3),
  -- Retroativa permitida. Base do aviso de reposição (~3 meses).
  data_compra date not null,
  observacao text check (observacao is null or char_length(observacao) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists kit_compras_cliente_idx on public.kit_compras (cliente_id, data_compra desc);

-- ---------------------------------------------------------------------------
-- Cobranças
-- ---------------------------------------------------------------------------
create table if not exists public.cobrancas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clients (id) on delete restrict,
  tipo text not null check (tipo in ('mensalidade', 'kit', 'avulso')),
  -- Só para tipo = 'kit': a compra a que a parcela pertence.
  kit_compra_id uuid references public.kit_compras (id) on delete restrict,
  valor numeric(10, 2) not null check (valor > 0),
  vencimento date not null,
  parcela_atual smallint not null default 1,
  total_parcelas smallint not null default 1,
  link_pagamento text check (link_pagamento is null or char_length(link_pagamento) <= 1000),
  data_envio_link date,
  data_pagamento date,
  -- 'atrasado' é aceito, mas o painel usa a view cobrancas_situacao, que
  -- calcula o atraso pela data (não depende de alguém marcar).
  status text not null default 'pendente'
    check (status in ('pendente', 'link_enviado', 'pago', 'atrasado', 'cancelado')),
  observacao text check (observacao is null or char_length(observacao) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cobrancas_parcelas_check
    check (total_parcelas >= 1 and parcela_atual between 1 and total_parcelas),
  constraint cobrancas_kit_check check ((tipo = 'kit') = (kit_compra_id is not null)),
  -- Pago sempre tem data de pagamento, e só pago tem.
  constraint cobrancas_pagamento_check check ((status = 'pago') = (data_pagamento is not null)),
  constraint cobrancas_link_enviado_check
    check (status <> 'link_enviado' or data_envio_link is not null)
);

create index if not exists cobrancas_cliente_idx on public.cobrancas (cliente_id, vencimento desc);
create index if not exists cobrancas_abertas_idx on public.cobrancas (vencimento)
  where status in ('pendente', 'link_enviado', 'atrasado');
create index if not exists cobrancas_kit_idx on public.cobrancas (kit_compra_id)
  where kit_compra_id is not null;

-- Evita lançar a mesma mensalidade duas vezes (canceladas não contam).
create unique index if not exists cobrancas_mensalidade_unica_idx
  on public.cobrancas (cliente_id, vencimento)
  where tipo = 'mensalidade' and status <> 'cancelado';

-- Evita parcela repetida na mesma compra de kit (canceladas não contam).
create unique index if not exists cobrancas_parcela_kit_unica_idx
  on public.cobrancas (kit_compra_id, parcela_atual)
  where kit_compra_id is not null and status <> 'cancelado';

-- ---------------------------------------------------------------------------
-- updated_at automático
-- ---------------------------------------------------------------------------
drop trigger if exists kit_compras_set_updated_at on public.kit_compras;
create trigger kit_compras_set_updated_at
  before update on public.kit_compras
  for each row execute function public.set_updated_at();

drop trigger if exists cobrancas_set_updated_at on public.cobrancas;
create trigger cobrancas_set_updated_at
  before update on public.cobrancas
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: só administradores, como as outras tabelas. anon não tem acesso.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['kit_compras', 'cobrancas']
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

-- ---------------------------------------------------------------------------
-- Situação calculada de cada cobrança (atraso pela data, nunca desatualizado)
-- ---------------------------------------------------------------------------
-- security_invoker: a view respeita o RLS de quem consulta.
create or replace view public.cobrancas_situacao
with (security_invoker = true)
as
select
  c.*,
  case
    when c.status in ('pendente', 'link_enviado', 'atrasado')
         and c.vencimento < (now() at time zone 'America/Sao_Paulo')::date then 'atrasado'
    when c.status = 'atrasado' then 'pendente'
    else c.status
  end as situacao,
  case
    when c.status in ('pendente', 'link_enviado', 'atrasado')
         and c.vencimento < (now() at time zone 'America/Sao_Paulo')::date
      then (now() at time zone 'America/Sao_Paulo')::date - c.vencimento
    else 0
  end as dias_atraso
from public.cobrancas c;

grant select on public.cobrancas_situacao to authenticated;
revoke all on public.cobrancas_situacao from anon;
