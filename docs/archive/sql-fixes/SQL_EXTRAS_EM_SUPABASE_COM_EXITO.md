Relação de sql rodadas com êxito em 22/02/2026



create unique index if not exists stores\_slug\_lower\_uniq

on public.stores (lower(slug));

--------

create or replace function public.normalize\_phone\_digits()

returns trigger

language plpgsql

set search\_path = public, pg\_temp

as $$

begin

&nbsp; if new.phone is not null then

&nbsp;   new.phone := regexp\_replace(new.phone, '\\D', '', 'g');

&nbsp; end if;

&nbsp; return new;

end;

$$;



drop trigger if exists trg\_customers\_normalize\_phone on public.customers;

create trigger trg\_customers\_normalize\_phone

before insert or update of phone on public.customers

for each row execute function public.normalize\_phone\_digits();

-------

create unique index if not exists customers\_store\_phone\_uniq

on public.customers (store\_id, phone);

-------

select pg\_get\_functiondef('public.send\_customer\_otp(text,uuid)'::regprocedure);

select pg\_get\_functiondef('public.verify\_customer\_otp(text,text,uuid)'::regprocedure);

-------

alter table public.customer\_otps enable row level security;



-- Sem policies = ninguém acessa via API normal

revoke all on table public.customer\_otps from anon, authenticated;



-- Se existir sequence, ok; mas com uuid não existe mesmo.

-- (você já tratou isso)

-------

create or replace function public.verify\_customer\_otp(p\_phone text, p\_otp text, p\_store\_id uuid)

returns jsonb

language plpgsql

security definer

set search\_path = public, pg\_temp

as $$

declare

&nbsp; v\_phone text;

&nbsp; v\_otp text;

&nbsp; v\_row public.customer\_otps%rowtype;

&nbsp; v\_customer public.customers%rowtype;

&nbsp; v\_is\_new boolean := true;

begin

&nbsp; v\_phone := regexp\_replace(coalesce(p\_phone,''), '\\D', '', 'g');

&nbsp; v\_otp   := regexp\_replace(coalesce(p\_otp,''),   '\\D', '', 'g');



&nbsp; if p\_store\_id is null then

&nbsp;   raise exception 'store\_id obrigatório';

&nbsp; end if;



&nbsp; if length(v\_phone) < 10 then

&nbsp;   raise exception 'Telefone inválido';

&nbsp; end if;



&nbsp; if length(v\_otp) < 4 then

&nbsp;   raise exception 'OTP inválido';

&nbsp; end if;



&nbsp; -- pega o mais recente, não verificado e não expirado

&nbsp; select \*

&nbsp;   into v\_row

&nbsp;   from public.customer\_otps

&nbsp;  where phone = v\_phone

&nbsp;    and store\_id = p\_store\_id

&nbsp;    and verified = false

&nbsp;    and expires\_at > now()

&nbsp;  order by created\_at desc

&nbsp;  limit 1;



&nbsp; if not found then

&nbsp;   return jsonb\_build\_object('isValid', false);

&nbsp; end if;



&nbsp; -- rate limit por tentativas (ex: 5)

&nbsp; if v\_row.attempts >= 5 then

&nbsp;   return jsonb\_build\_object('isValid', false, 'locked', true);

&nbsp; end if;



&nbsp; -- incrementa tentativa sempre que for validar

&nbsp; update public.customer\_otps

&nbsp;    set attempts = attempts + 1

&nbsp;  where id = v\_row.id;



&nbsp; -- valida hash

&nbsp; if crypt(v\_otp, v\_row.otp\_code) <> v\_row.otp\_code then

&nbsp;   return jsonb\_build\_object('isValid', false);

&nbsp; end if;



&nbsp; -- marca como verificado

&nbsp; update public.customer\_otps

&nbsp;    set verified = true

&nbsp;  where id = v\_row.id;



&nbsp; -- busca customer

&nbsp; select \*

&nbsp;   into v\_customer

&nbsp;   from public.customers

