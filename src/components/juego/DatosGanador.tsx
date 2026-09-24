import type { Premio } from "../../lib/premios.ts";

/**
 * Dónde se está mostrando algo: en la tarjeta del panel o en la pantalla
 * completa que se proyecta en el salón. Solo cambia la escala y la paleta.
 */
export type Tono = "tarjeta" | "escenario";

/** N° de cartón con los ceros adelante, como está impreso en el talón. */
export const fmtCarton = (n: number) => String(n).padStart(6, "0");

/**
 * El bloque de un ganador: N°, comprador y teléfono.
 *
 * Es el mismo contenido en la tarjeta y en la pantalla completa, así que va en
 * un solo lugar: si fueran dos copias, el día que cambie qué se canta habría
 * que acordarse de tocar las dos. `premio` en null es "todavía girando": se ve
 * el N° cambiando y nada más.
 *
 * `compacto` es para los empates: con varios ganadores a la vez, el N° a
 * tamaño completo no entra en la pantalla.
 */
export function DatosGanador({
  premio,
  numero,
  aterrizando,
  tono,
  compacto = false,
}: {
  premio: Premio | null;
  numero: number;
  aterrizando: boolean;
  tono: Tono;
  compacto?: boolean;
}) {
  const escenario = tono === "escenario";
  const tamanoNumero = compacto
    ? escenario
      ? "text-5xl sm:text-6xl"
      : "text-3xl"
    : escenario
      ? "text-7xl sm:text-9xl"
      : "text-5xl";
  return (
    <div className="flex flex-col items-center gap-1">
      <span
        className={[
          "font-mono font-extrabold leading-none tabular-nums",
          tamanoNumero,
          escenario ? "text-white" : "text-marca-900",
          "transition-transform duration-500 ease-out motion-reduce:transition-none",
          aterrizando ? "scale-125" : "scale-100",
        ].join(" ")}
      >
        {fmtCarton(numero)}
      </span>
      {premio && (
        <>
          <span
            className={
              escenario
                ? "text-3xl font-bold text-white sm:text-4xl"
                : "text-2xl font-bold text-slate-800"
            }
          >
            {premio.comprador || "(sin nombre)"}
          </span>
          {premio.telefono && (
            <span
              className={
                escenario ? "text-xl text-marca-100" : "text-lg text-slate-600"
              }
            >
              {premio.telefono}
            </span>
          )}
        </>
      )}
    </div>
  );
}
