// ─────────────────────────────────────────────────────────────────────────
// Tipos del dominio del bingo de 90 bolas.
// Este módulo es PURO: no importa React ni nada del navegador, así puede
// correr igual en el browser o en un servidor Node.
// ─────────────────────────────────────────────────────────────────────────

/** Cantidad de filas de un cartón. */
export const FILAS = 3;

/** Cantidad de columnas de un cartón. */
export const COLUMNAS = 9;

/** Números por fila (las otras 4 celdas quedan vacías). */
export const NUMEROS_POR_FILA = 5;

/** Total de números en un cartón (3 filas × 5). */
export const NUMEROS_POR_CARTON = FILAS * NUMEROS_POR_FILA; // 15

/**
 * Una celda del cartón: o bien un número del 1 al 90, o `null` si está vacía.
 */
export type Celda = number | null;

/**
 * Un cartón de bingo de 90 bolas.
 * `filas` es una matriz de 3 filas × 9 columnas.
 */
export interface Carton {
  /** Identificador estable derivado del contenido (mismo contenido → mismo id). */
  readonly id: string;
  /** Matriz [FILAS][COLUMNAS] de celdas. */
  readonly filas: ReadonlyArray<ReadonlyArray<Celda>>;
}

/** Opciones para generar un lote de cartones. */
export interface OpcionesGeneracion {
  /** Cuántos cartones generar. */
  cantidad: number;
  /**
   * Semilla del generador. Si se provee, el lote es reproducible:
   * la misma semilla + cantidad produce exactamente los mismos cartones.
   * Si se omite, se usa una semilla aleatoria.
   */
  semilla?: number;
}

/** Resultado de generar un lote: los cartones y la semilla efectivamente usada. */
export interface LoteGenerado {
  cartones: Carton[];
  /** Semilla usada (útil para reproducir/reimprimir el mismo lote). */
  semilla: number;
}

/**
 * Rango de números (inclusivo) que corresponde a cada columna.
 * Columna 0 → 1..9, columna 1 → 10..19, … columna 8 → 80..90.
 */
export const RANGOS_COLUMNA: ReadonlyArray<readonly [number, number]> = [
  [1, 9],
  [10, 19],
  [20, 29],
  [30, 39],
  [40, 49],
  [50, 59],
  [60, 69],
  [70, 79],
  [80, 90],
];
