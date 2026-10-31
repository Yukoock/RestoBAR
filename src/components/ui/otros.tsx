// Otros componentes base (B3): QRCode, ProductPhoto y el logo.
import type { CSSProperties } from "react";
import { QRCodeSVG } from "qrcode.react";
import { cx } from "@/lib/formato";
import { useConfig } from "@/lib/config";
import { Ilustracion, datosIlus } from "../ilustraciones";

export function QRCode({ texto, tamano = 168, etiqueta }: { texto: string; tamano?: number; etiqueta: string }) {
  return (
    <div role="img" aria-label={etiqueta} className="inline-block rounded-sm bg-white p-2">
      <QRCodeSVG value={texto} size={tamano} level="M" fgColor="#10241B" bgColor="#FFFFFF" />
    </div>
  );
}

// Foto real del producto; si falta, la ilustración en el estilo de la marca (B1.8)
export function ProductPhoto({ codigo, nombre, categoria, fotoUrl, agotado, cuadrada, bebidaEmbotellada, className }:
  { codigo: string; nombre: string; categoria?: string | null; fotoUrl?: string | null; agotado?: boolean; cuadrada?: boolean; bebidaEmbotellada?: boolean; className?: string }) {
  return (
    <div className={cx("ilus rounded-md", cuadrada && "cuadrada", agotado && "gris", className)}>
      {fotoUrl
        ? <img src={fotoUrl} alt={nombre} loading="lazy" className={bebidaEmbotellada ? "contain" : undefined} />
        : <Ilustracion datos={datosIlus(codigo, nombre, categoria)} />}
    </div>
  );
}

const TRENZA: [number, number][] = [[14, 27.4], [18.5, 25.3], [23, 23.9], [27.5, 23.2], [32, 23], [36.5, 23.2], [41, 23.9], [45.5, 25.3], [50, 27.4]];
export function LogoIcono({ tamano = 40 }: { tamano?: number }) {
  return (
    <svg width={tamano} height={tamano} viewBox="0 0 64 64" aria-hidden="true" className="block flex-none">
      <rect width="64" height="64" rx="16" fill="var(--brand)" />
      <ellipse cx="32" cy="38" rx="24" ry="13" fill="var(--maiz)" />
      <g fill="var(--accent)">{TRENZA.map(([x, y]) => <ellipse key={x} cx={x} cy={y} rx="2.6" ry="4.4" transform={`rotate(35 ${x} ${y})`} />)}</g>
    </svg>
  );
}

// Nombre del negocio desde la configuración. «ResTO BAR» lleva el «TO» en urucú.
export function PalabraLogo({ className, style }: { className?: string; style?: CSSProperties }) {
  const { config } = useConfig();
  const n = config.nombre;
  const m = n === "ResTO BAR" ? <>Res<span className="text-accent">TO</span> BAR</> : n;
  return <span aria-label={n} style={style} className={cx("whitespace-nowrap font-display text-[22px] font-extrabold tracking-tight", className)}>{m}</span>;
}

export function Logo({ tamano = 40, className }: { tamano?: number; className?: string }) {
  const { config } = useConfig();
  return (
    <span className={cx("inline-flex items-center gap-2.5", className)}>
      {config.logo_url ? <img src={config.logo_url} alt="" width={tamano} height={tamano} className="rounded-md bg-white object-contain p-0.5" /> : <LogoIcono tamano={tamano} />}
      <PalabraLogo />
    </span>
  );
}
