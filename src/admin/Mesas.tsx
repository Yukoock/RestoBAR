// Mesas (B6.2): plano del salón por zona y lista; cada mesa abre sus dos QR (pedir y llamar al mesero).
import { useMemo, useRef, useState, type CSSProperties } from "react";
import { Bell, Check, Copy, Download, Printer, QrCode, Receipt, RefreshCw, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useConfig } from "@/lib/config";
import { useAuth } from "@/lib/auth";
import { bs, cx, mensajeError, minutosDesde } from "@/lib/formato";
import { useMesas, usePedidosAbiertos, useLlamadasActivas, usePerfiles, estadoMesa, ESTADO_MESA, type EstadoMesa } from "@/lib/datos";
import { abrirImpresion, exportarTabla } from "@/lib/exportar";
import type { Llamada, Mesa, Pedido } from "@/lib/tipos";
import { DataTable } from "@/components/DataTable";
import { Badge, Button, Card, ConfirmDialog, ErrorState, Modal, QRCode, Seg, Skeleton, useAvisar } from "@/components/ui";
import type { LucideIcon } from "lucide-react";

const ICONO: Record<EstadoMesa, LucideIcon> = { libre: Check, ocupada: Users, cuenta: Receipt, llamando: Bell };
const COLOR: Record<EstadoMesa, string> = { libre: "var(--ok)", ocupada: "var(--warn)", cuenta: "var(--bad)", llamando: "var(--info)" };
const FONDO: Record<EstadoMesa, string> = { libre: "var(--surface)", ocupada: "var(--warn-soft)", cuenta: "var(--bad-soft)", llamando: "var(--info-soft)" };
export const urlMesa = (tipo: "mesa" | "llamar", m: Mesa) => `${location.origin}/${tipo}/${m.numero}?t=${m.qr_token}`;

