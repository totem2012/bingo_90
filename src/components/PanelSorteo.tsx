// Sorteo del ganador entre los cartones vendidos.
//
// Los cartones que ya ganaron salen del bombo, así se pueden sortear varios
// premios seguidos (1ro, 2do, 3ro…) sin que se repita nadie.

import { useEffect, useRef, useState } from "react";
import { generarLote, elegibles, type Carton } from "../core/index.ts";
import { useBingo } from "../state/store.ts";
import { CartonPreview } from "./CartonPreview.tsx";

/** Cuánto dura la animación de "bombo girando" antes de frenar. */
const DURACION_SORTEO = 1500;
const PASO_ANIMACION = 70;

const fmt = (n: number) => String(n).padStart(6, "0");

/** Clases del N° ganador. `aterrizando` lo deja agrandado un instante. */
function claseNumero(aterrizando: boolean, tamano: string): string {
  return [
    "font-mono font-extrabold tabular-nums text-marca-900",
    tamano,
    "transition-transform duration-500 ease-out motion-reduce:transition-none",
    aterrizando ? "scale-125" : "scale-100",
  ].join(" ");
}

export function PanelSorteo() {
  const ventas = useBingo((s) => s.ventas);
  const premios = useBingo((s) => s.premios);
  const semilla = useBingo((s) => s.semilla);
  const marca = useBingo((s) => s.marca);
  const ultimoGanador = useBingo((s) => s.ultimoGanador);
  const sortearGanador = useBingo((s) => s.sortearGanador);
  const deshacerPremio = useBingo((s) => s.deshacerPremio);
  const borrarPremios = useBingo((s) => s.borrarPremios);

  const [descripcion, setDescripcion] = useState("");
  const [girando, setGirando] = useState(false);
  const [numeroVisible, setNumeroVisible] = useState<number | null>(null);
  const [cartonGanador, setCartonGanador] = useState<Carton | null>(null);
  // Pantalla completa para cantar el premio en el salón: el número y el nombre
  // se leen de lejos, muchas veces proyectados.
  const [pantallaCompleta, setPantallaCompleta] = useState(false);
  // El cartón para cotejar contra el papel también tiene que poder verse desde
  // la pantalla completa; si no, cantar el premio obligaría a salir.
  const [verCarton, setVerCarton] = useState(false);
  // Golpe de escala al frenar la ruleta: la animación dura 1,5 s para generar
  // expectativa y terminaba en un corte seco.
  const [aterrizando, setAterrizando] = useState(false);
  const timers = useRef<{ intervalo?: number; fin?: number; pop?: number }>({});

  // Limpiamos los timers si el componente se desmonta a mitad del sorteo.
  useEffect(() => {
    return () => {
      if (timers.current.intervalo) clearInterval(timers.current.intervalo);
      if (timers.current.fin) clearTimeout(timers.current.fin);
      if (timers.current.pop) clearTimeout(timers.current.pop);
    };
  }, []);

  // Salir de la pantalla completa con Escape, como cualquier modal.
  useEffect(() => {
    if (!pantallaCompleta) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPantallaCompleta(false);
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [pantallaCompleta]);

  const enJuego = elegibles(
    ventas.map((v) => v.numero),
    premios.map((p) => p.numero),
  );

  /**
   * Regenera el cartón ganador para poder cotejarlo contra el papel.
   * Como la secuencia es determinista, alcanza con la semilla y el N°.
   *
   * Es O(n): `generarLote` recorre la secuencia desde el principio, porque eso
   * es justamente lo que garantiza que las tiradas no se pisen. Medido: 2 ms en
   * el cartón 200, 52 ms en el 5.000, 181 ms en el 20.000. Se llama una sola
   * vez por premio y justo después de los 1,5 s de animación del bombo, así
   * que no se percibe. Cachear no serviría: el ganador sale del bombo, con lo
   * cual nunca se pide dos veces el mismo N°.
   */
  function cartonDe(numero: number): Carton | null {
    try {
      return generarLote({ cantidad: 1, semilla, desde: numero }).cartones[0];
    } catch {
      return null;
    }
  }

  function sortear() {
    if (enJuego.length === 0 || girando) return;

    setGirando(true);
    setCartonGanador(null);

    // Ruleta visual: vamos mostrando N° al azar del bombo mientras "gira".
    timers.current.intervalo = window.setInterval(() => {
      setNumeroVisible(enJuego[Math.floor(Math.random() * enJuego.length)]);
    }, PASO_ANIMACION);

    timers.current.fin = window.setTimeout(() => {
      if (timers.current.intervalo) clearInterval(timers.current.intervalo);
      // El ganador real lo decide el store, no la animación.
      const premio = sortearGanador(descripcion);
      if (premio) {
        setNumeroVisible(premio.numero);
        setCartonGanador(cartonDe(premio.numero));
        // Arranca agrandado y vuelve a su tamaño: el número "cae" en lugar de
        // aparecer de golpe. Es una transición, no una animación con
        // keyframes, para que `motion-reduce` la anule sola.
        setAterrizando(true);
        timers.current.pop = window.setTimeout(() => setAterrizando(false), 30);
      }
      setGirando(false);
      setDescripcion("");
    }, DURACION_SORTEO);
  }

  const fmtFecha = (iso: string) =>
    new Date(iso).toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    });

  return (
    <div className="flex flex-col gap-6">
      {/* ── Control del sorteo ── */}
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-800">Sorteo</h2>
          <span className="text-sm text-slate-500">
            <strong className="text-slate-700">{enJuego.length}</strong> cartones
            en el bombo
          </span>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-600">
            Premio <span className="font-normal text-slate-500">(opcional)</span>
          </span>
          <input
            type="text"
            value={descripcion}
            maxLength={60}
            placeholder="Ej: Bicicleta"
            disabled={girando}
            onChange={(e) => setDescripcion(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-marca-500 focus:ring-2 focus:ring-marca-100 disabled:bg-slate-50"
          />
        </label>

        <button
          type="button"
          onClick={sortear}
          disabled={enJuego.length === 0 || girando}
          className="rounded-lg bg-marca-600 px-4 py-4 text-lg font-bold text-white shadow-sm transition hover:bg-marca-700 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-marca-500 focus-visible:ring-offset-2"
        >
          {girando ? "Sorteando…" : "🎲 Sortear ganador"}
        </button>

        {ventas.length === 0 && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Todavía no cargaste ningún cartón vendido. Cargalos arriba para poder
            sortear.
          </p>
        )}
        {ventas.length > 0 && enJuego.length === 0 && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Todos los cartones vendidos ya ganaron un premio.
          </p>
        )}
      </div>

      {/* ── Resultado ── */}
      {(girando || ultimoGanador) && numeroVisible !== null && (
        <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-marca-600 bg-marca-50 p-6 text-center">
          <span className="text-sm font-semibold uppercase tracking-wide text-marca-700">
            {girando ? "Sorteando…" : "Ganador"}
          </span>
          {/* El premio es la mitad de lo que se canta ("¡Bicicleta para el
              000175!"), así que va grande y no en la línea chica de arriba. */}
          {!girando && ultimoGanador?.descripcion && (
            <span className="text-3xl font-bold text-marca-800">
              {ultimoGanador.descripcion}
            </span>
          )}
          <span className={claseNumero(aterrizando, "text-5xl")}>
            {fmt(numeroVisible)}
          </span>
          {!girando && ultimoGanador && (
            <>
              <span className="text-2xl font-bold text-slate-800">
                {ultimoGanador.comprador || "(sin nombre)"}
              </span>
              {ultimoGanador.telefono && (
                <span className="text-lg text-slate-600">
                  {ultimoGanador.telefono}
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  setVerCarton(false);
                  setPantallaCompleta(true);
                }}
                className="mt-2 rounded-md border border-marca-600 px-3 py-1.5 text-sm font-medium text-marca-700 hover:bg-marca-100 focus-visible:ring-2 focus-visible:ring-marca-500 focus-visible:ring-offset-2"
                title="Mostrarlo grande para cantarlo en el salón"
              >
                ⛶ Pantalla completa
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Pantalla completa para cantar el premio ──
          Esta app termina en un salón con gente mirando: el número y el nombre
          tienen que leerse de lejos, muchas veces proyectados. Va sobrio a
          propósito —fondo plano, tipografía grande, nada de efectos— porque lo
          que importa es que se lea. */}
      {pantallaCompleta && ultimoGanador && numeroVisible !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Ganador"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 overflow-auto bg-marca-900 p-6 text-center"
        >
          {ultimoGanador.descripcion && (
            <span className="text-4xl font-semibold text-marca-100 sm:text-5xl">
              {ultimoGanador.descripcion}
            </span>
          )}
          <span
            className={[
              "font-mono text-7xl font-extrabold leading-none tabular-nums text-white sm:text-9xl",
              "transition-transform duration-500 ease-out motion-reduce:transition-none",
              aterrizando ? "scale-125" : "scale-100",
            ].join(" ")}
          >
            {fmt(numeroVisible)}
          </span>
          <span className="text-3xl font-bold text-white sm:text-4xl">
            {ultimoGanador.comprador || "(sin nombre)"}
          </span>
          {ultimoGanador.telefono && (
            <span className="text-xl text-marca-100">{ultimoGanador.telefono}</span>
          )}

          {/* El cotejo contra el papel es la parte funcional de esta pantalla:
              tiene que seguir a mano sin salir. */}
          {verCarton && cartonGanador && (
            <div className="w-full max-w-md rounded-xl bg-white p-4 text-left">
              <CartonPreview
                carton={cartonGanador}
                marca={marca}
                numero={ultimoGanador.numero}
              />
            </div>
          )}

          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            {cartonGanador && (
              <button
                type="button"
                onClick={() => setVerCarton((v) => !v)}
                className="rounded-md border border-marca-200 px-3 py-1.5 text-sm font-medium text-marca-100 hover:bg-marca-800 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-marca-900"
              >
                {verCarton ? "Ocultar cartón" : "Ver cartón"}
              </button>
            )}
            <button
              type="button"
              onClick={() => setPantallaCompleta(false)}
              className="rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-marca-900 hover:bg-marca-50 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-marca-900"
            >
              Salir (Esc)
            </button>
          </div>
        </div>
      )}

      {/* ── Cartón ganador, para cotejar contra el papel ── */}
      {!girando && cartonGanador && ultimoGanador && (
        <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-100 p-6">
          <h3 className="text-sm font-semibold text-slate-600">
            Cartón ganador — compará con el papel
          </h3>
          <CartonPreview
            carton={cartonGanador}
            marca={marca}
            numero={ultimoGanador.numero}
          />
        </div>
      )}

      {/* ── Historial de premios ── */}
      {premios.length > 0 && (
        <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-600">
            Premios sorteados
          </h3>
          <ul className="flex flex-col gap-1">
            {premios.map((p) => (
              <li
                key={p.orden}
                className="flex items-baseline justify-between gap-2 border-b border-slate-100 py-1.5 text-sm last:border-0"
              >
                <span className="min-w-0 flex-1 truncate text-slate-700">
                  <strong>{p.orden}°</strong>{" "}
                  {p.descripcion && (
                    <span className="text-slate-500">{p.descripcion} — </span>
                  )}
                  {p.comprador || "(sin nombre)"}
                </span>
                <span className="shrink-0 font-mono text-xs text-slate-500">
                  N° {p.numero} · {fmtFecha(p.fecha)}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                deshacerPremio();
                setNumeroVisible(null);
                setCartonGanador(null);
              }}
              className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:border-slate-400 focus-visible:ring-2 focus-visible:ring-marca-500 focus-visible:ring-offset-2"
              title="El cartón vuelve al bombo"
            >
              ↶ Deshacer último
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirm("¿Borrar todos los premios sorteados?")) {
                  borrarPremios();
                  setNumeroVisible(null);
                  setCartonGanador(null);
                }
              }}
              className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-rose-600 hover:border-rose-400 focus-visible:ring-2 focus-visible:ring-marca-500 focus-visible:ring-offset-2"
            >
              Reiniciar sorteos
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
