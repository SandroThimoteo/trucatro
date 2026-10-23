-- Trucatro online: contas, convites, perfis e admin no Supabase.
-- Como usar: Supabase > SQL Editor > New query > cole este arquivo inteiro > Run.
-- Pode rodar de novo sem perder dados (só recria as funções).
--
-- Segurança: as tabelas ficam fechadas (RLS ligado, sem políticas, sem permissões para anon).
-- O jogo só conversa com o banco pelas funções abaixo, que conferem token, senha e admin.
-- A primeira conta criada vira admin e não precisa de convite; as outras precisam.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists trucatro_contas (
  id uuid primary key default extensions.gen_random_uuid(),
  nome text not null,
  nome_chave text not null unique,
  hash text not null,
  admin boolean not null default false,
  convite text,
  criado_em timestamptz not null default now()
);

create table if not exists trucatro_sessoes (
  token_hash text primary key,
  conta_id uuid not null references trucatro_contas(id) on delete cascade,
  criado_em timestamptz not null default now(),
  usado_em timestamptz not null default now()
);

create table if not exists trucatro_perfis (
  conta_id uuid primary key references trucatro_contas(id) on delete cascade,
  perfil jsonb not null default '{}'::jsonb,
  atualizado_em timestamptz not null default now()
);

create table if not exists trucatro_convites (
  codigo text primary key,
  criado_por uuid references trucatro_contas(id) on delete set null,
  observacao text,
  criado_em timestamptz not null default now(),
  usado_por uuid references trucatro_contas(id) on delete set null,
  usado_em timestamptz
);

-- Ajustes do admin esperando o jogo do jogador buscar (se ele estiver jogando agora)
create table if not exists trucatro_ajustes (
  id bigint generated always as identity primary key,
  conta_id uuid not null references trucatro_contas(id) on delete cascade,
  tampinhas integer,
  reis integer,
  criado_em timestamptz not null default now(),
  entregue boolean not null default false
);

create table if not exists trucatro_tentativas (
  chave text not null,
  em timestamptz not null default now()
);
create index if not exists trucatro_tentativas_idx on trucatro_tentativas (chave, em);

alter table trucatro_contas enable row level security;
alter table trucatro_sessoes enable row level security;
alter table trucatro_perfis enable row level security;
alter table trucatro_convites enable row level security;
alter table trucatro_ajustes enable row level security;
alter table trucatro_tentativas enable row level security;

do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on trucatro_contas, trucatro_sessoes, trucatro_perfis, trucatro_convites, trucatro_ajustes, trucatro_tentativas from %I', r);
    end if;
  end loop;
end $$;

-- ---------- utilitários internos ----------

create or replace function trucatro__erro(msg text) returns void
language plpgsql as $$ begin raise exception '%', msg using errcode = 'P0001'; end $$;

create or replace function trucatro__chave(p_nome text) returns text
language sql immutable as $$ select lower(btrim(p_nome)) $$;

create or replace function trucatro__novo_token(p_conta uuid) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare t text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  insert into trucatro_sessoes (token_hash, conta_id) values (encode(extensions.digest(t, 'sha256'), 'hex'), p_conta);
  -- no máximo 10 sessões por conta
  delete from trucatro_sessoes where conta_id = p_conta and token_hash not in (
    select token_hash from trucatro_sessoes where conta_id = p_conta order by usado_em desc limit 10);
  return t;
end $$;

create or replace function trucatro__conta(p_token text) returns trucatro_contas
language plpgsql security definer set search_path = public, extensions as $$
declare c trucatro_contas;
declare h text := encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');
begin
  select x.* into c from trucatro_sessoes s join trucatro_contas x on x.id = s.conta_id where s.token_hash = h;
  if c.id is null then perform trucatro__erro('Sessão expirada. Entre de novo.'); end if;
  update trucatro_sessoes set usado_em = now() where token_hash = h;
  return c;
