-- Só para o teste local: imita as funções do pgcrypto que o PGlite não tem. NÃO use no Supabase.
create schema if not exists extensions;
create or replace function extensions.gen_random_bytes(n int) returns bytea language sql volatile as $$
  select decode(string_agg(lpad(to_hex((random()*255)::int), 2, '0'), ''), 'hex') from generate_series(1, n) $$;
create or replace function extensions.digest(t text, alg text) returns bytea language sql immutable as $$ select sha256(convert_to(t, 'UTF8')) $$;
create or replace function extensions.gen_salt(t text, r int) returns text language sql volatile as $$ select '$x$' || md5(random()::text) $$;
create or replace function extensions.crypt(senha text, sal text) returns text language sql immutable as $$
  select left(sal, 35) || md5(left(sal, 35) || senha) $$;
create or replace function extensions.gen_random_uuid() returns uuid language sql volatile as $$ select gen_random_uuid() $$;
