// Mapa con OpenStreetMap (Leaflet, sin API de pago). Lo usan Delivery y el carrito de la tienda.
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin } from "lucide-react";

// Mapa con OpenStreetMap. La dirección se ubica con Nominatim (gratis) y se guarda en este celular para no repetir la búsqueda.
export function Mapa({ direccion, ciudad, alto }: { direccion: string | null; ciudad: string | null; alto?: string }) {
  const caja = useRef<HTMLDivElement>(null);
  const [estado, setEstado] = useState<"buscando" | "ok" | "no">("buscando");
  useEffect(() => {
    if (!caja.current) return;
    const centro: [number, number] = [-17.7833, -63.1821]; // Santa Cruz de la Sierra
    const mapa = L.map(caja.current, { zoomControl: false, attributionControl: true }).setView(centro, 13);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(mapa);
    let vivo = true;
    (async () => {
      if (!direccion) { setEstado("no"); return; }
      const q = `${direccion}, ${ciudad || "Santa Cruz de la Sierra, Bolivia"}`;
      const clave = "restobar-geo-" + q;
      let pos: [number, number] | null = null;
      try { pos = JSON.parse(localStorage.getItem(clave) || "null"); } catch { /* nada */ }
      if (!pos) {
        try {
          const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=bo&q=${encodeURIComponent(q)}`, { headers: { "Accept-Language": "es" } });
          const d = await r.json();
          if (d[0]) { pos = [Number(d[0].lat), Number(d[0].lon)]; localStorage.setItem(clave, JSON.stringify(pos)); }
        } catch { /* sin internet */ }
      }
      if (!vivo) return;
      if (pos) { mapa.setView(pos, 16); L.circleMarker(pos, { radius: 11, color: "#fff", weight: 3, fillColor: "#C94F1E", fillOpacity: 1 }).addTo(mapa); setEstado("ok"); }
      else setEstado("no");
    })();
    return () => { vivo = false; mapa.remove(); };
  }, [direccion, ciudad]);
  return (
    <div className={"relative w-full bg-surface-2 " + (alto || "h-[200px]")}>
      <div ref={caja} className="h-full w-full" role="img" aria-label={direccion ? `Mapa de la entrega: ${direccion}` : "Mapa sin dirección"} />
      {estado !== "ok" && <span className="pointer-events-none absolute bottom-2 left-2 z-[400] flex items-center gap-1.5 rounded-sm bg-surface px-2 py-1 text-xs text-ink-2 shadow-1"><MapPin size={14} />{estado === "buscando" ? "Buscando la dirección…" : "No encontré la dirección en el mapa. Usa «Abrir en Maps»."}</span>}
    </div>
  );
}
