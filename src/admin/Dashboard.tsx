// Dashboard (B6.2): periodo en la URL, 4 KPI con comparación, canales, incidencias, gráficos y tablas.
import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AlertTriangle, Bell, QrCode } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { bs, cx, fecha, hora, porcentaje } from "@/lib/formato";
import { useConsulta, usePedidos, useLlamadasActivas, usePerfiles, useMesas, inicioDelDia, pagado, METODOS } from "@/lib/datos";
import type { Pedido } from "@/lib/tipos";
import { DateRangePicker, StatCard, Card, ErrorState, type Periodo } from "@/components/ui";
import { GraficoCard, Columnas, Area, Apilada, Horizontales, Barra } from "@/components/graficos";
import { useIncidencias } from "./Admin";
import { useConfig } from "@/lib/config";

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const enRango = (p: Pedido, desde: Date, hasta?: Date) => { const t = new Date(p.created_at).getTime(); return t >= desde.getTime() && (!hasta || t < hasta.getTime()); };
const ventas = (ps: Pedido[]) => ps.filter(pagado).reduce((a, p) => a + Number(p.total), 0);
const cambio = (a: number, b: number) => b ? Math.round(((a - b) / b) * 100) : undefined;

export function Dashboard() {
  const [params, setParams] = useSearchParams();
  const navegar = useNavigate();
  const periodo = (["hoy", "7d", "30d"].includes(params.get("periodo") || "") ? params.get("periodo") : "hoy") as Periodo;
  const n = periodo === "hoy" ? 1 : periodo === "7d" ? 7 : 30;
  const desdeCarga = useMemo(() => inicioDelDia(Math.max(2 * n - 1, 7)), [n]);
  const { datos: todos, cargando, error, recargar } = usePedidos(desdeCarga);
  const { datos: perfiles } = usePerfiles();
  const { datos: mesas } = useMesas();
  const { datos: activas } = useLlamadasActivas();
  const inicio = inicioDelDia(n - 1);
  const { datos: llamadas } = useConsulta<{ atendida_por: string | null; atendida_at: string | null; created_at: string }[]>("llamadas-" + n,
    () => supabase.from("llamadas").select("atendida_por, atendida_at, created_at").gte("created_at", inicio.toISOString()) as never, [], ["llamadas"]);
  const inc = useIncidencias();
  const { config } = useConfig();
  // Horas del gráfico: el horario de atención, ampliado si hubo ventas fuera de él
  const hAbre = parseInt(config.hora_abre), hCierra = Math.min(23, parseInt(config.hora_cierra));

  const r = useMemo(() => {
    const validos = todos.filter(p => p.estado !== "anulado");
    const actual = validos.filter(p => enRango(p, inicio));
    const previo = periodo === "hoy" ? validos.filter(p => enRango(p, inicioDelDia(7), inicioDelDia(6))) : validos.filter(p => enRango(p, inicioDelDia(2 * n - 1), inicio));
    const cobrados = actual.filter(pagado);
    const porDia = (k: number) => Array.from({ length: k }, (_, i) => {
      const d0 = inicioDelDia(k - 1 - i), d1 = inicioDelDia(k - 2 - i), del = validos.filter(p => enRango(p, d0, i === k - 1 ? undefined : d1));
      return { etiqueta: fecha(d0).slice(0, 5), valor: ventas(del), pedidos: del.length };
    });
    const grupos: [string, string[], string][] = [["Mesa y QR", ["mesa", "qr"], "var(--r-mesero)"], ["Mostrador", ["mostrador"], "var(--r-cajero)"], ["Para llevar", ["llevar"], "var(--r-cocina)"], ["Delivery y web", ["delivery", "web"], "var(--r-delivery)"]];
    const canales = grupos.map(([nombre, cs, color]) => { const l = actual.filter(p => cs.includes(p.canal)); return { nombre, color, valor: l.length, monto: ventas(l) }; });
    const conVenta = cobrados.map(p => new Date(p.created_at).getHours());
    const h0 = Math.min(hAbre, ...conVenta), h1 = Math.max(hCierra, ...conVenta);
    const horas = Array.from({ length: h1 - h0 + 1 }, (_, i) => i + h0).map(h => ({ etiqueta: String(h), valor: cobrados.filter(p => new Date(p.created_at).getHours() === h).reduce((a, p) => a + Number(p.total), 0) }));
    const metodos = Object.keys(METODOS).map((m, i) => ({ nombre: METODOS[m], valor: cobrados.filter(p => p.pago_metodo === m).reduce((a, p) => a + Number(p.total), 0), color: `var(--series-${i + 1})` }));
    const prods: Record<string, { nombre: string; cant: number; monto: number }> = {};
    actual.forEach(p => (p.pedido_items || []).forEach(i => { const k = i.producto_id || i.nombre; prods[k] = prods[k] || { nombre: i.nombre, cant: 0, monto: 0 }; prods[k].cant += i.cantidad; prods[k].monto += i.cantidad * Number(i.precio_unitario); }));
    const top = Object.values(prods).sort((a, b) => b.monto - a.monto).slice(0, 8);
    const v = ventas(actual), vp = ventas(previo);
    return {
      v, vp, pedidos: actual.length, pedidosP: previo.length,
      ticket: cobrados.length ? v / cobrados.length : 0, ticketP: previo.filter(pagado).length ? vp / previo.filter(pagado).length : 0,
      qr: ventas(actual.filter(p => p.pago_metodo === "qr")), qrP: ventas(previo.filter(p => p.pago_metodo === "qr")),
      dias: porDia(Math.max(n, 7)), spark: porDia(7), canales, horas, metodos, top,
    };
  }, [todos, periodo]); // eslint-disable-line react-hooks/exhaustive-deps

  const comp = periodo === "hoy" ? `vs el ${DIAS[new Date(Date.now() - 7 * 86400000).getDay()]} pasado` : periodo === "7d" ? "vs los 7 días anteriores" : "vs los 30 días anteriores";
  const pico = r.horas.reduce((a, b) => b.valor > a.valor ? b : a, r.horas[0]);
  const totTop = r.top.reduce((a, x) => a + x.monto, 0) || 1;
  const meseros = perfiles.filter(p => p.rol === "mesero" && p.activo);
  if (error) return <Card><ErrorState error={error} onRetry={recargar} /></Card>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DateRangePicker value={periodo} onChange={k => setParams({ periodo: k }, { replace: true })} />
        <span className="text-sm text-ink-3">Se actualiza solo · {hora(Date.now())}</span>
      </div>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard cargando={cargando} label="Ventas netas" valor={bs(r.v)} delta={cambio(r.v, r.vp)} comparacion={comp} serie={r.spark.map(d => d.valor)} />
        <StatCard cargando={cargando} label="Ticket promedio" valor={bs(r.ticket)} delta={cambio(r.ticket, r.ticketP)} comparacion={comp} color="var(--accent)" serie={r.spark.map(d => d.pedidos ? d.valor / d.pedidos : 0)} />
        <StatCard cargando={cargando} label="Pedidos" valor={r.pedidos} delta={cambio(r.pedidos, r.pedidosP)} comparacion={comp} color="var(--r-mesero)" serie={r.spark.map(d => d.pedidos)} onClick={() => navegar("/admin/pedidos")} />
        <StatCard cargando={cargando} label="Cobros QR" valor={bs(r.qr)} delta={cambio(r.qr, r.qrP)} comparacion={comp} color="var(--r-cliente)" onClick={() => navegar("/admin/cobros-qr")} />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {r.canales.map(c => (
          <div key={c.nombre} className="flex flex-col gap-0.5 rounded-md border-t-4 bg-surface px-3.5 py-3 text-sm shadow-1" style={{ borderTopColor: c.color }}>
            <span>{c.nombre}</span><strong className="num text-[17px]">{c.valor} pedidos</strong><span className="num text-ink-3">{bs(c.monto)} cobrado</span>
          </div>
        ))}
      </div>
      <Card>
        <h3 className="font-bold">Incidencias</h3>
        <div className="grid gap-2.5 md:grid-cols-3">
          {([[inc.anulados, "pedidos anulados hoy", AlertTriangle, "/admin/pedidos?filtro=anulados"], [inc.llamadas, "llamadas sin atender", Bell, "/admin/mesas"], [inc.qr, "cobros QR por validar", QrCode, "/admin/pedidos?filtro=qr"]] as const).map(([v, t, Ic, ruta]) => (
            <button key={t} type="button" onClick={() => navegar(ruta)} className={cx("flex min-h-14 items-center gap-2.5 rounded-md border px-3.5 text-left", v ? "border-transparent bg-bad-soft text-bad" : "border-line bg-surface-2 text-ink-2")}>
              <Ic size={20} /><strong className="num font-display text-lg">{v}</strong><span>{t}</span>
            </button>
          ))}
        </div>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <GraficoCard titulo="Ventas por hora" lectura={pico.valor ? `La hora pico es a las ${pico.etiqueta}:00, con ${bs(pico.valor)}.` : "Todavía no hay ventas cobradas en este periodo."} tabla={{ cols: ["Hora", "Ventas"], filas: r.horas.map(h => [h.etiqueta + ":00", bs(h.valor)]) }}>
          <Columnas datos={r.horas} />
        </GraficoCard>
        <GraficoCard titulo={`Ventas de los últimos ${r.dias.length} días`} lectura="Pasa el mouse sobre la línea para ver el monto y los pedidos." tabla={{ cols: ["Día", "Ventas", "Pedidos"], filas: r.dias.map(d => [d.etiqueta, bs(d.valor), d.pedidos]) }}>
          <Area datos={r.dias} />
        </GraficoCard>
        <GraficoCard titulo="Pedidos por canal" lectura="Cada canal con el color de su rol." tabla={{ cols: ["Canal", "Pedidos", "Cobrado"], filas: r.canales.map(c => [c.nombre, c.valor, bs(c.monto)]) }}>
          <Apilada partes={r.canales} />
        </GraficoCard>
        <GraficoCard titulo="Métodos de pago" lectura="Lo cobrado en el periodo por cada método." tabla={{ cols: ["Método", "Monto"], filas: r.metodos.map(m => [m.nombre, bs(m.valor)]) }}>
          <Horizontales filas={r.metodos} />
        </GraficoCard>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="font-bold">Productos más vendidos</h3>
          {r.top.length === 0 ? <p className="text-ink-3">Todavía no hay ventas en este periodo.</p> : (
            <table className="w-full text-[15px]">
              <thead><tr className="text-[13px] text-ink-3"><th className="py-2 text-left font-semibold">Producto</th><th className="py-2 text-right font-semibold">Cant.</th><th className="py-2 pl-3 text-left font-semibold">Del total</th></tr></thead>
              <tbody>{r.top.map(t => <tr key={t.nombre} className="border-t border-line"><td className="py-2">{t.nombre}</td><td className="num py-2 text-right">{t.cant}</td><td className="py-2 pl-3"><span className="flex items-center gap-2"><Barra valor={t.monto} max={r.top[0].monto} /><span className="num">{porcentaje((t.monto / totTop) * 100)}</span></span></td></tr>)}</tbody>
            </table>
          )}
        </Card>
        <Card>
          <h3 className="font-bold">Atención en salón</h3>
          {meseros.length === 0 ? <p className="text-ink-3">Todavía no hay meseros activos. Créalos en Administración › Usuarios y roles.</p> : (
            <table className="w-full text-[15px]">
              <thead><tr className="text-[13px] text-ink-3"><th className="py-2 text-left font-semibold">Mesero</th><th className="py-2 text-left font-semibold">Zona</th><th className="py-2 text-right font-semibold">Pedidos</th><th className="py-2 text-right font-semibold">Responde en</th><th className="py-2 text-right font-semibold">Sin atender</th></tr></thead>
              <tbody>{meseros.map(m => {
                const suyas = llamadas.filter(l => l.atendida_por === m.id && l.atendida_at);
                const prom = suyas.length ? suyas.reduce((a, l) => a + (new Date(l.atendida_at!).getTime() - new Date(l.created_at).getTime()), 0) / suyas.length / 60000 : null;
                const sin = activas.filter(l => mesas.find(x => x.id === l.mesa_id)?.zona === m.zona).length;
                return <tr key={m.id} className="border-t border-line"><td className="py-2">{m.nombre}</td><td className="py-2">{m.zona || "—"}</td><td className="num py-2 text-right">{todos.filter(p => p.mesero_id === m.id && enRango(p, inicio)).length}</td><td className="num py-2 text-right">{prom == null ? "—" : `${prom.toFixed(1).replace(".", ",")} min`}</td><td className={cx("num py-2 text-right", sin > 0 && "font-bold text-info")}>{sin}</td></tr>;
              })}</tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  );
}
