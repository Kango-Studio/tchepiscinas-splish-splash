-- Agendamento e lembretes; n?o gera cobran?as nem envia mensagens.
alter table public.leads drop constraint if exists leads_stage_check;
alter table public.leads add constraint leads_stage_check check (stage in
 ('novo','em_atendimento','proposta_enviada','orcamento_enviado','aguardando_primeira_visita','fechado','perdido'));
create table public.lead_sales (
 lead_id uuid primary key references public.leads(id) on delete cascade,
 client_id uuid references public.clients(id),
 address text not null check(length(trim(address))>0),
 pool_tech_id uuid not null references public.pool_techs(id),
 expected_date date, estimate text, review_date date,
 items text[] not null check(cardinality(items)>0 and items <@ array['plano','servico','kit','produtos']::text[]),
 plan_id uuid references public.plans(id),
 agreed_value numeric(12,2) not null check(agreed_value>=0),
 service_chargeable boolean not null default true,
 confirmed_date date, confirmed_at timestamptz,
 check(expected_date is not null or (coalesce(length(trim(estimate)),0)>0 and review_date is not null)),
 check(not ('plano'=any(items)) or plan_id is not null)
);
create table public.sale_link_tasks (
 lead_id uuid not null references public.lead_sales(lead_id) on delete cascade,
 kind text not null check(kind in ('pagamento','produtos')),
 due_date date not null, sent_date date,
 primary key(lead_id,kind)
);
alter table public.lead_sales enable row level security;
alter table public.sale_link_tasks enable row level security;
create policy admin_sales on public.lead_sales for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy admin_sale_links on public.sale_link_tasks for all to authenticated using(public.is_admin()) with check(public.is_admin());
grant select on public.lead_sales,public.sale_link_tasks to authenticated;

-- Serializa todas as opera??es do mesmo lead e preserva Fechados anteriores.
create function public.schedule_first_visit(p_lead_id uuid,p_values jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare l public.leads;
begin
 if not public.is_admin() then raise exception 'Sem permiss?o'; end if;
 select * into strict l from public.leads where id=p_lead_id for update;
 if l.stage='fechado' or exists(select 1 from public.lead_sales where lead_id=p_lead_id and confirmed_at is not null) then
 raise exception 'Venda j? confirmada'; end if;
 insert into public.lead_sales(lead_id,client_id,address,pool_tech_id,expected_date,estimate,review_date,items,plan_id,agreed_value,service_chargeable)
 values(p_lead_id,nullif(p_values->>'client_id','')::uuid,p_values->>'address',(p_values->>'pool_tech_id')::uuid,
 nullif(p_values->>'expected_date','')::date,nullif(p_values->>'estimate',''),nullif(p_values->>'review_date','')::date,
 array(select jsonb_array_elements_text(p_values->'items')),nullif(p_values->>'plan_id','')::uuid,(p_values->>'agreed_value')::numeric,
 coalesce((p_values->>'service_chargeable')::boolean,true))
 on conflict(lead_id) do update set client_id=excluded.client_id,address=excluded.address,pool_tech_id=excluded.pool_tech_id,
 expected_date=excluded.expected_date,estimate=excluded.estimate,review_date=excluded.review_date,
 items=excluded.items,plan_id=excluded.plan_id,agreed_value=excluded.agreed_value,service_chargeable=excluded.service_chargeable;
 update public.leads set stage='aguardando_primeira_visita' where id=p_lead_id;
end; $$;

create function public.confirm_first_visit(p_lead_id uuid,p_date date)
returns void language plpgsql security definer set search_path='' as $$
declare s public.lead_sales; l public.leads;
 today date := (now() at time zone 'America/Sao_Paulo')::date;
begin
 if not public.is_admin() then raise exception 'Sem permiss?o'; end if;
 select * into strict l from public.leads where id=p_lead_id for update;
 select * into strict s from public.lead_sales where lead_id=p_lead_id for update;
 if s.confirmed_at is not null then return; end if;
 if l.stage<>'aguardando_primeira_visita' then raise exception 'Lead n?o est? aguardando visita'; end if;
 if p_date is null or p_date>today then raise exception 'Data efetiva inv?lida'; end if;
 update public.lead_sales set confirmed_date=p_date,confirmed_at=now() where lead_id=p_lead_id;
 insert into public.sale_link_tasks(lead_id,kind,due_date)
 select p_lead_id,k,today from (values
 ('pagamento',s.service_chargeable and s.agreed_value>0 and s.items && array['plano','servico']::text[]),
 ('produtos',s.items && array['kit','produtos']::text[])) x(k,needed)
 where needed on conflict do nothing;
 update public.leads set stage='fechado' where id=p_lead_id;
end; $$;

create function public.mark_sale_link_sent(p_lead_id uuid,p_kind text,p_date date)
returns void language plpgsql security definer set search_path='' as $$
declare s public.lead_sales;
begin
 if not public.is_admin() then raise exception 'Sem permiss?o'; end if;
 if p_date is null or p_date>(now() at time zone 'America/Sao_Paulo')::date then raise exception 'Data de envio inv?lida'; end if;
 select * into strict s from public.lead_sales where lead_id=p_lead_id for update;
 update public.sale_link_tasks set sent_date=coalesce(sent_date,p_date) where lead_id=p_lead_id and kind=p_kind;
 if not found then raise exception 'Pend?ncia n?o encontrada'; end if;
 -- Atualiza a pend?ncia existente da esteira sem dar baixa em pagamento.
 if p_kind='pagamento' and s.client_id is not null then
 update public.clients set link_enviado_em=coalesce(link_enviado_em,p_date),
 etapa_onboarding=case when etapa_onboarding='aguardando_link' then 'link_enviado' else etapa_onboarding end where id=s.client_id;
 end if;
end; $$;

-- Envio registrado na esteira existente conclui a mesma pend?ncia.
create function public.sync_first_visit_link() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.link_enviado_em is not null then
 update public.sale_link_tasks t set sent_date=coalesce(t.sent_date,new.link_enviado_em)
 from public.lead_sales s where s.client_id=new.id and s.lead_id=t.lead_id and t.kind='pagamento';
 end if;
 return null;
end; $$;
create trigger sync_first_visit_link after update of link_enviado_em on public.clients
 for each row execute function public.sync_first_visit_link();

-- Nenhuma outra tela pode pular a revisão de uma visita agendada.
create function public.guard_first_visit_close() returns trigger language plpgsql set search_path='' as $$
begin
 if old.stage='aguardando_primeira_visita' and new.stage='fechado'
 and not exists(select 1 from public.lead_sales where lead_id=new.id and confirmed_at is not null) then
 raise exception 'Confirme a primeira visita antes de fechar';
 end if;
 return new;
end; $$;
create trigger guard_first_visit_close before update of stage on public.leads
 for each row execute function public.guard_first_visit_close();
revoke all on function public.schedule_first_visit(uuid,jsonb),public.confirm_first_visit(uuid,date),public.mark_sale_link_sent(uuid,text,date) from public,anon;
grant execute on function public.schedule_first_visit(uuid,jsonb),public.confirm_first_visit(uuid,date),public.mark_sale_link_sent(uuid,text,date) to authenticated;
