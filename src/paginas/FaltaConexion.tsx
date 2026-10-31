// Se muestra si todavía no existe el archivo .env con los datos de Supabase.
import { PlugZap } from "lucide-react";
import { LogoIcono } from "@/components/ui";

export function FaltaConexion() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-5 p-6">
      <LogoIcono tamano={56} />
      <h1 className="flex items-center gap-2 text-xl font-extrabold"><PlugZap aria-hidden="true" /> Falta conectar Supabase</h1>
      <p className="text-ink-2">La app todavía no sabe a qué base de datos conectarse. Haz esto una sola vez:</p>
      <ol className="flex list-decimal flex-col gap-2 pl-5 text-ink-2">
        <li>En la carpeta del proyecto, copia el archivo <code className="rounded bg-surface-2 px-1">.env.example</code> y llámalo <code className="rounded bg-surface-2 px-1">.env</code>.</li>
        <li>En Supabase entra a <strong>Project Settings › API Keys</strong> y copia la <strong>Project URL</strong> y la <strong>anon public key</strong>.</li>
        <li>Pégalas en el archivo <code className="rounded bg-surface-2 px-1">.env</code> y guarda.</li>
        <li>Detén la app (Ctrl + C) y vuelve a abrirla con <code className="rounded bg-surface-2 px-1">npm run dev</code>.</li>
      </ol>
      <p className="text-sm text-ink-3">En Netlify, las mismas dos variables van en Site configuration › Environment variables.</p>
    </main>
  );
}