end $$;

create or replace function trucatro__admin(p_token text) returns trucatro_contas
language plpgsql security definer set search_path = public, extensions as $$
declare c trucatro_contas := trucatro__conta(p_token);
begin
  if not c.admin then perform trucatro__erro('Só o admin pode fazer isso.'); end if;
  return c;
end $$;

create or replace function trucatro__limite(p_chave text, p_max int) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  delete from trucatro_tentativas where em < now() - interval '10 minutes';
  if (select count(*) from trucatro_tentativas where chave = p_chave and em > now() - interval '1 minute') >= p_max then
    perform trucatro__erro('Muitas tentativas. Espere um minuto.');
  end if;
  insert into trucatro_tentativas (chave) values (p_chave);
end $$;

-- Aplica valores definidos pelo admin num perfil (réis ficam dentro da run salva, que é um texto JSON)
create or replace function trucatro__aplicar(p_perfil jsonb, p_tampinhas int, p_reis int) returns jsonb
language plpgsql volatile as $$
declare p jsonb := coalesce(p_perfil, '{}'::jsonb);
declare s jsonb;
begin
  if p_tampinhas is null and p_reis is null then return p; end if;
  -- Marca como mais novo que qualquer cópia local do jogador
  p := jsonb_set(p, '{atualizadoEm}', to_jsonb((extract(epoch from clock_timestamp()) * 1000)::bigint));
  if p_tampinhas is not null then p := jsonb_set(p, '{tampinhas}', to_jsonb(greatest(0, p_tampinhas))); end if;
  if p_reis is not null and jsonb_typeof(p -> 'save') = 'string' then
    s := (p ->> 'save')::jsonb;
    s := jsonb_set(s, '{reis}', to_jsonb(greatest(0, p_reis)));
    p := jsonb_set(p, '{save}', to_jsonb(s::text));
  end if;
  return p;
end $$;

create or replace function trucatro__reis(p_perfil jsonb) returns int
language plpgsql immutable as $$
begin
  if jsonb_typeof(p_perfil -> 'save') <> 'string' then return null; end if;
  return ((p_perfil ->> 'save')::jsonb ->> 'reis')::int;
exception when others then return null;
end $$;

-- ---------- conta ----------

create or replace function trucatro_status() returns json
language sql security definer set search_path = public as $$
  select json_build_object('trucatro', true, 'temAdmin', exists (select 1 from trucatro_contas where admin));
$$;

create or replace function trucatro_cadastrar(p_nome text, p_senha text, p_convite text default null) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_nome text := btrim(coalesce(p_nome, ''));
  v_convite text := upper(btrim(coalesce(p_convite, '')));
  v_primeira boolean;
  v_id uuid;
begin
  perform trucatro__limite('cadastro', 20);
  if v_nome !~ '^[A-Za-z0-9À-ÖØ-öø-ÿ _.-]{3,20}$' then perform trucatro__erro('Nome: de 3 a 20 letras ou números'); end if;
  if length(coalesce(p_senha, '')) < 6 or length(p_senha) > 100 then perform trucatro__erro('Senha: pelo menos 6 caracteres'); end if;
  if exists (select 1 from trucatro_contas where nome_chave = trucatro__chave(v_nome)) then
    perform trucatro__erro('Esse nome já tem conta. Use Entrar.');
  end if;
  lock table trucatro_contas in exclusive mode;
  v_primeira := not exists (select 1 from trucatro_contas);
  if not v_primeira then
    update trucatro_convites set usado_em = now() where codigo = v_convite and usado_por is null returning codigo into v_convite;
    if v_convite is null then perform trucatro__erro('Convite inválido ou já usado. Peça um convite ao admin.'); end if;
  end if;
  insert into trucatro_contas (nome, nome_chave, hash, admin, convite)
    values (v_nome, trucatro__chave(v_nome), extensions.crypt(p_senha, extensions.gen_salt('bf', 10)), v_primeira, nullif(v_convite, ''))
    returning id into v_id;
  if not v_primeira then update trucatro_convites set usado_por = v_id where codigo = v_convite; end if;
  insert into trucatro_perfis (conta_id) values (v_id);
  return json_build_object('token', trucatro__novo_token(v_id), 'nome', v_nome, 'admin', v_primeira);