&nbsp;  where phone = v\_phone

&nbsp;    and store\_id = p\_store\_id

&nbsp;  limit 1;



&nbsp; if found then

&nbsp;   v\_is\_new := false;

&nbsp;   return jsonb\_build\_object(

&nbsp;     'isValid', true,

&nbsp;     'isNewUser', v\_is\_new,

&nbsp;     'customer', to\_jsonb(v\_customer)

&nbsp;   );

&nbsp; end if;



&nbsp; return jsonb\_build\_object(

&nbsp;   'isValid', true,

&nbsp;   'isNewUser', v\_is\_new,

&nbsp;   'customer', null

&nbsp; );

end;

$$;

-------

create extension if not exists "pgcrypto";

create extension if not exists "uuid-ossp";

-------

alter table public.customer\_otps

&nbsp; add column if not exists attempts integer not null default 0;



-- Opcional (recomendado): garantir só 1 OTP ativo por (store\_id, phone)

-- Não dá pra fazer UNIQUE direto por causa de verified/expirações.

-- Então a gente garante isso na função (apagando os antigos antes de criar um novo).

-------

create or replace function public.send\_customer\_otp(p\_phone text, p\_store\_id uuid)

returns jsonb

language plpgsql

security definer

set search\_path = public, pg\_temp

as $$

declare

&nbsp; v\_phone text;

&nbsp; v\_otp text;

&nbsp; v\_hash text;

&nbsp; v\_expires\_at timestamptz;

begin

&nbsp; v\_phone := regexp\_replace(coalesce(p\_phone,''), '\\D', '', 'g');



&nbsp; if p\_store\_id is null then

&nbsp;   raise exception 'store\_id obrigatório';

&nbsp; end if;



&nbsp; if length(v\_phone) < 10 then

&nbsp;   raise exception 'Telefone inválido';

&nbsp; end if;



&nbsp; -- expiração (ex: 5 min)

&nbsp; v\_expires\_at := now() + interval '5 minutes';



&nbsp; -- OTP numérico 6 dígitos

&nbsp; v\_otp := lpad((floor(random()\*1000000))::int::text, 6, '0');



&nbsp; -- hash do OTP

&nbsp; v\_hash := crypt(v\_otp, gen\_salt('bf'));



&nbsp; -- remove OTPs antigos não verificados (higiene + “1 ativo por vez”)

&nbsp; delete from public.customer\_otps

&nbsp;  where phone = v\_phone

&nbsp;    and store\_id = p\_store\_id

&nbsp;    and verified = false;



&nbsp; insert into public.customer\_otps (phone, store\_id, otp\_code, expires\_at, verified, attempts)

&nbsp; values (v\_phone, p\_store\_id, v\_hash, v\_expires\_at, false, 0);



&nbsp; -- NÃO retorne o OTP em produção.

&nbsp; -- Em dev, se quiser, você pode retornar condicionalmente por flag/ambiente.

&nbsp; return jsonb\_build\_object(

&nbsp;   'ok', true,

&nbsp;   'expiresAt', v\_expires\_at

&nbsp; );

end;

$$;

-------

create extension if not exists "pgcrypto";



create or replace function public.verify\_customer\_otp(

&nbsp; p\_phone text,

&nbsp; p\_otp text,

&nbsp; p\_store\_id uuid

)

returns jsonb

language plpgsql

security definer

set search\_path = public, pg\_temp

as $$

declare

&nbsp; v\_phone text;

&nbsp; v\_otp   text;

&nbsp; v\_row   public.customer\_otps%rowtype;

&nbsp; v\_customer public.customers%rowtype;

&nbsp; v\_is\_new boolean := true;

begin

&nbsp; v\_phone := regexp\_replace(coalesce(p\_phone,''), '\\D', '', 'g');

&nbsp; v\_otp   := regexp\_replace(coalesce(p\_otp,''),   '\\D', '', 'g');



&nbsp; if length(v\_phone) < 10 then

&nbsp;   raise exception 'Telefone inválido';

