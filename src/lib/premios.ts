// ─────────────────────────────────────────────────────────────────────────
// Historial de PREMIOS sorteados por semilla, persistido en el navegador.
//
// Cada sorteo saca un cartón del bombo: los cartones que ya ganaron no
// vuelven a entrar en los sorteos siguientes (1er premio, 2do, 3ro…).
//
// Se guarda un SNAPSHOT del comprador al momento del sorteo. Si después se
// edita o se borra la venta, el historial de premios no se reescribe: lo que
// se cantó en el evento queda como se cantó.
// ─────────────────────────────────────────────────────────────────────────

/** Un premio ya sorteado. */
export interface Premio {
  /** 1 = primer premio, 2 = segundo, … (orden en que se sortearon). */
  orden: number;
  /** Qué se sorteaba (ej: "Bicicleta"). Puede quedar vacío. */
  descripcion: string;
  /** N° del cartón ganador. */
  numero: number;
  /** Nombre del comprador al momento del sorteo. */
  comprador: string;
  /** Teléfono del comprador al momento del sorteo. */
  telefono: string;
  /** Fecha del sorteo en ISO. */
  fecha: string;
}

/** Datos que aporta quien sortea (el resto lo completa `registrarPremio`). */
export type DatosPremio = Pick<
  Premio,
  "descripcion" | "numero" | "comprador" | "telefono"
>;

/** Mapa semilla → premios, tal como se guarda en localStorage. */
type RegistroPremios = Record<string, Premio[]>;

import { escribirClave, leerClave } from "./persistencia.ts";

const CLAVE_PREMIOS = "bingo90:premios:v1";

/**
 * Lee el blob completo de la clave. `ilegible` distingue dos cosas que antes se
 * confundían en un `{}`: que no haya nada guardado (campaña nueva) y que lo
 * guardado no se pueda leer. En el segundo caso se perdió TODO lo de esta
 * clave —de todas las semillas— y la app tiene que avisarlo, porque si no el
 * usuario ve una campaña sana y vacía justo cuando más datos perdió.
 *
 * Que el navegador no nos deje leer (modo privado, cookies bloqueadas) NO es
 * ilegible: ahí nunca hubo nada guardado y la app funciona en memoria.
 */
function leerCrudo(): { reg: RegistroPremios; ilegible: boolean } {
  const crudo = leerClave(CLAVE_PREMIOS);
  if (!crudo) return { reg: {}, ilegible: false };
  try {
    const datos: unknown = JSON.parse(crudo);
    if (typeof datos !== "object" || datos === null || Array.isArray(datos)) {
      return { reg: {}, ilegible: true };
    }
    return { reg: datos as RegistroPremios, ilegible: false };
  } catch {
    return { reg: {}, ilegible: true };
  }
}

function leerTodo(): RegistroPremios {
  return leerCrudo().reg;
}

function escribirTodo(reg: RegistroPremios): void {
  // Si el navegador no guarda, la app sigue andando en memoria; que el usuario
  // se entere es responsabilidad de persistencia.ts (ver App.tsx).
  escribirClave(CLAVE_PREMIOS, JSON.stringify(reg));
}

/**
 * ¿Es un premio bien formado? Se usa para validar lo que entra por el import
 * de campaña (ver campana.ts) y para descartar basura al leer el storage.
 */
export function esPremio(v: unknown): v is Premio {
  if (typeof v !== "object" || v === null) return false;
  const p = v as Record<string, unknown>;
  return (
    Number.isInteger(p.orden) &&
    (p.orden as number) >= 1 &&
    Number.isInteger(p.numero) &&
    (p.numero as number) >= 1 &&
    typeof p.descripcion === "string" &&
    typeof p.comprador === "string" &&
    typeof p.telefono === "string" &&
    typeof p.fecha === "string"
  );
}

/** Lo leído de una semilla + cuántos registros dañados hubo que descartar. */
export interface LecturaPremios {
  premios: Premio[];
  descartados: number;
  /** No se pudo leer lo guardado: se perdieron los premios de todas las semillas. */
  ilegible: boolean;
}

/**
 * Premios de una semilla, informando cuántos registros dañados se descartaron.
 * Igual que en registro.ts y ventas.ts: lo corrupto se descarta al leer para
 * que un storage envenenado no impida abrir la app y reimportar el respaldo,
 * y se cuenta para avisarlo (un premio que se cae es un premio que se cantó en
 * el evento y desapareció del historial).
 */
export function leerPremiosDe(semilla: number): LecturaPremios {
  const { reg, ilegible } = leerCrudo();
  if (ilegible) return { premios: [], descartados: 0, ilegible: true };
  const guardados = reg[String(semilla)];
  if (guardados === undefined) {
    return { premios: [], descartados: 0, ilegible: false };
  }
  if (!Array.isArray(guardados)) {
    return { premios: [], descartados: 1, ilegible: false };
  }
  const premios = guardados.filter(esPremio);
  return {
    premios,
    descartados: guardados.length - premios.length,
    ilegible: false,
  };
}

/** Premios sorteados para una semilla, en orden de sorteo. */
export function premiosDe(semilla: number): Premio[] {
  return leerPremiosDe(semilla).premios;
}

/**
 * Registra un premio al final del historial y devuelve la lista actualizada.
 * El `orden` se calcula solo a partir de los premios previos.
 */
export function registrarPremio(semilla: number, datos: DatosPremio): Premio[] {
  const reg = leerTodo();
  const clave = String(semilla);
  const previos = reg[clave] ?? [];
  const premio: Premio = {
    orden: previos.length + 1,
    descripcion: datos.descripcion.trim(),
    numero: datos.numero,
    comprador: datos.comprador,
    telefono: datos.telefono,
    fecha: new Date().toISOString(),
  };
  reg[clave] = [...previos, premio];
  escribirTodo(reg);
  return reg[clave];
}

/** Borra el último premio (el cartón vuelve al bombo). */
export function deshacerUltimoPremio(semilla: number): Premio[] {
  const reg = leerTodo();
  const clave = String(semilla);
  const previos = reg[clave] ?? [];
  reg[clave] = previos.slice(0, -1);
  escribirTodo(reg);
  return reg[clave];
}

/** Borra todo el historial de premios de una semilla. */
export function reiniciarPremios(semilla: number): Premio[] {
  const reg = leerTodo();
  delete reg[String(semilla)];
  escribirTodo(reg);
  return [];
}

/** Reemplaza los premios de una semilla (lo usa el import de campaña). */
export function reemplazarPremios(semilla: number, premios: Premio[]): Premio[] {
  const reg = leerTodo();
  reg[String(semilla)] = premios;
  escribirTodo(reg);
  return premios;
}
