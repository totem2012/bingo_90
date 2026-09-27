// ─────────────────────────────────────────────────────────────────────────
// Reglas del JUEGO de la noche: bolillero y etapas.
//
// La noche sigue una secuencia fija de etapas (ver SECUENCIA). Tres se juegan
// con el bolillero (cuaterna, fila y cartón lleno) y las otras son sorteos al
// azar entre todos los vendidos. Las bolillas NO se reinician entre etapas:
// el sorteo solo frena el bolillero, y la fila se sigue jugando con las
// bolillas que salieron durante la cuaterna.
//
// Módulo PURO: no sabe de localStorage ni del DOM. El RNG es inyectable como
// en sorteo.ts, para que los tests sean predecibles.
// ─────────────────────────────────────────────────────────────────────────

import type { Rng } from "./rng.ts";
import type { Carton } from "./types.ts";

/** Formas de ganar un premio. */
export type Modalidad = "cuaterna" | "fila" | "lleno" | "sorteo";

/** Modalidades que se juegan con el bolillero (las demás son sorteos). */
export type ModalidadBolillero = Exclude<Modalidad, "sorteo">;

/** Orden de las etapas de la noche. El índice es el `etapa` de cada premio. */
export const SECUENCIA: readonly Modalidad[] = [
  "cuaterna",
  "sorteo",
  "fila",
  "sorteo",
  "lleno",
];

/**
 * Nombre para mostrar de cada modalidad. Las claves internas siguen siendo
 * "cuaterna" y "fila" porque se guardan en el navegador y en los respaldos;
 * lo que ve el público es "Cuaterno" y "Línea".
 */
export const NOMBRE_MODALIDAD: Record<Modalidad, string> = {
  cuaterna: "Cuaterno",
  fila: "Línea",
  lleno: "Cartón lleno",
  sorteo: "Sorteo",
};

/** Bolilla más alta del bolillero (hay una por cada número del 1 al 90). */
export const TOTAL_BOLILLAS = 90;

export function esModalidadBolillero(m: Modalidad): m is ModalidadBolillero {
  return m !== "sorteo";
}

/**
 * ¿El cartón gana la modalidad con las bolillas que salieron?
 *
 * - Cuaterna: 4 números salidos en CUALQUIER parte del cartón (no hace falta
 *   que estén en la misma fila; así lo juega el cliente).
 * - Fila: una fila horizontal completa (sus 5 números).
 * - Cartón lleno: los 15 números.
 */
export function cumple(
  carton: Carton,
  salidas: ReadonlySet<number>,
  modalidad: ModalidadBolillero,
): boolean {
  const porFila = carton.filas.map(
    (fila) => fila.filter((c) => c !== null && salidas.has(c)).length,
  );
  const total = porFila.reduce((a, b) => a + b, 0);
  switch (modalidad) {
    case "cuaterna":
      return total >= 4;
    case "fila":
      return carton.filas.some(
        (fila, i) => porFila[i] === fila.filter((c) => c !== null).length,
      );
    case "lleno":
      return carton.filas.every(
        (fila, i) => porFila[i] === fila.filter((c) => c !== null).length,
      );
  }
}

/** Un cartón vendido con su N°, listo para revisar si ganó. */
export interface CartonEnJuego {
  numero: number;
  carton: Carton;
}

/**
 * Todos los cartones que cumplen la modalidad. Si completan varios con la
 * misma bolilla ganan TODOS (el cliente reparte el premio), así que no se
 * desempata acá. Mantiene el orden de `cartones`.
 */
export function ganadoresDe(
  cartones: readonly CartonEnJuego[],
  salidas: ReadonlySet<number>,
  modalidad: ModalidadBolillero,
): number[] {
  return cartones
    .filter(({ carton }) => cumple(carton, salidas, modalidad))
    .map(({ numero }) => numero);
}

/** Bolillas que todavía están adentro del bolillero, de menor a mayor. */
export function bolillasRestantes(salidas: readonly number[]): number[] {
  const afuera = new Set(salidas);
  const quedan: number[] = [];
  for (let n = 1; n <= TOTAL_BOLILLAS; n++) if (!afuera.has(n)) quedan.push(n);
  return quedan;
}

/**
 * Saca una bolilla al azar entre las que quedan. Lanza si ya salieron todas:
 * la UI tiene que frenar antes (con 90 bolillas afuera cualquier cartón
 * vendido ya completó, así que el juego terminó).
 */
export function sacarBolilla(
  salidas: readonly number[],
  rng: Rng = Math.random,
): number {
  const quedan = bolillasRestantes(salidas);
  if (quedan.length === 0) {
    throw new Error("Ya salieron las 90 bolillas");
  }
  return quedan[Math.floor(rng() * quedan.length)];
}

/**
 * Etapa en curso: la primera de la secuencia que todavía no tiene ganador.
 * Se DERIVA de los premios en vez de guardarse aparte: un índice guardado
 * por su lado se desincroniza al deshacer o reiniciar premios. `null` = la
 * noche terminó.
 *
 * Los premios sin `etapa` (sorteos de antes de que existieran las etapas) no
 * cuentan.
 */
export function etapaActual(
  premios: readonly { etapa?: number }[],
): number | null {
  const cerradas = new Set(premios.map((p) => p.etapa));
  for (let i = 0; i < SECUENCIA.length; i++) {
    if (!cerradas.has(i)) return i;
  }
  return null;
}
