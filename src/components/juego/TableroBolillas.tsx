// Tablero del 1 al 90 con las bolillas que ya salieron, como el tablero
// luminoso de un salón de bingo. Es lo que mira la gente para controlar su
// cartón cuando se le pasó un número.

import { TOTAL_BOLILLAS } from "../../core/index.ts";
import type { Tono } from "./DatosGanador.tsx";

const NUMEROS = Array.from({ length: TOTAL_BOLILLAS }, (_, i) => i + 1);

export function TableroBolillas({
  bolillas,
  tono,
}: {
  /** Bolillas salidas, en orden de salida (la última se destaca). */
  bolillas: readonly number[];
  tono: Tono;
}) {
  const escenario = tono === "escenario";
  const salidas = new Set(bolillas);
  const ultima = bolillas[bolillas.length - 1];
  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <h3
          className={
            escenario
              ? "text-sm font-semibold uppercase tracking-wide text-marca-200"
              : "text-sm font-semibold text-slate-600"
          }
        >
          Tablero
        </h3>
        <span
          className={
            escenario ? "text-sm text-marca-100" : "text-sm text-slate-500"
          }
        >
          <strong className={escenario ? "text-white" : "text-slate-700"}>
            {bolillas.length}
          </strong>{" "}
          / {TOTAL_BOLILLAS} bolillas
        </span>
      </div>
      {/* Diez por fila, como los tableros de salón: cada fila es una decena. */}
      <ol className="grid grid-cols-10 gap-1" aria-label="Bolillas del 1 al 90">
        {NUMEROS.map((n) => {
          const salio = salidas.has(n);
          return (
            <li
              key={n}
              data-salio={salio || undefined}
              aria-label={salio ? `${n}, salió` : `${n}`}
              className={[
                "flex aspect-square items-center justify-center rounded font-bold tabular-nums",
                escenario ? "text-sm sm:text-base" : "text-[11px] sm:text-xs",
                // Proyectado, azul sobre azul no se distinguía desde el fondo
                // del salón: las que salieron van en blanco.
                salio
                  ? escenario
                    ? "bg-white text-marca-900"
                    : "bg-marca-600 text-white"
                  : escenario
                    ? "bg-marca-800 text-marca-200"
                    : "bg-slate-100 text-slate-400",
                n === ultima ? "ring-2 ring-amber-400 ring-offset-1" : "",
              ].join(" ")}
            >
              {n}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
