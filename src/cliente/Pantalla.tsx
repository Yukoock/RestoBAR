// Pantalla del cliente (B6.9): segunda pantalla de la caja, en horizontal. Sigue al pedido elegido en Cajero
// (en este mismo equipo): productos, TOTAL A PAGAR, QR del banco y «¡Gracias!». Sin pedido, muestra las promociones.
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useConfig, useTitulo } from "@/lib/config";
import { bs, cx } from "@/lib/formato";
import { useConsulta } from "@/lib/datos";
import { useProductos, useCategorias } from "@/lib/catalogo";
import { usePantallaCaja, sonar } from "@/lib/operacion";
import type { Banner, Pedido } from "@/lib/tipos";
import { Logo, ProductPhoto } from "@/components/ui";
import { QrCobro } from "@/components/QrCobro";

export function PantallaCliente() {
  useTitulo("Pantalla del cliente");
  const { config } = useConfig();
  const msg = usePantallaCaja();
  const [fase, setFase] = useState(msg.fase);
  const { datos: pedido } = useConsulta<Pedido | null>("pantalla-" + (msg.pedidoId || "nada"),
    () => supabase.from("pedidos").select("*, pedido_items(*)").eq("id", msg.pedidoId || "00000000-0000-0000-0000-000000000000").maybeSingle() as never, null, ["pedidos", "pedido_items"]);
  const { datos: productos } = useProductos();
  const { datos: categorias } = useCategorias();
  const { datos: banners } = useConsulta<Banner[]>("banners-pantalla", () => supabase.from("banners").select("*").eq("activo", true).order("orden") as never, [], ["banners"]);
  const promos = banners.filter(b => b.donde.includes("pantalla"));
  const [i, setI] = useState(0);

  useEffect(() => { setFase(msg.fase); }, [msg]);
  // Al confirmarse el pago: sonido, «¡Gracias!» y, a los 10 segundos, vuelve a las promociones
  useEffect(() => {
    if (fase !== "pagado") return;
    sonar("gracias");
    const t = setTimeout(() => setFase("espera"), 10000);
    return () => clearTimeout(t);
  }, [fase]);
  // Si la caja confirmó un QR que estaba por validar, también se muestra «¡Gracias!»
  useEffect(() => { if (pedido && fase === "qr" && pedido.pago_metodo && !pedido.pago_pendiente) setFase("pagado"); }, [pedido, fase]);
  useEffect(() => { if (promos.length < 2) return; const t = setInterval(() => setI(x => (x + 1) % promos.length), 6000); return () => clearInterval(t); }, [promos.length]);
  // Pantalla completa con el primer toque (el navegador no permite hacerlo solo)
  useEffect(() => {
    const f = () => { document.documentElement.requestFullscreen?.().catch(() => {}); };
    window.addEventListener("click", f, { once: true });
    return () => window.removeEventListener("click", f);
  }, []);
  const prod = (id: string | null) => productos.find(p => p.id === id);
  const cat = (id: string | null) => categorias.find(c => c.id === id)?.nombre;
  const espera = fase === "espera" || !msg.pedidoId || !pedido || pedido.estado === "anulado";

  if (espera) {
    const b = promos[i % (promos.length || 1)], pb = b && prod(b.producto_id);
    return (
      <main className="flex min-h-screen flex-col gap-6 bg-bg px-8 py-6">
        <header className="flex items-center gap-4"><Logo tamano={52} className="[&>span:last-child]:text-[32px]" /><span className="flex-1" /><span className="text-xl text-ink-3">{config.lema}</span></header>
        {b ? (
          <div key={b.id} className="anim-aparece grid flex-1 items-center gap-8 md:grid-cols-[1.2fr_1fr]">
            <div className="overflow-hidden rounded-lg shadow-2">
              {b.foto_url ? <img src={b.foto_url} alt="" className="aspect-[4/3] w-full object-cover" /> : pb ? <ProductPhoto codigo={pb.codigo} nombre={pb.nombre} categoria={cat(pb.categoria_id)} fotoUrl={pb.foto_url} className="!rounded-none" /> : null}
            </div>
            <div className="flex flex-col gap-3">
              <h1 className="text-[clamp(36px,5vw,64px)] font-extrabold leading-none">{b.titulo}</h1>
              {b.subtitulo && <p className="text-2xl text-ink-2">{b.subtitulo}</p>}
              {pb && <p className="num font-display text-3xl font-extrabold text-brand-text">{bs(pb.precio)}</p>}
              <div className="trenza w-40 !bg-maiz" aria-hidden="true" />
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center"><h1 className="text-5xl font-extrabold">Bienvenidos a {config.nombre}</h1><p className="text-2xl text-ink-2">{config.lema}</p></div>
        )}
        {promos.length > 1 && <div className="flex justify-center gap-2" aria-hidden="true">{promos.map((p, k) => <i key={p.id} className={cx("h-2.5 w-2.5 rounded-full", k === i % promos.length ? "bg-accent" : "bg-surface-3")} />)}</div>}
      </main>
    );
  }
  const monto = fase === "qr" && msg.monto ? msg.monto : Number(pedido!.total);
  return (
    <main className="flex min-h-screen flex-col gap-5 bg-bg px-7 py-5">
      <header className="flex items-center gap-4"><Logo tamano={48} className="[&>span:last-child]:text-[30px]" /><span className="flex-1" /><strong className="num font-display text-[28px]">Pedido #{pedido!.numero}</strong></header>
      <div className="grid flex-1 gap-6 lg:grid-cols-[1fr_1.1fr]">
        <ul className="flex flex-col self-start rounded-lg bg-surface px-5 py-3 shadow-1" aria-label="Tu pedido">
          {(pedido!.pedido_items || []).map(it => { const p = prod(it.producto_id); return (
            <li key={it.id} className="grid grid-cols-[72px_1fr_auto] items-center gap-4 border-b border-dashed border-line py-2.5 text-xl last:border-0">
              {p ? <ProductPhoto codigo={p.codigo} nombre={p.nombre} categoria={cat(p.categoria_id)} fotoUrl={p.foto_url} cuadrada className="!w-[72px] !rounded-lg" /> : <span />}
              <span><strong>{it.cantidad} × {it.nombre}</strong>{it.nota && <small className="block text-base text-accent-deep">{it.nota}</small>}</span>
              <span className="num">{bs(it.cantidad * Number(it.precio_unitario))}</span>
            </li>
          ); })}
          {Number(pedido!.envio) > 0 && <li className="flex justify-between py-2.5 text-xl"><span>Envío</span><span className="num">{bs(pedido!.envio)}</span></li>}
          {Number(pedido!.propina) > 0 && <li className="flex justify-between py-2.5 text-xl"><span>Propina</span><span className="num">{bs(pedido!.propina)}</span></li>}
        </ul>
        <section className="flex flex-col items-center justify-center gap-4 rounded-lg bg-brand p-7 text-center text-on-brand" aria-live="polite">
          {fase === "pagado" ? <>
            <span className="anim-aparece grid h-40 w-40 place-items-center rounded-full bg-white text-ok"><Check size={88} strokeWidth={2.5} /></span>
            <h2 className="text-6xl font-extrabold">¡Gracias!</h2>
            <p className="num text-2xl">Pago recibido · {bs(pedido!.total)}</p>
          </> : <>
            <span className="text-lg font-extrabold tracking-[.12em] opacity-85">TOTAL A PAGAR</span>
            <strong className="num font-display text-[clamp(48px,7vw,96px)] font-extrabold leading-none">{bs(monto)}</strong>
            {fase === "qr" && <>
              <div className="rounded-md bg-white p-2"><QrCobro monto={monto} referencia={`pedido ${pedido!.numero}`} tamano={300} aviso={false} /></div>
              <ol className="flex flex-wrap justify-center gap-4 text-lg font-semibold">
                {["Abre la app de tu banco", "Escanea este QR", "Confirma el pago"].map((t, k) => <li key={t} className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-full bg-maiz font-extrabold text-on-maiz">{k + 1}</span>{t}</li>)}
              </ol>
              <p className="animate-pulse text-xl font-semibold">Esperando tu pago…</p>
            </>}
          </>}
        </section>
      </div>
    </main>
  );
}
