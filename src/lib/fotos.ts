// Fotos (B6.2 Productos › Fotos): se recortan al centro (4:3 o 1:1), se achican y se comprimen antes de subirlas.
import { supabase } from "./supabase";

export async function comprimir(archivo: File, proporcion = 4 / 3, ancho = 1200, calidad = 0.82): Promise<Blob> {
  const url = URL.createObjectURL(archivo);
  try {
    const img = await new Promise<HTMLImageElement>((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => mal(new Error("No se pudo leer la imagen. Usa una foto JPG o PNG.")); i.src = url; });
    // Recorte centrado a la proporción pedida
    let sw = img.naturalWidth, sh = img.naturalHeight;
    if (sw / sh > proporcion) sw = sh * proporcion; else sh = sw / proporcion;
    const sx = (img.naturalWidth - sw) / 2, sy = (img.naturalHeight - sh) / 2;
    const w = Math.min(ancho, Math.round(sw)), h = Math.round(w / proporcion);
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    c.getContext("2d")!.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
    const blob = await new Promise<Blob | null>(ok => c.toBlob(ok, "image/webp", calidad));
    if (blob) return blob;
    return await new Promise<Blob>((ok, mal) => c.toBlob(b => b ? ok(b) : mal(new Error("No se pudo comprimir la foto.")), "image/jpeg", calidad));
  } finally { URL.revokeObjectURL(url); }
}

/** Sube una foto comprimida a un bucket público y devuelve su dirección pública. */
export async function subirFoto(bucket: "productos" | "marca", carpeta: string, nombre: string, archivo: File, proporcion = 4 / 3): Promise<string> {
  const blob = await comprimir(archivo, proporcion);
  const ext = blob.type === "image/webp" ? "webp" : "jpg";
  const ruta = `${carpeta}/${nombre}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(ruta, blob, { contentType: blob.type, upsert: true, cacheControl: "31536000" });
  if (error) throw error;
  return supabase.storage.from(bucket).getPublicUrl(ruta).data.publicUrl;
}

/** Comprobantes (bucket privado): fotos de facturas de compra y de entregas. Devuelve la ruta guardada. */
export async function subirComprobante(carpeta: string, nombre: string, archivo: File): Promise<string> {
  const esPdf = archivo.type === "application/pdf";
  const blob = esPdf ? archivo : await comprimir(archivo, 3 / 4, 1600, 0.85);
  const ruta = `${carpeta}/${nombre}-${Date.now()}.${esPdf ? "pdf" : blob.type === "image/webp" ? "webp" : "jpg"}`;
  const { error } = await supabase.storage.from("comprobantes").upload(ruta, blob, { contentType: blob.type, upsert: true });
  if (error) throw error;
  return ruta;
}
export async function verComprobante(ruta: string) {
  const { data, error } = await supabase.storage.from("comprobantes").createSignedUrl(ruta, 600);
  if (error) throw error;
  window.open(data.signedUrl, "_blank", "noopener");
}
