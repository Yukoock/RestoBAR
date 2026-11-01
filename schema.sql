-- =====================================================================
-- PrestoBar · Base de datos completa para Supabase
-- Curso «Crea tu Software de Restaurante con IA» · Fase 3
--
-- Cómo usarlo: Supabase › SQL Editor › New query › pega TODO este archivo › Run.
-- Se pega una sola vez. Si lo vuelves a ejecutar no rompe nada: crea lo que falte
-- y no duplica los datos de ejemplo.
--
-- Qué crea: tablas, seguridad por rol (RLS), funciones para la tienda y el QR de
-- mesa, disparadores (inventario, agotado, totales), tiempo real, buckets de fotos
-- y los datos de ejemplo de PrestoBar.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- Esquema privado: no se ve desde la app. Guarda los PIN y las funciones de apoyo.
create schema if not exists privado;
-- anon y authenticated solo pueden ejecutar las dos funciones que usan las políticas (rol_actual y tiene_rol).
revoke all on schema privado from public;
grant usage on schema privado to anon, authenticated;

-- ---------------------------------------------------------------------
-- 1. Tablas
-- ---------------------------------------------------------------------

-- Configuración del negocio (una sola fila)
create table if not exists public.negocio_config (
  id smallint primary key default 1 check (id = 1),
  nombre text not null default 'Mi restaurante',
  lema text,
  logo_url text,
  whatsapp text,
  direccion text,
  ciudad text,
  nit text,
  horario text,
  hora_abre time not null default '10:00',
  hora_cierra time not null default '23:30',
  moneda text not null default 'Bs',
  color text not null default '#12402F',
  propina_sugerida smallint not null default 10 check (propina_sugerida in (0, 5, 10)),
  demora_min smallint not null default 20 check (demora_min between 5 and 120),
  escalado_min smallint not null default 3 check (escalado_min between 1 and 60),
  local_abierto boolean not null default true,
  envio jsonb not null default '[]'::jsonb,       -- zonas de delivery: [{id, nombre, costo}]
  facturacion_activa boolean not null default true,
  facturacion_pruebas boolean not null default true,
  updated_at timestamptz not null default now()
);
-- Agregados en la Fase 7 (si ya pegaste una versión anterior, estas líneas los suman sin borrar nada)
alter table public.negocio_config add column if not exists comision_qr numeric(5, 2) not null default 0 check (comision_qr between 0 and 10);
alter table public.negocio_config add column if not exists intentos_pin smallint not null default 3 check (intentos_pin between 1 and 10);
-- Fase 9: imagen del QR de cobro que da el banco (se muestra en la caja, la pantalla del cliente y la tienda)
alter table public.negocio_config add column if not exists qr_cobro_url text;

-- Datos secretos: el hash del PIN de anulación vive aquí, fuera del alcance de la app.
-- (B8 lo pone en negocio_config; aquí se separa para que nadie pueda leer el hash.)
create table if not exists privado.secretos (
  id smallint primary key default 1 check (id = 1),
  pin_anulacion_hash text not null
);

-- Perfiles del equipo: uno por cada usuario de Supabase Auth
create table if not exists public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text not null,
  correo text,
  rol text not null default 'mesero' check (rol in ('dueno', 'cajero', 'cocina', 'mesero', 'repartidor')),
  zona text,
  activo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- PIN de 4 dígitos de cada persona (hash). Separado por el mismo motivo que el PIN de anulación.
create table if not exists privado.pines (
  perfil_id uuid primary key references public.perfiles (id) on delete cascade,
  pin_hash text not null
);

-- Qué pantallas abre cada rol (editable desde Usuarios y roles; el Dueño siempre tiene todo)
create table if not exists public.permisos_rol (
  rol text not null check (rol in ('cajero', 'cocina', 'mesero', 'repartidor')),
  pantalla text not null,
  permitido boolean not null default false,
  primary key (rol, pantalla)
);

