// ─────────────────────────────────────────────────────────────────────────
// BOLILLAS que salieron del bolillero, por semilla, persistidas en el
// navegador y en el orden en que salieron.
//
// Es lo único del juego que no se puede reconstruir: si se cierra la pestaña
// a mitad de la noche, sin esto no hay forma de saber qué números ya se
// cantaron. La etapa en curso NO se guarda: se deriva de los premios (ver
// core/juego.ts → etapaActual).
// ─────────────────────────────────────────────────────────────────────────

import { TOTAL_BOLILLAS } from "../core/juego.ts";
import { escribirClave, leerClave } from "./persistencia.ts";

/** Mapa semilla → bolillas salidas, tal como se guarda en localStorage. */
type RegistroBolillas = Record<string, number[]>;

const CLAVE_BOLILLAS = "bingo90:bolillas:v1";

/**
 * Lee el blob completo de la clave. Igual que en premios.ts, `ilegible`
 * distingue "no hay nada guardado" de "lo guardado no se puede leer".
 */
function leerCrudo(): { reg: RegistroBolillas; ilegible: boolean } {
  const crudo = leerClave(CLAVE_BOLILLAS);
  if (!crudo) return { reg: {}, ilegible: false };
  try {
    const datos: unknown = JSON.parse(crudo);
    if (typeof datos !== "object" || datos === null || Array.isArray(datos)) {
      return { reg: {}, ilegible: true };
    }
    return { reg: datos as RegistroBolillas, ilegible: false };
  } catch {
    return { reg: {}, ilegible: true };
  }
}

function escribirTodo(reg: RegistroBolillas): void {
  escribirClave(CLAVE_BOLILLAS, JSON.stringify(reg));
}

/** ¿Es un número de bolilla válido (entero del 1 al 90)? */
export function esBolilla(v: unknown): v is number {
  return Number.isInteger(v) && (v as number) >= 1 && (v as number) <= TOTAL_BOLILLAS;
}

/**
 * ¿Es una lista de bolillas bien formada? Además de que cada una sea válida,
 * no puede haber repetidas: una bolilla sale una sola vez.
 */
export function esListaDeBolillas(v: unknown): v is number[] {
  return (
    Array.isArray(v) && v.every(esBolilla) && new Set(v).size === v.length
  );
}

/** Lo leído de una semilla + cuántos registros dañados hubo que descartar. */
export interface LecturaBolillas {
  bolillas: number[];
  descartados: number;
  /** No se pudo leer lo guardado: se perdieron las bolillas de todas las semillas. */
  ilegible: boolean;
}

/**
 * Bolillas de una semilla. Lo dañado se descarta y se cuenta, como en el
 * resto de los registros: una bolilla inválida o repetida no se puede
 * "arreglar" adivinando, y la app tiene que poder abrir igual.
 */
export function leerBolillasDe(semilla: number): LecturaBolillas {
  const { reg, ilegible } = leerCrudo();
  if (ilegible) return { bolillas: [], descartados: 0, ilegible: true };
  const guardadas = reg[String(semilla)];
  if (guardadas === undefined) {
    return { bolillas: [], descartados: 0, ilegible: false };
  }
  if (!Array.isArray(guardadas)) {
    return { bolillas: [], descartados: 1, ilegible: false };
  }
  const vistas = new Set<number>();
  const bolillas = guardadas.filter((b): b is number => {
    if (!esBolilla(b) || vistas.has(b)) return false;
    vistas.add(b);
    return true;
  });
  return {
    bolillas,
    descartados: guardadas.length - bolillas.length,
    ilegible: false,
  };
}

/** Bolillas salidas de una semilla, en orden de salida. */
export function bolillasDe(semilla: number): number[] {
  return leerBolillasDe(semilla).bolillas;
}

/** Agrega una bolilla al final y devuelve la lista actualizada. */
export function agregarBolilla(semilla: number, bolilla: number): number[] {
  if (!esBolilla(bolilla)) {
    throw new Error(`La bolilla tiene que ser un número del 1 al ${TOTAL_BOLILLAS}.`);
  }
  const { reg } = leerCrudo();
  const clave = String(semilla);
  const previas = bolillasDe(semilla);
  if (previas.includes(bolilla)) {
    throw new Error(`La bolilla ${bolilla} ya salió.`);
  }
  reg[clave] = [...previas, bolilla];
  escribirTodo(reg);
  return reg[clave];
}

/** Vuelve a meter todas las bolillas (empieza un juego nuevo). */
export function reiniciarBolillas(semilla: number): number[] {
  const { reg } = leerCrudo();
  delete reg[String(semilla)];
  escribirTodo(reg);
  return [];
}

/** Reemplaza las bolillas de una semilla (lo usa el import de campaña). */
export function reemplazarBolillas(semilla: number, bolillas: number[]): number[] {
  const { reg } = leerCrudo();
  reg[String(semilla)] = bolillas;
  escribirTodo(reg);
  return bolillas;
}
