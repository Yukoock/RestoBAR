// Tipos de las tablas de Supabase que usa la app (ver fase-3-base-de-datos/schema.sql).
export type Rol = "dueno" | "cajero" | "cocina" | "mesero" | "repartidor";
export type Canal = "mesa" | "qr" | "mostrador" | "llevar" | "delivery" | "web";
export type EstadoPedido = "borrador" | "cocina" | "preparando" | "listo" | "entregado" | "anulado";
export type MetodoPago = "efectivo" | "qr" | "tarjeta" | "mixto";
export type Estacion = "cocina" | "horno" | "parrilla" | "bebidas" | "postres";

export interface Perfil {
  id: string;
  nombre: string;
  correo: string | null;
  rol: Rol;
  zona: string | null;
  activo: boolean;
}

export interface ZonaEnvio { id: string; nombre: string; costo: number }

export interface NegocioConfig {
  nombre: string;
  lema: string | null;
  logo_url: string | null;
  whatsapp: string | null;
  direccion: string | null;
  ciudad: string | null;
  nit: string | null;
  horario: string | null;
  hora_abre: string;
  hora_cierra: string;
  moneda: string;
  color: string;
  propina_sugerida: 0 | 5 | 10;
  demora_min: number;
  escalado_min: number;
  local_abierto: boolean;
  envio: ZonaEnvio[];
  facturacion_activa: boolean;
  facturacion_pruebas: boolean;
  comision_qr: number;
  intentos_pin: number;
  qr_cobro_url: string | null;
}

export interface Categoria { id: string; nombre: string; orden: number; visible: boolean }

export interface Producto {
  id: string;
  codigo: string;
  nombre: string;
  nombre_en: string | null;
  descripcion: string | null;
  precio: number;
  costo: number;
  categoria_id: string | null;
  estacion: Estacion;
  foto_url: string | null;
  canales: { salon: boolean; mostrador: boolean; delivery: boolean; tienda: boolean };
  favorito: boolean;
  agotado: boolean;
  en_menu: boolean;
  stock: number | null;
}

export interface Mesa { id: string; numero: number; zona: string; capacidad: number; forma: "redonda" | "rect"; x: number; y: number; qr_token: string }

export interface PedidoItem {
  id: string;
  pedido_id: string;
  producto_id: string | null;
  nombre: string;
  precio_unitario: number;
  cantidad: number;
  nota: string | null;
  estacion: Estacion;
}

export interface Pedido {
  id: string;
  fecha: string;
  numero: number;
  canal: Canal;
  mesa_id: string | null;
  cliente: string | null;
  telefono: string | null;
  estado: EstadoPedido;
  pago_metodo: MetodoPago | null;
  pago_pendiente: boolean;
  pago_efectivo: number | null;
  propina: number;
  partes: number;
  envio: number;
  subtotal: number;
  total: number;
  direccion: string | null;
  delivery_estado: "asignado" | "recogido" | "en_camino" | "entregado" | null;
  repartidor_id: string | null;
  mesero_id: string | null;
  creado_por: string | null;
  pidio_cuenta: boolean;
  motivo_anulacion: string | null;
  enviado_at: string | null;
  preparando_at: string | null;
  listo_at: string | null;
  entregado_at: string | null;
  pagado_at: string | null;
  anulado_at: string | null;
  created_at: string;
  pedido_items?: PedidoItem[];
}

export interface Llamada {
  id: string;
  mesa_id: string;
  motivo: "Cuenta" | "Agua" | "Ayuda con el pedido" | "Otro";
  atendida_por: string | null;
  atendida_at: string | null;
  cancelada: boolean;
  created_at: string;
}

export interface Modificador { id: string; producto_id: string; nombre: string; orden: number }
export interface Ingrediente { id: string; nombre: string; unidad: "kg" | "litro" | "unidad"; stock: number; minimo: number; costo_unitario: number }
export interface Receta { id: string; producto_id: string; ingrediente_id: string; cantidad: number }
export interface MovimientoInventario { id: string; ingrediente_id: string; tipo: "entrada" | "salida" | "venta" | "ajuste"; cantidad: number; motivo: string | null; pedido_id: string | null; compra_id: string | null; creado_por: string | null; created_at: string }
export interface Proveedor { id: string; nombre: string; rubro: string | null; whatsapp: string | null }
export interface Compra { id: string; numero: string; fecha: string; proveedor_id: string | null; detalle: string | null; total: number; foto_url: string | null; estado: "Recibida" | "Por pagar" | "Anulada"; creado_por: string | null; created_at: string }
export interface CategoriaGasto { id: string; nombre: string }
export interface Gasto { id: string; fecha: string; categoria_id: string | null; detalle: string; monto: number; creado_por: string | null; created_at: string }
export interface Banner { id: string; titulo: string; subtitulo: string | null; foto_url: string | null; producto_id: string | null; donde: ("tienda" | "pantalla")[]; activo: boolean; orden: number }
export interface MenuDelDia { id: string; fecha: string; producto_id: string; preparado: number; disponible: boolean }
