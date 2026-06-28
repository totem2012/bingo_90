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
 *
 * `desde` (1-based, por defecto 1) elige el tramo de la secuencia: se generan
 * los cartones únicos en las posiciones [desde, desde + cantidad). Esto permite
 * repartir UNA semilla entre varios títulos sin repetir: con la misma semilla,
 * un título toma desde=1/cantidad=200 y otro desde=201/cantidad=300; al no
 * solaparse los tramos de una secuencia sin duplicados, no comparten cartones.
 */
export function generarLote(opciones: OpcionesGeneracion): LoteGenerado {
  const { cantidad } = opciones;
  if (!Number.isInteger(cantidad) || cantidad < 1) {
    throw new Error("La cantidad debe ser un entero mayor o igual a 1");
  }

  const desde = opciones.desde ?? 1;
  if (!Number.isInteger(desde) || desde < 1) {
    throw new Error("El número inicial (desde) debe ser un entero mayor o igual a 1");
  }

  const semilla = opciones.semilla ?? semillaAleatoria();
  const rng = crearRng(semilla);

  // Para devolver el tramo [desde, desde+cantidad) recorremos la secuencia
  // desde el principio: descartamos los primeros `salto` cartones únicos y
  // nos quedamos con los `cantidad` siguientes. Recorrer siempre desde el
  // inicio es lo que garantiza que tramos de distintos títulos sean disjuntos.
  const salto = desde - 1;
  const total = salto + cantidad;

  const cartones: Carton[] = [];
  const clavesVistas = new Set<string>();

  // Cota de intentos por si pidieran una cantidad gigante (hay ~3,67×10¹⁸
  // cartones distintos, así que en la práctica casi nunca hay colisiones).
  const maxIntentos = total * 50 + 100;
  let intentos = 0;

  while (cartones.length < total) {
    const carton = generarCartonConRng(rng);
    const clave = claveContenido(carton);
    if (!clavesVistas.has(clave)) {
      clavesVistas.add(clave);
      cartones.push(carton);
    }
    if (++intentos > maxIntentos) {
      throw new Error(
        `No se pudieron generar ${total} cartones únicos tras ${intentos} intentos`,
      );
    }
  }

  return { cartones: cartones.slice(salto), semilla };
}
