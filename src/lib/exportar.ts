// Exportar e imprimir (B4): Excel (archivo .csv que Excel abre directo), PDF e impresión.
import type { Columna } from "@/components/DataTable";
import type { NegocioConfig, Pedido } from "./tipos";
import { bs, fecha, fechaHora, hora } from "./formato";

const escapar = (s: string) => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

function descargar(nombre: string, contenido: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = document.createElement("a");
  a.href = url; a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Abre una ventana lista para imprimir (o guardar como PDF desde el diálogo de impresión). */
export function abrirImpresion(titulo: string, cuerpo: string, ancho = "A4") {
  const v = window.open("", "_blank", "width=900,height=700");
  if (!v) { alert("El navegador bloqueó la ventana de impresión. Permite las ventanas emergentes para este sitio."); return; }
  v.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escapar(titulo)}</title>
  <style>@page{size:${ancho};margin:${ancho === "A4" ? "14mm" : "4mm"}}body{font:13px/1.4 "Hanken Grotesk",Arial,sans-serif;color:#10241B;margin:0}
  h1{font-size:18px;margin:0 0 4px}table{width:100%;border-collapse:collapse}th,td{padding:5px 6px;border-bottom:1px solid #ddd;text-align:left}
  th{background:#F3F2EC;font-size:12px}.der{text-align:right}.muted{color:#5B6159}.tot td{font-weight:700;border-top:2px solid #10241B}
  .ticket{width:72mm;font-size:12px}.ticket .c{text-align:center}.ticket hr{border:0;border-top:1px dashed #999}</style></head>
  <body>${cuerpo}<script>window.onload=()=>{window.print();}<\/script></body></html>`);
  v.document.close();
}

export function exportarTabla<T>(tipo: "excel" | "pdf" | "imprimir", titulo: string, filas: T[], columnas: Columna<T>[], config: NegocioConfig) {
  const cols = columnas.filter(c => c.titulo && c.texto);
  const valor = (c: Columna<T>, f: T) => String(c.texto!(f) ?? "");
  if (tipo === "excel") {
    const lineas = [
      [config.nombre], [titulo + " · " + fechaHora(Date.now())], [],
      cols.map(c => c.titulo), ...filas.map(f => cols.map(c => valor(c, f))),
    ].map(l => l.map(x => `"${String(x).replace(/"/g, '""')}"`).join(";"));
    // El BOM y el punto y coma hacen que Excel en español lo abra con tildes y en columnas
    descargar(`${titulo.toLowerCase().replace(/\s+/g, "-")}-${fecha(Date.now()).replace(/\//g, "-")}.csv`, "﻿" + lineas.join("\r\n"), "text/csv;charset=utf-8");
    return;
  }
  abrirImpresion(titulo, `<h1>${escapar(config.nombre)} · ${escapar(titulo)}</h1><p class="muted">${escapar(config.direccion || "")} · ${fechaHora(Date.now())} · ${filas.length} filas</p>
    <table><thead><tr>${cols.map(c => `<th class="${c.derecha ? "der" : ""}">${escapar(c.titulo)}</th>`).join("")}</tr></thead>
    <tbody>${filas.map(f => `<tr>${cols.map(c => `<td class="${c.derecha ? "der" : ""}">${escapar(valor(c, f))}</td>`).join("")}</tr>`).join("")}</tbody></table>`);
}

/** Ticket de 80 mm */
export function imprimirTicket(p: Pedido, config: NegocioConfig, mesa?: number) {
  const items = (p.pedido_items || []).map(i => `<tr><td>${i.cantidad} × ${escapar(i.nombre)}${i.nota ? `<br><span class="muted">${escapar(i.nota)}</span>` : ""}</td><td class="der">${bs(i.cantidad * i.precio_unitario, "")}</td></tr>`).join("");
  abrirImpresion(`Ticket ${p.numero}`, `<div class="ticket">
    <p class="c"><strong style="font-size:16px">${escapar(config.nombre)}</strong><br>${escapar(config.lema || "")}<br>${escapar(config.direccion || "")}<br>${escapar(config.ciudad || "")}${config.nit ? `<br>NIT ${escapar(config.nit)}` : ""}</p><hr>
    <p>Pedido #${p.numero} · ${fecha(p.created_at)} ${hora(p.created_at)}<br>${mesa ? `Mesa ${mesa}` : escapar(p.cliente || "")}</p><hr>
    <table>${items}
      ${p.envio ? `<tr><td>Envío</td><td class="der">${bs(p.envio, "")}</td></tr>` : ""}
      ${p.propina ? `<tr><td>Propina</td><td class="der">${bs(p.propina, "")}</td></tr>` : ""}
      <tr class="tot"><td>TOTAL</td><td class="der">${bs(p.total)}</td></tr></table><hr>
    <p class="c">¡Gracias por su visita! Vuelva pronto</p></div>`, "80mm auto");
}

/** Exporta una tabla simple (columnas de texto) a Excel o a impresión/PDF. */
export function exportarFilas(tipo: "excel" | "pdf", titulo: string, subtitulo: string, cols: string[], filas: (string | number)[][], config: NegocioConfig) {
  const columnas = cols.map((c, i) => ({ clave: String(i), titulo: c, texto: (f: (string | number)[]) => f[i], derecha: i > 0 && filas.some(f => typeof f[i] === "number" || /^(−?Bs |\d)/.test(String(f[i]))) }));
  exportarTabla(tipo, `${titulo} · ${subtitulo}`, filas, columnas as never, config);
}
