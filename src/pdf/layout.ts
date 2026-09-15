// ─────────────────────────────────────────────────────────────────────────
// Constantes y cálculo de geometría para el PDF.
//
// Unidad: puntos PDF (1 pt = 1/72 pulgada). Origen de pdf-lib: esquina
// inferior izquierda, con la Y creciendo hacia arriba. Para razonar más
// cómodo, acá trabajamos con coordenadas "desde arriba" (top) y convertimos
// a la Y de pdf-lib en el momento de dibujar.
// ─────────────────────────────────────────────────────────────────────────

/** Tamaño de hoja A4 en puntos (vertical). */
export const A4 = { ancho: 595.28, alto: 841.89 } as const;

/** Margen exterior de la hoja. */
export const MARGEN = 36; // 0.5"

/** Separación vertical entre cartones de una misma hoja. */
export const SEPARACION_CARTON = 18;

/** Fracción del ancho de la unidad que ocupa el talón (cupón de control). */
export const FRACCION_TALON = 0.26;

/** Cantidad de cartones por hoja por defecto (con talón entran menos). */
export const CARTONES_POR_HOJA_DEFECTO = 3;

/** Etiquetas de los encabezados de columna (1-9, 10-19, … 80-90). */
export const ETIQUETAS_COLUMNA: readonly string[] = [
  "1-9",
  "10-19",
  "20-29",
  "30-39",
  "40-49",
  "50-59",
  "60-69",
  "70-79",
  "80-90",
];

// ─── Texto: tipografía en coordenadas "desde arriba" ────────────────────────
//
// pdf-lib dibuja el texto apoyado en la línea base. Estas dos proporciones del
// tamaño de fuente son lo que hace falta para ubicarlo mirando la caja:

/** Cuánto baja la línea base respecto del tope de la línea. */
export const BASE_DESDE_TOPE = 0.78;

/** Alto de una mayúscula (lo que se ve del texto), medido desde la base. */
export const ALTO_MAYUSCULA = 0.7;

/**
 * Tope de la línea para que un texto quede centrado a lo alto de una banda
 * (la del evento, la de los encabezados de columna).
 *
 * Pasar el centro de la banda como tope de línea NO alcanza: eso deja la base
 * de las letras 0.78·tamaño más abajo del centro, o sea toda la mayúscula
 * fuera de la mitad de arriba, y el texto termina pegado al borde inferior de
 * la banda (y encima a los números del cartón, que arrancan justo debajo). Lo
 * que hay que centrar es la mayúscula: su base va en `centro + alto/2` y el
 * tope de línea, `BASE_DESDE_TOPE` más arriba.
 */
export function topDeLineaCentrada(
  topBanda: number,
  altoBanda: number,
  tamano: number,
): number {
  const base = topBanda + altoBanda / 2 + (tamano * ALTO_MAYUSCULA) / 2;
  return base - tamano * BASE_DESDE_TOPE;
}

/** Rectángulo de un cartón, en coordenadas "desde arriba". */
export interface Rect {
  /** Distancia desde el borde izquierdo de la hoja. */
  left: number;
  /** Distancia desde el borde superior de la hoja. */
  top: number;
  ancho: number;
  alto: number;
}

/**
 * Calcula los rectángulos donde van los cartones de una hoja, apilados
 * verticalmente. Devuelve `porHoja` rectángulos.
 */
export function rectangulosDeCartones(porHoja: number): Rect[] {
  if (!Number.isInteger(porHoja) || porHoja < 1) {
    throw new Error("cartonesPorHoja debe ser un entero >= 1");
  }
  const anchoUtil = A4.ancho - 2 * MARGEN;
  const altoUtil = A4.alto - 2 * MARGEN;
  const altoCarton =
    (altoUtil - SEPARACION_CARTON * (porHoja - 1)) / porHoja;

  const rects: Rect[] = [];
  for (let i = 0; i < porHoja; i++) {
    rects.push({
      left: MARGEN,
      top: MARGEN + i * (altoCarton + SEPARACION_CARTON),
      ancho: anchoUtil,
      alto: altoCarton,
    });
  }
  return rects;
}
