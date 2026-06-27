// ─────────────────────────────────────────────────────────────────────────
// Generación de UN cartón válido de bingo de 90 bolas.
//
// Reglas que debe cumplir un cartón (ver validator.ts):
//  • 3 filas × 9 columnas = 27 celdas, con 15 números y 12 vacías.
//  • Cada fila tiene EXACTAMENTE 5 números.
//  • Cada columna tiene 1, 2 o 3 números (nunca 0).
//  • Cada columna usa su rango (col 0 → 1..9, … col 8 → 80..90).
//  • Los números de una columna van ordenados de arriba hacia abajo.
//
// Estrategia (en 3 pasos):
//  1. Repartir cuántos números lleva cada columna (entre 1 y 3, sumando 15).
//  2. Construir la "máscara" de posiciones (qué celdas llevan número) de modo
//     que cada fila quede con 5. Se asigna al azar y se REPARA por transferencias
//     dentro de cada columna hasta equilibrar las filas (siempre converge).
//  3. Rellenar cada columna con números ordenados de su rango.
// ─────────────────────────────────────────────────────────────────────────

import {
  COLUMNAS,
  FILAS,
  NUMEROS_POR_CARTON,
  NUMEROS_POR_FILA,
  RANGOS_COLUMNA,
  type Carton,
  type Celda,
} from "./types.ts";
import { crearRng, elegirOrdenados, type Rng } from "./rng.ts";

/**
 * Paso 1: decide cuántos números lleva cada columna.
 * Arranca con 1 por columna (suma 9) y reparte los 6 restantes,
 * sin que ninguna columna supere 3.
 */
function repartirConteosPorColumna(rng: Rng): number[] {
  const conteos = new Array<number>(COLUMNAS).fill(1);
  let restantes = NUMEROS_POR_CARTON - COLUMNAS; // 15 - 9 = 6
  while (restantes > 0) {
    const j = Math.floor(rng() * COLUMNAS);
    if (conteos[j] < 3) {
      conteos[j]++;
      restantes--;
    }
  }
  return conteos;
}

/**
 * Paso 2: construye una máscara booleana [FILAS][COLUMNAS] donde `true`
 * indica que esa celda lleva número. Respeta los conteos por columna y
 * deja cada fila con exactamente 5 números.
 */
function construirMascara(rng: Rng, conteos: number[]): boolean[][] {
  const mascara: boolean[][] = Array.from({ length: FILAS }, () =>
    new Array<boolean>(COLUMNAS).fill(false),
  );

  // Asignación inicial: por cada columna, elegir al azar `conteos[j]` filas.
  for (let j = 0; j < COLUMNAS; j++) {
    const filas = [0, 1, 2];
    // Fisher-Yates parcial para elegir las primeras `conteos[j]` filas.
    for (let i = filas.length - 1; i > 0; i--) {
      const k = Math.floor(rng() * (i + 1));
      [filas[i], filas[k]] = [filas[k], filas[i]];
    }
    for (let c = 0; c < conteos[j]; c++) {
      mascara[filas[c]][j] = true;
    }
  }

  // Reparación: equilibrar filas a 5 transfiriendo marcas dentro de una columna.
  // Una transferencia mueve un número de una fila "con exceso" a otra "con
  // defecto" en una columna donde la primera tiene marca y la segunda no.
  // Esto mantiene el conteo de la columna y siempre existe tal columna mientras
  // las filas estén desbalanceadas, por lo que el proceso converge.
  const sumaFila = (i: number) => mascara[i].filter(Boolean).length;

  let guardia = 0;
  for (;;) {
    let filaExceso = -1;
    let filaDefecto = -1;
    for (let i = 0; i < FILAS; i++) {
      if (sumaFila(i) > NUMEROS_POR_FILA) filaExceso = i;
      if (sumaFila(i) < NUMEROS_POR_FILA) filaDefecto = i;
    }
    if (filaExceso === -1 || filaDefecto === -1) break; // todas en 5

    for (let j = 0; j < COLUMNAS; j++) {
      if (mascara[filaExceso][j] && !mascara[filaDefecto][j]) {
        mascara[filaExceso][j] = false;
        mascara[filaDefecto][j] = true;
        break;
      }
    }

    if (++guardia > 1000) {
      throw new Error("No se pudo equilibrar la máscara del cartón");
    }
  }

  return mascara;
}

/**
 * Paso 3: rellena la máscara con números reales, ordenados por columna.
 */
function rellenar(rng: Rng, mascara: boolean[][]): Celda[][] {
  const filas: Celda[][] = Array.from({ length: FILAS }, () =>
    new Array<Celda>(COLUMNAS).fill(null),
  );

  for (let j = 0; j < COLUMNAS; j++) {
    const filasMarcadas: number[] = [];
    for (let i = 0; i < FILAS; i++) {
      if (mascara[i][j]) filasMarcadas.push(i);
    }
    if (filasMarcadas.length === 0) continue;

    const [min, max] = RANGOS_COLUMNA[j];
    const numeros = elegirOrdenados(rng, min, max, filasMarcadas.length);
    // filasMarcadas ya está en orden ascendente (0 < 1 < 2) y `numeros`
    // también, así que la columna queda ordenada de arriba hacia abajo.
    filasMarcadas.forEach((fila, idx) => {
      filas[fila][j] = numeros[idx];
    });
  }

  return filas;
}

/**
 * Hash estable (djb2) del contenido del cartón. Sirve como `id` y para
 * detectar duplicados en un lote.
 */
function calcularId(filas: Celda[][]): string {
  let h = 5381;
  for (let i = 0; i < FILAS; i++) {
    for (let j = 0; j < COLUMNAS; j++) {
      const v = filas[i][j] ?? 0;
      h = ((h << 5) + h + v) | 0;
    }
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/**
 * Genera un único cartón válido usando el RNG provisto.
 * Útil cuando ya tenés un RNG con semilla (ver batch.ts).
 */
export function generarCartonConRng(rng: Rng): Carton {
  const conteos = repartirConteosPorColumna(rng);
  const mascara = construirMascara(rng, conteos);
  const filas = rellenar(rng, mascara);
  return { id: calcularId(filas), filas };
}

/**
 * Genera un único cartón válido. Acepta una semilla opcional para reproducir.
 */
export function generarCarton(semilla?: number): Carton {
  const rng = crearRng(semilla ?? Math.floor(Math.random() * 0xffffffff));
  return generarCartonConRng(rng);
}
