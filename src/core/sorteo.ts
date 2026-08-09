// ─────────────────────────────────────────────────────────────────────────
// Sorteo de un ganador entre los cartones vendidos.
//
// Módulo PURO: no sabe nada de localStorage ni del DOM, solo trabaja con
// listas de N° de cartón. Eso lo hace trivial de testear.
//
// El RNG es inyectable: la app usa Math.random (sorteo simple), y los tests
// pasan un RNG con semilla (ver rng.ts) para obtener resultados predecibles.
// ─────────────────────────────────────────────────────────────────────────

import type { Rng } from "./rng.ts";

/**
 * Cartones que todavía pueden ganar: los vendidos menos los que ya salieron
 * en un sorteo anterior. Mantiene el orden de `vendidos`.
 */
export function elegibles(vendidos: number[], yaGanaron: number[]): number[] {
  const ganadores = new Set(yaGanaron);
  return vendidos.filter((n) => !ganadores.has(n));
}

/**
 * Elige un elemento al azar de la lista. Lanza si está vacía, porque sortear
 * sin candidatos es siempre un error de quien llama (la UI debe deshabilitar
 * el botón antes de llegar acá).
 */
export function sortearUno<T>(items: T[], rng: Rng = Math.random): T {
  if (items.length === 0) {
    throw new Error("No hay cartones en el bombo para sortear");
  }
  return items[Math.floor(rng() * items.length)];
}
