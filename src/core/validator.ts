// ─────────────────────────────────────────────────────────────────────────
// Validación de un cartón de bingo de 90 bolas.
//
// Es la red de seguridad del dominio: cualquier cartón que produzca el
// generador DEBE pasar todas estas reglas. Los tests lo verifican sobre
// miles de cartones.
// ─────────────────────────────────────────────────────────────────────────

import {
  COLUMNAS,
  FILAS,
  NUMEROS_POR_CARTON,
  NUMEROS_POR_FILA,
  RANGOS_COLUMNA,
  type Carton,
} from "./types.ts";

/** Resultado de validar: si es válido y, si no, la lista de problemas. */
export interface ResultadoValidacion {
  valido: boolean;
  errores: string[];
}

/**
 * Valida un cartón contra todas las reglas del bingo de 90 bolas.
 */
export function validarCarton(carton: Carton): ResultadoValidacion {
  const errores: string[] = [];
  const { filas } = carton;

  // Estructura: 3 filas × 9 columnas.
  if (filas.length !== FILAS) {
    errores.push(`Debe tener ${FILAS} filas, tiene ${filas.length}`);
    return { valido: false, errores }; // sin estructura no seguimos
  }
  for (let i = 0; i < FILAS; i++) {
    if (filas[i].length !== COLUMNAS) {
      errores.push(`La fila ${i} debe tener ${COLUMNAS} columnas`);
    }
  }
  if (errores.length > 0) return { valido: false, errores };

  // Cada fila: exactamente 5 números.
  for (let i = 0; i < FILAS; i++) {
    const cuenta = filas[i].filter((c) => c !== null).length;
    if (cuenta !== NUMEROS_POR_FILA) {
      errores.push(`La fila ${i} tiene ${cuenta} números (deben ser ${NUMEROS_POR_FILA})`);
    }
  }

  // Total de números.
  const total = filas.flat().filter((c) => c !== null).length;
  if (total !== NUMEROS_POR_CARTON) {
    errores.push(`El cartón tiene ${total} números (deben ser ${NUMEROS_POR_CARTON})`);
  }

  // Por columna: conteo 1..3, rango correcto, orden ascendente.
  const vistos = new Set<number>();
  for (let j = 0; j < COLUMNAS; j++) {
    const [min, max] = RANGOS_COLUMNA[j];
    const valores: number[] = [];
    for (let i = 0; i < FILAS; i++) {
      const c = filas[i][j];
      if (c === null) continue;
      valores.push(c);

      if (c < min || c > max) {
        errores.push(`El número ${c} en la columna ${j} está fuera del rango ${min}-${max}`);
      }
      if (vistos.has(c)) {
        errores.push(`El número ${c} aparece repetido en el cartón`);
      }
      vistos.add(c);
    }

    if (valores.length < 1 || valores.length > 3) {
      errores.push(`La columna ${j} tiene ${valores.length} números (deben ser entre 1 y 3)`);
    }
    for (let k = 1; k < valores.length; k++) {
      if (valores[k] <= valores[k - 1]) {
        errores.push(`La columna ${j} no está ordenada de forma ascendente`);
        break;
      }
    }
  }

  return { valido: errores.length === 0, errores };
}

/** Versión booleana rápida. */
export function esCartonValido(carton: Carton): boolean {
  return validarCarton(carton).valido;
}
