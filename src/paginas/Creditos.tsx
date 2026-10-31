// Créditos de las fotos (página pública). Las licencias libres piden citar al autor y la licencia.
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useTitulo } from "@/lib/config";
import { CREDITOS_FOTOS } from "@/lib/creditosFotos";
import { Logo } from "@/components/ui";

export function Creditos() {
  useTitulo("Créditos de las fotos");
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-8">
      <Link to="/" className="inline-flex items-center gap-1.5 self-start text-sm font-semibold text-ink-3 hover:text-ink"><ArrowLeft size={16} /> Volver</Link>
      <Logo />
      <h1 className="text-xl font-extrabold">Créditos de las fotos</h1>
      <p className="text-ink-2">Estas fotos son de Wikimedia Commons y se usan con licencia libre. Fueron recortadas a 4:3 y reducidas. Las que tienen licencia CC BY-SA se comparten con esa misma licencia.</p>
      <div className="overflow-x-auto rounded-md bg-surface shadow-1">
        <table className="w-full min-w-[520px] text-[15px]">
          <thead><tr className="bg-surface-2 text-left text-[13px] text-ink-3"><th className="px-3 py-2.5 font-semibold">Plato</th><th className="px-3 font-semibold">Autor</th><th className="px-3 font-semibold">Licencia</th></tr></thead>
          <tbody>{CREDITOS_FOTOS.map(c => (
            <tr key={c.codigo} className="border-t border-line">
              <td className="px-3 py-2">{c.plato}</td>
              <td className="px-3 py-2"><a href={c.fuente} target="_blank" rel="noopener" className="text-brand-text underline">{c.autor}</a></td>
              <td className="px-3 py-2"><a href={c.licenciaUrl} target="_blank" rel="noopener" className="text-brand-text underline">{c.licencia}</a></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </main>
  );
}
