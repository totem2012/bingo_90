// ─────────────────────────────────────────────────────────────────────────
// Generador de números pseudoaleatorios CON SEMILLA (determinista).
//
// ¿Por qué no usar Math.random()? Porque queremos que un lote sea
// REPRODUCIBLE: guardando la semilla podés volver a generar exactamente
// los mismos cartones (reimprimir sin duplicar, compartir un lote, testear).
// ─────────────────────────────────────────────────────────────────────────

/** Función que devuelve un número pseudoaleatorio en [0, 1). */
export type Rng = () => number;

/**
 * mulberry32: PRNG rápido y de buena distribución para 32 bits.
 * Determinista: la misma semilla siempre produce la misma secuencia.
 */
export function crearRng(semilla: number): Rng {
  let a = semilla >>> 0;
  return function (): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Genera una semilla aleatoria de 32 bits (para cuando el usuario no la fija). */
export function semillaAleatoria(): number {
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}

/** Entero aleatorio en [min, max] (ambos inclusive). */
export function enteroEnRango(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/**
 * Mezcla un arreglo in-place (Fisher-Yates) usando el RNG con semilla.
 * Devuelve el mismo arreglo por comodidad.
 */
export function mezclar<T>(rng: Rng, arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Elige `n` elementos distintos al azar de un rango [min, max] inclusivo,
 * y los devuelve ORDENADOS de menor a mayor.
 */
export function elegirOrdenados(
  rng: Rng,
  min: number,
  max: number,
  n: number,
): number[] {
  const pool: number[] = [];
  for (let v = min; v <= max; v++) pool.push(v);
  mezclar(rng, pool);
  return pool.slice(0, n).sort((x, y) => x - y);
}