&nbsp; end if;



&nbsp; if length(v\_otp) < 4 then

&nbsp;   raise exception 'OTP inválido';

&nbsp; end if;



&nbsp; if p\_store\_id is null then

&nbsp;   raise exception 'store\_id obrigatório';

&nbsp; end if;



&nbsp; -- pega o mais recente, não verificado e não expirado

&nbsp; select \*

&nbsp;   into v\_row

&nbsp;   from public.customer\_otps

&nbsp;  where phone = v\_phone

&nbsp;    and store\_id = p\_store\_id

&nbsp;    and verified = false

&nbsp;    and expires\_at > now()

&nbsp;  order by created\_at desc

&nbsp;  limit 1;



&nbsp; if not found then

&nbsp;   return jsonb\_build\_object('isValid', false);

&nbsp; end if;



&nbsp; -- ✅ valida hash (aqui estava seu erro: precisa estar num IF)

&nbsp; if crypt(v\_otp, v\_row.otp\_code) <> v\_row.otp\_code then

&nbsp;   return jsonb\_build\_object('isValid', false);

&nbsp; end if;



&nbsp; -- marca como verificado

&nbsp; update public.customer\_otps

&nbsp;    set verified = true

&nbsp;  where id = v\_row.id;



&nbsp; -- busca customer

&nbsp; select \*

&nbsp;   into v\_customer

&nbsp;   from public.customers

&nbsp;  where phone = v\_phone

&nbsp;    and store\_id = p\_store\_id

&nbsp;  limit 1;



&nbsp; if found then

&nbsp;   v\_is\_new := false;

&nbsp;   return jsonb\_build\_object(

&nbsp;     'isValid', true,

&nbsp;     'isNewUser', v\_is\_new,

&nbsp;     'customer', to\_jsonb(v\_customer)

&nbsp;   );

&nbsp; end if;



&nbsp; return jsonb\_build\_object(

&nbsp;   'isValid', true,

&nbsp;   'isNewUser', v\_is\_new,

&nbsp;   'customer', null

&nbsp; );

end;

$$;

-------

-- =========================================================

-- 1) RLS ON (se já estiver ON, ok)

-- =========================================================

alter table public.customer\_otps enable row level security;

alter table public.otp\_codes     enable row level security;



-- (Opcional, mais “duro”: até o dono da tabela não bypassa RLS sem policies)

-- Eu só recomendo isso se você tem 100% certeza que tudo nelas será via RPC/service\_role.

-- alter table public.customer\_otps force row level security;

-- alter table public.otp\_codes     force row level security;



-- =========================================================

-- 2) REVOGAR acesso direto via PostgREST (anon/authenticated)

-- =========================================================

revoke all on table public.customer\_otps from anon, authenticated;

revoke all on table public.otp\_codes     from anon, authenticated;



-- =========================================================

-- 3) GARANTIR que service\_role consegue operar (se você usar service key no backend)

-- =========================================================

grant select, insert, update, delete on table public.customer\_otps to service\_role;

grant select, insert, update, delete on table public.otp\_codes     to service\_role;



-- =========================================================

-- 4) (Opcional) travas extras úteis em produção

-- =========================================================



-- Evita reuso “infinito” de OTP válido (já existe verified, mas isso ajuda)

create index if not exists idx\_customer\_otps\_active

&nbsp; on public.customer\_otps (store\_id, phone, created\_at desc)

&nbsp; where verified = false;



-- Limita cadastros duplicados de cliente por loja (quando você ativar isso em produção)

-- (Sugestão que você pediu: número exclusivo por loja)

do $$

begin

&nbsp; if not exists (

&nbsp;   select 1

&nbsp;   from pg\_constraint

&nbsp;   where conname = 'customers\_store\_phone\_uniq'

&nbsp; ) then

&nbsp;   alter table public.customers

&nbsp;     add constraint customers\_store\_phone\_uniq unique (store\_id, phone);

&nbsp; end if;

end $$;

-------

-- =========================================================

