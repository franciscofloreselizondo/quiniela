-- 057 · Correos alternos para entrar, cumpleaños en el perfil y avisos personales (26-nov-2026). Aditiva, sin tiempo caído.
-- 1) Un socio puede entrar con su correo principal o con correos alternos (lo captura Presidente/Secretario en Miembros).
--    El código llega al correo que escribió. Google también reconoce el alterno.
-- 2) Cumpleaños: cada socio lo llena en Mi perfil. El día de su cumpleaños sale el aviso 🎂 a todos.
-- 3) Avisos personales (no se guardan, se arman al consultar): 🧾 "Debes / Te deben" de torneos cerrados desde la Rosa,
--    hasta que se marca pagado. Nuevo torneo: el aviso ahora dice cuándo cierran los picks.

alter table public.c_members add column if not exists birthday date;
alter table public.c_members add column if not exists email_alt text[] not null default '{}';

create or replace function public.c_member_by_email(p_email text) returns c_members
language sql stable security definer set search_path = public as $$
  select * from c_members
  where active and not coalesce(removed, false)
    and (lower(email) = lower(trim(p_email)) or lower(trim(p_email)) = any(email_alt))
  order by (lower(email) = lower(trim(p_email))) desc limit 1 $$;

create or replace function public.c_member_json(m c_members, p_full boolean) returns jsonb
language sql immutable as $$
  select jsonb_build_object('id',m.id,'name',m.name,'nickname',m.nickname,'role',m.role,'fundador',m.fundador,'board',m.board,'liga',m.liga,'hcp',m.hcp,
    'active',m.active,'bet_admin',m.bet_admin,'superadmin',m.superadmin,'avatar',m.avatar,'guest',coalesce(m.guest,false))
    || case when p_full then jsonb_build_object('email',m.email,'email_alt',coalesce(to_jsonb(m.email_alt),'[]'::jsonb),'birthday',m.birthday) else '{}'::jsonb end
$$;

