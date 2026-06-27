// ─────────────────────────────────────────────────────────────────────────
// Generación de un LOTE de cartones únicos (independientes entre sí).
//
// Garantiza que no haya dos cartones idénticos en el lote (compara por id,
// que es un hash del contenido). El lote es reproducible vía la semilla.
// ─────────────────────────────────────────────────────────────────────────

import { crearRng, semillaAleatoria } from "./rng.ts";
import { generarCartonConRng } from "./generator.ts";
import type { Carton, LoteGenerado, OpcionesGeneracion } from "./types.ts";

/**
 * Clave canónica del CONTENIDO completo del cartón (las 27 celdas).
 * A diferencia del `id` (hash corto, solo para mostrar), esta clave no tiene
 * colisiones: dos cartones con la misma clave son literalmente idénticos.
 * Por eso se usa para garantizar unicidad real dentro de un lote grande.
 */
function claveContenido(carton: Carton): string {
  return carton.filas.map((fila) => fila.map((c) => c ?? "_").join(",")).join("|");
}

/**
 * Genera `cantidad` cartones únicos. Si se pasa `semilla`, el lote completo
 * es reproducible (misma semilla + misma cantidad → mismos cartones).
 */
export function generarLote(opciones: OpcionesGeneracion): LoteGenerado {
  const { cantidad } = opciones;
  if (!Number.isInteger(cantidad) || cantidad < 1) {
    throw new Error("La cantidad debe ser un entero mayor o igual a 1");
  }

  const semilla = opciones.semilla ?? semillaAleatoria();
  const rng = crearRng(semilla);

  const cartones: Carton[] = [];
  const clavesVistas = new Set<string>();

  // Cota de intentos por si pidieran una cantidad gigante (hay ~3,67×10¹⁸
  // cartones distintos, así que en la práctica casi nunca hay colisiones).
  const maxIntentos = cantidad * 50 + 100;
  let intentos = 0;

  while (cartones.length < cantidad) {
    const carton = generarCartonConRng(rng);
    const clave = claveContenido(carton);
    if (!clavesVistas.has(clave)) {
      clavesVistas.add(clave);
      cartones.push(carton);
    }
    if (++intentos > maxIntentos) {
      throw new Error(
        `No se pudieron generar ${cantidad} cartones únicos tras ${intentos} intentos`,
      );
    }
  }

  return { cartones, semilla };
}
