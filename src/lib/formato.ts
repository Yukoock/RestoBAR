// Formato único de todo el sistema (B2): moneda «Bs 1.240,00», fechas dd/mm/aaaa y hora de 24 h.

export function bs(n: number | string | null | undefined, moneda = "Bs"): string {
  const v = Math.round(Number(n || 0) * 100) / 100;
  const [entero, dec] = Math.abs(v).toFixed(2).split(".");
  return (v < 0 ? "−" : "") + moneda + " " + entero.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "," + dec;
}

// Lee un monto escrito a la boliviana («1.250,50») o con punto decimal («1250.50»)
export function leerMonto(texto: string): number {
  const t = texto.trim().replace(/\s|Bs/gi, "");
  if (!t) return 0;
  const normal = /,\d{1,2}$/.test(t) ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  const n = Number(normal);
  return Number.isFinite(n) ? n : 0;
}

const dos = (n: number) => String(n).padStart(2, "0");
const aFecha = (t: string | number | Date) => (t instanceof Date ? t : new Date(t));

export const fecha = (t: string | number | Date) => { const d = aFecha(t); return `${dos(d.getDate())}/${dos(d.getMonth() + 1)}/${d.getFullYear()}`; };
export const hora = (t: string | number | Date) => { const d = aFecha(t); return `${dos(d.getHours())}:${dos(d.getMinutes())}`; };
export const fechaHora = (t: string | number | Date) => `${fecha(t)} ${hora(t)}`;
export const mmss = (ms: number) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${dos(Math.floor(s / 60))}:${dos(s % 60)}`; };
export const minutosDesde = (t: string | number) => Math.max(0, Math.round((Date.now() - aFecha(t).getTime()) / 60000));
export const porcentaje = (n: number) => `${Math.round(n)} %`;

export const sinTildes = (s: string | null | undefined) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
export const iniciales = (n: string) => n.split(" ").filter(Boolean).map(w => w[0]).slice(0, 2).join("").toUpperCase();
export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(" ");

// Mensajes de Supabase en español, sin culpa y diciendo qué hacer
export function mensajeError(e: unknown): string {
  const m = typeof e === "string" ? e : e instanceof Error ? e.message : (e as { message?: string })?.message || "";
  if (/invalid login credentials/i.test(m)) return "El correo o la contraseña no coinciden. Revísalos y vuelve a intentar.";
  if (/user already registered/i.test(m)) return "Ya existe una cuenta con ese correo. Inicia sesión con ella.";
  if (/password should be at least/i.test(m)) return "La contraseña debe tener al menos 6 caracteres.";
  if (/email not confirmed/i.test(m)) return "Falta confirmar el correo. Si eres el Dueño, ejecuta otra vez hacer-administrador.sql; si no, pídele al Dueño que te cree la cuenta desde la app.";
  if (/unable to validate email|invalid email/i.test(m)) return "Ese correo no parece válido. Revísalo.";
  if (/failed to fetch|networkerror|network request failed/i.test(m)) return "No hay conexión con el servidor. Revisa tu internet y vuelve a intentar.";
  if (/rate limit|too many/i.test(m)) return "Demasiados intentos seguidos. Espera un minuto y vuelve a intentar.";
  if (/row-level security|permission denied/i.test(m)) return "Tu usuario no tiene permiso para hacer esto. Pídeselo al Dueño.";
  return m || "Algo salió mal. Vuelve a intentar.";
}