end $$;

create or replace function trucatro_entrar(p_nome text, p_senha text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare c trucatro_contas;
declare v_chave text := 'entrar:' || trucatro__chave(coalesce(p_nome, ''));
begin
  delete from trucatro_tentativas where em < now() - interval '10 minutes';
  if (select count(*) from trucatro_tentativas where chave = v_chave and em > now() - interval '1 minute') >= 8 then
    perform trucatro__erro('Muitas tentativas. Espere um minuto.');
  end if;
  select * into c from trucatro_contas where nome_chave = trucatro__chave(coalesce(p_nome, ''));
  if c.id is null or c.hash <> extensions.crypt(coalesce(p_senha, ''), c.hash) then
    -- Devolve o erro em vez de lançar, para a tentativa errada ficar registrada (lançar desfaria o insert)
    insert into trucatro_tentativas (chave) values (v_chave);
    return json_build_object('erro', 'Nome ou senha errados');
  end if;
  return json_build_object('token', trucatro__novo_token(c.id), 'nome', c.nome, 'admin', c.admin);
end $$;

create or replace function trucatro_eu(p_token text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare c trucatro_contas := trucatro__conta(p_token);
begin
  return json_build_object('nome', c.nome, 'admin', c.admin);
end $$;

create or replace function trucatro_sair(p_token text) returns json
language plpgsql security definer set search_path = public, extensions as $$
begin
  delete from trucatro_sessoes where token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');
  return json_build_object('ok', true);
end $$;

-- ---------- perfil ----------

create or replace function trucatro_carregar(p_token text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare c trucatro_contas := trucatro__conta(p_token);
declare v jsonb;
begin
  update trucatro_ajustes set entregue = true where conta_id = c.id and not entregue;
  select perfil into v from trucatro_perfis where conta_id = c.id;
  return json_build_object('perfil', case when v = '{}'::jsonb then null else v end);
end $$;

-- Salva o perfil. Se o admin mudou algo enquanto o jogador jogava, aplica por cima e devolve os valores.
create or replace function trucatro_salvar(p_token text, p_perfil jsonb) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare c trucatro_contas := trucatro__conta(p_token);
declare a record;
declare v jsonb := p_perfil;
declare t int;
declare r int;
begin
  if jsonb_typeof(p_perfil) <> 'object' then perform trucatro__erro('Perfil inválido'); end if;
  if length(p_perfil::text) > 1000000 then perform trucatro__erro('Progresso grande demais'); end if;
  for a in select * from trucatro_ajustes where conta_id = c.id and not entregue order by id loop
    v := trucatro__aplicar(v, a.tampinhas, a.reis);
    t := coalesce(a.tampinhas, t);
    r := coalesce(a.reis, r);
  end loop;
  update trucatro_ajustes set entregue = true where conta_id = c.id and not entregue;
  insert into trucatro_perfis (conta_id, perfil, atualizado_em) values (c.id, v, now())
    on conflict (conta_id) do update set perfil = excluded.perfil, atualizado_em = now();
  return json_build_object('ok', true, 'ajustes', case when t is null and r is null then null else json_build_object('tampinhas', t, 'reis', r) end);
end $$;

-- ---------- admin ----------

create or replace function trucatro_admin_jogadores(p_token text) returns json
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform trucatro__admin(p_token);
  return coalesce((
    select json_agg(json_build_object(
      'nome', c.nome, 'admin', c.admin, 'convite', c.convite, 'criadoEm', c.criado_em,
      'tampinhas', coalesce((p.perfil ->> 'tampinhas')::int, 0),
      'reis', trucatro__reis(p.perfil),
      'atualizadoEm', p.atualizado_em
    ) order by c.criado_em)
    from trucatro_contas c left join trucatro_perfis p on p.conta_id = c.id), '[]'::json);
end $$;

-- Define Tampinhas e/ou réis (da run em andamento) de um jogador. null = não mexe.
create or replace function trucatro_admin_definir(p_token text, p_nome text, p_tampinhas int default null, p_reis int default null) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare alvo trucatro_contas;
begin
  perform trucatro__admin(p_token);
  select * into alvo from trucatro_contas where nome_chave = trucatro__chave(coalesce(p_nome, ''));
  if alvo.id is null then perform trucatro__erro('Jogador não encontrado'); end if;
  if p_tampinhas is not null and (p_tampinhas < 0 or p_tampinhas > 1000000) then perform trucatro__erro('Tampinhas: de 0 a 1.000.000'); end if;
  if p_reis is not null and (p_reis < 0 or p_reis > 1000000) then perform trucatro__erro('Réis: de 0 a 1.000.000'); end if;
  update trucatro_perfis set perfil = trucatro__aplicar(perfil, p_tampinhas, p_reis), atualizado_em = now() where conta_id = alvo.id;
  insert into trucatro_ajustes (conta_id, tampinhas, reis) values (alvo.id, p_tampinhas, p_reis);
  return json_build_object('ok', true);
end $$;

create or replace function trucatro_admin_criar_convites(p_token text, p_quantidade int, p_observacao text default null) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare adm trucatro_contas := trucatro__admin(p_token);
declare codigos text[] := '{}';
declare cod text;
declare letras text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
declare b bytea;
declare i int;
begin
  if p_quantidade is null or p_quantidade < 1 or p_quantidade > 100 then perform trucatro__erro('Quantidade: de 1 a 100 convites'); end if;
  while coalesce(array_length(codigos, 1), 0) < p_quantidade loop
    b := extensions.gen_random_bytes(8);
    cod := '';
    for i in 0..7 loop
      cod := cod || substr(letras, (get_byte(b, i) % 32) + 1, 1);
      if i = 3 then cod := cod || '-'; end if;
    end loop;
    insert into trucatro_convites (codigo, criado_por, observacao) values (cod, adm.id, nullif(btrim(coalesce(p_observacao, '')), ''))
      on conflict do nothing;
    if found then codigos := codigos || cod; end if;
  end loop;
  return to_json(codigos);
end $$;

create or replace function trucatro_admin_convites(p_token text) returns json
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform trucatro__admin(p_token);
  return coalesce((
    select json_agg(json_build_object(
      'codigo', v.codigo, 'observacao', v.observacao, 'criadoEm', v.criado_em,
      'usadoPor', (select nome from trucatro_contas where id = v.usado_por), 'usadoEm', v.usado_em
    ) order by v.criado_em desc)
    from trucatro_convites v), '[]'::json);
end $$;

create or replace function trucatro_admin_apagar_convite(p_token text, p_codigo text) returns json
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform trucatro__admin(p_token);
  delete from trucatro_convites where codigo = upper(btrim(coalesce(p_codigo, ''))) and usado_por is null;
  if not found then perform trucatro__erro('Convite não existe ou já foi usado'); end if;
  return json_build_object('ok', true);
end $$;

-- ---------- Desafio do dia ----------
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

-- Só as funções públicas ficam liberadas para o site; as internas (trucatro__*) não.
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as assinatura, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like 'trucatro%' loop
    execute format('revoke all on function %s from public', f.assinatura);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      if f.proname like 'trucatro\_\_%' then
        execute format('revoke all on function %s from anon, authenticated', f.assinatura);
      else
        execute format('grant execute on function %s to anon, authenticated', f.assinatura);
      end if;
    end if;
  end loop;
end $$;
