import { useEffect, useState } from "react";

export type Tema = "auto" | "light" | "dark";
const CLAVE = "restobar-tema";

function aplicar(t: Tema) {
  if (t === "auto") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", t);
}

export function temaGuardado(): Tema {
  try { const v = localStorage.getItem(CLAVE); if (v === "light" || v === "dark" || v === "auto") return v; } catch { /* sin almacenamiento */ }
  return "auto";
}

// Apariencia: automática (sigue al celular o la computadora), clara u oscura
export function useTema(): [Tema, (t: Tema) => void] {
  const [tema, setTema] = useState<Tema>(temaGuardado);
  useEffect(() => {
    aplicar(tema);
    try { localStorage.setItem(CLAVE, tema); } catch { /* sin almacenamiento */ }
  }, [tema]);
  return [tema, setTema];
}

aplicar(temaGuardado());
