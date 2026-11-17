-- Execute após as migrações, em um banco de teste. Tudo termina em rollback.
begin;
insert into auth.users(id) values ('11111111-1111-4111-8111-111111111112');
insert into public.admin_users(user_id) values ('11111111-1111-4111-8111-111111111112');
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111112',true);
set local role authenticated;

do $$
declare
  cliente uuid;
  lead uuid;
  tecnico uuid;
  plano uuid;
  mensalidade uuid;
  produtos uuid;
  kit uuid[];
  pedido uuid := gen_random_uuid();
  link_mensalidade text := 'https://example.com/mensalidade';
  link_kit text := 'https://example.com/kit';
  payload jsonb;
  nao_admin uuid := '22222222-2222-4222-8222-222222222222';
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  rejeitou boolean;
begin
  select id into plano from public.plans where name = 'Recorrente';
  insert into public.pool_techs(name) values ('Teste dos links') returning id into tecnico;
  insert into public.leads(name, whatsapp) values ('Maria', '5551999999999') returning id into lead;
  perform public.schedule_first_visit(lead, jsonb_build_object(
    'address', 'Endereço de teste', 'pool_tech_id', tecnico, 'expected_date', hoje,
    'items', array['plano','kit','produtos'], 'plan_id', plano, 'agreed_value', 397
  ));
  perform public.confirm_first_visit_with_finance(lead, hoje, 284, 3, 50, hoje+2);
  select client_id into strict cliente from public.lead_sales where lead_id = lead;
  select array_agg(id order by parcela_atual) into kit
    from public.cobrancas where cliente_id = cliente and tipo = 'kit';
  select id into strict produtos from public.cobrancas where cliente_id = cliente and tipo = 'produtos';
  insert into public.cobrancas(cliente_id, tipo, valor, vencimento)
    values (cliente, 'mensalidade', 397, hoje+1) returning id into mensalidade;

  payload := jsonb_build_object(
    'nome', 'Maria da Silva', 'whatsapp', '5551988888888',
    'destinatario', '5551996239937', 'mensagem', 'Pedido de mensalidade e kit',
    'itens', jsonb_build_object(mensalidade, jsonb_build_object('valor',397))
  );

  -- A ausência de configuração e os dados obrigatórios impedem a gravação.
  update public.app_settings set whatsapp_gerente = null where id;
  rejeitou := false;
  begin
    perform public.registrar_fluxo_link(cliente, array[mensalidade], 'abriu_gerente', pedido, payload);
  exception when raise_exception then rejeitou := true; end;
  assert rejeitou;
  update public.app_settings set whatsapp_gerente = '5551996239937' where id;
  rejeitou := false;
  begin
    perform public.registrar_fluxo_link(cliente, array[mensalidade], 'abriu_gerente', pedido, payload - 'whatsapp');
  exception when raise_exception then rejeitou := true; end;
  assert rejeitou;

  -- Se um item da seleção falhar, cadastro, cobrança e histórico sofrem rollback juntos.
  rejeitou := false;
  begin
    perform public.registrar_fluxo_link(cliente, array[mensalidade, produtos], 'abriu_gerente', pedido, payload);
  exception when raise_exception then rejeitou := true; end;
  assert rejeitou;
  assert (select name = 'Maria' from public.clients where id = cliente);
  assert not exists (select 1 from public.cobranca_link_eventos where cobranca_id = any(array[mensalidade,produtos]));

  -- Um pedido combinado, retomado ou repetido antes da confirmação, não duplica eventos.
  perform public.registrar_fluxo_link(cliente, array[mensalidade] || kit, 'abriu_gerente', pedido, payload);
  perform public.registrar_fluxo_link(cliente, kit || mensalidade, 'abriu_gerente', pedido, payload);
  perform public.registrar_fluxo_link(cliente, array[mensalidade] || kit, 'abriu_gerente', gen_random_uuid(), payload);
  assert (select count(*) = 4 from public.cobranca_link_eventos where operacao_id = pedido);
  assert (select count(*) = 4 from public.cobranca_link_eventos where cobranca_id = any(array[mensalidade] || kit));
  assert (select name = 'Maria da Silva' and whatsapp = '5551988888888' from public.clients where id = cliente);
  perform public.registrar_fluxo_link(cliente, array[mensalidade] || kit, 'confirmou_solicitacao', gen_random_uuid());

  -- O gerente retorna e o cliente recebe a mensalidade primeiro.
  perform public.registrar_fluxo_link(cliente, array[mensalidade], 'recebeu_link', gen_random_uuid(),
    jsonb_build_object('link', link_mensalidade));
  assert (select link_pagamento = link_mensalidade and status = 'pendente'
    from public.cobrancas where id = mensalidade);
  assert not exists (select 1 from public.cobrancas where id = any(kit) and link_pagamento is not null);
  perform public.registrar_fluxo_link(cliente, array[mensalidade], 'abriu_cliente', gen_random_uuid(),
    jsonb_build_object('nome','Maria da Silva','whatsapp','5551988888888','destinatario','5551988888888','mensagem','Segue o link',
      'links', jsonb_build_object(mensalidade, link_mensalidade)));
  perform public.registrar_fluxo_link(cliente, array[mensalidade], 'confirmou_envio', gen_random_uuid());
  assert (select status = 'link_enviado' and data_envio_link = hoje and data_pagamento is null
    from public.cobrancas where id = mensalidade);
  assert (select sent_date = hoje from public.sale_link_tasks where lead_id = lead and kind = 'pagamento');
  assert (select count(*) = 1 from public.cobranca_link_eventos where cobranca_id = mensalidade
    and acao = 'confirmou_envio' and registrado_por = auth.uid() and registrado_em is not null);

  -- Reenvio do pedido mantém o histórico e um link pode ser salvo para o kit inteiro.
  perform public.registrar_fluxo_link(cliente, kit, 'abriu_gerente', gen_random_uuid(),
    payload || jsonb_build_object('mensagem','Novo pedido de kit','itens','{}'::jsonb));
  assert (select count(*) = 6 from public.cobranca_link_eventos where cobranca_id = any(kit) and acao = 'abriu_gerente');
  perform public.registrar_fluxo_link(cliente, kit, 'confirmou_solicitacao', gen_random_uuid());
  perform public.registrar_fluxo_link(cliente, kit, 'recebeu_link', gen_random_uuid(), jsonb_build_object('link', link_kit));
  assert (select count(*) = 3 from public.cobrancas where id = any(kit) and link_pagamento = link_kit);

  -- Uma descrição corrigida pelo modal acompanha a cobrança manual ou automática.
  perform public.registrar_fluxo_link(cliente, array[produtos], 'abriu_gerente', gen_random_uuid(),
    payload || jsonb_build_object('mensagem','Somente produtos',
      'itens',jsonb_build_object(produtos,jsonb_build_object('valor',55,'descricao','Cloro'))));
  assert (select valor = 55 and observacao = 'Cloro' from public.cobrancas where id = produtos);
  assert (select count(*) = 5 from public.cobrancas where cliente_id = cliente);
  assert (select count(*) = 4 from public.cobrancas where lead_sale_id = lead);

  -- O mesmo link pode cobrir um kit e os produtos. Os envios continuam individuais.
  perform public.registrar_fluxo_link(cliente, kit || produtos, 'recebeu_link', gen_random_uuid(),
    jsonb_build_object('link', link_kit));
  payload := jsonb_build_object('nome','Maria da Silva','whatsapp','5551988888888','destinatario','5551988888888','mensagem','Links do kit e do cloro',
    'links', (select jsonb_object_agg(id, link_kit) from unnest(kit || produtos) as ids(id)));
  perform public.registrar_fluxo_link(cliente, kit || produtos, 'abriu_cliente', gen_random_uuid(), payload);
  perform public.registrar_fluxo_link(cliente, array[produtos], 'confirmou_envio', gen_random_uuid());
  assert (select sent_date is null from public.sale_link_tasks where lead_id = lead and kind = 'produtos');
  perform public.registrar_fluxo_link(cliente, kit, 'confirmou_envio', gen_random_uuid());
  assert (select sent_date = hoje from public.sale_link_tasks where lead_id = lead and kind = 'produtos');

  -- Continua sendo possível registrar a baixa pela operação atual do Financeiro.
  update public.cobrancas set status = 'pago', data_pagamento = hoje where id = mensalidade;
  assert (select etapa_onboarding = 'ativo' from public.clients where id = cliente);

  perform set_config('request.jwt.claim.sub', nao_admin::text, true);
  assert not exists (select 1 from public.cobranca_link_eventos);
  rejeitou := false;
  begin
    perform public.registrar_fluxo_link(cliente, array[produtos], 'confirmou_solicitacao', gen_random_uuid());
  exception when insufficient_privilege then rejeitou := true; end;
  assert rejeitou;
end;
$$;

rollback;
