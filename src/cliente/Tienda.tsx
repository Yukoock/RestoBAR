// Tienda online (B6.7): pública y pensada para el celular. Menú con fotos, carrito, delivery o recoger,
// «Pedir por WhatsApp» o «Pagar con QR», y seguimiento en vivo del pedido.
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Check, Clock, Home, MapPin, MessageCircle, Minus, Plus, QrCode, Receipt, ShoppingBag, UtensilsCrossed } from "lucide-react";
import { useConfig, useTitulo } from "@/lib/config";
import { bs, cx, mensajeError } from "@/lib/formato";
import { useMenuPublico, useCarrito, estaAbierto, pedirPublico, useSeguimiento } from "@/lib/publico";
import type { ProductoCompleto } from "@/lib/catalogo";
import { BottomSheet, Button, EmptyState, ErrorState, FormField, Logo, ProductPhoto, Seg, Skeleton, useAvisar } from "@/components/ui";
import { Mapa } from "@/components/Mapa";
import { QrCobro } from "@/components/QrCobro";

const ULTIMO = "restobar-ultimo-pedido";

export function Tienda() {
  useTitulo("Tienda online");
  const { config } = useConfig();
  const avisar = useAvisar();
  const { productos, categorias, banners, nombreCat, cargando, error, recargar } = useMenuPublico();
  const carrito = useCarrito("tienda");
  const [hoja, setHoja] = useState<"carrito" | "local" | null>(null);
  const [catVisible, setCatVisible] = useState("");
  const abierto = estaAbierto(config);
  const banner = banners.find(b => b.donde.includes("tienda"));
  const prodBanner = banner && productos.find(p => p.id === banner.producto_id);
  const favoritos = productos.filter(p => p.favorito && p.canales?.tienda !== false);
  const ultimo = useMemo(() => { try { return JSON.parse(localStorage.getItem(ULTIMO) || "null") as { id: string; codigo: string; numero: number; t: number } | null; } catch { return null; } }, []);
  const venta = (p: ProductoCompleto) => p.canales?.tienda !== false;
  const enCarrito = (id: string) => carrito.items.filter(i => i.producto_id === id).reduce((a, i) => a + i.cantidad, 0);
  const agregar = (p: ProductoCompleto, d = 1) => {
    if (p.agotado) return;
    if (!abierto) return avisar("El local está cerrado ahora. Puedes ver el menú y pedir cuando abramos.", "info");
    carrito.sumar(p.id, d);
  };

  // SEO (B6.7): descripción y datos estructurados Restaurant + Menu para los buscadores
  useEffect(() => {
    const desc = `${config.nombre}${config.lema ? " · " + config.lema : ""}. Menú con precios y pedidos online en ${config.ciudad || "Bolivia"}.`;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!meta) { meta = document.createElement("meta"); meta.name = "description"; document.head.appendChild(meta); }
    meta.content = desc;
    const datos = {
      "@context": "https://schema.org", "@type": "Restaurant", name: config.nombre, description: desc, servesCuisine: "Boliviana",
      address: { "@type": "PostalAddress", streetAddress: config.direccion, addressLocality: config.ciudad, addressCountry: "BO" },
      telephone: config.whatsapp ? "+" + config.whatsapp : undefined, url: location.origin + "/tienda", priceRange: "Bs",
      hasMenu: { "@type": "Menu", hasMenuSection: categorias.map(c => ({ "@type": "MenuSection", name: c.nombre,
        hasMenuItem: productos.filter(p => p.categoria_id === c.id).map(p => ({ "@type": "MenuItem", name: p.nombre, description: p.descripcion || undefined, image: p.foto_url || undefined,
          offers: { "@type": "Offer", price: Number(p.precio).toFixed(2), priceCurrency: "BOB", availability: p.agotado ? "https://schema.org/OutOfStock" : "https://schema.org/InStock" } })) })) },
    };
    let s = document.getElementById("ld-restaurante") as HTMLScriptElement | null;
    if (!s) { s = document.createElement("script"); s.id = "ld-restaurante"; s.type = "application/ld+json"; document.head.appendChild(s); }
    s.textContent = JSON.stringify(datos);
  }, [config, productos, categorias]);
  // La barra de categorías resalta la sección que se ve en pantalla
  useEffect(() => {
    const obs = new IntersectionObserver(es => { const v = es.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]; if (v) setCatVisible(v.target.id.replace("cat-", "")); }, { rootMargin: "-120px 0px -60% 0px" });
    document.querySelectorAll("[id^=cat-]").forEach(e => obs.observe(e));
    return () => obs.disconnect();
  }, [categorias.length, productos.length]);
  // «Ver en la tienda» desde Administración llega con #P07
  useEffect(() => { if (!cargando && location.hash) setTimeout(() => document.getElementById(location.hash.slice(1))?.scrollIntoView({ block: "center" }), 300); }, [cargando]);
  const irA = (id: string) => { const el = document.getElementById(id); if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 112, behavior: "smooth" }); };

  return (
    <div className="mx-auto min-h-screen max-w-2xl bg-bg pb-24">
      <header className="sticky top-0 z-20 flex min-h-[60px] items-center gap-2 border-b border-line bg-surface px-3">
        <Logo tamano={34} className="flex-1 [&>span:last-child]:text-[19px]" />
        {config.whatsapp && <a href={`https://wa.me/${config.whatsapp}`} target="_blank" rel="noopener" aria-label="Escribir por WhatsApp" className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-[#1E8A4C] px-3.5 text-sm font-semibold text-white"><MessageCircle size={18} />WhatsApp</a>}
      </header>
      <div role="status" className={cx("flex items-center gap-2 px-3.5 py-2 text-[13px] font-semibold", abierto ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad")}>
        <i className="h-2 w-2 rounded-full bg-current" aria-hidden="true" />
        {abierto ? `Abierto ahora · hasta las ${config.hora_cierra.slice(0, 5)} · entrega en 35–50 min` : `Cerrado · abrimos a las ${config.hora_abre.slice(0, 5)}`}
      </div>
      {ultimo && Date.now() - ultimo.t < 6 * 3600000 && (
        <Link to={`/tienda/pedido/${ultimo.id}?c=${ultimo.codigo}`} className="flex items-center gap-2 bg-info-soft px-3.5 py-2.5 text-sm font-semibold text-info"><Receipt size={18} />Ver mi pedido #{ultimo.numero}</Link>
      )}

      {/* Portada: banner activo o la presentación del local */}
      <section className="relative" aria-label="Portada">
        {prodBanner || banner?.foto_url ? (
          <div className="relative">
            {banner?.foto_url ? <img src={banner.foto_url} alt="" className="aspect-[16/10] w-full object-cover" /> : <ProductPhoto codigo={prodBanner!.codigo} nombre={prodBanner!.nombre} categoria={nombreCat(prodBanner!.categoria_id)} fotoUrl={prodBanner!.foto_url} className="!aspect-[16/10] !rounded-none" />}
            <div className="absolute inset-x-3 bottom-3 flex flex-col items-start gap-1 rounded-md bg-surface/95 p-3 shadow-1">
              <strong className="font-display text-xl">{banner!.titulo}</strong>
              {banner!.subtitulo && <span className="text-sm text-ink-2">{banner!.subtitulo}</span>}
              {prodBanner && <Button variant="accent" size="sm" disabled={!abierto || prodBanner.agotado} onClick={() => { agregar(prodBanner); avisar(`${prodBanner.nombre} está en tu carrito`); }}>Lo quiero</Button>}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2 bg-brand px-5 py-8 text-on-brand"><strong className="font-display text-2xl">{config.nombre}</strong><span>{config.lema}</span><div className="trenza w-[72px] !bg-maiz" aria-hidden="true" /></div>
        )}
      </section>

      <nav aria-label="Categorías" className="sin-barra sticky top-[60px] z-10 flex gap-1 overflow-x-auto border-b border-line bg-surface px-2.5 py-1.5">
        {categorias.map(c => <button key={c.id} type="button" onClick={() => irA("cat-" + c.id)} aria-current={catVisible === c.id ? "true" : undefined}
          className={cx("min-h-[38px] whitespace-nowrap rounded-full px-3 text-sm font-semibold", catVisible === c.id ? "bg-brand text-on-brand" : "text-ink-2")}>{c.nombre}</button>)}
      </nav>

      {error ? <ErrorState titulo="No se pudo cargar el menú" error={error} onRetry={recargar} /> : cargando ? (
        <div className="flex flex-col gap-3 p-3.5">{[1, 2, 3, 4].map(i => <Skeleton key={i} h={110} r={12} />)}</div>
      ) : <>
        {favoritos.length > 0 && (
          <section className="px-3.5 pt-4" aria-labelledby="t-fav">
            <h2 id="t-fav" className="mb-2 text-lg font-extrabold">Más vendidos</h2>
            <div className="sin-barra flex snap-x gap-2.5 overflow-x-auto pb-1.5">
              {favoritos.map(p => (
                <button key={p.id} type="button" disabled={!abierto || p.agotado} onClick={() => agregar(p)} aria-label={`Agregar ${p.nombre}, ${bs(p.precio)}`}
                  className="flex w-[150px] flex-none snap-start flex-col gap-1 rounded-md bg-surface p-1.5 pb-2.5 text-left text-sm font-semibold shadow-1 disabled:opacity-60">
                  <ProductPhoto codigo={p.codigo} nombre={p.nombre} categoria={nombreCat(p.categoria_id)} fotoUrl={p.foto_url} agotado={p.agotado} className="!rounded-lg" />
                  <span className="line-clamp-2 px-0.5 leading-tight">{p.nombre}</span><strong className="num px-0.5">{bs(p.precio)}</strong>
                </button>
              ))}
            </div>
          </section>
        )}
        {categorias.map(c => {
          const ps = productos.filter(p => p.categoria_id === c.id && venta(p));
          if (!ps.length) return null;
          return (
            <section key={c.id} id={"cat-" + c.id} className="scroll-mt-28 px-3.5 pt-5" aria-labelledby={"h-" + c.id}>
              <h2 id={"h-" + c.id} className="mb-2 text-lg font-extrabold">{c.nombre}</h2>
              <ul className="flex flex-col gap-2.5">
                {ps.map(p => (
                  <li key={p.id} id={p.codigo} className="flex gap-3 rounded-md bg-surface p-2 shadow-1">
                    <ProductPhoto codigo={p.codigo} nombre={p.nombre} categoria={c.nombre} fotoUrl={p.foto_url} agotado={p.agotado} cuadrada className="!w-24 flex-none !rounded-lg" />
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <strong className="text-[15px]">{p.nombre}</strong>
                      {p.descripcion && <p className="line-clamp-2 text-[13px] text-ink-3">{p.descripcion}</p>}
                      <span className="mt-auto flex items-center justify-between gap-2 font-bold">
                        <span className="num">{bs(p.precio)}</span>
                        {p.agotado ? <span className="rounded-full bg-surface-3 px-2.5 py-0.5 text-[13px] text-ink-2">Agotado</span>
                          : enCarrito(p.id) ? <Cantidad n={enCarrito(p.id)} nombre={p.nombre} menos={() => carrito.sumar(p.id, -1)} mas={() => agregar(p)} />
                          : <Button size="sm" icon={Plus} disabled={!abierto} onClick={() => agregar(p)}>Agregar</Button>}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
        <p className="px-3.5 pt-6 text-center text-xs text-ink-3">Fotos de Wikimedia Commons con licencia libre · <Link to="/creditos" className="underline">Créditos</Link></p>
      </>}

      <nav aria-label="Tienda" className="fixed inset-x-0 bottom-0 z-20 mx-auto grid max-w-2xl grid-cols-4 border-t border-line bg-surface px-1 pb-[max(8px,env(safe-area-inset-bottom))] pt-1.5">
        {([["Inicio", Home, () => window.scrollTo({ top: 0, behavior: "smooth" })], ["Menú", UtensilsCrossed, () => categorias[0] && irA("cat-" + categorias[0].id)], ["Local", MapPin, () => setHoja("local")]] as const).map(([t, Ic, f]) => (
          <button key={t} type="button" onClick={f} className="flex min-h-[52px] flex-col items-center justify-center gap-0.5 text-xs font-semibold text-ink-3"><Ic size={22} />{t}</button>
        ))}
        <button type="button" onClick={() => setHoja("carrito")} aria-label={`Carrito, ${carrito.cantidad} productos`} className="flex min-h-[52px] flex-col items-center justify-center gap-0.5 text-xs font-semibold text-brand-text">
          <span className="relative"><ShoppingBag size={22} />{carrito.cantidad > 0 && <span className="num absolute -right-2.5 -top-1.5 min-w-[18px] rounded-full bg-accent px-1 text-center text-[11px] font-bold leading-[18px] text-on-accent">{carrito.cantidad}</span>}</span>Carrito
        </button>
      </nav>
      {hoja === "carrito" && <Carrito productos={productos} nombreCat={nombreCat} carrito={carrito} abierto={abierto} onClose={() => setHoja(null)} />}
      {hoja === "local" && (
        <BottomSheet titulo="Nuestro local" onClose={() => setHoja(null)}>
          <p>{config.direccion}<br />{config.ciudad}</p>
          {config.horario && <p className="flex items-center gap-2 text-sm"><Clock size={16} />{config.horario}</p>}
          <Mapa direccion={config.direccion} ciudad={config.ciudad} alto="h-[180px]" />
          <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${config.direccion}, ${config.ciudad}`)}`} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-sm border border-line font-semibold"><MapPin size={18} />Cómo llegar</a>
        </BottomSheet>
      )}
    </div>
  );
}

function Cantidad({ n, nombre, menos, mas }: { n: number; nombre: string; menos: () => void; mas: () => void }) {
  return (
    <span className="inline-flex items-center rounded-full border border-line bg-surface">
      <button type="button" aria-label={`Quitar 1 ${nombre}`} onClick={menos} className="grid h-10 w-10 place-items-center"><Minus size={16} /></button>
      <span className="num w-6 text-center">{n}</span>
      <button type="button" aria-label={`Sumar 1 ${nombre}`} onClick={mas} className="grid h-10 w-10 place-items-center"><Plus size={16} /></button>
    </span>
  );
}

function Carrito({ productos, nombreCat, carrito, abierto, onClose }:
  { productos: ProductoCompleto[]; nombreCat: (id: string | null) => string | undefined; carrito: ReturnType<typeof useCarrito>; abierto: boolean; onClose: () => void }) {
  const { config } = useConfig();
  const navegar = useNavigate();
  const [modo, setModo] = useState<"delivery" | "recoger">("delivery");
  const guardado = (k: string) => { try { return localStorage.getItem("restobar-cliente-" + k) || ""; } catch { return ""; } };
  const [nombre, setNombre] = useState(() => guardado("nombre")), [tel, setTel] = useState(() => guardado("tel")), [dir, setDir] = useState(() => guardado("dir"));
  const [dirMapa, setDirMapa] = useState(dir);
  const [zona, setZona] = useState(config.envio[0]?.id || ""), [nota, setNota] = useState(""), [cupon, setCupon] = useState("");
  const [error, setError] = useState(""), [enviando, setEnviando] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => { clearTimeout(t.current); t.current = setTimeout(() => setDirMapa(dir), 1200); }, [dir]);
  const lineas = carrito.items.map(i => ({ ...i, p: productos.find(p => p.id === i.producto_id) })).filter(l => l.p);
  const subtotal = lineas.reduce((a, l) => a + l.cantidad * Number(l.p!.precio), 0);
  const envio = modo === "delivery" ? Number(config.envio.find(z => z.id === zona)?.costo || 0) : 0;
  const total = subtotal + envio;
  const sinDelivery = modo === "delivery" && config.envio.length === 0;
  function validar() {
    if (!abierto) return "El local está cerrado ahora.";
    if (nombre.trim().length < 2) return "Escribe tu nombre.";
    if (modo === "delivery" && dir.trim().length < 6) return "Escribe la dirección de entrega: es obligatoria para el delivery.";
    if (sinDelivery) return "Por ahora no hacemos delivery. Elige «Recoger en el local».";
    return "";
  }
  const recordar = () => { try { localStorage.setItem("restobar-cliente-nombre", nombre.trim()); localStorage.setItem("restobar-cliente-tel", tel.trim()); localStorage.setItem("restobar-cliente-dir", dir.trim()); } catch { /* nada */ } };
  const items = () => carrito.items.map((i, k) => k === 0 && nota.trim() ? { ...i, nota: [i.nota, "Nota: " + nota.trim()].filter(Boolean).join(" · ").slice(0, 120) } : i);
  const mensaje = () => `Hola ${config.nombre}, quiero pedir:\n${lineas.map(l => `• ${l.cantidad} × ${l.p!.nombre}${l.nota ? ` (${l.nota})` : ""}`).join("\n")}\n${modo === "delivery" ? `Delivery a: ${dir.trim()}` : "Recojo en el local"}\nTotal: ${bs(total)}\nA nombre de: ${nombre.trim()}${tel ? ` · ${tel}` : ""}${nota.trim() ? `\nNota: ${nota.trim()}` : ""}`;
  async function pagarQR() {
    const e = validar(); if (e) return setError(e);
    setEnviando(true); recordar();
    try {
      const r = await pedirPublico({ canal: "web", items: items(), cliente: nombre.trim(), telefono: tel.trim(), direccion: modo === "delivery" ? dir.trim() : undefined, zona_envio: modo === "delivery" ? zona : undefined, recoger: modo === "recoger" });
      localStorage.setItem(ULTIMO, JSON.stringify({ id: r.id, codigo: r.codigo, numero: r.numero, t: Date.now() }));
      carrito.vaciar(); onClose(); navegar(`/tienda/pedido/${r.id}?c=${r.codigo}`);
    } catch (er) { setError(mensajeError(er)); } finally { setEnviando(false); }
  }
  return (
    <BottomSheet titulo="Tu pedido" onClose={onClose} pie={lineas.length ? (
      <div className="flex flex-col gap-2">
        {error && <p role="alert" className="text-sm font-semibold text-bad">{error}</p>}
        {config.whatsapp && <a href={validar() ? undefined : `https://wa.me/${config.whatsapp}?text=${encodeURIComponent(mensaje())}`} target="_blank" rel="noopener"
          onClick={e => { const v = validar(); if (v) { e.preventDefault(); setError(v); } else recordar(); }}
          className="inline-flex min-h-14 items-center justify-center gap-2 rounded-sm bg-[#1E8A4C] px-4 text-[17px] font-semibold text-white"><MessageCircle size={20} />Pedir por WhatsApp</a>}
        <Button variant="primary" size="lg" icon={QrCode} loading={enviando} onClick={pagarQR}>Pagar con QR · {bs(total)}</Button>
      </div>
    ) : undefined}>
      {lineas.length === 0 ? <EmptyState icon={ShoppingBag} titulo="Tu carrito está vacío" texto="Agrega tus platos favoritos desde el menú." /> : <>
        <ul className="flex flex-col gap-2">{lineas.map(l => (
          <li key={l.producto_id + l.nota} className="flex items-center gap-2.5">
            <ProductPhoto codigo={l.p!.codigo} nombre={l.p!.nombre} categoria={nombreCat(l.p!.categoria_id)} fotoUrl={l.p!.foto_url} cuadrada className="!w-12 flex-none !rounded-lg" />
            <span className="flex min-w-0 flex-1 flex-col text-sm font-semibold">{l.p!.nombre}<small className="num font-medium text-ink-3">{bs(l.p!.precio)}</small></span>
            <Cantidad n={l.cantidad} nombre={l.p!.nombre} menos={() => carrito.sumar(l.producto_id, -1, l.nota)} mas={() => carrito.sumar(l.producto_id, 1, l.nota)} />
          </li>
        ))}</ul>
        <Seg value={modo} onChange={v => { setModo(v); setError(""); }} label="Entrega" opciones={[["delivery", "Delivery"], ["recoger", "Recoger en el local"]]} />
        <FormField id="c-nombre" label="Tu nombre"><input id="c-nombre" autoComplete="name" value={nombre} onChange={e => { setNombre(e.target.value); setError(""); }} /></FormField>
        <FormField id="c-tel" label="Tu teléfono (opcional)" hint="Para avisarte si hace falta"><input id="c-tel" type="tel" inputMode="tel" autoComplete="tel" value={tel} onChange={e => setTel(e.target.value)} /></FormField>
        {modo === "delivery" && (sinDelivery ? <p className="text-sm font-semibold text-warn">Por ahora no hacemos delivery. Elige «Recoger en el local».</p> : <>
          <FormField id="c-dir" label="Dirección de entrega" hint="Calle, número y una referencia (ej.: frente al mercado)"><input id="c-dir" autoComplete="street-address" value={dir} onChange={e => { setDir(e.target.value); setError(""); }} /></FormField>
          {dirMapa.trim().length >= 6 && <Mapa direccion={dirMapa} ciudad={config.ciudad} alto="h-[150px]" />}
          <FormField id="c-zona" label="Zona de entrega"><select id="c-zona" value={zona} onChange={e => setZona(e.target.value)}>{config.envio.map(z => <option key={z.id} value={z.id}>{z.nombre} · {bs(z.costo)}</option>)}</select></FormField>
        </>)}
        {modo === "recoger" && <p className="flex items-center gap-2 text-sm"><MapPin size={16} />Recoges en {config.direccion}</p>}
        <FormField id="c-nota" label="Notas (opcional)"><input id="c-nota" value={nota} maxLength={80} placeholder="Ej.: sin picante" onChange={e => setNota(e.target.value)} /></FormField>
        <FormField id="c-cupon" label="Cupón (opcional)" error={cupon.trim() ? "No hay cupones activos por ahora." : undefined}><input id="c-cupon" value={cupon} onChange={e => setCupon(e.target.value)} /></FormField>
        <dl className="num flex flex-col gap-1">
          <div className="flex justify-between"><dt>Productos</dt><dd>{bs(subtotal)}</dd></div>
          {envio > 0 && <div className="flex justify-between"><dt>Envío</dt><dd>{bs(envio)}</dd></div>}
          <div className="flex justify-between border-t border-line pt-1.5 text-lg font-extrabold"><dt>Total</dt><dd>{bs(total)}</dd></div>
        </dl>
      </>}
    </BottomSheet>
  );
}

/* ---------- Seguimiento en vivo ---------- */
export function SeguimientoPedido() {
  useTitulo("Tu pedido");
  const { config } = useConfig();
  const { id } = useParams();
  const [q] = useSearchParams();
  const { s, error, noExiste } = useSeguimiento(id || null, q.get("c"));
  const delivery = !!s?.delivery_estado;
  const pasos: [string, boolean][] = s ? [
    ["Recibido", true],
    [delivery ? "En la cocina" : "En la cocina", !!s.preparando || ["listo", "entregado"].includes(s.estado)],
    ["Listo", ["listo", "entregado"].includes(s.estado)],
    [delivery ? "En camino" : "Puedes pasar a recoger", delivery ? ["en_camino", "entregado"].includes(s.delivery_estado || "") : ["listo", "entregado"].includes(s.estado)],
    ["Entregado", s.estado === "entregado" && (!delivery || s.delivery_estado === "entregado")],
  ] : [];
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 px-4 py-6">
      <Logo />
      {noExiste ? <EmptyState icon={Receipt} titulo="No encontramos ese pedido" texto="Revisa el enlace o escríbenos por WhatsApp." /> : error ? <ErrorState error={error} onRetry={() => location.reload()} /> : !s ? <Skeleton h={300} r={12} /> : <>
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="grid h-20 w-20 place-items-center rounded-full bg-ok text-white"><Check size={40} strokeWidth={2.5} /></span>
          <h1 className="text-xl font-extrabold">¡Pedido recibido!</h1>
          <p className="num">Pedido #{s.numero} · {bs(s.total)} · {s.pagado ? "Pagado" : "Pago por QR pendiente"}</p>
        </div>
        {!s.pagado && s.estado !== "anulado" && (
          <section className="flex flex-col items-center gap-2 rounded-md bg-surface p-4 text-center shadow-1">
            <strong>Paga {bs(s.total)} con QR</strong>
            <QrCobro monto={Number(s.total)} referencia={`pedido ${s.numero}`} tamano={220} aviso={false} />
            <p className="text-sm text-ink-2">Abre la app de tu banco, escanea y escribe el monto. La caja confirma cuando llegue el pago.</p>
          </section>
        )}
        {s.estado === "anulado" ? <p className="rounded-md bg-bad-soft p-3 font-semibold text-bad">Este pedido fue anulado. Escríbenos si tienes dudas.</p> : (
          <ol className="flex flex-col gap-3 rounded-md bg-surface p-4 shadow-1" aria-label="Estado del pedido">
            {pasos.map(([t, ok]) => <li key={t} className={cx("flex items-center gap-3", ok ? "text-ink" : "text-ink-3")}><i aria-hidden="true" className={cx("grid h-7 w-7 place-items-center rounded-full border-2", ok ? "border-ok bg-ok text-white" : "border-line")}>{ok && <Check size={14} strokeWidth={3} />}</i><span className="font-semibold">{t}</span></li>)}
          </ol>
        )}
        <ul className="text-sm text-ink-2">{s.items.map((i, k) => <li key={k}>{i.cantidad} × {i.nombre}</li>)}</ul>
        <p className="text-sm text-ink-3">Esta página se actualiza sola.</p>
        <div className="flex flex-wrap gap-2">
          {config.whatsapp && <a href={`https://wa.me/${config.whatsapp}?text=${encodeURIComponent(`Hola, consulto por mi pedido #${s.numero}`)}`} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center gap-2 rounded-sm border border-line px-4 font-semibold"><MessageCircle size={18} />Escribirnos</a>}
          <Link to="/tienda" className="inline-flex min-h-11 items-center rounded-sm bg-brand px-4 font-semibold text-on-brand">Volver al menú</Link>
        </div>
      </>}
    </main>
  );
}