-- A) Blindar acesso direto à tabela customer\_otps

-- =========================================================

revoke all on table public.customer\_otps from anon, authenticated;

-- revoke all on sequence public.customer\_otps\_id\_seq from anon, authenticated; -- se existir (provavelmente não, por ser uuid)



-- (Opcional) Se você usa "public" grants customizados, reforce:

revoke all on table public.customer\_otps from public;



-- =========================================================

-- B) Garantir que RLS está ON (você já fez, mas deixo idempotente)

-- =========================================================

alter table public.customer\_otps enable row level security;



-- Sem policies = ninguém acessa via API normal (perfeito).



-- =========================================================

-- C) Permitir somente EXECUTE nas funções (RPC)

-- =========================================================

revoke all on function public.send\_customer\_otp(text, uuid) from public;

revoke all on function public.verify\_customer\_otp(text, text, uuid) from public;



-- Você pode permitir para anon/authenticated chamarem RPC,

-- porque a função é SECURITY DEFINER e você controla tudo lá dentro.

grant execute on function public.send\_customer\_otp(text, uuid) to anon, authenticated;

grant execute on function public.verify\_customer\_otp(text, text, uuid) to anon, authenticated;

-------

create or replace function public.verify\_customer\_otp(p\_phone text, p\_otp text, p\_store\_id uuid)

returns jsonb

language plpgsql

security definer

set search\_path = public, pg\_temp

as $$

declare

&nbsp; v\_row public.customer\_otps%rowtype;

&nbsp; v\_customer public.customers%rowtype;

&nbsp; v\_is\_new boolean := false;

begin

&nbsp; -- Em produção, recomendo validar OTP só no backend (service\_role),

&nbsp; -- porque em seguida você vai emitir o JWT ali mesmo.

&nbsp; if auth.role() <> 'service\_role' then

&nbsp;   raise exception 'forbidden';

&nbsp; end if;



&nbsp; -- Pega o OTP mais recente ainda ativo

&nbsp; select \*

&nbsp;   into v\_row

&nbsp; from public.customer\_otps

&nbsp; where phone = p\_phone

&nbsp;   and store\_id = p\_store\_id

&nbsp;   and used = false

&nbsp; order by created\_at desc

&nbsp; limit 1;



&nbsp; if not found then

&nbsp;   return jsonb\_build\_object('isValid', false, 'reason', 'not\_found');

&nbsp; end if;



&nbsp; if v\_row.expires\_at < now() then

&nbsp;   update public.customer\_otps set used = true where id = v\_row.id;

&nbsp;   return jsonb\_build\_object('isValid', false, 'reason', 'expired');

&nbsp; end if;



&nbsp; -- Conta tentativas (anti brute force básico)

&nbsp; update public.customer\_otps

&nbsp;    set attempts = attempts + 1

&nbsp;  where id = v\_row.id;



&nbsp; if (v\_row.attempts + 1) > 8 then

&nbsp;   update public.customer\_otps set used = true where id = v\_row.id;

&nbsp;   return jsonb\_build\_object('isValid', false, 'reason', 'too\_many\_attempts');

&nbsp; end if;



&nbsp; -- Validação hash (preferencial). Se otp\_hash estiver vazio (legado), cai no otp\_code.

&nbsp; if v\_row.otp\_hash is not null then

&nbsp;   if crypt(p\_otp, v\_row.otp\_hash) <> v\_row.otp\_hash then

&nbsp;     return jsonb\_build\_object('isValid', false, 'reason', 'invalid');

&nbsp;   end if;

&nbsp; else

&nbsp;   if v\_row.otp\_code <> p\_otp then

&nbsp;     return jsonb\_build\_object('isValid', false, 'reason', 'invalid');

&nbsp;   end if;

&nbsp; end if;



&nbsp; -- Marca como usado/validado

&nbsp; update public.customer\_otps

&nbsp;    set verified = true,

&nbsp;        used = true

&nbsp;  where id = v\_row.id;



&nbsp; -- Busca customer (se existir)

