-- Trucatro: Desafio do dia (ranking). Rode DEPOIS do schema.sql (ou cole o schema.sql inteiro, que já inclui isto).
-- Pode rodar de novo sem perder dados.

create table if not exists trucatro_desafios (
  conta_id uuid not null references trucatro_contas(id) on delete cascade,
  dia date not null,
  pontos int not null,
  bairro int not null,
  mesas int not null,
  enviado_em timestamptz not null default now(),
  primary key (conta_id, dia)
);
alter table trucatro_desafios enable row level security;
create index if not exists trucatro_desafios_dia on trucatro_desafios (dia, pontos desc);

do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on trucatro_desafios from %I', r);
    end if;
  end loop;
end $$;

-- Top 50 do dia: nome, pontos, bairro e mesas vencidas
create or replace function trucatro_desafio_ranking(p_dia date) returns json
language sql security definer set search_path = public as $$
  select coalesce(json_agg(x), '[]'::json) from (
    select c.nome, d.pontos, d.bairro, d.mesas
    from trucatro_desafios d join trucatro_contas c on c.id = d.conta_id
    where d.dia = p_dia
    order by d.pontos desc, d.enviado_em
    limit 50
  ) x;
$$;

-- Envia o resultado do desafio (fica o melhor do dia de cada conta) e devolve o ranking
create or replace function trucatro_desafio_enviar(p_token text, p_dia date, p_pontos int, p_bairro int, p_mesas int) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare c trucatro_contas := trucatro__conta(p_token);
declare hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if p_dia < hoje - 1 or p_dia > hoje + 1 then perform trucatro__erro('Esse desafio já fechou'); end if;
  if p_pontos < 0 or p_pontos > 50000000 or p_bairro < 1 or p_bairro > 99 or p_mesas < 0 or p_mesas > 300 then
    perform trucatro__erro('Resultado inválido');
  end if;
  perform trucatro__limite('desafio:' || c.id::text, 30);
  insert into trucatro_desafios (conta_id, dia, pontos, bairro, mesas) values (c.id, p_dia, p_pontos, p_bairro, p_mesas)
  on conflict (conta_id, dia) do update set
    pontos = greatest(trucatro_desafios.pontos, excluded.pontos),
    bairro = greatest(trucatro_desafios.bairro, excluded.bairro),
    mesas = greatest(trucatro_desafios.mesas, excluded.mesas),
    enviado_em = now();
  return trucatro_desafio_ranking(p_dia);
end $$;

do $$
declare f record;
begin
  for f in select p.oid::regprocedure as assinatura from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('trucatro_desafio_ranking', 'trucatro_desafio_enviar') loop
    execute format('revoke all on function %s from public', f.assinatura);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('grant execute on function %s to anon, authenticated', f.assinatura);
    end if;
  end loop;
end $$;
