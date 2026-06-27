import { ConfigPanel } from "./components/ConfigPanel.tsx";
import { CartonPreview } from "./components/CartonPreview.tsx";
import { useBingo } from "./state/store.ts";

export default function App() {
  const preview = useBingo((s) => s.preview);
  const marca = useBingo((s) => s.marca);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-6 py-4">
          <h1 className="text-xl font-bold text-slate-800">
            🎱 Generador de Bingo 90
          </h1>
          <p className="text-sm text-slate-500">
            Generá cartones únicos y descargalos en PDF listos para imprimir.
          </p>
        </div>
      </header>

      {/* Contenido: config (izq) + preview (der) */}
      <main className="mx-auto grid max-w-5xl gap-6 px-6 py-8 md:grid-cols-[20rem_1fr]">
        <ConfigPanel />

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-slate-800">Vista previa</h2>
          <p className="text-sm text-slate-500">
            Así se ve el primer cartón del lote. Tocá “↻ Nueva” para ver otra
            variación.
          </p>
          <div className="rounded-xl border border-slate-200 bg-slate-100 p-6">
            <CartonPreview carton={preview} marca={marca} />
          </div>
        </section>
      </main>
    </div>
  );
}
