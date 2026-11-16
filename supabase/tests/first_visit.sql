-- Executar após as migrations, em um banco de teste (tudo termina em rollback).
-- psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/first_visit.sql
begin;
insert into auth.users(id) values ('11111111-1111-4111-8111-111111111111');
insert into public.admin_users(user_id) values ('11111111-1111-4111-8111-111111111111');
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
set local role authenticated;

do $$
declare
 lead uuid; old_lead uuid; free_lead uuid; kit_lead uuid; tech uuid; plan uuid; client uuid;
 initial_charges bigint; initial_clients bigint; initial_visits bigint;
 payload jsonb; s public.lead_sales; sent date;
 today date := (now() at time zone 'America/Sao_Paulo')::date;
 rejected boolean;
begin
 insert into public.pool_techs(name) values('Teste primeira visita') returning id into tech;
 select id into plan from public.plans limit 1;
 insert into public.clients(name,plan_id,etapa_onboarding,primeira_visita_em)
 values('Cliente de teste',plan,'aguardando_link',today-1) returning id into client;
 insert into public.leads(name,whatsapp,stage) values('Lead visita','5551999999999','orcamento_enviado') returning id into lead;
 insert into public.leads(name,whatsapp,stage) values('Fechado antigo','5551988888888','fechado') returning id into old_lead;
 select count(*) into initial_charges from public.cobrancas;
 select count(*) into initial_clients from public.clients;
 select count(*) into initial_visits from public.visits;
 payload := jsonb_build_object('client_id',client,'address','Rua de teste, 123','pool_tech_id',tech,
   'estimate','Na próxima semana','review_date',today-1,'items',array['plano','kit'], 'plan_id',plan,'agreed_value',597);

 -- Estimativa exige revisão e descrição, inclusive quando os campos são null.
 rejected := false;
 begin perform public.schedule_first_visit(lead,payload-'review_date');
 exception when check_violation then rejected:=true; end;
 assert rejected, 'Estimativa sem revisão foi aceita';
 rejected := false;
 begin perform public.schedule_first_visit(lead,payload-'estimate');
 exception when check_violation then rejected:=true; end;
 assert rejected, 'Estimativa sem descrição foi aceita';
 perform public.schedule_first_visit(lead,payload);
 assert (select stage='aguardando_primeira_visita' from public.leads where id=lead);
 assert (select coalesce(expected_date,review_date)<today from public.lead_sales where lead_id=lead), 'Lembrete atrasado não persistiu';

 -- Reagendar atualiza a mesma linha e a data do mesmo lembrete.
 payload := payload || jsonb_build_object('expected_date',today+2,'estimate',null,'review_date',null);
 perform public.schedule_first_visit(lead,payload);
 assert (select count(*)=1 from public.lead_sales where lead_id=lead);
 assert (select expected_date=today+2 and review_date is null from public.lead_sales where lead_id=lead);
 rejected := false;
 begin update public.leads set stage='fechado' where id=lead;
 exception when raise_exception then rejected:=true; end;
 assert rejected, 'Fechamento pulou a confirmação';
 rejected := false;
 begin perform public.confirm_first_visit(lead,today+1);
 exception when raise_exception then rejected:=true; end;
 assert rejected, 'Confirmação futura foi aceita';

 -- Plano com kit: dois lembretes, prazo no dia da confirmação (visita retroativa).
 perform public.confirm_first_visit(lead,today-1);
 assert (select stage='fechado' from public.leads where id=lead);
 assert (select confirmed_date=today-1 from public.lead_sales where lead_id=lead);
 assert (select count(*)=2 and bool_and(due_date=today) from public.sale_link_tasks where lead_id=lead);
 perform public.confirm_first_visit(lead,today);
 assert (select confirmed_date=today-1 from public.lead_sales where lead_id=lead), 'Reconfirmação alterou a visita';
 assert (select count(*)=2 from public.sale_link_tasks where lead_id=lead), 'Duplicou lembretes';
 assert (select count(*)=initial_charges from public.cobrancas), 'Confirmação criou cobrança';
 assert (select count(*)=initial_clients from public.clients), 'Confirmação criou cliente';
 assert (select count(*)=initial_visits from public.visits), 'Confirmação criou registro extra de visita';

 -- Envio parcial e repetido, sem baixa de pagamento.
 perform public.mark_sale_link_sent(lead,'pagamento',today);
 perform public.mark_sale_link_sent(lead,'pagamento',today-1);
 assert (select sent_date=today from public.sale_link_tasks where lead_id=lead and kind='pagamento');
 assert (select sent_date is null from public.sale_link_tasks where lead_id=lead and kind='produtos');
 assert (select link_enviado_em=today from public.clients where id=client);
 assert (select count(*)=initial_charges from public.cobrancas), 'Envio mudou cobrança';
 perform public.mark_sale_link_sent(lead,'produtos',today);
 assert (select count(*)=2 from public.sale_link_tasks where lead_id=lead and sent_date is not null);

 -- Cadastro fechado anterior continua intacto e não ganha tarefas.
 rejected := false;
 begin perform public.schedule_first_visit(old_lead,payload);
 exception when raise_exception then rejected:=true; end;
 assert rejected;
 assert (select stage='fechado' from public.leads where id=old_lead);
 assert not exists(select 1 from public.lead_sales where lead_id=old_lead);

 -- Caso da tela: fechado sem agendamento, plano de R$ 397 e sem cobrança.
 -- Só a ação explícita de reabrir permite agendar, sem alterar outros fechados.
 update public.leads set stage='orcamento_enviado' where id=old_lead;
 perform public.schedule_first_visit(old_lead,payload || jsonb_build_object('client_id',null,'items',array['plano'],'agreed_value',397,'service_chargeable',false));
 assert (select stage='aguardando_primeira_visita' from public.leads where id=old_lead);
 assert (select agreed_value=397 and not service_chargeable from public.lead_sales where lead_id=old_lead);

 -- Serviço sem cobrança não gera lembrete de pagamento.
 insert into public.leads(name,whatsapp) values('Serviço gratuito','5551977777777') returning id into free_lead;
 perform public.schedule_first_visit(free_lead,payload || jsonb_build_object('items',array['servico'],'agreed_value',0));
 perform public.confirm_first_visit(free_lead,today);
 assert not exists(select 1 from public.sale_link_tasks where lead_id=free_lead);

 -- Serviço de cortesia combinado com kit pago: somente link de produtos.
 insert into public.leads(name,whatsapp) values('Serviço e kit','5551944444444') returning id into free_lead;
 perform public.schedule_first_visit(free_lead,payload || jsonb_build_object('items',array['servico','kit'],'agreed_value',200,'service_chargeable',false));
 perform public.confirm_first_visit(free_lead,today);
 assert (select count(*)=1 and bool_and(kind='produtos') from public.sale_link_tasks where lead_id=free_lead);

 -- Kit sem visita preserva o fechamento direto, sem tarefas automáticas.
 insert into public.leads(name,whatsapp,interest,stage) values('Kit avulso','5551966666666','produtos','fechado') returning id into kit_lead;
 assert not exists(select 1 from public.sale_link_tasks where lead_id=kit_lead);
 -- Kit com visita gera só o lembrete de produtos.
 update public.leads set stage='orcamento_enviado' where id=kit_lead;
 perform public.schedule_first_visit(kit_lead,payload || jsonb_build_object('items',array['kit'],'agreed_value',200));
 perform public.confirm_first_visit(kit_lead,today);
 assert (select count(*)=1 and bool_and(kind='produtos') from public.sale_link_tasks where lead_id=kit_lead);

 -- A ação antiga do Financeiro conclui o mesmo lembrete de pagamento.
 insert into public.leads(name,whatsapp) values('Envio pela esteira','5551955555555') returning id into free_lead;
 perform public.schedule_first_visit(free_lead,payload || jsonb_build_object('items',array['servico'],'agreed_value',100));
 perform public.confirm_first_visit(free_lead,today);
 update public.clients set link_enviado_em=today where id=client;
 assert (select sent_date=today from public.sale_link_tasks where lead_id=free_lead and kind='pagamento');
 raise notice 'OK: estimativa, revisão obrigatória, reagendamento, atraso, confirmação, envio parcial, idempotência, fechamento direto e integração financeira';
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
do $$
declare rejected boolean := false;
begin
 assert (select count(*)=0 from public.lead_sales), 'RLS expôs vendas';
 assert (select count(*)=0 from public.sale_link_tasks), 'RLS expôs lembretes';
 begin perform public.confirm_first_visit(gen_random_uuid(),current_date);
 exception when raise_exception then rejected:=true; end;
 assert rejected, 'Não administrador conseguiu confirmar';
end $$;
rollback;
