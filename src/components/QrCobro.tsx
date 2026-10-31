// QR de cobro: la imagen del QR del banco (Configuración › Operación). Si todavía no se subió, un QR de muestra.
import { useConfig } from "@/lib/config";
import { bs, cx } from "@/lib/formato";
import { QRCode } from "./ui";

// aviso: el recordatorio de subir el QR del banco es para el personal; las pantallas del cliente lo ocultan (B6.9)
export function QrCobro({ monto, referencia, tamano = 168, className, aviso = true }: { monto: number; referencia: string; tamano?: number; className?: string; aviso?: boolean }) {
  const { config } = useConfig();
  return (
    <div className={cx("flex flex-col items-center gap-1.5", className)}>
      {config.qr_cobro_url
        ? <img src={config.qr_cobro_url} alt={`QR para pagar ${bs(monto)} a ${config.nombre}`} width={tamano} height={tamano} className="rounded-sm bg-white object-contain p-2" style={{ width: tamano, height: tamano }} />
        : <QRCode texto={`Pago ${config.nombre} · ${referencia} · ${bs(monto)}`} tamano={tamano - 16} etiqueta={`QR de muestra para ${bs(monto)}`} />}
      {!config.qr_cobro_url && aviso && <span className="max-w-[220px] text-center text-xs text-ink-3">QR de muestra: sube el QR de tu banco en Configuración › Operación.</span>}
    </div>
  );
}