&nbsp; select \*

&nbsp;   into v\_customer

&nbsp; from public.customers

&nbsp; where phone = p\_phone

&nbsp;   and store\_id = p\_store\_id

&nbsp; limit 1;



&nbsp; if not found then

&nbsp;   v\_is\_new := true;

&nbsp;   return jsonb\_build\_object(

&nbsp;     'isValid', true,

&nbsp;     'isNewUser', true,

&nbsp;     'customer', null

&nbsp;   );

&nbsp; end if;



&nbsp; return jsonb\_build\_object(

&nbsp;   'isValid', true,

&nbsp;   'isNewUser', false,

&nbsp;   'customer', row\_to\_json(v\_customer)

&nbsp; );

end;

$$;



revoke all on function public.verify\_customer\_otp(text, text, uuid) from public, anon, authenticated;

grant execute on function public.verify\_customer\_otp(text, text, uuid) to service\_role;

-------

create or replace function public.send\_customer\_otp(p\_phone text, p\_store\_id uuid)

returns jsonb

language plpgsql

security definer

set search\_path = public, pg\_temp

as $$

declare

&nbsp; v\_now timestamptz := now();

&nbsp; v\_otp text;

&nbsp; v\_expires timestamptz := v\_now + interval '10 minutes';

&nbsp; v\_last timestamptz;

begin

&nbsp; -- Somente backend (service\_role) pode gerar OTP

&nbsp; if auth.role() <> 'service\_role' then

&nbsp;   raise exception 'forbidden';

&nbsp; end if;



&nbsp; -- Rate limit simples (evita spam): 1 envio a cada 30s por phone+store

&nbsp; select max(last\_sent\_at)

&nbsp;   into v\_last

&nbsp; from public.customer\_otps

&nbsp; where phone = p\_phone

&nbsp;   and store\_id = p\_store\_id;



&nbsp; if v\_last is not null and v\_last > (v\_now - interval '30 seconds') then

&nbsp;   return jsonb\_build\_object(

&nbsp;     'ok', false,

&nbsp;     'reason', 'rate\_limited',

&nbsp;     'retry\_in\_seconds', 30

&nbsp;   );

&nbsp; end if;



&nbsp; -- Gera OTP (6 dígitos)

&nbsp; v\_otp := lpad((floor(random()\*1000000))::int::text, 6, '0');



&nbsp; -- Opcional: invalida OTPs anteriores ainda ativas

&nbsp; update public.customer\_otps

&nbsp;    set used = true

&nbsp;  where phone = p\_phone

&nbsp;    and store\_id = p\_store\_id

&nbsp;    and used = false;



&nbsp; insert into public.customer\_otps(phone, store\_id, otp\_hash, expires\_at, created\_at, verified, attempts, used, last\_sent\_at, otp\_code)

&nbsp; values (

&nbsp;   p\_phone,

&nbsp;   p\_store\_id,

&nbsp;   crypt(v\_otp, gen\_salt('bf')),

&nbsp;   v\_expires,

&nbsp;   v\_now,

&nbsp;   false,

&nbsp;   0,

&nbsp;   false,

&nbsp;   v\_now,

&nbsp;   v\_otp   -- <-- mantenho por compatibilidade; remova quando quiser (ver bloco acima)

&nbsp; );



&nbsp; -- Retorna OTP para o backend mandar por WhatsApp/SMS

&nbsp; return jsonb\_build\_object(

&nbsp;   'ok', true,

&nbsp;   'otp', v\_otp,

&nbsp;   'expires\_at', v\_expires

&nbsp; );

end;

$$;



revoke all on function public.send\_customer\_otp(text, uuid) from public, anon, authenticated;

grant execute on function public.send\_customer\_otp(text, uuid) to service\_role;

-------

-- 1) Colunas novas (não quebra compatibilidade)

alter table public.customer\_otps

&nbsp; add column if not exists otp\_hash text,

&nbsp; add column if not exists attempts integer not null default 0,

&nbsp; add column if not exists used boolean not null default false,