export function Mesas() {
  const { config } = useConfig();
  const { datos: mesas, cargando, error, recargar } = useMesas();
  const { datos: abiertos } = usePedidosAbiertos();
  const { datos: llamadas } = useLlamadasActivas();
  const { datos: perfiles } = usePerfiles();
  const zonas = useMemo(() => [...new Set(mesas.map(m => m.zona))], [mesas]);
  const [vista, setVista] = useState<"plano" | "lista">("plano");
  const [zona, setZona] = useState<string>("");
  const [elegida, setElegida] = useState<Mesa | null>(null);
  const z = zona || zonas[0] || "";
  const est = (m: Mesa) => estadoMesa(m.id, abiertos, llamadas);
  const pedidoDe = (m: Mesa) => abiertos.find(p => p.mesa_id === m.id);
  const meseroDe = (zona: string) => perfiles.filter(p => p.rol === "mesero" && p.activo && p.zona === zona).map(p => p.nombre).join(", ") || "Sin asignar";
  const cuenta = (k: EstadoMesa) => mesas.filter(m => est(m) === k).length;

  if (error) return <Card><ErrorState error={error} onRetry={recargar} /></Card>;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(ESTADO_MESA) as EstadoMesa[]).map(k => <Badge key={k} tono={ESTADO_MESA[k].tono} icon={ICONO[k]}><span className="num">{cuenta(k)}</span> {ESTADO_MESA[k].nombre.toLowerCase()}</Badge>)}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Seg value={vista} onChange={setVista} label="Vista" opciones={[["plano", "Plano del salón"], ["lista", "Lista"]]} />
          <Button icon={Printer} disabled={!mesas.length} onClick={() => imprimirTodos(mesas, config.nombre)}>Imprimir todos los QR</Button>
        </div>
      </div>
      {vista === "plano" ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            {zonas.length > 1 && <Seg value={z} onChange={setZona} label="Zona" opciones={zonas.map(x => [x, x] as [string, string])} />}
            <span className="text-sm text-ink-3">Mesero de la zona: <strong>{meseroDe(z)}</strong></span>
          </div>
          {cargando ? <Skeleton h={420} r={20} /> : (
            <div role="group" aria-label={`Plano · ${z}`} className="relative min-h-[560px] overflow-hidden rounded-lg bg-surface shadow-1 md:aspect-[16/8] md:min-h-[420px]"
              style={{ backgroundImage: "linear-gradient(var(--grid) 1px, transparent 1px), linear-gradient(90deg, var(--grid) 1px, transparent 1px)", backgroundSize: "32px 32px" }}>
              {mesas.filter(m => m.zona === z).map(m => {
                const e = est(m), p = pedidoDe(m), Ic = ICONO[e];
                return (
                  <button key={m.id} type="button" onClick={() => setElegida(m)} style={{ left: `${m.x}%`, top: `${m.y}%`, "--c": COLOR[e], background: FONDO[e] } as CSSProperties}
                    aria-label={`Mesa ${m.numero}, ${m.capacidad} sillas, ${ESTADO_MESA[e].nombre}${p ? `, ${bs(p.total)}` : ""}`}
                    className={cx("absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-0.5 border-2 border-[var(--c)] shadow-1 hover:shadow-[0_0_0_3px_var(--c)]",
                      m.forma === "redonda" ? "h-[78px] w-[78px] rounded-full md:h-[104px] md:w-[104px]" : "h-[72px] w-[100px] rounded-md md:h-[96px] md:w-[150px]", e === "llamando" && "animate-pulse")}>
                    <strong className="num font-display text-xl leading-none md:text-[26px]">{m.numero}</strong>
                    <span className="flex items-center gap-1 text-xs font-bold text-[var(--c)]"><Ic size={14} strokeWidth={2} />{ESTADO_MESA[e].nombre}</span>
                    <span className="num hidden text-[11px] text-ink-3 md:block">{p ? `${minutosDesde(p.created_at)} min · ${bs(p.total)}` : `${m.capacidad} sillas`}</span>
                  </button>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <DataTable<Mesa> id="mesas" titulo="Mesas" filas={mesas} clave={m => m.id} cargando={cargando} buscar={m => `mesa ${m.numero} ${m.zona}`}
          filtros={[{ id: "todas", titulo: "Todas", f: () => true }, ...zonas.map(x => ({ id: x, titulo: x, f: (m: Mesa) => m.zona === x }))]}
          columnas={[
            { clave: "numero", titulo: "Mesa", render: m => <strong>Mesa {m.numero}</strong>, texto: m => m.numero, orden: m => m.numero },
            { clave: "zona", titulo: "Zona", texto: m => m.zona, orden: m => m.zona },
            { clave: "capacidad", titulo: "Sillas", derecha: true, texto: m => m.capacidad, orden: m => m.capacidad },
            { clave: "forma", titulo: "Forma", texto: m => m.forma === "redonda" ? "Redonda" : "Rectangular" },
            { clave: "estado", titulo: "Estado", render: m => { const e = est(m); return <Badge tono={ESTADO_MESA[e].tono} icon={ICONO[e]}>{ESTADO_MESA[e].nombre}</Badge>; }, texto: m => ESTADO_MESA[est(m)].nombre, orden: m => est(m) },
            { clave: "mesero", titulo: "Mesero", texto: m => meseroDe(m.zona) },
            { clave: "consumo", titulo: "Consumo", derecha: true, texto: m => { const p = pedidoDe(m); return p ? bs(p.total) : "—"; } },
          ]}
          accion={{ titulo: "QR", icon: QrCode, onClick: setElegida }} onFila={setElegida}
          onExportar={(t, f, c) => exportarTabla(t, "Mesas", f, c, config)} />
      )}
      {elegida && <MesaModal m={mesas.find(x => x.id === elegida.id) || elegida} pedido={pedidoDe(elegida)} llamada={llamadas.find(l => l.mesa_id === elegida.id)} mesero={meseroDe(elegida.zona)} onClose={() => setElegida(null)} />}
    </div>
  );
}

function MesaModal({ m, pedido, llamada, mesero, onClose }: { m: Mesa; pedido?: Pedido; llamada?: Llamada; mesero: string; onClose: () => void }) {
  const { config } = useConfig();
  const { perfil } = useAuth();
  const avisar = useAvisar();
  const [renovar, setRenovar] = useState(false);
  const cajas = useRef<Record<string, HTMLDivElement | null>>({});
  const e = llamada ? "llamando" : pedido?.pidio_cuenta ? "cuenta" : pedido ? "ocupada" : "libre";
  const qrs: ["mesa" | "llamar", string, LucideIcon][] = [["mesa", "Pedido desde la mesa", Receipt], ["llamar", "Llamar al mesero", Bell]];

  async function atender() {
    const { error } = await supabase.from("llamadas").update({ atendida_por: perfil?.id, atendida_at: new Date().toISOString() }).eq("id", llamada!.id);
    if (error) avisar(mensajeError(error), "bad"); else avisar("Llamada atendida");
  }
  async function copiar(url: string) {
    try { await navigator.clipboard.writeText(url); avisar("Enlace copiado"); } catch { avisar("No se pudo copiar. Mantén presionado el enlace para copiarlo.", "bad"); }
  }
  function descargar(tipo: string) {
    const svg = cajas.current[tipo]?.querySelector("svg"); if (!svg) return;
    const img = new Image(), c = document.createElement("canvas"), n = 600;
    img.onload = () => { c.width = c.height = n; const x = c.getContext("2d")!; x.fillStyle = "#fff"; x.fillRect(0, 0, n, n); x.drawImage(img, 30, 30, n - 60, n - 60);
      const a = document.createElement("a"); a.href = c.toDataURL("image/png"); a.download = `qr-${tipo}-mesa-${m.numero}.png`; a.click(); };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(new XMLSerializer().serializeToString(svg))));
  }
  function imprimir(tipo: string, titulo: string) {
    const svg = cajas.current[tipo]?.querySelector("svg")?.outerHTML || "";
    abrirImpresion(`QR mesa ${m.numero}`, `<div style="text-align:center;padding:30px"><h1 style="font-size:28px">${config.nombre}</h1><p style="font-size:22px">Mesa ${m.numero} · ${titulo}</p><div style="width:320px;margin:20px auto">${svg.replace(/width="\d+"/, 'width="320"').replace(/height="\d+"/, 'height="320"')}</div><p>Escanea con la cámara de tu celular</p></div>`);
  }
  return (
    <Modal titulo={`Mesa ${m.numero} · ${m.zona}`} onClose={onClose} ancho={720}
      pie={<><Button variant="danger" icon={RefreshCw} onClick={() => setRenovar(true)}>Renovar QR</Button><span className="flex-1" /><Button variant="primary" onClick={onClose}>Listo</Button></>}>
      <div className="flex flex-wrap items-center gap-2.5">
        <Badge tono={ESTADO_MESA[e].tono} icon={ICONO[e]}>{ESTADO_MESA[e].nombre}</Badge>
        <span className="text-ink-3">{m.capacidad} sillas · {m.forma === "redonda" ? "redonda" : "rectangular"} · mesero: {mesero}</span>
      </div>
      {llamada && (
        <div className="flex flex-wrap items-center gap-3 rounded-md bg-info-soft px-3.5 py-3 text-info">
          <Bell size={20} /><div className="flex-1"><strong>Llamando: {llamada.motivo}</strong><p className="num text-sm">Hace {Math.max(1, minutosDesde(llamada.created_at))} min</p></div>
          <Button variant="primary" onClick={atender}>Atender</Button>
        </div>
      )}
      {pedido && <p className="text-sm">Pedido #{pedido.numero} abierto · <strong className="num">{bs(pedido.total)}</strong> · <a className="font-semibold text-brand-text underline" href={`/admin/pedidos?pedido=${pedido.id}`}>Ver pedido</a></p>}
      <div className="grid gap-4 sm:grid-cols-2">
        {qrs.map(([tipo, titulo, Ic]) => {
          const url = urlMesa(tipo, m);
          return (
            <div key={tipo} className="flex flex-col items-center gap-2.5 rounded-md border border-line p-4 text-center">
              <strong className="flex items-center gap-1.5"><Ic size={18} /> {titulo}</strong>
              <div ref={el => { cajas.current[tipo] = el; }}><QRCode texto={url} tamano={168} etiqueta={`QR ${titulo}, mesa ${m.numero}`} /></div>
              <code className="break-all text-xs text-ink-3">{url.replace(/^https?:\/\//, "")}</code>
              <div className="flex flex-wrap justify-center gap-1.5">
                <Button size="sm" icon={Copy} onClick={() => copiar(url)}>Copiar enlace</Button>
                <Button size="sm" icon={Download} onClick={() => descargar(tipo)}>Descargar</Button>
                <Button size="sm" icon={Printer} onClick={() => imprimir(tipo, titulo)}>Imprimir</Button>
              </div>
            </div>
          );
        })}
      </div>
      {renovar && <ConfirmDialog titulo="¿Renovar los QR de esta mesa?" peligro confirmar="Renovar" onClose={() => setRenovar(false)}
        texto={`Los QR impresos de la Mesa ${m.numero} dejarán de funcionar. Tendrás que imprimir y pegar los nuevos.`}
        onConfirm={async () => { const { error } = await supabase.rpc("renovar_qr_mesa", { p_mesa: m.id }); if (error) avisar(mensajeError(error), "bad"); else avisar(`QR de la Mesa ${m.numero} renovados. Imprime los nuevos.`); }} />}
    </Modal>
  );
}

// Hoja A4 con el QR de cada mesa (para pedir) y el logo
function imprimirTodos(mesas: Mesa[], nombre: string) {
  const c = document.createElement("div");
  c.style.position = "fixed"; c.style.left = "-9999px"; document.body.appendChild(c);
  import("react-dom/client").then(({ createRoot }) => {
    const raiz = createRoot(c);
    raiz.render(<>{mesas.map(m => <div key={m.id} data-n={m.numero}><QRCode texto={urlMesa("mesa", m)} tamano={130} etiqueta="" /></div>)}</>);
    setTimeout(() => {
      const celdas = [...c.querySelectorAll<HTMLElement>("[data-n]")].map(d => `<div style="border:1px dashed #C9C2B5;border-radius:8px;padding:10px;text-align:center;break-inside:avoid"><strong style="font-size:15px">${nombre} · Mesa ${d.dataset.n}</strong>${d.querySelector("svg")?.outerHTML || ""}<div>Escanea y pide</div></div>`).join("");
      abrirImpresion("QR de todas las mesas", `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">${celdas}</div>`);
      raiz.unmount(); c.remove();
    }, 150);
  });
}
