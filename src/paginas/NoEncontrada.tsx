import { Link } from "react-router-dom";
import { Logo } from "@/components/ui";
import { useTitulo } from "@/lib/config";

export function NoEncontrada() {
  useTitulo("Página no encontrada");
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 p-6 text-center">
      <Logo />
      <h1 className="text-xl font-extrabold">Esta página no existe</h1>
      <p className="text-ink-2">Puede que el enlace esté mal escrito o que la página haya cambiado de lugar.</p>
      <Link to="/" className="inline-flex min-h-11 items-center rounded-sm bg-brand px-4 font-semibold text-on-brand">Volver al inicio</Link>
    </main>
  );
}