&nbsp; add column if not exists last\_sent\_at timestamptz;



-- 2) Índice melhor para lookup (mantém o seu também)

create index if not exists idx\_customer\_otps\_active\_lookup

on public.customer\_otps (phone, store\_id)

where used = false;



-- 3) (Opcional) Se você quiser parar de vez de guardar o otp\_code em texto puro:

-- alter table public.customer\_otps drop column otp\_code;

-- (Só faça isso depois de atualizar as funções abaixo e confirmar que nada depende do otp\_code.)

-------

-- =========================================================

-- PRÉ-REQ: extensões (você já rodou, mas deixo seguro)

-- =========================================================

create extension if not exists pgcrypto;



-- =========================================================

-- 1) Helper: gerar OTP numérico

-- =========================================================

create or replace function public.app\_generate\_otp(p\_length int default 6)

returns text

language plpgsql

stable

as $$

declare

&nbsp; otp text := '';

&nbsp; i int;

begin

&nbsp; if p\_length < 4 then

&nbsp;   p\_length := 4;

&nbsp; end if;



&nbsp; for i in 1..p\_length loop

&nbsp;   otp := otp || floor(random() \* 10)::int::text;

&nbsp; end loop;



&nbsp; return otp;

end;

$$;



-- Fix linter: search\_path

alter function public.app\_generate\_otp(int) set search\_path = public, pg\_temp;



-- =========================================================

-- 2) RPC: send\_customer\_otp(text, uuid)

--    - gera OTP

--    - salva hash + expiração

--    - invalida OTPs anteriores não verificados

--    - retorna otp\_plain (opcional) + expires\_at

-- =========================================================

create or replace function public.send\_customer\_otp(

&nbsp; p\_phone text,

&nbsp; p\_store\_id uuid

)

returns jsonb

language plpgsql

security definer

set search\_path = public, pg\_temp

as $$

declare

&nbsp; v\_phone text;

&nbsp; v\_otp text;

&nbsp; v\_hash text;

&nbsp; v\_expires\_at timestamptz := now() + interval '5 minutes';

begin

&nbsp; -- normaliza telefone: só dígitos

&nbsp; v\_phone := regexp\_replace(coalesce(p\_phone,''), '\\D', '', 'g');



&nbsp; if length(v\_phone) < 10 then

&nbsp;   raise exception 'Telefone inválido';

&nbsp; end if;



&nbsp; if p\_store\_id is null then

&nbsp;   raise exception 'store\_id obrigatório';

&nbsp; end if;



&nbsp; -- invalida códigos anteriores ainda não verificados

&nbsp; update public.customer\_otps

&nbsp;    set verified = true

&nbsp;  where phone = v\_phone

&nbsp;    and store\_id = p\_store\_id

&nbsp;    and verified = false

&nbsp;    and expires\_at > now();



&nbsp; -- gera e guarda hash

&nbsp; v\_otp := public.app\_generate\_otp(6);

&nbsp; v\_hash := crypt(v\_otp, gen\_salt('bf'));



&nbsp; insert into public.customer\_otps (phone, store\_id, otp\_code, expires\_at, verified)

&nbsp; values (v\_phone, p\_store\_id, v\_hash, v\_expires\_at, false);



&nbsp; -- IMPORTANTE:

&nbsp; -- Em produção, eu recomendo NÃO retornar o OTP.

&nbsp; -- Aqui deixo retornando para você conseguir integrar com o smsgate.

&nbsp; return jsonb\_build\_object(

&nbsp;   'ok', true,

&nbsp;   'expires\_at', v\_expires\_at,

&nbsp;   'otp', v\_otp

&nbsp; );

end;

$$;



-- Permitir chamada via RPC (anon/authenticated)

grant execute on function public.send\_customer\_otp(text, uuid) to anon, authenticated;



-- =========================================================

-- 3) RPC: verify\_customer\_otp(text, text, uuid)

--    - valida OTP pelo hash

--    - marca como verified

