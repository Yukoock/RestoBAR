// Gráficos en SVG con el selector «Gráfico / Tabla» (B6.2). Los colores salen de los tokens, así se leen en claro y oscuro.
import { useState, type ReactNode } from "react";
import { bs } from "@/lib/formato";
import { Seg } from "./ui/controles";

export function GraficoCard({ titulo, lectura, tabla, children }: { titulo: string; lectura?: string; tabla: { cols: string[]; filas: (string | number)[][] }; children: ReactNode }) {
  const [vista, setVista] = useState<"g" | "t">("g");
  return (
    <section aria-label={titulo} className="flex min-w-0 flex-col gap-3 rounded-md bg-surface p-[18px] shadow-1">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div><h3 className="text-base font-bold">{titulo}</h3>{lectura && <p className="text-sm text-ink-3">{lectura}</p>}</div>
        <Seg value={vista} onChange={setVista} label={"Vista de " + titulo} opciones={[["g", "Gráfico"], ["t", "Tabla"]]} />
      </header>
      {vista === "g" ? children : (
        <div className="overflow-auto">
          <table className="w-full text-[15px]">
            <thead><tr>{tabla.cols.map((c, i) => <th key={c} className={`border-b border-line px-2.5 py-2 text-[13px] font-semibold text-ink-3 ${i ? "text-right" : "text-left"}`}>{c}</th>)}</tr></thead>
            <tbody>{tabla.filas.map((f, i) => <tr key={i} className="border-b border-line last:border-0">{f.map((v, j) => <td key={j} className={`px-2.5 py-2 ${j ? "num text-right" : ""}`}>{v}</td>)}</tr>)}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}

const corto = (v: number) => v >= 1000 ? (v / 1000).toFixed(v >= 10000 ? 0 : 1).replace(".", ",") + " mil" : String(Math.round(v));
function ejeY(max: number) { const paso = Math.pow(10, Math.floor(Math.log10(max || 1))); const tope = Math.max(paso, Math.ceil(max / paso) * paso); return [0, tope / 2, tope]; }
const ejeTxt = "fill-[var(--ink-3)] text-[12px]";

export function Columnas({ datos, alto = 200 }: { datos: { etiqueta: string; valor: number }[]; alto?: number }) {
  const W = 640, H = alto, pl = 44, pb = 26, pt = 20;
  const max = Math.max(0, ...datos.map(d => d.valor)), ticks = ejeY(max), tope = ticks[2];
  const bw = (W - pl) / Math.max(datos.length, 1);
  const iMax = max > 0 ? datos.findIndex(d => d.valor === max) : -1;
  if (max === 0) return <p className="py-8 text-center text-sm text-ink-3">Sin ventas cobradas en este periodo.</p>;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full overflow-visible" role="img" aria-label="Gráfico de columnas">
      {ticks.map(t => { const y = pt + (H - pb - pt) * (1 - t / tope); return <g key={t}><line x1={pl} x2={W} y1={y} y2={y} stroke="var(--grid)" /><text x={pl - 6} y={y + 4} textAnchor="end" className={ejeTxt}>{corto(t)}</text></g>; })}
      {datos.map((d, i) => {
        const h = (H - pb - pt) * (d.valor / tope), x = pl + i * bw + bw * 0.18, y = H - pb - h, pico = i === iMax;
        return (
          <g key={i}>
            <rect x={x} y={y} width={bw * 0.64} height={Math.max(h, 0)} rx="3" fill={pico ? "var(--accent)" : "var(--brand)"} opacity={pico ? 1 : 0.85}><title>{d.etiqueta}: {bs(d.valor)}</title></rect>
            {pico && <text x={x + bw * 0.32} y={y - 6} textAnchor="middle" className="fill-[var(--accent-deep)] text-[12px] font-bold">Pico · {corto(d.valor)}</text>}
            <text x={x + bw * 0.32} y={H - 8} textAnchor="middle" className={ejeTxt}>{d.etiqueta}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function Area({ datos }: { datos: { etiqueta: string; valor: number; pedidos: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640, H = 210, pl = 44, pb = 26, pt = 16, n = datos.length;
  const max = Math.max(0, ...datos.map(d => d.valor)), ticks = ejeY(max), tope = ticks[2];
  const x = (i: number) => pl + (n > 1 ? i / (n - 1) : 0) * (W - pl - 8), y = (v: number) => pt + (H - pb - pt) * (1 - v / tope);
  const d = datos.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.valor).toFixed(1)}`).join(" ");
  const cada = Math.ceil(n / 7);
  if (n < 2) return <p className="text-sm text-ink-3">Hace falta más de un día con ventas para dibujar la línea.</p>;
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full overflow-visible" role="img" aria-label="Ventas por día"
        onMouseMove={e => { const r = e.currentTarget.getBoundingClientRect(); const px = ((e.clientX - r.left) / r.width) * W; setHover(Math.max(0, Math.min(n - 1, Math.round(((px - pl) / (W - pl - 8)) * (n - 1))))); }}
        onMouseLeave={() => setHover(null)}>
        {ticks.map(t => <g key={t}><line x1={pl} x2={W} y1={y(t)} y2={y(t)} stroke="var(--grid)" /><text x={pl - 6} y={y(t) + 4} textAnchor="end" className={ejeTxt}>{corto(t)}</text></g>)}
        <path d={`${d} L${x(n - 1)} ${H - pb} L${pl} ${H - pb}Z`} fill="var(--brand)" opacity=".12" />
        <path d={d} fill="none" stroke="var(--brand)" strokeWidth="2.5" />
        {datos.map((p, i) => i % cada === 0 || i === n - 1 ? <text key={i} x={x(i)} y={H - 8} textAnchor="middle" className={ejeTxt}>{p.etiqueta}</text> : null)}
        <circle cx={x(n - 1)} cy={y(datos[n - 1].valor)} r="4.5" fill="var(--accent)" stroke="var(--surface)" strokeWidth="2" />
        {hover != null && <g><line x1={x(hover)} x2={x(hover)} y1={pt} y2={H - pb} stroke="var(--axis)" strokeDasharray="3 3" /><circle cx={x(hover)} cy={y(datos[hover].valor)} r="5" fill="var(--accent)" /></g>}
      </svg>
      {hover != null && (
        <div className="pointer-events-none absolute top-0 flex -translate-x-1/2 flex-col whitespace-nowrap rounded-md bg-ink px-2.5 py-1.5 text-[13px] text-bg" style={{ left: `${(x(hover) / W) * 100}%` }}>
          <strong>{datos[hover].etiqueta}</strong><span className="num">{bs(datos[hover].valor)}</span><span className="num">{datos[hover].pedidos} pedidos</span>
        </div>
      )}
    </div>
  );
}

export function Apilada({ partes }: { partes: { nombre: string; valor: number; color: string }[] }) {
  const tot = partes.reduce((s, p) => s + p.valor, 0) || 1;
  return (
    <div>
      <div className="flex h-7 gap-0.5 overflow-hidden rounded-md bg-surface-2" role="img" aria-label={partes.map(p => `${p.nombre} ${Math.round((p.valor / tot) * 100)} %`).join(", ")}>
        {partes.filter(p => p.valor > 0).map(p => <i key={p.nombre} style={{ width: `${(p.valor / tot) * 100}%`, background: p.color }} title={`${p.nombre}: ${p.valor}`} />)}
      </div>
      <ul className="mt-3 grid gap-1.5">
        {partes.map(p => <li key={p.nombre} className="flex items-center gap-2 text-sm"><i className="h-3 w-3 rounded-[3px]" style={{ background: p.color }} />{p.nombre}<strong className="num ml-auto">{p.valor} · {Math.round((p.valor / tot) * 100)} %</strong></li>)}
      </ul>
    </div>
  );
}

export function Horizontales({ filas }: { filas: { nombre: string; valor: number; color?: string }[] }) {
  const max = Math.max(1, ...filas.map(f => f.valor));
  return (
    <ul className="grid gap-3">
      {filas.map(f => (
        <li key={f.nombre} className="grid grid-cols-[100px_1fr_auto] items-center gap-2.5 text-sm">
          <span>{f.nombre}</span>
          <span className="h-3.5 overflow-hidden rounded bg-surface-2"><i className="block h-full" style={{ width: `${(f.valor / max) * 100}%`, background: f.color || "var(--brand)" }} /></span>
          <strong className="num">{bs(f.valor)}</strong>
        </li>
      ))}
    </ul>
  );
}

export function Barra({ valor, max, color = "var(--brand)" }: { valor: number; max: number; color?: string }) {
  return <span className="block h-2 min-w-[60px] overflow-hidden rounded bg-surface-3" aria-hidden="true"><i className="block h-full rounded" style={{ width: `${Math.min(100, (valor / (max || 1)) * 100)}%`, background: color }} /></span>;
}
