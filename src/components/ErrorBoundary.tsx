// Si una pantalla falla, se muestra qué pasó y un botón para reintentar, en vez de una página en blanco (B2).
import { Component, type ReactNode } from "react";

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main role="alert" className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-xl font-extrabold">Algo falló en esta pantalla</h1>
        <p className="text-ink-2">Recarga la página. Si vuelve a pasar, copia este mensaje y envíalo a soporte:</p>
        <code className="max-w-full overflow-auto rounded-sm bg-surface-2 px-3 py-2 text-sm">{this.state.error.message}</code>
        <button type="button" onClick={() => location.reload()} className="min-h-11 rounded-sm bg-brand px-4 font-semibold text-on-brand">Recargar</button>
      </main>
    );
  }
}