CREATE OR REPLACE FUNCTION public.c_request_code(p_email text)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare m c_members; c text; s q_settings; dest text := lower(trim(coalesce(p_email,'')));
begin
  m := c_member_by_email(dest);
  if m.id is null then return 'no_registrado'; end if;
  if (select count(*) from c_codes where lower(email)=lower(m.email) and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Demasiados códigos pedidos. Intenta en una hora.'; end if;
  c := lpad((floor(random()*1000000))::int::text, 6, '0');
  update c_codes set used = true where lower(email)=lower(m.email) and not used;
  insert into c_codes(email, code_hash, expires_at) values (lower(m.email), md5(lower(m.email)||':'||c), now() + interval '15 minutes');
  select * into s from q_settings where id = 1;
  perform q_send('club_codigo', jsonb_build_array(jsonb_build_object('email', dest, 'name', m.name)), null, null,
    'Tu código de acceso: ' || c,
    c_wrap('Hola ' || q_esc(m.name),
      '<p>Tu código para entrar a la app del club es:</p><p style="font:bold 34px Georgia,serif;letter-spacing:8px;color:#1f3b2c;margin:12px 0">' || c || '</p>'
      || '<p style="color:#7a6650;font-size:13px">Vence en 15 minutos. Si no lo pediste, ignora este correo.</p>'));
  return 'enviado';
end $function$;

CREATE OR REPLACE FUNCTION public.c_verify_code(p_email text, p_code text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare m c_members; cd c_codes; tok text;
begin
  m := c_member_by_email(p_email);
  if m.id is null then raise exception 'Correo no registrado'; end if;
  select * into cd from c_codes where lower(email)=lower(m.email) and not used and expires_at > now() order by id desc limit 1;
  -- los errores se regresan (no se lanzan) para que el contador de intentos sí se guarde
  if cd.id is null then return jsonb_build_object('error','Código vencido. Pide uno nuevo.'); end if;
  if cd.attempts >= 5 then return jsonb_build_object('error','Demasiados intentos. Pide un código nuevo.'); end if;
  if cd.code_hash <> md5(lower(m.email)||':'||trim(coalesce(p_code,''))) then
    update c_codes set attempts = attempts + 1 where id = cd.id;
    return jsonb_build_object('error','Código incorrecto');
  end if;
  update c_codes set used = true where id = cd.id;
  tok := replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','');
  insert into c_sessions(token, member_id, expires_at) values (tok, m.id, now() + interval '120 days');
  delete from c_sessions where expires_at < now();
  return jsonb_build_object('token', tok, 'me', c_member_json(m, true));
end $function$;

CREATE OR REPLACE FUNCTION public.c_login_oauth()
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare cl jsonb := auth.jwt(); em text := lower(trim(cl->>'email')); m c_members; tok text;
  nm text := left(trim(coalesce(cl->'user_metadata'->>'full_name', cl->'user_metadata'->>'name', '')), 40);
begin
  if coalesce(cl->>'role','') <> 'authenticated' or coalesce(em,'') = '' then
    return jsonb_build_object('error','No pudimos verificar tu cuenta. Intenta de nuevo o entra con código.');
  end if;
  m := c_member_by_email(em);
  if m.id is null then
    begin delete from auth.users where id = nullif(cl->>'sub','')::uuid; exception when others then null; end;
    return jsonb_build_object('error','no_registrado','email',em,'name',nm,
      'pendiente', exists (select 1 from c_requests where lower(email) = em and status = 'pendiente'));
  end if;
  tok := replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','');
  insert into c_sessions(token, member_id, expires_at) values (tok, m.id, now() + interval '120 days');
  delete from c_sessions where expires_at < now();
  return jsonb_build_object('token', tok, 'me', c_member_json(m, true));
end $function$;

CREATE OR REPLACE FUNCTION public.c_request_access(p_name text, p_email text)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare em text := lower(trim(coalesce(p_email,''))); nm text := left(trim(coalesce(p_name,'')),40); r c_requests; s q_settings;
begin
  if nm = '' then raise exception 'Escribe tu nombre'; end if;
  if em !~ '^\S+@\S+\.\S+$' then raise exception 'Correo no válido'; end if;
  if (c_member_by_email(em)).id is not null then return 'ya_registrado'; end if;
  if exists (select 1 from c_requests where lower(email) = em and status = 'pendiente') then return 'ya_pendiente'; end if;
  if (select count(*) from c_requests where created_at > now() - interval '1 hour') >= 20 then raise exception 'Demasiadas solicitudes. Intenta más tarde.'; end if;
  insert into c_requests(name, email) values (nm, em) returning * into r;
  select * into s from q_settings where id = 1;
  perform q_send('club_solicitud', jsonb_build_array(jsonb_build_object('email', s.mail_cc, 'name', 'Hermanos McGregor')), null, null,
    'Solicitud de acceso al club: ' || nm,
    c_wrap('Solicitud de acceso', '<p><b>' || q_esc(nm) || '</b> (' || q_esc(em) || ') pide entrar a la app del club.</p>'
      || '<p style="color:#7a6650;font-size:13px">Si ya existe un socio con ese nombre sin correo, se le asigna; si no, se crea como socio nuevo. También puedes resolverlo en Miembros.</p>'
      || c_btn(s.club_url || '?creq=' || r.id || '&k=' || r.approve_key, '✅ Aprobar')
      || '<p style="margin-top:-6px"><a href="' || s.club_url || '?creq=' || r.id || '&k=' || r.approve_key || '&act=no" style="color:#8f2d2a">Rechazar</a></p>'));
  return 'ok';
end $function$;

CREATE OR REPLACE FUNCTION public.c_update_me(p_token text, p_data jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare m c_members := c_session(p_token); bd date;
begin
  if (p_data->>'liga') is not null and (p_data->>'liga') not in ('sabado','domingo','ambas') then raise exception 'Liga inválida'; end if;
  if p_data ? 'avatar' and p_data->>'avatar' is not null then
    if (p_data->>'avatar') !~ '^data:image/(jpeg|png|webp);base64,' then raise exception 'Imagen inválida'; end if;
    if length(p_data->>'avatar') > 120000 then raise exception 'La foto es muy pesada'; end if;
  end if;
  if p_data ? 'birthday' and nullif(p_data->>'birthday','') is not null then
    begin bd := (p_data->>'birthday')::date; exception when others then raise exception 'Fecha de cumpleaños inválida'; end;
    if bd < date '1920-01-01' or bd > current_date then raise exception 'Fecha de cumpleaños inválida'; end if;
  end if;
  update c_members set
    liga = case when p_data ? 'liga' then nullif(p_data->>'liga','') else liga end,
    nickname = case when p_data ? 'nickname' then nullif(left(trim(coalesce(p_data->>'nickname','')),30),'') else nickname end,
    avatar = case when p_data ? 'avatar' then p_data->>'avatar' else avatar end,
    birthday = case when p_data ? 'birthday' then bd else birthday end
  where id = m.id;
  return c_me(p_token);
end $function$;

-- correos alternos: Presidente/Secretario los capturan en Miembros (separados por coma)
create or replace function public.c_admin_set_email_alt(p_token text, p_member uuid, p_emails text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare m c_members := c_session(p_token); L text[]; e text;
begin
  if not c_can_members(m) then raise exception 'Solo el Presidente o el Secretario editan correos'; end if;
  select coalesce(array_agg(distinct x), '{}') into L from (select lower(trim(t)) x from unnest(string_to_array(coalesce(p_emails,''), ',')) t) q where x <> '';
  if array_length(L, 1) > 3 then raise exception 'Máximo 3 correos alternos'; end if;
  foreach e in array L loop
    if e !~ '^\S+@\S+\.\S+$' then raise exception 'Correo no válido: %', e; end if;
    if exists (select 1 from c_members where id <> p_member and (lower(email) = e or e = any(email_alt))) then raise exception 'El correo % ya es de otro socio', e; end if;
    if exists (select 1 from c_members where id = p_member and lower(email) = e) then raise exception 'Ese ya es su correo principal'; end if;
  end loop;
  update c_members set email_alt = L where id = p_member;
  if not found then raise exception 'Miembro no existe'; end if;
  return c_members_list(p_token);
end $$;

-- avisos: nuevo torneo dice el cierre de picks
CREATE OR REPLACE FUNCTION public.n_ev_t()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
begin
  begin
    if new.solo_historico then return new; end if;
    if tg_op = 'INSERT' then
      perform n_add('torneo', '🏆', 'Nuevo torneo: ' || new.name,
        concat_ws(' · ', new.course, to_char(new.event_date, 'DD/MM/YYYY'), 'Inscripciones abiertas',
          case when new.lock_at is not null then 'picks hasta el ' || to_char(new.lock_at at time zone 'America/Mexico_City', 'DD/MM HH24:MI') end),
        '#e=' || new.id, 'ev-' || new.id);
    elsif new.closed and not coalesce(old.closed, false) then
      perform n_add('resultado', '🥇', 'Resultados: ' || new.name, 'Ya están el ranking y los premios', '#e=' || new.id, 'evc-' || new.id);
    end if;
  exception when others then null; end;
  return new;
end $function$;

create or replace function public.n_kinds() returns jsonb language sql immutable as $$
  select '[{"k":"torneo","i":"🏆","n":"Nuevo torneo","w":"Al crear un torneo (con el cierre de picks)"},
           {"k":"resultado","i":"🥇","n":"Resultados","w":"Al cerrar un torneo"},
           {"k":"picks","i":"⏰","n":"Cierre de picks","w":"Aviso personal cuando faltan menos de 24 h y no has llenado tus picks"},
           {"k":"saldo","i":"🧾","n":"Debes / Te deben","w":"Aviso personal mientras tengas un pago pendiente de un torneo"},
           {"k":"cumple","i":"🎂","n":"Cumpleaños","w":"El día del cumpleaños de un socio (si lo llenó en su perfil)"},
           {"k":"calendario","i":"📅","n":"Calendario","w":"Al agregar una fecha al calendario"},
           {"k":"honor","i":"🏅","n":"Nuevo honor","w":"Al agregar al Cuadro de Honor"},
           {"k":"salidas","i":"🛺","n":"Salidas","w":"Al publicar o editar las salidas"},
           {"k":"socio","i":"👋","n":"Bienvenido","w":"Al dar de alta a un socio"},
           {"k":"codigo","i":"📖","n":"Nuevo Código","w":"Al publicar una versión del Código"},
           {"k":"propuesta","i":"🗳️","n":"Propuesta al Board","w":"Al enviar una propuesta al Board"},
           {"k":"votacion","i":"✅","n":"Resultado de votación","w":"Cuando el Board aprueba o rechaza una propuesta"}]'::jsonb $$;

create or replace function public.n_list(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare m c_members := c_session(p_token); s timestamptz; rem jsonb := '[]'::jsonb; sal jsonb := '[]'::jsonb; cum jsonb := '[]'::jsonb;
  off text[] := coalesce((select news_off from c_settings where id = 1), '{}'); hoy date := (now() at time zone 'America/Mexico_City')::date;
  yo text[];
begin
  select seen_at into s from n_seen_at where member_id = m.id;
  s := coalesce(s, now() - interval '14 days');
  yo := array_remove(array[m.name, nullif(m.nickname, '')], null);
  if not coalesce(m.guest, false) then
    if not ('picks' = any(off)) then
      select coalesce(jsonb_agg(jsonb_build_object('id', 'picks-' || e.id, 'kind', 'picks', 'icon', '⏰',
          'title', 'Cierran los picks: ' || e.name,
          'body', 'Faltan ' || case when e.lock_at - now() < interval '1 hour' then 'menos de 1 hora' else extract(hour from e.lock_at - now())::int || ' h' end
                  || ' y no has llenado tus picks', 'link', '#e=' || e.id, 'at', now(), 'new', true, 'by', null) order by e.lock_at), '[]'::jsonb)
        into rem
      from b_events e
      where not e.closed and not coalesce(e.solo_historico, false) and e.lock_at > now() and e.lock_at <= now() + interval '24 hours'
        and not exists (select 1 from b_entries x where x.event_id = e.id and x.member_id = m.id and x.picks <> '{}'::jsonb);
    end if;
    if not ('saldo' = any(off)) then
      select coalesce(jsonb_agg(jsonb_build_object('id', 'saldo-' || q.event_id || '-' || q.n, 'kind', 'saldo', 'icon', '🧾',
          'title', case when q.debe then 'Debes ' || to_char(q.amount, 'FM$999,999') || ' a ' || q.otro else q.otro || ' te debe ' || to_char(q.amount, 'FM$999,999') end,
          'body', q.ev || ' · ' || case when q.debe then 'cuando pagues, quien recibe lo marca' else 'márcalo como recibido cuando te pague' end,
          'link', 'saldos', 'at', q.at, 'new', false, 'by', null) order by q.at desc), '[]'::jsonb)
        into sal
      from (select p.event_id, e.name ev, coalesce(e.event_date::timestamptz, p.computed_at) at, (x->>'amount')::numeric amount,
                   (x->>'payer') = any(yo) debe, case when (x->>'payer') = any(yo) then x->>'payee' else x->>'payer' end otro,
                   row_number() over () n
            from b_settle_plan p join b_events e on e.id = p.event_id, jsonb_array_elements(p.transfers) x
            where e.closed and coalesce(e.event_date, date '2026-11-14') >= date '2026-11-14'
              and ((x->>'payer') = any(yo) or (x->>'payee') = any(yo))
              and not exists (select 1 from b_settle b where b.event_id = p.event_id and b.payer = x->>'payer' and b.payee = x->>'payee')
            limit 10) q;
    end if;
    if not ('cumple' = any(off)) then
      select coalesce(jsonb_agg(jsonb_build_object('id', 'cumple-' || c.id || '-' || hoy, 'kind', 'cumple', 'icon', '🎂',
          'title', case when c.id = m.id then '¡Feliz cumpleaños, ' || coalesce(nullif(c.nickname, ''), c.name) || '!' else 'Hoy cumple ' || coalesce(nullif(c.nickname, ''), c.name) end,
          'body', case when c.id = m.id then 'De parte de todos los Hermanos McGregor 🍾' else 'Mándale un abrazo' end,
          'link', null, 'at', hoy::timestamptz, 'new', true, 'by', null)), '[]'::jsonb)
        into cum
      from c_members c
      where c.active and not coalesce(c.removed, false) and not coalesce(c.guest, false) and c.birthday is not null
        and extract(month from c.birthday) = extract(month from hoy) and extract(day from c.birthday) = extract(day from hoy);
    end if;
  end if;
  return jsonb_build_object(
    'unread', (select count(*) from n_news where created_at > s) + jsonb_array_length(rem) + jsonb_array_length(cum),
    'seen_at', s,
    'can_post', coalesce(m.board, false) or coalesce(m.superadmin, false),
    'items', cum || rem || sal || coalesce((select jsonb_agg(jsonb_build_object('id', n.id, 'kind', n.kind, 'icon', n.icon, 'title', n.title, 'body', n.body,
        'link', n.link, 'at', n.created_at, 'new', n.created_at > s, 'by', (select coalesce(nullif(c.nickname, ''), c.name) from c_members c where c.id = n.created_by))
        order by n.created_at desc) from (select * from n_news order by created_at desc limit 60) n), '[]'::jsonb));
end $$;

-- Peter: también entra con su Yahoo
update c_members set email_alt = array['pelizondop@yahoo.com.mx']
where lower(email) = 'pelizondop@gmail.com' and not ('pelizondop@yahoo.com.mx' = any(email_alt));

revoke all on function public.c_member_by_email(text) from public, anon, authenticated;
revoke all on function public.n_kinds() from public, anon, authenticated;
revoke all on function public.c_admin_set_email_alt(text, uuid, text) from public;
grant execute on function public.c_admin_set_email_alt(text, uuid, text) to anon, authenticated;
