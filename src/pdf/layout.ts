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
