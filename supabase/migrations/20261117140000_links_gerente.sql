begin;

alter table public.app_settings add column whatsapp_gerente text
  check (whatsapp_gerente is null or whatsapp_gerente ~ '^55[1-9][0-9][0-9]{8,9}$');
update public.app_settings set whatsapp_gerente = '5551996239937' where id;

alter table public.cobrancas
  add column lead_sale_id uuid references public.lead_sales(lead_id) on delete set null;
create index cobrancas_lead_sale_idx on public.cobrancas (lead_sale_id)
  where lead_sale_id is not null;

-- Registra a origem apenas nas cobranças criadas pela confirmação da visita.
alter function public.confirm_first_visit_with_finance(uuid, date, numeric, integer, numeric, date)
  rename to confirm_first_visit_with_finance_internal;
revoke all on function public.confirm_first_visit_with_finance_internal(uuid, date, numeric, integer, numeric, date)
  from public, anon, authenticated;

create function public.confirm_first_visit_with_finance(
  p_lead_id uuid, p_date date, p_kit_value numeric, p_kit_installments integer,
  p_products_value numeric, p_due_date date
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  origem_anterior text := coalesce(current_setting('tche.lead_sale_id', true), '');
begin
  perform set_config('tche.lead_sale_id', p_lead_id::text, true);
  perform public.confirm_first_visit_with_finance_internal(
    p_lead_id, p_date, p_kit_value, p_kit_installments, p_products_value, p_due_date
  );
  perform set_config('tche.lead_sale_id', origem_anterior, true);
end;
$$;

revoke all on function public.confirm_first_visit_with_finance(uuid, date, numeric, integer, numeric, date)
  from public, anon;
grant execute on function public.confirm_first_visit_with_finance(uuid, date, numeric, integer, numeric, date)
  to authenticated;

create function public.vincular_cobranca_primeira_visita()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.tipo in ('kit', 'produtos') then
    select s.lead_id into new.lead_sale_id
      from public.lead_sales s
      where s.lead_id = nullif(current_setting('tche.lead_sale_id', true), '')::uuid
        and s.client_id = new.cliente_id and s.confirmed_at is not null;
  end if;
  return new;
end;
$$;

create trigger vincular_cobranca_primeira_visita before insert on public.cobrancas
  for each row execute function public.vincular_cobranca_primeira_visita();

create table public.cobranca_link_operacoes (
  id uuid primary key,
  cliente_id uuid not null,
  cobrancas uuid[] not null,
  acao text not null,
  dados_hash bytea not null
);
alter table public.cobranca_link_operacoes enable row level security;
revoke all on public.cobranca_link_operacoes from public, anon, authenticated;

create table public.cobranca_link_eventos (
  id bigint generated always as identity primary key,
  cobranca_id uuid not null references public.cobrancas(id) on delete restrict,
  operacao_id uuid not null references public.cobranca_link_operacoes(id),
  acao text not null check (acao in (
    'abriu_gerente', 'confirmou_solicitacao', 'recebeu_link', 'abriu_cliente', 'confirmou_envio'
  )),
  registrado_em timestamptz not null default now(),
  registrado_por uuid not null,
  destinatario text,
  mensagem text,
  link text,
  unique (operacao_id, cobranca_id)
);

create index cobranca_link_eventos_cobranca_idx
  on public.cobranca_link_eventos (cobranca_id, id desc);
alter table public.cobranca_link_eventos enable row level security;
create policy admin_select_cobranca_link_eventos on public.cobranca_link_eventos
  for select to authenticated using (public.is_admin());
revoke all on public.cobranca_link_eventos from public, anon, authenticated;
grant select on public.cobranca_link_eventos to authenticated;

create function public.registrar_fluxo_link(
  p_cliente_id uuid,
  p_cobrancas uuid[],
  p_acao text,
  p_operacao_id uuid,
  p_dados jsonb default '{}'::jsonb
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  cliente public.clients;
  cobranca public.cobrancas;
  anterior public.cobranca_link_eventos;
  detalhes jsonb;
  cobrancas_ordenadas uuid[];
  dados_hash_atual bytea := sha256(convert_to(coalesce(p_dados, '{}'::jsonb)::text, 'UTF8'));
  nome text := trim(p_dados->>'nome');
  telefone text := p_dados->>'whatsapp';
  mensagem text := nullif(trim(p_dados->>'mensagem'), '');
  link_recebido text := trim(p_dados->>'link');
  destinatario_chat text;
  descricao text;
  valor_item numeric;
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  if p_acao is null or p_acao not in (
    'abriu_gerente', 'confirmou_solicitacao', 'recebeu_link', 'abriu_cliente', 'confirmou_envio'
  ) or p_operacao_id is null or coalesce(cardinality(p_cobrancas), 0) not between 1 and 100 then
    raise exception 'Selecione cobranças para esta ação.';
  end if;

  perform 1 from public.cobrancas where cliente_id = p_cliente_id
    and id = any(p_cobrancas) order by id for update;
  select * into strict cliente from public.clients where id = p_cliente_id for update;
  if (select count(*) from public.cobrancas where cliente_id = cliente.id
      and id = any(p_cobrancas) and tipo in ('mensalidade', 'kit', 'produtos'))
    <> cardinality(p_cobrancas) then
    raise exception 'A seleção contém cobranças inválidas.';
  end if;

  select array_agg(id order by id) into cobrancas_ordenadas from unnest(p_cobrancas) as ids(id);
  insert into public.cobranca_link_operacoes values (
    p_operacao_id, p_cliente_id, cobrancas_ordenadas, p_acao, dados_hash_atual
  ) on conflict (id) do nothing;
  if not found then
    if exists (select 1 from public.cobranca_link_operacoes where id = p_operacao_id
      and cliente_id = p_cliente_id and cobrancas = cobrancas_ordenadas and acao = p_acao
      and dados_hash = dados_hash_atual) then
      return;
    end if;
    raise exception 'Esta operação já foi usada. Revise o pedido e tente novamente.';
  end if;

  if p_acao in ('abriu_gerente', 'abriu_cliente') and (
    coalesce(length(nome), 0) not between 2 and 120
    or nome !~ '[^[:space:]]+[[:space:]]+[^[:space:]]+'
    or coalesce(telefone, '') !~ '^55[1-9][0-9][0-9]{8,9}$'
    or mensagem is null or length(mensagem) > 12000
  ) then
    raise exception 'Revise o nome completo, o WhatsApp e a mensagem.';
  end if;

  if p_acao = 'abriu_gerente' then
    select whatsapp_gerente into destinatario_chat from public.app_settings where id;
    if destinatario_chat is null then
      raise exception 'Preencha o WhatsApp do gerente nas Configurações.';
    end if;
    if destinatario_chat is distinct from (p_dados->>'destinatario') then
      raise exception 'O WhatsApp do gerente mudou. Confira a configuração e tente novamente.';
    end if;
  elsif p_acao = 'recebeu_link' then
    if coalesce(link_recebido, '') !~* '^https?://[^[:space:]/?#]+[^[:space:]]*$'
      or length(link_recebido) > 1000 then
      raise exception 'Cole um link de pagamento válido.';
    end if;
  elsif p_acao = 'abriu_cliente' then
    destinatario_chat := telefone;
    if destinatario_chat is distinct from (p_dados->>'destinatario') then
      raise exception 'Confira o WhatsApp do cliente.';
    end if;
  end if;

  if p_acao in ('abriu_gerente', 'abriu_cliente')
    and (cliente.name, cliente.whatsapp) is distinct from (nome, telefone) then
    update public.clients set name = nome, whatsapp = telefone where id = cliente.id;
  end if;

  for cobranca in select * from public.cobrancas where id = any(p_cobrancas) order by id for update loop
    if cobranca.status in ('pago', 'cancelado') then
      raise exception 'A cobrança foi paga ou cancelada. Atualize a seleção.';
    end if;
    select * into anterior from public.cobranca_link_eventos
      where cobranca_id = cobranca.id order by id desc limit 1;

    case p_acao
      when 'abriu_gerente' then
        detalhes := p_dados->'itens'->(cobranca.id::text);
        if cobranca.tipo <> 'kit' then
          valor_item := (detalhes->>'valor')::numeric;
          descricao := nullif(trim(detalhes->>'descricao'), '');
          if valor_item is null or valor_item not between 0.01 and 99999999.99
            or valor_item <> round(valor_item, 2)
            or (cobranca.tipo = 'produtos' and descricao is null)
            or length(descricao) > 2000 then
            raise exception 'Informe descrição e valor para os itens selecionados.';
          end if;
          update public.cobrancas
            set valor = valor_item, observacao = case when tipo = 'produtos' then descricao else observacao end
            where id = cobranca.id and (cobranca.valor is distinct from valor_item
              or (tipo = 'produtos' and cobranca.observacao is distinct from descricao));
        end if;
        if anterior.acao = p_acao and anterior.mensagem = mensagem
          and anterior.destinatario = destinatario_chat then continue; end if;
      when 'confirmou_solicitacao' then
        if anterior.acao = p_acao then continue; end if;
        if anterior.acao is distinct from 'abriu_gerente' then
          raise exception 'Abra o WhatsApp do gerente antes de confirmar a solicitação.';
        end if;
        destinatario_chat := anterior.destinatario;
      when 'recebeu_link' then
        if anterior.acao = p_acao and cobranca.link_pagamento = link_recebido then continue; end if;
        update public.cobrancas
          set link_pagamento = link_recebido, status = 'pendente', data_envio_link = null
          where id = cobranca.id;
      when 'abriu_cliente' then
        if coalesce(cobranca.link_pagamento, '') !~* '^https?://'
          or cobranca.link_pagamento is distinct from (p_dados->'links'->>(cobranca.id::text))
          or cobranca.status = 'link_enviado'
          or (anterior.acao in ('abriu_gerente','confirmou_solicitacao')
            and anterior.link is not distinct from cobranca.link_pagamento) then
          raise exception 'Salve o link recebido antes de abrir o WhatsApp do cliente.';
        end if;
        if anterior.acao = p_acao and anterior.mensagem = mensagem
          and anterior.link = cobranca.link_pagamento
          and anterior.destinatario = destinatario_chat then continue; end if;
      when 'confirmou_envio' then
        if anterior.acao = p_acao and cobranca.status = 'link_enviado' then continue; end if;
        if anterior.acao is distinct from 'abriu_cliente'
          or anterior.link is distinct from cobranca.link_pagamento then
          raise exception 'Abra o WhatsApp do cliente com o link atual antes de confirmar o envio.';
        end if;
        destinatario_chat := anterior.destinatario;
        update public.cobrancas
          set status = 'link_enviado', data_envio_link = hoje where id = cobranca.id;
    end case;

    insert into public.cobranca_link_eventos
      (cobranca_id, operacao_id, acao, registrado_por, destinatario, mensagem, link)
    values (cobranca.id, p_operacao_id, p_acao, auth.uid(), destinatario_chat, mensagem,
      case when p_acao = 'recebeu_link' then link_recebido else cobranca.link_pagamento end);
  end loop;

  -- Cada cobrança avança separadamente. O lembrete de produtos da venda só
  -- termina depois que todos os itens financeiros vinculados estiverem resolvidos.
  if p_acao = 'confirmou_envio' then
    update public.sale_link_tasks as task
    set sent_date = hoje
    where task.kind = 'produtos' and task.sent_date is null
      and exists (
        select 1 from public.cobrancas c
        where c.id = any(p_cobrancas) and c.lead_sale_id = task.lead_id
      )
      and not exists (
        select 1 from public.cobrancas c where c.lead_sale_id = task.lead_id
          and c.status not in ('link_enviado', 'pago', 'cancelado')
      );
  end if;
end;
$$;

revoke all on function public.registrar_fluxo_link(uuid, uuid[], text, uuid, jsonb) from public, anon;
grant execute on function public.registrar_fluxo_link(uuid, uuid[], text, uuid, jsonb) to authenticated;

commit;
