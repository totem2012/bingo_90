import { useState } from "react";
import { ConfigPanel } from "./components/ConfigPanel.tsx";
import { CartonPreview } from "./components/CartonPreview.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";
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
  const registrosDanados = useBingo((s) => s.registrosDanados);
  const datosIlegibles = useBingo((s) => s.datosIlegibles);
  const persistencia = useBingo((s) => s.persistencia);
  const ocultarAvisoDatos = useBingo((s) => s.ocultarAvisoDatos);
  const [vista, setVista] = useState<Vista>("generar");

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6">
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
                  "focus-visible:ring-2 focus-visible:ring-marca-500 focus-visible:ring-offset-2",
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

      {/*
        Este aviso no habla del pasado sino del futuro: mientras el navegador
        no guarde, todo lo que se imprima y se venda se pierde al cerrar la
        pestaña. Por eso va primero, en rojo y SIN botón para ocultarlo: los
        otros dos avisan algo que ya pasó y se pueden dar por enterados, este
        describe una situación que sigue activa y que todavía se puede
        prevenir exportando el respaldo.
      */}
      {persistencia !== "ok" && (
        <div className="border-b-2 border-rose-400 bg-rose-50">
          <div className="mx-auto flex max-w-5xl items-start gap-3 px-6 py-3">
            <span aria-hidden="true" className="text-lg leading-tight">
              🛑
            </span>
            <p className="flex-1 text-sm text-rose-900">
              {persistencia === "sin-storage" ? (
                <>
                  <strong className="font-semibold">
                    Este navegador no está guardando nada.
                  </strong>{" "}
                  Puede ser una ventana de incógnito o tener el almacenamiento
                  bloqueado. La app funciona igual, pero al cerrar la pestaña
                  se pierde la numeración de los cartones que imprimas y las
                  ventas que cargues.
                </>
              ) : (
                <>
                  <strong className="font-semibold">
                    No se pudo guardar lo último que hiciste.
                  </strong>{" "}
                  Puede que no quede espacio en el navegador. Lo que ves en
                  pantalla está bien, pero no quedó guardado: al cerrar la
                  pestaña se pierde.
                </>
              )}{" "}
              <strong className="font-semibold">
                Exportá el respaldo (.json) antes de cerrar
              </strong>{" "}
              y, si ya imprimiste, anotá hasta qué N° llegaste.
            </p>
          </div>
        </div>
      )}

      {/*
        Al leer la campaña se descarta lo que esté dañado para que la app pueda
        abrir igual (ver lib/registro.ts). Pero descartar una tirada BAJA el
        total impreso y la próxima tanda reimprimiría N° que quizás ya están
        vendidos, así que el descarte no puede pasar en silencio.
      */}
      {(datosIlegibles || registrosDanados > 0) && (
        <div className="border-b border-amber-300 bg-amber-50">
          <div className="mx-auto flex max-w-5xl items-start gap-3 px-6 py-3">
            <span aria-hidden="true" className="text-lg leading-tight">
              ⚠️
            </span>
            <p className="flex-1 text-sm text-amber-900">
              {datosIlegibles ? (
                <>
                  <strong className="font-semibold">
                    No se pudo leer lo que había guardado en este navegador.
                  </strong>{" "}
                  Puede haberse perdido el historial de tiradas, las ventas o
                  los premios de TODAS las campañas: lo que ves ahora puede
                  estar vacío sin estarlo de verdad. No generes una tirada
                  nueva hasta importar el archivo de respaldo (.json), porque
                  la numeración volvería a empezar y reimprimiría cartones ya
                  entregados.
                </>
              ) : (
                <>
                  <strong className="font-semibold">
                    {registrosDanados === 1
                      ? "Se descartó 1 registro dañado de esta campaña."
                      : `Se descartaron ${registrosDanados} registros dañados de esta campaña.`}
                  </strong>{" "}
                  Puede haber cambiado el total de cartones entregados, o
                  faltar ventas y premios. Revisá la numeración del historial
                  ANTES de generar la próxima tirada y, si tenés el archivo de
                  respaldo (.json), importalo para recuperar lo que falta.
                </>
              )}
            </p>
            <button
              type="button"
              onClick={ocultarAvisoDatos}
              className="shrink-0 rounded-md border border-amber-400 px-2 py-1 text-xs font-medium text-amber-900 hover:border-amber-600"
              title="Ocultar el aviso (no recupera lo descartado)"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {vista === "generar" ? (
        /* Config (izq) + preview (der) */
        <main className="mx-auto grid max-w-5xl gap-6 px-4 py-8 sm:px-6 md:grid-cols-[20rem_1fr]">
          <ConfigPanel />

          {/*
            `sticky` + `self-start`: la columna de configuración es mucho más
            alta que la vista previa, así que al scrollear para tocar color,
            título o logos el cartón se iba de pantalla justo cuando se quiere
            ver el efecto. `self-start` es imprescindible: sin él la sección se
            estira a todo el alto de la fila del grid y `sticky` no pega nada.

            En móvil no hay dos columnas: la vista previa va ARRIBA
            (`order-first`), porque abajo del formulario quedaba a ~1100px de
            scroll y se configuraba a ciegas. Pegada al tope no: en un teléfono
            se comería media pantalla mientras se escribe.
          */}
          <section className="order-first flex flex-col gap-3 md:order-none md:sticky md:top-6 md:self-start">
            <h2 className="text-lg font-semibold text-slate-800">Vista previa</h2>
            <p className="text-sm text-slate-500">
              Así se ve el primer cartón del lote. Tocá “↻ Nueva” para ver otra
              variación.
            </p>
            <div className="rounded-xl border border-slate-200 bg-slate-100 p-3 sm:p-6">
              {/*
                Boundary propio y más chico que el de la raíz: el cartón que se
                dibuja acá sale del generador, así que es de lo más expuesto a
                un valor con forma inesperada. Si revienta, que se pierda la
                vista previa y no la app entera: con el resto en pie el usuario
                todavía puede generar el PDF, cargar ventas y sortear.
              */}
              <ErrorBoundary
                nombre="la vista previa"
                fallback={(_error, reintentar) => (
                  <div className="flex flex-col items-start gap-2">
                    <p className="text-sm text-slate-600">
                      No se pudo dibujar este cartón. Es un problema de esta
                      vista, no de la tirada: el PDF se genera igual. Probá con
                      “↻ Nueva” para ver otra variación.
                    </p>
                    <button
                      type="button"
                      onClick={reintentar}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:border-slate-400 focus-visible:ring-2 focus-visible:ring-marca-500 focus-visible:ring-offset-2"
                    >
                      Reintentar
                    </button>
                  </div>
                )}
              >
                <CartonPreview carton={preview} marca={marca} />
              </ErrorBoundary>
            </div>
          </section>
        </main>
      ) : (
        /*
          Ventas (izq, ancha) + sorteo (der, angosta). Estaba al revés: la lista
          de ventas es la que tiene datos largos (nombre del comprador y del
          vendedor) y quedaba en la columna angosta, truncando justo el dato que
          hay que leer cuando se canta un número. El sorteo es un input, un
          botón y la lista de premios: entra cómodo en 24rem.
        */
        <main className="mx-auto flex max-w-5xl flex-col-reverse gap-6 px-4 py-8 sm:px-6 md:grid md:grid-cols-[1fr_24rem]">
          <PanelVentas />
          {/*
            En móvil el sorteo va PRIMERO: por eso el `<main>` es un
            `flex-col-reverse` que recién en `md` pasa a ser grid (donde el
            reverse no aplica y vuelve el orden de siempre, ventas a la
            izquierda). El README promete llevarse la campaña al celular para
            sortear desde ahí: esa persona está parada en un salón cantando
            números, no cargando ventas, y dejarlo abajo la obligaba a pasar por
            encima de la lista entera de cartones vendidos cada vez.
          */}
          <PanelSorteo />
        </main>
      )}
    </div>
  );
}