-- Menú
create table if not exists public.categorias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  orden smallint not null default 0,
  visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.productos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique check (codigo ~ '^P[0-9]{2,3}$'),
  nombre text not null,
  nombre_en text,
  descripcion text check (char_length(descripcion) <= 120),
  precio numeric(10, 2) not null check (precio > 0),
  costo numeric(10, 2) not null default 0 check (costo >= 0),
  categoria_id uuid references public.categorias (id) on delete set null,
  estacion text not null default 'cocina' check (estacion in ('cocina', 'horno', 'parrilla', 'bebidas', 'postres')),
  foto_url text,
  canales jsonb not null default '{"salon": true, "mostrador": true, "delivery": true, "tienda": true}'::jsonb,
  favorito boolean not null default false,
  agotado boolean not null default false,
  en_menu boolean not null default true,
  stock integer check (stock >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists productos_categoria_idx on public.productos (categoria_id);

create table if not exists public.modificadores (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references public.productos (id) on delete cascade,
  nombre text not null,
  orden smallint not null default 0,
  unique (producto_id, nombre)
);
create index if not exists modificadores_producto_idx on public.modificadores (producto_id);

-- Salón
create table if not exists public.mesas (
  id uuid primary key default gen_random_uuid(),
  numero smallint not null unique check (numero > 0),
  zona text not null,
  capacidad smallint not null check (capacidad between 1 and 30),
  forma text not null default 'redonda' check (forma in ('redonda', 'rect')),
  x numeric(5, 2) not null default 50,
  y numeric(5, 2) not null default 50,
  qr_token text not null unique default encode(extensions.gen_random_bytes(9), 'hex'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.llamadas (
  id uuid primary key default gen_random_uuid(),
  mesa_id uuid not null references public.mesas (id) on delete cascade,
  motivo text not null check (motivo in ('Cuenta', 'Agua', 'Ayuda con el pedido', 'Otro')),
  atendida_por uuid references public.perfiles (id) on delete set null,
  atendida_at timestamptz,
  cancelada boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists llamadas_mesa_idx on public.llamadas (mesa_id);
create index if not exists llamadas_activas_idx on public.llamadas (created_at) where atendida_at is null and not cancelada;
create index if not exists llamadas_atendida_por_idx on public.llamadas (atendida_por);

-- Pedidos (un solo flujo para todos los canales, B7)
create table if not exists public.pedidos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default (now() at time zone 'America/La_Paz')::date,
  numero integer not null,
  canal text not null check (canal in ('mesa', 'qr', 'mostrador', 'llevar', 'delivery', 'web')),
  mesa_id uuid references public.mesas (id) on delete set null,
  cliente text,
  telefono text,
  estado text not null default 'cocina' check (estado in ('borrador', 'cocina', 'preparando', 'listo', 'entregado', 'anulado')),
  pago_metodo text check (pago_metodo in ('efectivo', 'qr', 'tarjeta', 'mixto')),
  pago_pendiente boolean not null default false,
  pago_efectivo numeric(10, 2),          -- parte en efectivo de un pago mixto, o lo recibido en efectivo
  propina numeric(10, 2) not null default 0 check (propina >= 0),
  partes smallint not null default 1 check (partes between 1 and 20),
  envio numeric(10, 2) not null default 0 check (envio >= 0),
  subtotal numeric(10, 2) not null default 0,
  total numeric(10, 2) not null default 0,
  direccion text,
  delivery_estado text check (delivery_estado in ('asignado', 'recogido', 'en_camino', 'entregado')),
  repartidor_id uuid references public.perfiles (id) on delete set null,
  mesero_id uuid references public.perfiles (id) on delete set null,
  creado_por uuid references public.perfiles (id) on delete set null,
  pidio_cuenta boolean not null default false,
  motivo_anulacion text,
  codigo_seguimiento text not null default encode(extensions.gen_random_bytes(6), 'hex'),
  dispositivo text,                      -- identifica al celular del cliente para limitar envíos
  enviado_at timestamptz, preparando_at timestamptz, listo_at timestamptz, entregado_at timestamptz,
  pagado_at timestamptz, recogido_at timestamptz, en_camino_at timestamptz, anulado_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (fecha, numero)
);
create index if not exists pedidos_mesa_idx on public.pedidos (mesa_id);
create index if not exists pedidos_fecha_idx on public.pedidos (fecha desc);
create index if not exists pedidos_abiertos_idx on public.pedidos (estado) where estado not in ('entregado', 'anulado');
create index if not exists pedidos_repartidor_idx on public.pedidos (repartidor_id);
create index if not exists pedidos_mesero_idx on public.pedidos (mesero_id);
create index if not exists pedidos_creado_por_idx on public.pedidos (creado_por);
create index if not exists pedidos_dispositivo_idx on public.pedidos (dispositivo, created_at desc) where dispositivo is not null;

create table if not exists public.pedido_items (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos (id) on delete cascade,
  producto_id uuid references public.productos (id) on delete set null,
  nombre text not null,                       -- copia congelada del nombre
  precio_unitario numeric(10, 2) not null check (precio_unitario >= 0),  -- precio congelado
  cantidad integer not null check (cantidad between 1 and 99),
  nota text check (char_length(nota) <= 120),
  estacion text not null default 'cocina',
  created_at timestamptz not null default now()
);
create index if not exists pedido_items_pedido_idx on public.pedido_items (pedido_id);
create index if not exists pedido_items_producto_idx on public.pedido_items (producto_id);

-- Caja
create table if not exists public.caja_sesiones (
  id uuid primary key default gen_random_uuid(),
  abierta_at timestamptz not null default now(),
  abierta_por uuid references public.perfiles (id) on delete set null,
  fondo numeric(10, 2) not null check (fondo >= 0),
  cerrada_at timestamptz,
  cerrada_por uuid references public.perfiles (id) on delete set null,
  arqueo jsonb,                               -- {"200": 9, "100": 10, ...}
  contado numeric(10, 2),
  debe_haber numeric(10, 2),
  diferencia numeric(10, 2)
);
create unique index if not exists caja_una_abierta_idx on public.caja_sesiones ((true)) where cerrada_at is null;
create index if not exists caja_abierta_por_idx on public.caja_sesiones (abierta_por);
create index if not exists caja_cerrada_por_idx on public.caja_sesiones (cerrada_por);

create table if not exists public.caja_movimientos (
  id uuid primary key default gen_random_uuid(),
  sesion_id uuid not null references public.caja_sesiones (id) on delete cascade,
  tipo text not null check (tipo in ('ingreso', 'retiro', 'gasto')),
  monto numeric(10, 2) not null check (monto > 0),
  detalle text not null,
  creado_por uuid references public.perfiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists caja_mov_sesion_idx on public.caja_movimientos (sesion_id);
create index if not exists caja_mov_creado_por_idx on public.caja_movimientos (creado_por);

-- Inventario
create table if not exists public.ingredientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  unidad text not null check (unidad in ('kg', 'litro', 'unidad')),
  stock numeric(12, 3) not null default 0,
  minimo numeric(12, 3) not null default 0 check (minimo >= 0),
  costo_unitario numeric(10, 2) not null default 0 check (costo_unitario >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recetas (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references public.productos (id) on delete cascade,
  ingrediente_id uuid not null references public.ingredientes (id) on delete restrict,
  cantidad numeric(12, 3) not null check (cantidad > 0),   -- por una porción
  unique (producto_id, ingrediente_id)
);
create index if not exists recetas_ingrediente_idx on public.recetas (ingrediente_id);

create table if not exists public.movimientos_inventario (
  id uuid primary key default gen_random_uuid(),
  ingrediente_id uuid not null references public.ingredientes (id) on delete cascade,
  tipo text not null check (tipo in ('entrada', 'salida', 'venta', 'ajuste')),
  cantidad numeric(12, 3) not null,           -- positiva entra, negativa sale
  motivo text,
  pedido_id uuid references public.pedidos (id) on delete set null,
  compra_id uuid,
  creado_por uuid references public.perfiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists mov_inv_ingrediente_idx on public.movimientos_inventario (ingrediente_id, created_at desc);
create index if not exists mov_inv_pedido_idx on public.movimientos_inventario (pedido_id);
create index if not exists mov_inv_compra_idx on public.movimientos_inventario (compra_id);
create index if not exists mov_inv_creado_por_idx on public.movimientos_inventario (creado_por);

-- Compras y proveedores
create table if not exists public.proveedores (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  rubro text,
  whatsapp text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.compras (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique,
  fecha date not null default (now() at time zone 'America/La_Paz')::date,
  proveedor_id uuid references public.proveedores (id) on delete set null,
  detalle text,
  total numeric(10, 2) not null default 0 check (total >= 0),
  foto_url text,                              -- foto de la factura (bucket «comprobantes»)
  estado text not null default 'Recibida' check (estado in ('Recibida', 'Por pagar', 'Anulada')),
  creado_por uuid references public.perfiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists compras_proveedor_idx on public.compras (proveedor_id);
create index if not exists compras_creado_por_idx on public.compras (creado_por);

create table if not exists public.compra_items (
  id uuid primary key default gen_random_uuid(),
  compra_id uuid not null references public.compras (id) on delete cascade,
  ingrediente_id uuid not null references public.ingredientes (id) on delete restrict,
  cantidad numeric(12, 3) not null check (cantidad > 0),
  costo_unitario numeric(10, 2) not null check (costo_unitario >= 0)
);
create index if not exists compra_items_compra_idx on public.compra_items (compra_id);
create index if not exists compra_items_ingrediente_idx on public.compra_items (ingrediente_id);

-- Gastos
create table if not exists public.categorias_gasto (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique
);
create table if not exists public.gastos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default (now() at time zone 'America/La_Paz')::date,
  categoria_id uuid references public.categorias_gasto (id) on delete set null,
  detalle text not null,
  monto numeric(10, 2) not null check (monto > 0),
  creado_por uuid references public.perfiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists gastos_fecha_idx on public.gastos (fecha desc);
create index if not exists gastos_categoria_idx on public.gastos (categoria_id);
create index if not exists gastos_creado_por_idx on public.gastos (creado_por);

-- Promociones y menú del día
create table if not exists public.banners (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  subtitulo text,
  foto_url text,
  producto_id uuid references public.productos (id) on delete set null,
  donde text[] not null default array['tienda', 'pantalla'],
  activo boolean not null default true,
  orden smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (donde <@ array['tienda', 'pantalla'])
);
create index if not exists banners_producto_idx on public.banners (producto_id);

create table if not exists public.menu_del_dia (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default (now() at time zone 'America/La_Paz')::date,
  producto_id uuid not null references public.productos (id) on delete cascade,
  preparado integer not null default 0 check (preparado >= 0),
  disponible boolean not null default true,
  unique (fecha, producto_id)
);
create index if not exists menu_dia_producto_idx on public.menu_del_dia (producto_id);

-- Facturación (activa en la ficha, A9)
create sequence if not exists public.facturas_numero_seq start 1200;
grant usage, select on sequence public.facturas_numero_seq to authenticated;
create table if not exists public.facturas (
  id uuid primary key default gen_random_uuid(),
  numero integer not null unique default nextval('public.facturas_numero_seq'),
  pedido_id uuid references public.pedidos (id) on delete set null,
  razon_social text not null,
  nit text not null,
  total numeric(10, 2) not null check (total >= 0),
  cuf text,
  pdf_url text,
  estado text not null default 'Válida' check (estado in ('Válida', 'Anulada')),
  motivo_anulacion text,
  ambiente_pruebas boolean not null default true,
  creado_por uuid references public.perfiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists facturas_pedido_idx on public.facturas (pedido_id);
create index if not exists facturas_creado_por_idx on public.facturas (creado_por);

-- Auditoría: quién hizo qué y cuándo
create table if not exists public.auditoria (
  id bigint generated always as identity primary key,
  quien uuid references public.perfiles (id) on delete set null,
  quien_nombre text,
  accion text not null,
  tabla text,
  registro_id uuid,
  detalle jsonb,
  created_at timestamptz not null default now()
);
create index if not exists auditoria_fecha_idx on public.auditoria (created_at desc);
create index if not exists auditoria_quien_idx on public.auditoria (quien);

-- ---------------------------------------------------------------------
-- 2. Funciones de apoyo (privadas)
-- ---------------------------------------------------------------------

-- Rol de la persona que está usando la app (null si no tiene perfil activo)
create or replace function privado.rol_actual()
returns text
language sql stable security definer
set search_path = ''
as $$
  select rol from public.perfiles where id = (select auth.uid()) and activo;
$$;

create or replace function privado.tiene_rol(roles text[])
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce((select privado.rol_actual()) = any (roles), false);
$$;

create or replace function privado.hoy()
returns date
language sql stable
set search_path = ''
as $$ select (now() at time zone 'America/La_Paz')::date; $$;

create or replace function privado.auditar(p_accion text, p_tabla text, p_registro uuid, p_detalle jsonb)
returns void
language sql security definer
set search_path = ''
as $$
  insert into public.auditoria (quien, quien_nombre, accion, tabla, registro_id, detalle)
  values ((select auth.uid()), (select nombre from public.perfiles where id = (select auth.uid())), p_accion, p_tabla, p_registro, p_detalle);
$$;

revoke all on all tables in schema privado from public, anon, authenticated;
revoke execute on all functions in schema privado from public, anon, authenticated;
grant execute on function privado.rol_actual(), privado.tiene_rol(text[]), privado.hoy() to anon, authenticated;
revoke execute on function privado.auditar(text, text, uuid, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. Disparadores
-- ---------------------------------------------------------------------

-- updated_at automático
create or replace function privado.tocar_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end; $$;

do $$
declare t text;
begin
  foreach t in array array['negocio_config', 'perfiles', 'categorias', 'productos', 'mesas', 'pedidos', 'ingredientes', 'proveedores', 'banners']
  loop
    execute format('drop trigger if exists tocar_updated_at on public.%I', t);
    execute format('create trigger tocar_updated_at before update on public.%I for each row execute function privado.tocar_updated_at()', t);
  end loop;
end $$;

-- Número correlativo del día (empieza en 1 cada día, hora de Bolivia)
create or replace function public.numero_pedido_del_dia()
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare v integer;
begin
  perform pg_advisory_xact_lock(hashtext('pedidos-' || privado.hoy()::text));
  select coalesce(max(numero), 0) + 1 into v from public.pedidos where fecha = privado.hoy();
  return v;
end; $$;
revoke execute on function public.numero_pedido_del_dia() from public, anon;
grant execute on function public.numero_pedido_del_dia() to authenticated;

create or replace function privado.pedido_antes_de_insertar()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.fecha := privado.hoy();
  new.numero := public.numero_pedido_del_dia();
  if new.creado_por is null then new.creado_por := (select auth.uid()); end if;
  if new.estado = 'cocina' then new.enviado_at := now(); end if;
  if new.canal in ('delivery') and new.delivery_estado is null then new.delivery_estado := 'asignado'; end if;
  if new.pago_metodo is not null and not new.pago_pendiente then new.pagado_at := now(); end if;
  return new;
end; $$;
drop trigger if exists pedido_antes_de_insertar on public.pedidos;
create trigger pedido_antes_de_insertar before insert on public.pedidos for each row execute function privado.pedido_antes_de_insertar();

-- Marca la hora de cada paso del pedido
create or replace function privado.pedido_marcar_tiempos()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.estado is distinct from old.estado then
    case new.estado
      when 'cocina' then new.enviado_at := now(); new.listo_at := null; new.entregado_at := null;
      when 'preparando' then new.preparando_at := now();
      when 'listo' then new.listo_at := now();
      when 'entregado' then new.entregado_at := now();
      when 'anulado' then new.anulado_at := now();
      else null;
    end case;
  end if;
  if new.pago_metodo is not null and not new.pago_pendiente and (old.pago_metodo is null or old.pago_pendiente) then
    new.pagado_at := now();
    new.pidio_cuenta := false;
  end if;
  if new.delivery_estado is distinct from old.delivery_estado then
    if new.delivery_estado = 'recogido' then new.recogido_at := now(); end if;
    if new.delivery_estado = 'en_camino' then new.en_camino_at := now(); end if;
  end if;
  new.total := new.subtotal + new.envio + new.propina;
  return new;
end; $$;
drop trigger if exists pedido_marcar_tiempos on public.pedidos;
create trigger pedido_marcar_tiempos before update on public.pedidos for each row execute function privado.pedido_marcar_tiempos();

-- Recalcula subtotal y total cuando cambian los productos del pedido
create or replace function privado.pedido_recalcular()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_id uuid := coalesce(new.pedido_id, old.pedido_id);
begin
  update public.pedidos p
     set subtotal = coalesce((select sum(precio_unitario * cantidad) from public.pedido_items where pedido_id = v_id), 0)
   where p.id = v_id;
  return null;
end; $$;
drop trigger if exists pedido_recalcular on public.pedido_items;
create trigger pedido_recalcular after insert or update or delete on public.pedido_items for each row execute function privado.pedido_recalcular();

-- Congela nombre, precio y estación del producto en cada línea
create or replace function privado.item_congelar()
returns trigger language plpgsql security definer set search_path = '' as $$
declare p record;
begin
  select nombre, precio, estacion into p from public.productos where id = new.producto_id;
  if found then
    new.nombre := coalesce(new.nombre, p.nombre);
    new.precio_unitario := coalesce(new.precio_unitario, p.precio);
    new.estacion := p.estacion;
  end if;
  return new;
end; $$;
drop trigger if exists item_congelar on public.pedido_items;
create trigger item_congelar before insert on public.pedido_items for each row execute function privado.item_congelar();

-- Descuenta el inventario según la receta cuando el pedido pasa a «entregado»
create or replace function privado.descontar_inventario()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.estado = 'entregado' and old.estado is distinct from 'entregado' then
    with consumo as (
      select r.ingrediente_id, sum(r.cantidad * i.cantidad) as cant
        from public.pedido_items i
        join public.recetas r on r.producto_id = i.producto_id
       where i.pedido_id = new.id
       group by r.ingrediente_id
    ), mov as (
      insert into public.movimientos_inventario (ingrediente_id, tipo, cantidad, motivo, pedido_id, creado_por)
      select ingrediente_id, 'venta', -cant, 'Venta del pedido #' || new.numero, new.id, (select auth.uid()) from consumo
      returning ingrediente_id, cantidad
    )
    update public.ingredientes g set stock = g.stock + m.cantidad
      from mov m where g.id = m.ingrediente_id;
    -- Bebidas embotelladas con stock por unidad
    update public.productos pr set stock = greatest(pr.stock - x.cant, 0), agotado = pr.agotado or pr.stock - x.cant <= 0
      from (select producto_id, sum(cantidad) cant from public.pedido_items where pedido_id = new.id group by producto_id) x
     where pr.id = x.producto_id and pr.stock is not null;
  end if;
  return null;
end; $$;
drop trigger if exists descontar_inventario on public.pedidos;
create trigger descontar_inventario after update of estado on public.pedidos for each row execute function privado.descontar_inventario();

-- Menú del día: cuando se vende todo lo preparado, el plato queda Agotado en todos los canales
create or replace function privado.agotar_menu_del_dia()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_preparado integer; v_vendido integer;
begin
  select preparado into v_preparado from public.menu_del_dia
   where fecha = privado.hoy() and producto_id = new.producto_id and disponible;
  if v_preparado is null then return null; end if;
  select coalesce(sum(i.cantidad), 0) into v_vendido
    from public.pedido_items i join public.pedidos p on p.id = i.pedido_id
   where i.producto_id = new.producto_id and p.fecha = privado.hoy() and p.estado <> 'anulado';
  if v_vendido >= v_preparado then
    update public.productos set agotado = true where id = new.producto_id and not agotado;
  end if;
  return null;
end; $$;
drop trigger if exists agotar_menu_del_dia on public.pedido_items;
create trigger agotar_menu_del_dia after insert on public.pedido_items for each row execute function privado.agotar_menu_del_dia();

-- Compras: suben el stock y actualizan el costo promedio del insumo (y con él, el de las recetas)
create or replace function privado.registrar_compra_item()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.ingredientes
     set costo_unitario = case when stock + new.cantidad > 0
           then round(((greatest(stock, 0) * costo_unitario) + (new.cantidad * new.costo_unitario)) / (greatest(stock, 0) + new.cantidad), 2)
           else new.costo_unitario end,
         stock = stock + new.cantidad
   where id = new.ingrediente_id;
  insert into public.movimientos_inventario (ingrediente_id, tipo, cantidad, motivo, compra_id, creado_por)
  values (new.ingrediente_id, 'entrada', new.cantidad, 'Compra', new.compra_id, (select auth.uid()));
  -- costo de cada plato = suma de su receta
  update public.productos pr set costo = x.costo
    from (select r.producto_id, round(sum(r.cantidad * g.costo_unitario), 2) costo
            from public.recetas r join public.ingredientes g on g.id = r.ingrediente_id
           where r.producto_id in (select producto_id from public.recetas where ingrediente_id = new.ingrediente_id)
           group by r.producto_id) x
   where pr.id = x.producto_id;
  return null;
end; $$;
drop trigger if exists registrar_compra_item on public.compra_items;
create trigger registrar_compra_item after insert on public.compra_items for each row execute function privado.registrar_compra_item();

-- Movimientos manuales (Entrada / Salida / Ajuste) ajustan el stock
create or replace function privado.aplicar_movimiento()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.tipo in ('salida', 'ajuste') or (new.tipo = 'entrada' and new.compra_id is null) then
    update public.ingredientes set stock = stock + new.cantidad where id = new.ingrediente_id;
  end if;
  if new.creado_por is null then new.creado_por := (select auth.uid()); end if;
  return new;
end; $$;
drop trigger if exists aplicar_movimiento on public.movimientos_inventario;
create trigger aplicar_movimiento before insert on public.movimientos_inventario for each row execute function privado.aplicar_movimiento();

-- Auditoría de cambios de precio
create or replace function privado.auditar_precio()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.precio is distinct from old.precio then
    perform privado.auditar('Cambió el precio de ' || new.nombre, 'productos', new.id,
      jsonb_build_object('antes', old.precio, 'despues', new.precio));
  end if;
  return null;
end; $$;
drop trigger if exists auditar_precio on public.productos;
create trigger auditar_precio after update of precio on public.productos for each row execute function privado.auditar_precio();

-- Nuevo usuario de Supabase Auth → su perfil, inactivo.
-- Nadie se vuelve Dueño solo: el Dueño se nombra UNA vez con hacer-administrador.sql.
-- Al resto del equipo lo crea el Dueño desde la app (Usuarios y roles › Crear usuario), con crear_usuario().
create or replace function privado.crear_perfil()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.perfiles (id, nombre, correo, rol, activo)
  values (new.id,
          coalesce(nullif(new.raw_user_meta_data ->> 'nombre', ''), split_part(new.email, '@', 1)),
          new.email, 'mesero', false)
  on conflict (id) do nothing;
  return new;
end; $$;
drop trigger if exists crear_perfil on auth.users;
create trigger crear_perfil after insert on auth.users for each row execute function privado.crear_perfil();

-- ---------------------------------------------------------------------
-- 4. Funciones que llama la app
-- ---------------------------------------------------------------------

-- ¿Ya existe el Dueño? Si no, la pantalla «Entrar» explica cómo nombrarlo con hacer-administrador.sql.
create or replace function public.hay_dueno()
returns boolean
language sql stable security definer
set search_path = ''
as $$ select exists (select 1 from public.perfiles where rol = 'dueno'); $$;
grant execute on function public.hay_dueno() to anon, authenticated;

-- Datos públicos de una mesa a partir de su QR (sin mostrar el token de otras mesas)
create or replace function public.info_mesa(p_numero integer, p_token text)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'numero', m.numero, 'zona', m.zona,
    'pedido_abierto', (select jsonb_build_object('numero', p.numero, 'total', p.total)
                         from public.pedidos p
                        where p.mesa_id = m.id and p.estado <> 'anulado'
                          and (p.pago_metodo is null or p.pago_pendiente)
                        order by p.created_at desc limit 1))
  from public.mesas m where m.numero = p_numero and m.qr_token = p_token;
$$;
grant execute on function public.info_mesa(integer, text) to anon, authenticated;

-- Pedido de la Tienda online o del QR de mesa.
-- p_items: [{"producto_id": "...", "cantidad": 2, "nota": "sin cebolla"}]
-- Los precios se toman del servidor; el cliente no puede cambiarlos.
create or replace function public.crear_pedido_publico(
  p_canal text,
  p_items jsonb,
  p_dispositivo text,
  p_mesa_numero integer default null,
  p_mesa_token text default null,
  p_cliente text default null,
  p_telefono text default null,
  p_direccion text default null,
  p_zona_envio text default null,
  p_recoger boolean default false
)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_cfg public.negocio_config;
  v_mesa public.mesas;
  v_pedido public.pedidos;
  v_item jsonb;
  v_prod public.productos;
  v_canal_prod text;
  v_envio numeric := 0;
  v_ahora time := (now() at time zone 'America/La_Paz')::time;
begin
  if p_canal not in ('qr', 'web') then raise exception 'Canal no permitido'; end if;
  if coalesce(length(p_dispositivo), 0) < 8 then raise exception 'Falta el identificador del dispositivo'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'El pedido está vacío'; end if;
  if jsonb_array_length(p_items) > 40 then raise exception 'Demasiados productos en un solo pedido'; end if;

  -- Un pedido cada 20 segundos por dispositivo
  if exists (select 1 from public.pedidos where dispositivo = p_dispositivo and created_at > now() - interval '20 seconds') then
    raise exception 'Espera unos segundos antes de enviar otro pedido';
  end if;

  select * into v_cfg from public.negocio_config where id = 1;

  if p_canal = 'qr' then
    select * into v_mesa from public.mesas where numero = p_mesa_numero and qr_token = p_mesa_token;
    if not found then raise exception 'El QR de esta mesa no es válido. Pide ayuda al mesero.'; end if;
    v_canal_prod := 'salon';
    -- Si la mesa ya tiene un pedido abierto, lo nuevo se suma a esa cuenta
    select * into v_pedido from public.pedidos
     where mesa_id = v_mesa.id and estado <> 'anulado' and (pago_metodo is null or pago_pendiente)
     order by created_at desc limit 1;
  else
    if not v_cfg.local_abierto or v_ahora < v_cfg.hora_abre or v_ahora >= v_cfg.hora_cierra then
      raise exception 'El local está cerrado ahora';
    end if;
    if coalesce(length(trim(p_cliente)), 0) < 2 then raise exception 'Escribe tu nombre'; end if;
    v_canal_prod := case when p_recoger then 'mostrador' else 'delivery' end;
    if not p_recoger then
      if coalesce(length(trim(p_direccion)), 0) < 6 then raise exception 'Escribe la dirección de entrega'; end if;
      select (z ->> 'costo')::numeric into v_envio from jsonb_array_elements(v_cfg.envio) z where z ->> 'id' = p_zona_envio;
      if v_envio is null then raise exception 'Elige una zona de entrega válida'; end if;
    end if;
  end if;

  if v_pedido.id is null then
    insert into public.pedidos (canal, mesa_id, cliente, telefono, direccion, envio, estado, dispositivo,
                                pago_metodo, pago_pendiente, delivery_estado)
    values (p_canal, v_mesa.id, left(p_cliente, 60), left(p_telefono, 20),
            case when p_canal = 'web' and not p_recoger then left(p_direccion, 200) end, v_envio, 'cocina', p_dispositivo,
            case when p_canal = 'web' then 'qr' end, p_canal = 'web',
            case when p_canal = 'web' and not p_recoger then 'asignado' end)
    returning * into v_pedido;
  else
    update public.pedidos set estado = 'cocina', pidio_cuenta = false, dispositivo = p_dispositivo,
           cliente = coalesce(cliente, left(p_cliente, 60))
     where id = v_pedido.id;
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_prod from public.productos where id = (v_item ->> 'producto_id')::uuid;
    if not found or not v_prod.en_menu then raise exception 'Un producto ya no está en el menú'; end if;
    if v_prod.agotado then raise exception '% está agotado', v_prod.nombre; end if;
    if not coalesce((v_prod.canales ->> v_canal_prod)::boolean, true) then raise exception '% no está disponible por este canal', v_prod.nombre; end if;
    if coalesce((v_item ->> 'cantidad')::int, 0) not between 1 and 50 then raise exception 'Cantidad no válida'; end if;
    insert into public.pedido_items (pedido_id, producto_id, nombre, precio_unitario, cantidad, nota)
    values (v_pedido.id, v_prod.id, v_prod.nombre, v_prod.precio, (v_item ->> 'cantidad')::int, left(v_item ->> 'nota', 120));
  end loop;

  select * into v_pedido from public.pedidos where id = v_pedido.id;
  return jsonb_build_object('id', v_pedido.id, 'numero', v_pedido.numero, 'codigo', v_pedido.codigo_seguimiento, 'total', v_pedido.total);
end; $$;
grant execute on function public.crear_pedido_publico(text, jsonb, text, integer, text, text, text, text, text, boolean) to anon, authenticated;

-- Seguimiento en vivo para el cliente (sin datos personales)
create or replace function public.seguimiento_pedido(p_pedido_id uuid, p_codigo text)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'numero', p.numero, 'estado', p.estado, 'delivery_estado', p.delivery_estado,
    'pagado', p.pago_metodo is not null and not p.pago_pendiente, 'total', p.total,
    'creado', p.created_at, 'enviado', p.enviado_at, 'preparando', p.preparando_at, 'listo', p.listo_at,
    'en_camino', p.en_camino_at, 'entregado', p.entregado_at,
    'items', (select jsonb_agg(jsonb_build_object('nombre', i.nombre, 'cantidad', i.cantidad) order by i.created_at)
                from public.pedido_items i where i.pedido_id = p.id))
  from public.pedidos p where p.id = p_pedido_id and p.codigo_seguimiento = p_codigo;
$$;
grant execute on function public.seguimiento_pedido(uuid, text) to anon, authenticated;

-- Llamar al mesero desde el QR de la mesa (una llamada cada 30 s por mesa)
create or replace function public.llamar_mesero(p_mesa_numero integer, p_mesa_token text, p_motivo text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare v_mesa uuid; v_id uuid;
begin
  select id into v_mesa from public.mesas where numero = p_mesa_numero and qr_token = p_mesa_token;
  if v_mesa is null then raise exception 'El QR de esta mesa no es válido'; end if;
  if exists (select 1 from public.llamadas where mesa_id = v_mesa and created_at > now() - interval '30 seconds' and not cancelada) then
    raise exception 'Ya avisamos a tu mesero. Espera unos segundos.';
  end if;
  update public.llamadas set cancelada = true where mesa_id = v_mesa and atendida_at is null and not cancelada;
  insert into public.llamadas (mesa_id, motivo) values (v_mesa, p_motivo) returning id into v_id;
  return v_id;
end; $$;
grant execute on function public.llamar_mesero(integer, text, text) to anon, authenticated;

create or replace function public.estado_llamada(p_llamada uuid, p_mesa_token text)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object('atendida', l.atendida_at is not null, 'cancelada', l.cancelada,
                            'mesero', split_part(pf.nombre, ' ', 1), 'creada', l.created_at)
    from public.llamadas l
    join public.mesas m on m.id = l.mesa_id and m.qr_token = p_mesa_token
    left join public.perfiles pf on pf.id = l.atendida_por
   where l.id = p_llamada;
$$;
grant execute on function public.estado_llamada(uuid, text) to anon, authenticated;

create or replace function public.cancelar_llamada(p_llamada uuid, p_mesa_token text)
returns void
language sql security definer
set search_path = ''
as $$
  update public.llamadas l set cancelada = true
    from public.mesas m
   where l.id = p_llamada and m.id = l.mesa_id and m.qr_token = p_mesa_token and l.atendida_at is null;
$$;
grant execute on function public.cancelar_llamada(uuid, text) to anon, authenticated;

-- Pedir la cuenta desde el QR de la mesa
create or replace function public.pedir_cuenta_mesa(p_mesa_numero integer, p_mesa_token text)
returns boolean
language sql security definer
set search_path = ''
as $$
  with p as (
    update public.pedidos set pidio_cuenta = true
     where id = (select p2.id from public.pedidos p2 join public.mesas m on m.id = p2.mesa_id
                  where m.numero = p_mesa_numero and m.qr_token = p_mesa_token
                    and p2.estado <> 'anulado' and (p2.pago_metodo is null or p2.pago_pendiente)
                  order by p2.created_at desc limit 1)
    returning 1)
  select exists (select 1 from p);
$$;
grant execute on function public.pedir_cuenta_mesa(integer, text) to anon, authenticated;

-- Anular un pedido: pide el PIN de anulación y un motivo, y queda en la auditoría
create or replace function public.anular_pedido(p_id uuid, p_pin text, p_motivo text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare v_hash text; v_num integer;
begin
  if not privado.tiene_rol(array['dueno', 'cajero']) then raise exception 'No tienes permiso para anular pedidos'; end if;
  if coalesce(length(trim(p_motivo)), 0) < 4 then raise exception 'Escribe el motivo de la anulación'; end if;
  select pin_anulacion_hash into v_hash from privado.secretos where id = 1;
  if v_hash is null or extensions.crypt(p_pin, v_hash) <> v_hash then raise exception 'PIN incorrecto'; end if;
  update public.pedidos set estado = 'anulado', motivo_anulacion = left(p_motivo, 200)
   where id = p_id and estado <> 'anulado' returning numero into v_num;
  if v_num is null then raise exception 'El pedido no existe o ya estaba anulado'; end if;
  perform privado.auditar('Anuló el pedido #' || v_num, 'pedidos', p_id, jsonb_build_object('motivo', p_motivo));
end; $$;
revoke execute on function public.anular_pedido(uuid, text, text) from public, anon;
grant execute on function public.anular_pedido(uuid, text, text) to authenticated;

-- Unir mesas (Fase 8): los productos del pedido de otra mesa pasan a esta cuenta y el pedido vacío queda anulado
create or replace function public.unir_pedidos(p_destino uuid, p_origen uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare v_dest public.pedidos; v_orig public.pedidos;
begin
  if not privado.tiene_rol(array['dueno', 'cajero', 'mesero']) then raise exception 'No tienes permiso para unir mesas'; end if;
  select * into v_dest from public.pedidos where id = p_destino;
  select * into v_orig from public.pedidos where id = p_origen;
  if v_dest.id is null or v_orig.id is null or v_dest.id = v_orig.id then raise exception 'Elige dos pedidos distintos'; end if;
  if v_dest.estado = 'anulado' or v_orig.estado = 'anulado' or (v_dest.pago_metodo is not null and not v_dest.pago_pendiente)
     or (v_orig.pago_metodo is not null and not v_orig.pago_pendiente) then raise exception 'Solo se pueden unir cuentas abiertas y sin cobrar'; end if;
  update public.pedido_items set pedido_id = p_destino where pedido_id = p_origen;
  update public.pedidos set subtotal = coalesce((select sum(precio_unitario * cantidad) from public.pedido_items where pedido_id = p_destino), 0) where id = p_destino;
  update public.pedidos set estado = 'anulado', subtotal = 0, motivo_anulacion = 'Unido al pedido #' || v_dest.numero where id = p_origen;
  perform privado.auditar('Unió el pedido #' || v_orig.numero || ' al #' || v_dest.numero, 'pedidos', p_destino, null);
end; $$;
revoke execute on function public.unir_pedidos(uuid, uuid) from public, anon;
grant execute on function public.unir_pedidos(uuid, uuid) to authenticated;

-- Anular una factura (mismo PIN y motivo)
create or replace function public.anular_factura(p_id uuid, p_pin text, p_motivo text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare v_hash text; v_num integer;
begin
  if not privado.tiene_rol(array['dueno', 'cajero']) then raise exception 'No tienes permiso para anular facturas'; end if;
  if coalesce(length(trim(p_motivo)), 0) < 4 then raise exception 'Escribe el motivo de la anulación'; end if;
  select pin_anulacion_hash into v_hash from privado.secretos where id = 1;
  if extensions.crypt(p_pin, v_hash) <> v_hash then raise exception 'PIN incorrecto'; end if;
  update public.facturas set estado = 'Anulada', motivo_anulacion = left(p_motivo, 200)
   where id = p_id and estado = 'Válida' returning numero into v_num;
  if v_num is null then raise exception 'La factura no existe o ya estaba anulada'; end if;
  perform privado.auditar('Anuló la factura ' || v_num, 'facturas', p_id, jsonb_build_object('motivo', p_motivo));
end; $$;
revoke execute on function public.anular_factura(uuid, text, text) from public, anon;
grant execute on function public.anular_factura(uuid, text, text) to authenticated;

-- El Dueño cambia el PIN de anulación
create or replace function public.cambiar_pin_anulacion(p_pin text)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not privado.tiene_rol(array['dueno']) then raise exception 'Solo el Dueño puede cambiar el PIN de anulación'; end if;
  if p_pin !~ '^[0-9]{4}$' then raise exception 'El PIN debe tener 4 números'; end if;
  insert into privado.secretos (id, pin_anulacion_hash) values (1, extensions.crypt(p_pin, extensions.gen_salt('bf')))
  on conflict (id) do update set pin_anulacion_hash = excluded.pin_anulacion_hash;
  perform privado.auditar('Cambió el PIN de anulación', 'negocio_config', null, null);
end; $$;
revoke execute on function public.cambiar_pin_anulacion(text) from public, anon;
grant execute on function public.cambiar_pin_anulacion(text) to authenticated;

-- El Dueño configura a un usuario recién creado (o lo edita): nombre, rol, zona, PIN y si está activo
create or replace function public.configurar_usuario(p_id uuid, p_nombre text, p_rol text, p_zona text, p_pin text, p_activo boolean)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not privado.tiene_rol(array['dueno']) then raise exception 'Solo el Dueño gestiona usuarios'; end if;
  if p_id = (select auth.uid()) and (p_rol <> 'dueno' or not p_activo) then raise exception 'No puedes quitarte el rol de Dueño'; end if;
  if p_id <> (select auth.uid()) and p_rol = 'dueno' then raise exception 'Solo hay un Dueño. Elige otro rol para esta persona'; end if;
  update public.perfiles set nombre = coalesce(nullif(trim(p_nombre), ''), nombre), rol = p_rol, zona = p_zona, activo = p_activo
   where id = p_id;
  if not found then raise exception 'Ese usuario no existe'; end if;
  if p_pin is not null then
    if p_pin !~ '^[0-9]{4}$' then raise exception 'El PIN debe tener 4 números'; end if;
    insert into privado.pines (perfil_id, pin_hash) values (p_id, extensions.crypt(p_pin, extensions.gen_salt('bf')))
    on conflict (perfil_id) do update set pin_hash = excluded.pin_hash;
  end if;
  perform privado.auditar('Configuró al usuario ' || p_nombre || ' como ' || p_rol, 'perfiles', p_id, jsonb_build_object('activo', p_activo));
end; $$;
revoke execute on function public.configurar_usuario(uuid, text, text, text, text, boolean) from public, anon;
grant execute on function public.configurar_usuario(uuid, text, text, text, text, boolean) to authenticated;

-- El Dueño crea la cuenta de una persona del equipo desde la app, con correo y contraseña,
-- sin salir de su sesión y sin que nadie tenga que confirmar su correo.
create or replace function public.crear_usuario(p_correo text, p_clave text, p_nombre text, p_rol text, p_zona text, p_pin text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_id uuid := gen_random_uuid();
  v_correo text := lower(trim(p_correo));
begin
  if not privado.tiene_rol(array['dueno']) then raise exception 'Solo el Dueño gestiona usuarios'; end if;
  if v_correo !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Escribe un correo válido'; end if;
  if length(coalesce(p_clave, '')) < 8 then raise exception 'La contraseña debe tener al menos 8 caracteres'; end if;
  if p_rol not in ('cajero', 'cocina', 'mesero', 'repartidor') then raise exception 'Elige un rol: Cajero, Cocina, Mesero o Repartidor'; end if;
  if p_pin !~ '^[0-9]{4}$' then raise exception 'El PIN debe tener 4 números'; end if;
  if exists (select 1 from auth.users where lower(email) = v_correo) then raise exception 'Ya existe un usuario con ese correo'; end if;

  -- Cuenta de acceso (los textos vacíos evitan el error «Database error querying schema» al entrar)
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_correo,
    extensions.crypt(p_clave, extensions.gen_salt('bf')), now(),
    '{"provider": "email", "providers": ["email"]}'::jsonb, jsonb_build_object('nombre', trim(p_nombre)), now(), now(),
    '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_id, v_id::text,
    jsonb_build_object('sub', v_id::text, 'email', v_correo, 'email_verified', true), 'email', now(), now(), now());

  -- El disparador ya creó su perfil: se le asigna rol, zona y PIN, y queda activo
  update public.perfiles set nombre = trim(p_nombre), rol = p_rol, zona = nullif(trim(p_zona), ''), activo = true where id = v_id;
  insert into privado.pines (perfil_id, pin_hash) values (v_id, extensions.crypt(p_pin, extensions.gen_salt('bf')))
  on conflict (perfil_id) do update set pin_hash = excluded.pin_hash;
  perform privado.auditar('Creó al usuario ' || trim(p_nombre) || ' como ' || p_rol, 'perfiles', v_id, jsonb_build_object('correo', v_correo));
  return v_id;
end; $$;
revoke execute on function public.crear_usuario(text, text, text, text, text, text) from public, anon;
grant execute on function public.crear_usuario(text, text, text, text, text, text) to authenticated;

-- El Dueño le pone una contraseña nueva a alguien del equipo (por ejemplo, si la olvidó)
create or replace function public.cambiar_clave_usuario(p_id uuid, p_clave text)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not privado.tiene_rol(array['dueno']) then raise exception 'Solo el Dueño gestiona usuarios'; end if;
  if length(coalesce(p_clave, '')) < 8 then raise exception 'La contraseña debe tener al menos 8 caracteres'; end if;
  update auth.users set encrypted_password = extensions.crypt(p_clave, extensions.gen_salt('bf')), updated_at = now() where id = p_id;
  if not found then raise exception 'Ese usuario no existe'; end if;
  perform privado.auditar('Cambió la contraseña de un usuario', 'perfiles', p_id, null);
end; $$;
revoke execute on function public.cambiar_clave_usuario(uuid, text) from public, anon;
grant execute on function public.cambiar_clave_usuario(uuid, text) to authenticated;

-- Cambiar de usuario con PIN en la tablet de la caja
create or replace function public.verificar_pin(p_perfil uuid, p_pin text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from privado.pines where perfil_id = p_perfil and extensions.crypt(p_pin, pin_hash) = pin_hash)
     and (select privado.rol_actual()) is not null;
$$;
revoke execute on function public.verificar_pin(uuid, text) from public, anon;
grant execute on function public.verificar_pin(uuid, text) to authenticated;

-- El cajero abre o cierra el local (la tienda online muestra «Cerrado»)
create or replace function public.cambiar_local_abierto(p_abierto boolean)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not privado.tiene_rol(array['dueno', 'cajero']) then raise exception 'No tienes permiso'; end if;
  update public.negocio_config set local_abierto = p_abierto where id = 1;
end; $$;
revoke execute on function public.cambiar_local_abierto(boolean) from public, anon;
grant execute on function public.cambiar_local_abierto(boolean) to authenticated;

-- Cajero o cocina marcan un plato como agotado (sin poder cambiar precios)
create or replace function public.marcar_agotado(p_producto uuid, p_agotado boolean)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not privado.tiene_rol(array['dueno', 'cajero', 'cocina']) then raise exception 'No tienes permiso'; end if;
  update public.productos set agotado = p_agotado where id = p_producto;
end; $$;
revoke execute on function public.marcar_agotado(uuid, boolean) from public, anon;
grant execute on function public.marcar_agotado(uuid, boolean) to authenticated;

-- Renovar el QR de una mesa (el QR impreso deja de funcionar)
create or replace function public.renovar_qr_mesa(p_mesa uuid)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare v text := encode(extensions.gen_random_bytes(9), 'hex');
begin
  if not privado.tiene_rol(array['dueno']) then raise exception 'Solo el Dueño renueva los QR'; end if;
  update public.mesas set qr_token = v where id = p_mesa;
  perform privado.auditar('Renovó el QR de una mesa', 'mesas', p_mesa, null);
  return v;
end; $$;
revoke execute on function public.renovar_qr_mesa(uuid) from public, anon;
grant execute on function public.renovar_qr_mesa(uuid) to authenticated;

-- Siguiente número de factura
create or replace function public.siguiente_numero_factura()
returns integer
language sql security definer
set search_path = ''
as $$ select nextval('public.facturas_numero_seq')::integer; $$;
revoke execute on function public.siguiente_numero_factura() from public, anon;
grant execute on function public.siguiente_numero_factura() to authenticated;

-- Las funciones de disparadores no se llaman directamente
revoke execute on function privado.pedido_antes_de_insertar(), privado.pedido_marcar_tiempos(), privado.pedido_recalcular(),
  privado.item_congelar(), privado.descontar_inventario(), privado.agotar_menu_del_dia(), privado.registrar_compra_item(),
  privado.aplicar_movimiento(), privado.auditar_precio(), privado.crear_perfil(), privado.tocar_updated_at() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 5. Seguridad por fila (RLS): cada rol ve y cambia solo lo suyo
-- ---------------------------------------------------------------------
alter table public.negocio_config enable row level security;
alter table public.perfiles enable row level security;
alter table public.permisos_rol enable row level security;
alter table public.categorias enable row level security;
alter table public.productos enable row level security;
alter table public.modificadores enable row level security;
alter table public.mesas enable row level security;
alter table public.llamadas enable row level security;
alter table public.pedidos enable row level security;
alter table public.pedido_items enable row level security;
alter table public.caja_sesiones enable row level security;
alter table public.caja_movimientos enable row level security;
alter table public.ingredientes enable row level security;
alter table public.recetas enable row level security;
alter table public.movimientos_inventario enable row level security;
alter table public.proveedores enable row level security;
alter table public.compras enable row level security;
alter table public.compra_items enable row level security;
alter table public.categorias_gasto enable row level security;
alter table public.gastos enable row level security;
alter table public.banners enable row level security;
alter table public.menu_del_dia enable row level security;
alter table public.facturas enable row level security;
alter table public.auditoria enable row level security;

-- Borra las políticas anteriores de este script para poder volver a ejecutarlo
do $$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
            where schemaname = 'public' and policyname like 'rb_%'
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- Lo que ve cualquiera (tienda, QR de mesa, pantalla del cliente): solo lectura
create policy rb_config_leer on public.negocio_config for select to anon, authenticated using (true);
create policy rb_config_dueno on public.negocio_config for update to authenticated
  using ((select privado.tiene_rol(array['dueno']))) with check ((select privado.tiene_rol(array['dueno'])));

create policy rb_categorias_leer on public.categorias for select to anon, authenticated using (visible or (select privado.rol_actual()) is not null);
create policy rb_categorias_dueno on public.categorias for all to authenticated
  using ((select privado.tiene_rol(array['dueno']))) with check ((select privado.tiene_rol(array['dueno'])));

create policy rb_productos_leer on public.productos for select to anon, authenticated using (en_menu or (select privado.rol_actual()) is not null);
create policy rb_productos_dueno on public.productos for all to authenticated
  using ((select privado.tiene_rol(array['dueno']))) with check ((select privado.tiene_rol(array['dueno'])));

create policy rb_modificadores_leer on public.modificadores for select to anon, authenticated using (true);
create policy rb_modificadores_dueno on public.modificadores for all to authenticated
  using ((select privado.tiene_rol(array['dueno']))) with check ((select privado.tiene_rol(array['dueno'])));

create policy rb_banners_leer on public.banners for select to anon, authenticated using (activo or (select privado.rol_actual()) is not null);
create policy rb_banners_dueno on public.banners for all to authenticated
  using ((select privado.tiene_rol(array['dueno']))) with check ((select privado.tiene_rol(array['dueno'])));

-- Equipo
create policy rb_perfiles_leer on public.perfiles for select to authenticated
  using (id = (select auth.uid()) or (select privado.rol_actual()) is not null);
create policy rb_perfiles_dueno on public.perfiles for update to authenticated
  using ((select privado.tiene_rol(array['dueno']))) with check ((select privado.tiene_rol(array['dueno'])));
create policy rb_permisos_leer on public.permisos_rol for select to authenticated using ((select privado.rol_actual()) is not null);
create policy rb_permisos_dueno on public.permisos_rol for all to authenticated
  using ((select privado.tiene_rol(array['dueno']))) with check ((select privado.tiene_rol(array['dueno'])));

-- Salón
create policy rb_mesas_leer on public.mesas for select to authenticated using ((select privado.rol_actual()) is not null);
create policy rb_mesas_dueno on public.mesas for all to authenticated
  using ((select privado.tiene_rol(array['dueno']))) with check ((select privado.tiene_rol(array['dueno'])));
create policy rb_llamadas_leer on public.llamadas for select to authenticated
  using ((select privado.tiene_rol(array['dueno', 'cajero', 'mesero'])));
create policy rb_llamadas_atender on public.llamadas for update to authenticated
  using ((select privado.tiene_rol(array['dueno', 'cajero', 'mesero']))) with check ((select privado.tiene_rol(array['dueno', 'cajero', 'mesero'])));

-- Pedidos: dueño, cajero, cocina y mesero ven todos; el repartidor solo los suyos
create policy rb_pedidos_leer on public.pedidos for select to authenticated
  using ((select privado.tiene_rol(array['dueno', 'cajero', 'cocina', 'mesero'])) or repartidor_id = (select auth.uid()));
create policy rb_pedidos_crear on public.pedidos for insert to authenticated
  with check ((select privado.tiene_rol(array['dueno', 'cajero', 'mesero'])) and estado <> 'anulado');
create policy rb_pedidos_cambiar on public.pedidos for update to authenticated
  using ((select privado.tiene_rol(array['dueno', 'cajero', 'cocina', 'mesero'])) or repartidor_id = (select auth.uid()))
  with check (estado <> 'anulado' or (select privado.tiene_rol(array['dueno', 'cajero'])));
-- (No hay política de borrado: los pedidos no se borran, se anulan con anular_pedido)

create policy rb_items_leer on public.pedido_items for select to authenticated
  using (exists (select 1 from public.pedidos p where p.id = pedido_id));
create policy rb_items_escribir on public.pedido_items for all to authenticated
  using ((select privado.tiene_rol(array['dueno', 'cajero', 'mesero']))
         and exists (select 1 from public.pedidos p where p.id = pedido_id and p.estado <> 'anulado' and (p.pago_metodo is null or p.pago_pendiente)))
  with check ((select privado.tiene_rol(array['dueno', 'cajero', 'mesero']))
         and exists (select 1 from public.pedidos p where p.id = pedido_id and p.estado <> 'anulado' and (p.pago_metodo is null or p.pago_pendiente)));

-- Caja: dueño y cajero. Solo el Dueño reabre una caja cerrada.
create policy rb_caja_leer on public.caja_sesiones for select to authenticated using ((select privado.tiene_rol(array['dueno', 'cajero'])));
create policy rb_caja_abrir on public.caja_sesiones for insert to authenticated with check ((select privado.tiene_rol(array['dueno', 'cajero'])));
create policy rb_caja_cerrar on public.caja_sesiones for update to authenticated
  using ((select privado.tiene_rol(array['dueno'])) or ((select privado.tiene_rol(array['cajero'])) and cerrada_at is null))
  with check ((select privado.tiene_rol(array['dueno'])) or ((select privado.tiene_rol(array['cajero'])) and cerrada_at is not null));
create policy rb_caja_mov on public.caja_movimientos for all to authenticated
  using ((select privado.tiene_rol(array['dueno', 'cajero']))) with check ((select privado.tiene_rol(array['dueno', 'cajero'])));

-- Inventario y compras: el Dueño gestiona; cajero y cocina pueden consultar
create policy rb_ingredientes_leer on public.ingredientes for select to authenticated using ((select privado.tiene_rol(array['dueno', 'cajero', 'cocina'])));
create policy rb_ingredientes_dueno on public.ingredientes for all to authenticated
  using ((select privado.tiene_rol(array['dueno']))) with check ((select privado.tiene_rol(array['dueno'])));
create policy rb_recetas_leer on public.recetas for select to authenticated using ((select privado.tiene_rol(array['dueno', 'cajero', 'cocina'])));
create policy rb_recetas_dueno on public.recetas for all to authenticated
  using ((select privado.tiene_rol(array['dueno']))) with check ((select privado.tiene_rol(array['dueno'])));
create policy rb_mov_inv_leer on public.movimientos_inventario for select to authenticated using ((select privado.tiene_rol(array['dueno', 'cocina'])));
create policy rb_mov_inv_crear on public.movimientos_inventario for insert to authenticated with check ((select privado.tiene_rol(array['dueno', 'cocina'])));
create policy rb_proveedores on public.proveedores for all to authenticated
  using ((select privado.tiene_rol(array['dueno']))) with check ((select privado.tiene_rol(array['dueno'])));
create policy rb_compras on public.compras for all to authenticated
  using ((select privado.tiene_rol(array['dueno']))) with check ((select privado.tiene_rol(array['dueno'])));
create policy rb_compra_items on public.compra_items for all to authenticated
  using ((select privado.tiene_rol(array['dueno']))) with check ((select privado.tiene_rol(array['dueno'])));

-- Gastos: el cajero registra y ve; el Dueño gestiona
create policy rb_cat_gasto_leer on public.categorias_gasto for select to authenticated using ((select privado.tiene_rol(array['dueno', 'cajero'])));
create policy rb_cat_gasto_dueno on public.categorias_gasto for all to authenticated
  using ((select privado.tiene_rol(array['dueno']))) with check ((select privado.tiene_rol(array['dueno'])));
create policy rb_gastos_leer on public.gastos for select to authenticated using ((select privado.tiene_rol(array['dueno', 'cajero'])));
create policy rb_gastos_crear on public.gastos for insert to authenticated with check ((select privado.tiene_rol(array['dueno', 'cajero'])));
create policy rb_gastos_dueno on public.gastos for update to authenticated
  using ((select privado.tiene_rol(array['dueno']))) with check ((select privado.tiene_rol(array['dueno'])));
create policy rb_gastos_borrar on public.gastos for delete to authenticated using ((select privado.tiene_rol(array['dueno'])));

-- Menú del día
create policy rb_menu_dia_leer on public.menu_del_dia for select to anon, authenticated using (true);
create policy rb_menu_dia_dueno on public.menu_del_dia for all to authenticated
  using ((select privado.tiene_rol(array['dueno']))) with check ((select privado.tiene_rol(array['dueno'])));

-- Facturas: dueño y cajero (se anulan con anular_factura, no se borran)
create policy rb_facturas_leer on public.facturas for select to authenticated using ((select privado.tiene_rol(array['dueno', 'cajero'])));
create policy rb_facturas_crear on public.facturas for insert to authenticated with check ((select privado.tiene_rol(array['dueno', 'cajero'])) and estado = 'Válida');

-- Auditoría: solo la lee el Dueño; la escriben las funciones
create policy rb_auditoria_leer on public.auditoria for select to authenticated using ((select privado.tiene_rol(array['dueno'])));

-- ---------------------------------------------------------------------
-- 6. Tiempo real: pedidos, productos de cada pedido, llamadas y configuración
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach t in array array['pedidos', 'pedido_items', 'llamadas', 'negocio_config', 'productos']
  loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 6b. CRM · Clientes, puntos y premios
--     Cada pedido con teléfono se une solo a la ficha de su cliente (se crea si no existe).
--     Los puntos salen de lo pagado: 1 punto por cada «crm_bs_por_punto» del subtotal.
-- ---------------------------------------------------------------------
alter table public.negocio_config add column if not exists crm_bs_por_punto numeric(10, 2) not null default 10 check (crm_bs_por_punto > 0);
alter table public.negocio_config add column if not exists crm_puntos_premio integer not null default 100 check (crm_puntos_premio > 0);
alter table public.negocio_config add column if not exists crm_premio text not null default 'Un plato fuerte gratis';
alter table public.negocio_config add column if not exists crm_dias_riesgo smallint not null default 30 check (crm_dias_riesgo between 7 and 365);

create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  telefono text unique check (telefono ~ '^[0-9]{8,15}$'),   -- con código de país: 59170000000
  correo text,
  cumpleanos date,
  notas text,
  etiquetas text[] not null default '{}',
  acepta_promos boolean not null default true,
  puntos_canjeados integer not null default 0 check (puntos_canjeados >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.pedidos add column if not exists cliente_id uuid references public.clientes (id) on delete set null;
create index if not exists pedidos_cliente_idx on public.pedidos (cliente_id);

create table if not exists public.canjes (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  puntos integer not null check (puntos > 0),
  premio text not null,
  creado_por uuid references public.perfiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists canjes_cliente_idx on public.canjes (cliente_id);
create index if not exists canjes_creado_por_idx on public.canjes (creado_por);

drop trigger if exists tocar_updated_at on public.clientes;
create trigger tocar_updated_at before update on public.clientes for each row execute function privado.tocar_updated_at();

-- Teléfono en un solo formato: solo números y con 591 delante si tiene 8 dígitos
create or replace function privado.normalizar_tel(p text)
returns text language sql immutable set search_path = '' as $$
  select case
    when length(regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g')) = 8 then '591' || regexp_replace(p, '[^0-9]', '', 'g')
    when length(regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g')) between 9 and 15 then regexp_replace(p, '[^0-9]', '', 'g')
  end;
$$;

-- Pedido con teléfono → su cliente (lo crea la primera vez y le pone nombre si aún no tenía)
create or replace function privado.vincular_cliente()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_tel text := privado.normalizar_tel(new.telefono);
  v_nombre text := nullif(trim(coalesce(new.cliente, '')), '');
  v_id uuid;
begin
  if v_tel is null then return new; end if;
  insert into public.clientes as c (nombre, telefono) values (coalesce(v_nombre, 'Cliente ' || right(v_tel, 4)), v_tel)
  on conflict (telefono) do update
    set nombre = case when c.nombre like 'Cliente %' and v_nombre is not null then v_nombre else c.nombre end
  returning c.id into v_id;
  new.cliente_id := v_id;
  return new;
end; $$;
drop trigger if exists vincular_cliente on public.pedidos;
create trigger vincular_cliente before insert or update of telefono, cliente on public.pedidos
  for each row execute function privado.vincular_cliente();
revoke execute on function privado.vincular_cliente() from public, anon, authenticated;

-- Resumen de cada cliente para la pantalla Clientes (respeta la seguridad de quien la mira)
create or replace view public.clientes_resumen with (security_invoker = true) as
select c.*,
  count(p.id) filter (where p.pagado)::int as visitas,
  coalesce(sum(p.total) filter (where p.pagado), 0)::numeric(12, 2) as total_gastado,
  min(p.created_at) filter (where p.pagado) as primera_visita,
  max(p.created_at) filter (where p.pagado) as ultima_visita,
  (coalesce(sum(floor(p.subtotal / cfg.crm_bs_por_punto)) filter (where p.pagado), 0) - c.puntos_canjeados)::int as puntos
from public.clientes c
cross join (select crm_bs_por_punto from public.negocio_config where id = 1) cfg
left join lateral (
  select x.id, x.total, x.subtotal, x.created_at,
         (x.pago_metodo is not null and not x.pago_pendiente and x.estado <> 'anulado') as pagado
  from public.pedidos x where x.cliente_id = c.id
) p on true
group by c.id, cfg.crm_bs_por_punto;
revoke all on public.clientes_resumen from anon;
grant select on public.clientes_resumen to authenticated;

-- Canjear el premio: descuenta los puntos y deja constancia
create or replace function public.canjear_puntos(p_cliente uuid)
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_premio text; v_necesarios integer; v_tiene integer; v_nombre text;
begin
  if not privado.tiene_rol(array['dueno', 'cajero']) then raise exception 'Solo el Dueño o la caja canjean premios'; end if;
  select nombre into v_nombre from public.clientes where id = p_cliente for update;
  if v_nombre is null then raise exception 'Ese cliente no existe'; end if;
  select crm_premio, crm_puntos_premio into v_premio, v_necesarios from public.negocio_config where id = 1;
  select puntos into v_tiene from public.clientes_resumen where id = p_cliente;
  if v_tiene < v_necesarios then raise exception 'Le faltan % puntos para el premio', v_necesarios - v_tiene; end if;
  update public.clientes set puntos_canjeados = puntos_canjeados + v_necesarios where id = p_cliente;
  insert into public.canjes (cliente_id, puntos, premio, creado_por) values (p_cliente, v_necesarios, v_premio, (select auth.uid()));
  perform privado.auditar('Canjeó «' || v_premio || '» para ' || v_nombre, 'clientes', p_cliente, jsonb_build_object('puntos', v_necesarios));
  return v_tiene - v_necesarios;
end; $$;
revoke execute on function public.canjear_puntos(uuid) from public, anon;
grant execute on function public.canjear_puntos(uuid) to authenticated;

alter table public.clientes enable row level security;
alter table public.canjes enable row level security;
drop policy if exists rb_clientes_leer on public.clientes;
drop policy if exists rb_clientes_crear on public.clientes;
drop policy if exists rb_clientes_cambiar on public.clientes;
drop policy if exists rb_clientes_borrar on public.clientes;
drop policy if exists rb_canjes_leer on public.canjes;
create policy rb_clientes_leer on public.clientes for select to authenticated using ((select privado.tiene_rol(array['dueno', 'cajero'])));
create policy rb_clientes_crear on public.clientes for insert to authenticated with check ((select privado.tiene_rol(array['dueno', 'cajero'])));
create policy rb_clientes_cambiar on public.clientes for update to authenticated
  using ((select privado.tiene_rol(array['dueno', 'cajero']))) with check ((select privado.tiene_rol(array['dueno', 'cajero'])));
create policy rb_clientes_borrar on public.clientes for delete to authenticated using ((select privado.tiene_rol(array['dueno'])));
create policy rb_canjes_leer on public.canjes for select to authenticated using ((select privado.tiene_rol(array['dueno', 'cajero'])));

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'clientes') then
    alter publication supabase_realtime add table public.clientes;
  end if;
end $$;

-- Pedidos anteriores con teléfono: se unen a su cliente (solo los que faltan)
update public.pedidos set telefono = telefono
 where cliente_id is null and privado.normalizar_tel(telefono) is not null;

-- ---------------------------------------------------------------------
-- 7. Storage: buckets con su nombre exacto y quién puede subir
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('productos', 'productos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('marca', 'marca', true, 2097152, array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']),
  ('comprobantes', 'comprobantes', false, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

drop policy if exists rb_fotos_leer on storage.objects;
drop policy if exists rb_fotos_subir on storage.objects;
drop policy if exists rb_fotos_cambiar on storage.objects;
drop policy if exists rb_fotos_borrar on storage.objects;
drop policy if exists rb_comprobantes_subir on storage.objects;
drop policy if exists rb_comprobantes_leer on storage.objects;

create policy rb_fotos_leer on storage.objects for select to anon, authenticated using (bucket_id in ('productos', 'marca'));
create policy rb_fotos_subir on storage.objects for insert to authenticated
  with check (bucket_id in ('productos', 'marca') and (select privado.tiene_rol(array['dueno'])));
create policy rb_fotos_cambiar on storage.objects for update to authenticated
  using (bucket_id in ('productos', 'marca') and (select privado.tiene_rol(array['dueno'])));
create policy rb_fotos_borrar on storage.objects for delete to authenticated
  using (bucket_id in ('productos', 'marca') and (select privado.tiene_rol(array['dueno'])));
create policy rb_comprobantes_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'comprobantes' and (select privado.tiene_rol(array['dueno', 'cajero', 'repartidor'])));
create policy rb_comprobantes_leer on storage.objects for select to authenticated
  using (bucket_id = 'comprobantes' and (select privado.tiene_rol(array['dueno', 'cajero'])));

-- ---------------------------------------------------------------------
-- 8. Datos de ejemplo de PrestoBar (de la ficha, parte A)
--    No se duplican si vuelves a ejecutar el script.
-- ---------------------------------------------------------------------
insert into public.negocio_config (id, nombre, lema, whatsapp, direccion, ciudad, nit, horario, hora_abre, hora_cierra,
  propina_sugerida, demora_min, escalado_min, envio, facturacion_activa, facturacion_pruebas)
values (1, 'PrestoBar', 'El mejor servicio', '59170000000', 'Av. Virgen de Luján, al lado del salón Youfer', 'Santa Cruz de la Sierra, Bolivia',
  '1029384756', 'Lunes a domingo 10:00–23:30', '10:00', '23:30', 10, 20, 3,
  '[{"id":"a4","nombre":"Hasta el 4.º anillo","costo":10},{"id":"a6","nombre":"Hasta el 6.º anillo","costo":15}]'::jsonb, true, true)
on conflict (id) do nothing;
-- Si tu negocio todavía tiene el nombre anterior de fábrica, pasa a PrestoBar (un nombre propio no se toca)
update public.negocio_config set nombre = 'PrestoBar' where id = 1 and nombre = 'ResTO BAR';

-- PIN de anulación de ejemplo: 1234 (cámbialo en Configuración › Seguridad)
insert into privado.secretos (id, pin_anulacion_hash) values (1, extensions.crypt('1234', extensions.gen_salt('bf')))
on conflict (id) do nothing;

insert into public.categorias (nombre, orden) values
  ('Entradas', 1),
  ('Sopas', 2),
  ('Platos fuertes', 3),
  ('Parrilla', 4),
  ('Bebidas frías', 5),
  ('Bebidas calientes', 6),
  ('Postres', 7)
on conflict (nombre) do nothing;

insert into public.productos (codigo, nombre, nombre_en, descripcion, precio, costo, categoria_id, estacion, canales, favorito, agotado, stock)
select v.codigo, v.nombre, v.nombre_en, v.descripcion, v.precio, v.costo, c.id, v.estacion, v.canales::jsonb, v.favorito, v.agotado, v.stock
from (values
  ('P01', 'Anticucho', 'Grilled beef-heart skewers with peanut sauce', 'Brochetas de corazón de res a la parrilla, con papa y salsa de maní', 25, 8, 'Entradas', 'parrilla', '{"salon":true,"mostrador":true,"delivery":true,"tienda":true}', false, false, null::integer),
  ('P02', 'Choclo con queso', null, 'Choclo tierno hervido con una tajada de queso criollo', 15, 6, 'Entradas', 'cocina', '{"salon":true,"mostrador":true,"delivery":true,"tienda":true}', false, false, null::integer),
  ('P03', 'Cuñapé (porción de 4)', 'Cheese & cassava bread rolls', 'Panecitos de almidón de yuca y queso, recién horneados', 12, 5.5, 'Entradas', 'horno', '{"salon":true,"mostrador":true,"delivery":true,"tienda":true}', true, false, null::integer),
  ('P04', 'Empanada de arroz', 'Crispy rice-flour turnover with cheese', 'Empanada crocante de harina de arroz rellena de queso', 7, 2.5, 'Entradas', 'cocina', '{"salon":true,"mostrador":true,"delivery":true,"tienda":true}', false, false, null::integer),
  ('P05', 'Humita en chala', null, 'Pasta de choclo con queso, cocida en su propia chala', 12, 5.5, 'Entradas', 'horno', '{"salon":true,"mostrador":true,"delivery":true,"tienda":true}', false, false, null::integer),
  ('P06', 'Masaco de plátano', 'Mashed green plantain with cheese', 'Plátano verde majado con queso, con charque o huevo', 15, 5.5, 'Entradas', 'cocina', '{"salon":true,"mostrador":true,"delivery":true,"tienda":true}', false, false, null::integer),
  ('P07', 'Salteña de carne', 'Baked empanada with juicy beef stew', 'Salteña horneada con jigote jugoso de carne, papa y huevo', 12, 5.5, 'Entradas', 'horno', '{"salon":true,"mostrador":true,"delivery":true,"tienda":true}', true, false, null::integer),
  ('P08', 'Salteña de pollo', null, 'Salteña horneada con jigote de pollo, arveja y huevo', 12, 4.5, 'Entradas', 'horno', '{"salon":true,"mostrador":true,"delivery":true,"tienda":true}', false, false, null::integer),
  ('P09', 'Sonso de yuca', 'Grilled cassava & cheese', 'Masa de yuca y queso asada a la brasa en palito', 12, 5, 'Entradas', 'parrilla', '{"salon":true,"mostrador":true,"delivery":true,"tienda":true}', false, false, null::integer),
  ('P10', 'Tamal cruceño', null, 'Masa de maíz con charque, envuelta en chala y cocida al vapor', 12, 4, 'Entradas', 'cocina', '{"salon":true,"mostrador":true,"delivery":true,"tienda":true}', false, false, null::integer),
  ('P11', 'Caldo de gallina criolla', null, 'Caldo de gallina de campo con arroz, papa y yuca', 30, 12.5, 'Sopas', 'cocina', '{"salon":true,"mostrador":true,"delivery":true,"tienda":true}', false, true, null::integer),
  ('P12', 'Chairo', null, 'Sopa de chuño con carne, verduras y mote', 25, 8.5, 'Sopas', 'cocina', '{"salon":true,"mostrador":true,"delivery":true,"tienda":true}', false, false, null::integer),
  ('P13', 'Fricasé', null, 'Cerdo en caldo de ají amarillo con mote y chuño', 40, 16.5, 'Sopas', 'cocina', '{"salon":true,"mostrador":true,"delivery":true,"tienda":true}', false, false, null::integer),
  ('P14', 'Locro carretero', 'Hearty rice soup with sun-dried beef', 'Sopa espesa de arroz con charque, plátano, huevo y yuca', 28, 9, 'Sopas', 'cocina', '{"salon":true,"mostrador":true,"delivery":true,"tienda":true}', true, false, null::integer),
  ('P15', 'Sopa de maní', 'Creamy peanut soup with fries', 'Crema de maní con carne y verduras, con papas fritas encima', 22, 9, 'Sopas', 'cocina', '{"salon":true,"mostrador":true,"delivery":true,"tienda":true}', false, false, null::integer),
  ('P16', 'Ají de fideo', null, 'Fideo en salsa de ají colorado con carne, papa y huevo', 35, 11, 'Platos fuertes', 'cocina', '{"salon":true,"mostrador":true,"delivery":true,"tienda":true}', false, false, null::integer),
  ('P17', 'Arroz con queso', null, 'Arroz cremoso con queso criollo, gratinado al horno', 28, 11, 'Platos fuertes', 'horno', '{"salon":true,"mostrador":true,"delivery":true,"tienda":true}', false, false, null::integer),
  ('P18', 'Charque con yuca', null, 'Charque de res frito con yuca, huevo y llajua', 45, 20.5, 'Platos fuertes', 'cocina', '{"salon":true,"mostrador":true,"delivery":true,"tienda":true}', false, false, null::integer),
  ('P19', 'Chicharrón de cerdo', null, 'Cerdo frito en su jugo con mote, yuca y llajua', 55, 21, 'Platos fuertes', 'cocina', '{"salon":true,"mostrador":true,"delivery":true,"tienda":true}', false, false, null::integer),
  ('P20', 'Fritanga', null, 'Cerdo en salsa de ají amarillo con mote y chuño', 40, 18, 'Platos fuertes', 'cocina', '{"salon":true,"mostrador":true,"delivery":true,"tienda":true}', false, false, null::integer),
  ('P21', 'Keperí', 'Slow-cooked beef brisket, Beni style', 'Matambre de res cocido lento al estilo beniano, con yuca y arroz', 75, 28, 'Platos fuertes', 'horno', '{"salon":true,"mostrador":true,"delivery":true,"tienda":true}', false, false, null::integer),
  ('P22', 'Lomo montado', null, 'Lomo a la plancha con dos huevos fritos, arroz y papas', 55, 24, 'Platos fuertes', 'cocina', '{"salon":true,"mostrador":true,"delivery":true,"tienda":true}', false, false, null::integer),
  ('P23', 'Majadito batido', 'Rice with sun-dried beef, fried egg & plantain', 'Arroz batido con charque, huevo frito y plátano maduro', 38, 13.5, 'Platos fuertes', 'cocina', '{"salon":true,"mostrador":true,"delivery":true,"tienda":true}', true, false, null::integer),
  ('P24', 'Majadito de charque', null, 'Arroz con charque desmenuzado, huevo frito, yuca y plátano', 40, 17, 'Platos fuertes', 'cocina', '{"salon":true,"mostrador":true,"delivery":true,"tienda":true}', false, false, null::integer),
  ('P25', 'Picante de pollo', 'Chicken in red chili sauce', 'Pollo en salsa de ají colorado con chuño, arroz y papa', 42, 14.5, 'Platos fuertes', 'cocina', '{"salon":true,"mostrador":true,"delivery":true,"tienda":true}', false, false, null::integer),
  ('P26', 'Pique macho', 'Beef, sausage & fries with locoto and egg', 'Carne, salchicha y papas fritas con locoto, cebolla y huevo', 75, 31.5, 'Platos fuertes', 'cocina', '{"salon":true,"mostrador":true,"delivery":true,"tienda":true}', true, false, null::integer),
  ('P27', 'Pollo al horno con yuca', null, 'Cuarto de pollo al horno con yuca, arroz y ensalada', 45, 15.5, 'Platos fuertes', 'horno', '{"salon":true,"mostrador":true,"delivery":true,"tienda":true}', false, false, null::integer),
  ('P28', 'Saice', null, 'Carne molida picante con arroz, papa y ensalada criolla', 38, 15.5, 'Platos fuertes', 'cocina', '{"salon":true,"mostrador":true,"delivery":true,"tienda":true}', false, false, null::integer),
  ('P29', 'Silpancho', 'Thin breaded beef over rice & potatoes', 'Carne apanada fina sobre arroz y papa, con huevo y ensalada', 40, 13, 'Platos fuertes', 'cocina', '{"salon":true,"mostrador":true,"delivery":true,"tienda":true}', false, false, null::integer),
  ('P30', 'Chorizo cruceño', null, 'Dos chorizos criollos a la parrilla con yuca y ensalada', 30, 12, 'Parrilla', 'parrilla', '{"salon":true,"mostrador":true,"delivery":true,"tienda":true}', false, false, null::integer),
  ('P31', 'Churrasco con yuca', null, 'Corte de res a la parrilla con yuca, arroz y ensalada', 60, 19, 'Parrilla', 'parrilla', '{"salon":true,"mostrador":true,"delivery":true,"tienda":true}', false, false, null::integer),
  ('P32', 'Costilla de cerdo', null, 'Costilla de cerdo a la brasa con yuca y ensalada', 55, 21.5, 'Parrilla', 'parrilla', '{"salon":true,"mostrador":true,"delivery":true,"tienda":true}', false, false, null::integer),
  ('P33', 'Pacumutu', 'Giant beef skewers with cassava', 'Brochetas gigantes de res a la parrilla con yuca, arroz y queso', 85, 39, 'Parrilla', 'parrilla', '{"salon":true,"mostrador":true,"delivery":true,"tienda":true}', false, false, null::integer),
  ('P34', 'Parrillada familiar (4 personas)', null, 'Churrasco, costilla, chorizo y pollo con yuca, arroz y ensaladas', 220, 83.5, 'Parrilla', 'parrilla', '{"salon":true,"mostrador":true,"delivery":true,"tienda":true}', false, false, null::integer),
  ('P35', 'Agua mineral', null, 'Botella de agua mineral de 500 ml', 8, 3.5, 'Bebidas frías', 'bebidas', '{"salon":true,"mostrador":true,"delivery":true,"tienda":true}', false, false, 32),
  ('P36', 'Cerveza Paceña 620 ml', null, 'Cerveza nacional bien helada', 22, 8, 'Bebidas frías', 'bebidas', '{"salon":true,"mostrador":true,"delivery":true,"tienda":true}', false, false, 37),
  ('P37', 'Chicha cruceña de maíz', 'Sweet corn drink, Santa Cruz style', 'Bebida dulce de maíz con canela y clavo, bien fría', 12, 5.5, 'Bebidas frías', 'bebidas', '{"salon":true,"mostrador":true,"delivery":true,"tienda":true}', true, false, 12),
  ('P38', 'Gaseosa 2 L', null, 'Gaseosa familiar de 2 litros', 18, 6.5, 'Bebidas frías', 'bebidas', '{"salon":true,"mostrador":true,"delivery":true,"tienda":true}', false, false, 17),
  ('P39', 'Jugo de achachairú', 'Achachairú fruit juice', 'Jugo natural de achachairú, fruta ácida del oriente', 15, 6.5, 'Bebidas frías', 'bebidas', '{"salon":true,"mostrador":true,"delivery":true,"tienda":true}', false, false, 22),
  ('P40', 'Jugo de cupuazú', null, 'Jugo cremoso de cupuazú, fruta amazónica', 15, 5.5, 'Bebidas frías', 'bebidas', '{"salon":true,"mostrador":true,"delivery":true,"tienda":true}', false, false, 27),
  ('P41', 'Limonada', null, 'Limonada natural recién exprimida', 12, 5, 'Bebidas frías', 'bebidas', '{"salon":true,"mostrador":true,"delivery":true,"tienda":true}', false, false, 32),
  ('P42', 'Mocochinchi', null, 'Refresco de durazno deshidratado con canela', 10, 3.5, 'Bebidas frías', 'bebidas', '{"salon":true,"mostrador":true,"delivery":true,"tienda":true}', false, false, 37),
  ('P43', 'Somó', null, 'Bebida de maíz blanco con canela, servida fría', 10, 4, 'Bebidas frías', 'bebidas', '{"salon":true,"mostrador":true,"delivery":true,"tienda":true}', false, false, 12),
  ('P44', 'Api con pastel', null, 'Api morado caliente con un pastel frito de queso', 15, 5, 'Bebidas calientes', 'bebidas', '{"salon":true,"mostrador":true,"delivery":false,"tienda":true}', false, false, null::integer),
  ('P45', 'Café con leche', null, 'Café filtrado con leche caliente', 10, 4, 'Bebidas calientes', 'bebidas', '{"salon":true,"mostrador":true,"delivery":false,"tienda":true}', false, false, null::integer),
  ('P46', 'Té de coca', null, 'Infusión de hoja de coca', 8, 2.5, 'Bebidas calientes', 'bebidas', '{"salon":true,"mostrador":true,"delivery":false,"tienda":true}', false, false, null::integer),
  ('P47', 'Arroz con leche', null, 'Arroz cocido en leche con canela y pasas', 12, 4.5, 'Postres', 'postres', '{"salon":true,"mostrador":true,"delivery":true,"tienda":true}', false, false, null::integer),
  ('P48', 'Dulce de achachairú', null, 'Achachairú en almíbar, servido frío', 14, 6.5, 'Postres', 'postres', '{"salon":true,"mostrador":true,"delivery":true,"tienda":true}', false, false, null::integer),
  ('P49', 'Ensalada de frutas tropicales', null, 'Papaya, piña, plátano y frutas de temporada', 15, 5.5, 'Postres', 'postres', '{"salon":true,"mostrador":true,"delivery":true,"tienda":true}', false, false, null::integer),
  ('P50', 'Flan casero', null, 'Flan de huevo con caramelo, hecho en casa', 14, 6.5, 'Postres', 'postres', '{"salon":true,"mostrador":true,"delivery":true,"tienda":true}', false, false, null::integer)
) as v (codigo, nombre, nombre_en, descripcion, precio, costo, categoria, estacion, canales, favorito, agotado, stock)
join public.categorias c on c.nombre = v.categoria
on conflict (codigo) do nothing;

insert into public.modificadores (producto_id, nombre, orden)
select p.id, v.nombre, v.orden
from (values
  ('P01', 'Sin picante', 1),
  ('P01', 'Bien picante', 2),
  ('P06', 'Con charque', 1),
  ('P06', 'Con huevo', 2),
  ('P07', 'Picante', 1),
  ('P07', 'Sin picante', 2),
  ('P08', 'Picante', 1),
  ('P08', 'Sin picante', 2),
  ('P13', 'Sin picante', 1),
  ('P13', 'Bien picante', 2),
  ('P14', 'Con huevo', 1),
  ('P14', 'Sin huevo', 2),
  ('P16', 'Sin picante', 1),
  ('P16', 'Bien picante', 2),
  ('P18', 'Con huevo', 1),
  ('P18', 'Sin huevo', 2),
  ('P20', 'Sin picante', 1),
  ('P20', 'Bien picante', 2),
  ('P22', 'Huevo suave', 1),
  ('P22', 'Huevo cocido', 2),
  ('P23', 'Con huevo', 1),
  ('P23', 'Sin huevo', 2),
  ('P23', 'Plátano extra', 3),
  ('P24', 'Con huevo', 1),
  ('P24', 'Sin huevo', 2),
  ('P25', 'Sin picante', 1),
  ('P25', 'Bien picante', 2),
  ('P26', 'Sin locoto', 1),
  ('P26', 'Sin cebolla', 2),
  ('P26', 'Bien picante', 3),
  ('P28', 'Sin picante', 1),
  ('P29', 'Huevo suave', 1),
  ('P29', 'Huevo cocido', 2),
  ('P29', 'Sin huevo', 3),
  ('P31', 'Jugoso', 1),
  ('P31', 'A punto', 2),
  ('P31', 'Bien cocido', 3),
  ('P33', 'Jugoso', 1),
  ('P33', 'A punto', 2),
  ('P33', 'Bien cocido', 3),
  ('P34', 'Jugoso', 1),
  ('P34', 'A punto', 2),
  ('P34', 'Bien cocido', 3),
  ('P35', 'Con gas', 1),
  ('P35', 'Sin gas', 2),
  ('P37', 'Con hielo', 1),
  ('P37', 'Sin hielo', 2),
  ('P38', 'Sabor a elegir', 1),
  ('P39', 'Con azúcar', 1),
  ('P39', 'Sin azúcar', 2),
  ('P40', 'Con azúcar', 1),
  ('P40', 'Sin azúcar', 2),
  ('P41', 'Con azúcar', 1),
  ('P41', 'Sin azúcar', 2),
  ('P45', 'Con azúcar', 1),
  ('P45', 'Sin azúcar', 2),
  ('P49', 'Con helado', 1),
  ('P49', 'Sin helado', 2)
) as v (codigo, nombre, orden)
join public.productos p on p.codigo = v.codigo
on conflict (producto_id, nombre) do nothing;

-- 15 mesas: planta baja 1 a 8 y segundo piso 9 a 15 (redondas hasta 4 sillas, rectangulares desde 6)
insert into public.mesas (numero, zona, capacidad, forma, x, y) values
  (1, 'Planta baja', 2, 'redonda', 14, 22),
  (2, 'Planta baja', 4, 'redonda', 34, 22),
  (3, 'Planta baja', 4, 'redonda', 54, 22),
  (4, 'Planta baja', 6, 'rect', 80, 24),
  (5, 'Planta baja', 4, 'redonda', 14, 58),
  (6, 'Planta baja', 2, 'redonda', 34, 58),
  (7, 'Planta baja', 8, 'rect', 58, 62),
  (8, 'Planta baja', 4, 'redonda', 84, 64),
  (9, 'Segundo piso', 4, 'redonda', 16, 24),
  (10, 'Segundo piso', 4, 'redonda', 38, 24),
  (11, 'Segundo piso', 6, 'rect', 64, 26),
  (12, 'Segundo piso', 2, 'redonda', 86, 22),
  (13, 'Segundo piso', 4, 'redonda', 18, 66),
  (14, 'Segundo piso', 6, 'rect', 44, 66),
  (15, 'Segundo piso', 8, 'rect', 74, 68)
on conflict (numero) do nothing;

insert into public.permisos_rol (rol, pantalla, permitido)
select r.rol, p.pantalla, p.pantalla = any (r.permitidas)
from (values
  ('cajero', array['Cajero', 'Mesas', 'Cierre de caja', 'Delivery']),
  ('cocina', array['Cocina']),
  ('mesero', array['Mesero']),
  ('repartidor', array['Delivery'])
) as r (rol, permitidas)
cross join (values ('Cajero'), ('Mesas'), ('Cierre de caja'), ('Cocina'), ('Mesero'), ('Delivery'), ('Productos y precios'), ('Reportes'), ('Usuarios'), ('Configuración')) as p (pantalla)
on conflict (rol, pantalla) do nothing;

insert into public.categorias_gasto (nombre) values
  ('Insumos de último momento'),
  ('Empaques'),
  ('Servicios'),
  ('Retiros'),
  ('Mantenimiento'),
  ('Sueldos'),
  ('Otros')
on conflict (nombre) do nothing;

insert into public.ingredientes (nombre, unidad, stock, minimo, costo_unitario) values
  ('Carne de res', 'kg', 18, 10, 62),
  ('Charque', 'kg', 4.5, 5, 95),
  ('Pollo', 'kg', 12, 8, 26),
  ('Cerdo', 'kg', 9, 6, 38),
  ('Arroz', 'kg', 42, 20, 9),
  ('Harina', 'kg', 25, 15, 7.5),
  ('Almidón de yuca', 'kg', 6, 8, 14),
  ('Queso criollo', 'kg', 7, 6, 45),
  ('Huevo', 'unidad', 96, 60, 1.2),
  ('Papa', 'kg', 30, 20, 5),
  ('Yuca', 'kg', 22, 15, 4),
  ('Plátano', 'unidad', 40, 30, 1),
  ('Maíz para chicha', 'kg', 3, 6, 12),
  ('Ají colorado', 'kg', 1.2, 1, 40),
  ('Aceite', 'litro', 14, 10, 16),
  ('Cerveza Paceña 620 ml', 'unidad', 48, 24, 13)
on conflict (nombre) do nothing;

insert into public.recetas (producto_id, ingrediente_id, cantidad)
select p.id, g.id, v.cantidad
from (values
  ('P07', 'Carne de res', 0.06),
  ('P07', 'Papa', 0.03),
  ('P07', 'Harina', 0.07),
  ('P07', 'Ají colorado', 0.005),
  ('P07', 'Huevo', 0.5),
  ('P03', 'Almidón de yuca', 0.12),
  ('P03', 'Queso criollo', 0.08),
  ('P03', 'Huevo', 0.5),
  ('P37', 'Maíz para chicha', 0.08),
  ('P23', 'Arroz', 0.15),
  ('P23', 'Charque', 0.08),
  ('P23', 'Huevo', 1),
  ('P23', 'Plátano', 1),
  ('P23', 'Aceite', 0.02),
  ('P26', 'Carne de res', 0.2),
  ('P26', 'Papa', 0.3),
  ('P26', 'Huevo', 1),
  ('P26', 'Aceite', 0.05),
  ('P14', 'Arroz', 0.08),
  ('P14', 'Charque', 0.05),
  ('P14', 'Huevo', 1),
  ('P14', 'Plátano', 0.5),
  ('P14', 'Yuca', 0.1)
) as v (codigo, ingrediente, cantidad)
join public.productos p on p.codigo = v.codigo
join public.ingredientes g on g.nombre = v.ingrediente
on conflict (producto_id, ingrediente_id) do nothing;

-- Costo de los platos que tienen receta = suma de sus insumos
update public.productos pr set costo = x.costo
  from (select r.producto_id, round(sum(r.cantidad * g.costo_unitario), 2) costo
          from public.recetas r join public.ingredientes g on g.id = r.ingrediente_id group by r.producto_id) x
 where pr.id = x.producto_id;

insert into public.proveedores (nombre, rubro, whatsapp) values
  ('Frigorífico Los Lotes', 'Carnes', '59171111111'),
  ('Mercado Abasto · Puesto 112', 'Verduras y tubérculos', '59172222222'),
  ('Lácteos del Norte', 'Queso y leche', '59173333333'),
  ('Distribuidora CBN Equipetrol', 'Bebidas', '59174444444'),
  ('Granos Warnes', 'Arroz, harina y maíz', '59175555555')
on conflict (nombre) do nothing;

insert into public.banners (titulo, subtitulo, producto_id, donde, activo, orden)
select v.titulo, v.subtitulo, p.id, v.donde, v.activo, v.orden
from (values
  ('Martes de majadito', 'Majadito batido + chicha a Bs 45,00', 'P23', array['tienda', 'pantalla'], true, 1),
  ('Salteñas de 10:00 a 12:00', 'Recién horneadas, jugosas como en casa', 'P07', array['tienda', 'pantalla'], true, 2),
  ('Parrillada familiar', 'Para 4 personas · domingos en la terraza', 'P34', array['pantalla'], false, 3)
) as v (titulo, subtitulo, codigo, donde, activo, orden)
join public.productos p on p.codigo = v.codigo
where not exists (select 1 from public.banners);

-- Menú del día de hoy (cámbialo cada mañana en Catálogo › Menú del día)
insert into public.menu_del_dia (fecha, producto_id, preparado)
select privado.hoy(), p.id, v.preparado
from (values
  ('P23', 30),
  ('P14', 25),
  ('P07', 80),
  ('P03', 60),
  ('P37', 40),
  ('P21', 12)
) as v (codigo, preparado)
join public.productos p on p.codigo = v.codigo
on conflict (fecha, producto_id) do nothing;

-- Listo. Siguiente paso (solo la primera vez): crea tu usuario y ejecuta hacer-administrador.sql.
