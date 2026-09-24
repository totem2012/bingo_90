// El bolillero animado: un bombo con bolillas que gira mientras se "mezcla" y
// la bolilla que sale, que cae y rebota.
//
// Es solo visual. Qué bolilla sale lo decide el store al final de la
// animación (ver PanelJuego), igual que en el sorteo: si la animación eligiera
// el número, cortarla a la mitad (cambiar de pestaña, desmontar) podría dejar
// una bolilla mostrada que nunca se guardó.

import type { Tono } from "./DatosGanador.tsx";

/** Una bolilla con su número. */
export function Bolilla({
  numero,
  tamano,
  destacada = false,
}: {
  numero: number;
  tamano: "chica" | "mediana" | "grande";
  destacada?: boolean;
}) {
  const medidas = {
    chica: "h-9 w-9 text-sm ring-2",
    mediana: "h-14 w-14 text-xl ring-4",
    grande: "h-32 w-32 text-6xl ring-8 sm:h-40 sm:w-40 sm:text-7xl",
  }[tamano];
  return (
    <span
      className={[
        "inline-flex shrink-0 items-center justify-center rounded-full font-extrabold tabular-nums shadow-md",
        medidas,
        destacada
          ? "bg-white text-marca-900 ring-marca-600"
          : "bg-white text-slate-700 ring-slate-300",
      ].join(" ")}
    >
      {numero}
    </span>
  );
}

/** Posiciones de las bolillas decorativas dentro del bombo (en % del bombo). */
const ADENTRO: readonly [number, number][] = [
  [22, 30], [48, 18], [72, 32], [30, 58], [56, 50], [76, 64],
  [40, 78], [62, 80], [18, 70], [84, 46],
];

export function Bolillero({
  girando,
  numeroVisible,
  ultimas,
  tono,
}: {
  /** Si el bombo está mezclando (dura lo que la animación de PanelJuego). */
  girando: boolean;
  /** Bolilla que se muestra en la boca: la que va pasando o la que salió. */
  numeroVisible: number | null;
  /** Las anteriores a la última, de la más nueva a la más vieja. */
  ultimas: readonly number[];
  tono: Tono;
}) {
  const escenario = tono === "escenario";
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-6">
        {/* Bombo */}
        <div
          aria-hidden="true"
          className={[
            "relative shrink-0 rounded-full border-4",
            escenario
              ? "h-32 w-32 border-marca-200 bg-marca-800 sm:h-40 sm:w-40"
              : "h-24 w-24 border-marca-200 bg-marca-50",
            girando ? "animate-bombo-gira motion-reduce:animate-none" : "",
          ].join(" ")}
        >
          {ADENTRO.map(([x, y], i) => (
            <span
              key={i}
              className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow ring-1 ring-marca-500"
              style={{ left: `${x}%`, top: `${y}%` }}
            />
          ))}
        </div>

        {/* Boca: la bolilla que sale. El `key` hace que la animación de
            caída se repita con cada bolilla nueva y no solo la primera vez. */}
        <div
          className={[
            "flex items-center justify-center",
            escenario ? "h-40 w-40 sm:h-48 sm:w-48" : "h-32 w-32",
          ].join(" ")}
          aria-live="polite"
        >
          {numeroVisible !== null ? (
            <span
              key={girando ? "girando" : numeroVisible}
              className={
                girando
                  ? "opacity-60"
                  : "animate-bolilla-sale motion-reduce:animate-none"
              }
            >
              <Bolilla
                numero={numeroVisible}
                tamano={escenario ? "grande" : "mediana"}
                destacada={!girando}
              />
            </span>
          ) : (
            <span
              className={
                escenario ? "text-lg text-marca-200" : "text-sm text-slate-400"
              }
            >
              Todavía no salió ninguna
            </span>
          )}
        </div>
      </div>

      {ultimas.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span
            className={
              escenario ? "text-sm text-marca-200" : "text-xs text-slate-500"
            }
          >
            Anteriores:
          </span>
          {ultimas.map((n) => (
            <Bolilla key={n} numero={n} tamano="chica" />
          ))}
        </div>
      )}
    </div>
  );
}