--    - retorna customer (se existir) + isNewUser

-- =========================================================

create or replace function public.verify\_customer\_otp(

&nbsp; p\_phone text,

&nbsp; p\_otp text,

&nbsp; p\_store\_id uuid

)

returns jsonb

language plpgsql

security definer

set search\_path = public, pg\_temp

as $$

declare

&nbsp; v\_phone text;

&nbsp; v\_otp text;

&nbsp; v\_row public.customer\_otps%rowtype;

&nbsp; v\_customer public.customers%rowtype;

&nbsp; v\_is\_new boolean := true;

begin

&nbsp; v\_phone := regexp\_replace(coalesce(p\_phone,''), '\\D', '', 'g');

&nbsp; v\_otp := regexp\_replace(coalesce(p\_otp,''), '\\D', '', 'g');



&nbsp; if length(v\_phone) < 10 then

&nbsp;   raise exception 'Telefone inválido';

&nbsp; end if;



&nbsp; if length(v\_otp) < 4 then

&nbsp;   raise exception 'OTP inválido';

&nbsp; end if;



&nbsp; if p\_store\_id is null then

&nbsp;   raise exception 'store\_id obrigatório';

&nbsp; end if;



&nbsp; -- pega o mais recente, não verificado e não expirado

&nbsp; select \*

&nbsp;   into v\_row

&nbsp;   from public.customer\_otps

&nbsp;  where phone = v\_phone

&nbsp;    and store\_id = p\_store\_id

&nbsp;    and verified = false

&nbsp;    and expires\_at > now()

&nbsp;  order by created\_at desc

&nbsp;  limit 1;



&nbsp; if not found then

&nbsp;   return jsonb\_build\_object('isValid', false);

&nbsp; end if;



&nbsp; -- valida hash

&nbsp; if crypt(v\_otp, v\_row.otp\_code) <> v\_row.otp\_code then

&nbsp;   return jsonb\_build\_object('isValid', false);

&nbsp; end if;



&nbsp; -- marca como verificado

&nbsp; update public.customer\_otps

&nbsp;    set verified = true

&nbsp;  where id = v\_row.id;



&nbsp; -- busca customer

&nbsp; select \*

&nbsp;   into v\_customer

&nbsp;   from public.customers

&nbsp;  where phone = v\_phone

&nbsp;    and store\_id = p\_store\_id

&nbsp;  limit 1;



&nbsp; if found then

&nbsp;   v\_is\_new := false;

&nbsp;   return jsonb\_build\_object(

&nbsp;     'isValid', true,

&nbsp;     'isNewUser', v\_is\_new,

&nbsp;     'customer', to\_jsonb(v\_customer)

&nbsp;   );

&nbsp; end if;



&nbsp; return jsonb\_build\_object(

&nbsp;   'isValid', true,

&nbsp;   'isNewUser', v\_is\_new,

&nbsp;   'customer', null

&nbsp; );

end;

$$;



grant execute on function public.verify\_customer\_otp(text, text, uuid) to anon, authenticated;



-- =========================================================

-- 4) Reforço: tabelas OTP sem acesso direto (você já fez algo parecido)

-- =========================================================

revoke all on table public.customer\_otps from anon, authenticated;

revoke all on table public.otp\_codes from anon, authenticated;

-------

select pg\_get\_functiondef(p.oid)

from pg\_proc p

join pg\_namespace n on n.oid = p.pronamespace

where n.nspname = 'public'

&nbsp; and p.proname = 'send\_customer\_otp'

&nbsp; and pg\_get\_function\_identity\_arguments(p.oid) = 'p\_phone text, p\_store\_id uuid';



select pg\_get\_functiondef(p.oid)

from pg\_proc p

join pg\_namespace n on n.oid = p.pronamespace

where n.nspname = 'public'

&nbsp; and p.proname = 'verify\_customer\_otp'

&nbsp; and pg\_get\_function\_identity\_arguments(p.oid) = 'p\_phone text, p\_otp text, p\_store\_id uuid';

