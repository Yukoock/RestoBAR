-- =====================================================================
-- PrestoBar · Hacer administrador (Dueño) a tu usuario
--
-- Úsalo UNA sola vez, después de ejecutar schema.sql:
--   1. En Supabase › Authentication › Users › Add user › Create new user,
--      escribe tu correo y tu contraseña y marca «Auto Confirm User».
--   2. Cambia abajo el correo de ejemplo por ese mismo correo (deja las comillas).
--   3. Supabase › SQL Editor › New query › pega este archivo › Run.
--
-- Al final debe decir: «Listo: ... ya es el Dueño».
-- Ese usuario entra a la app con su correo y contraseña, y desde
-- Administración › Usuarios y roles crea las cuentas del equipo.
-- =====================================================================

do $$
declare
  v_correo text := 'tu-correo@ejemplo.com';   -- ← CAMBIA ESTO por tu correo
  v_id uuid;
begin
  select id into v_id from auth.users where lower(email) = lower(trim(v_correo));
  if v_id is null then
    raise exception 'No encontré el usuario %. Créalo primero en Authentication › Users › Add user y revisa que el correo esté bien escrito.', v_correo;
  end if;

  -- Por si lo creaste sin marcar «Auto Confirm User»: queda confirmado
  update auth.users set email_confirmed_at = coalesce(email_confirmed_at, now()) where id = v_id;

  -- Solo hay un Dueño: si ya había otro, pasa a Cajero
  update public.perfiles set rol = 'cajero' where rol = 'dueno' and id <> v_id;

  insert into public.perfiles (id, nombre, correo, rol, activo)
  select id, split_part(email, '@', 1), email, 'dueno', true from auth.users where id = v_id
  on conflict (id) do update set rol = 'dueno', activo = true;

  raise notice 'Listo: % ya es el Dueño', v_correo;
end $$;

-- Comprobación: aquí abajo debe aparecer tu correo con rol «dueno» y activo «true»
select nombre, correo, rol, activo from public.perfiles where rol = 'dueno';
