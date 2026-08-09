import { useState } from "react";
import { ConfigPanel } from "./components/ConfigPanel.tsx";
import { CartonPreview } from "./components/CartonPreview.tsx";
import { PanelVentas } from "./components/PanelVentas.tsx";
import { PanelSorteo } from "./components/PanelSorteo.tsx";
import { useBingo } from "./state/store.ts";

type Vista = "generar" | "sorteo";

const PESTANAS: { id: Vista; etiqueta: string }[] = [
  { id: "generar", etiqueta: "Generar cartones" },
  { id: "sorteo", etiqueta: "Ventas y sorteo" },
];

export default function App() {
  const preview = useBingo((s) => s.preview);
  const marca = useBingo((s) => s.marca);
  const [vista, setVista] = useState<Vista>("generar");

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-6 py-4">
          <h1 className="text-xl font-bold text-slate-800">
            🎱 Generador de Bingo 90
          </h1>
          <p className="text-sm text-slate-500">
            Generá cartones únicos, registrá las ventas y sorteá el ganador.
          </p>

          {/* Pestañas */}
          <nav className="-mb-4 mt-4 flex gap-1">
            {PESTANAS.map(({ id, etiqueta }) => (
              <button
                key={id}
                type="button"
                onClick={() => setVista(id)}
                className={[
                  "rounded-t-lg border-b-2 px-4 py-2 text-sm font-medium transition",
                  vista === id
                    ? "border-marca-600 text-marca-700"
                    : "border-transparent text-slate-500 hover:text-slate-700",
                ].join(" ")}
              >
                {etiqueta}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {vista === "generar" ? (
        /* Config (izq) + preview (der) */
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
      ) : (
        /* Ventas (izq) + sorteo (der) */
        <main className="mx-auto grid max-w-5xl gap-6 px-6 py-8 md:grid-cols-[24rem_1fr]">
          <PanelVentas />
          <PanelSorteo />
        </main>
      )}
    </div>
  );
}
