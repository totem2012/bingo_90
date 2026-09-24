// ─────────────────────────────────────────────────────────────────────────
// Exportar / importar una CAMPAÑA completa a un archivo .json.
//
// Sirve para dos cosas:
//  • Llevar la campaña a otra computadora o celular (sortear desde otro lado).
//  • Respaldo: si se limpia el caché del navegador se pierde el registro de
//    tiradas y ventas, y con él la numeración de los cartones ya impresos.
//
// Todo local: el archivo lo baja y lo sube el usuario, nunca sale a un
// servidor.
// ─────────────────────────────────────────────────────────────────────────

import {
  esTirada,
  reemplazarTiradas,
  tiradasDe,
  type Tirada,
} from "./registro.ts";
import { esVenta, reemplazarVentas, ventasDe, type Venta } from "./ventas.ts";
import {
  esPremio,
  normalizarPremio,
  premiosDe,
  reemplazarPremios,
  type Premio,
} from "./premios.ts";
import {
  bolillasDe,
  esListaDeBolillas,
  reemplazarBolillas,
} from "./bolillas.ts";

/** Contenido del archivo .json de campaña. */
export interface CampanaExportada {
  /**
   * Versión del formato. La 2 sumó las bolillas del juego; la 1 se sigue
   * pudiendo importar (se toma como un juego sin bolillas).
   */
  version: 2;
  /** Semilla = identidad de la campaña. */
  semilla: number;
  /** Tiradas ya generadas (define la numeración de los cartones impresos). */
  registro: Tirada[];
  /** Cartones vendidos y sus compradores. */
  ventas: Venta[];
  /** Premios ya ganados (bolillero y sorteos). */
  premios: Premio[];
  /** Bolillas que salieron del bolillero, en orden. */
  bolillas: number[];
  /** Fecha de exportación en ISO. */
  exportadoEn: string;
}

/** Junta todo lo guardado de una semilla en un objeto exportable. */
export function exportarCampana(semilla: number): CampanaExportada {
  return {
    version: 2,
    semilla,
    registro: tiradasDe(semilla),
    ventas: ventasDe(semilla),
    premios: premiosDe(semilla),
    bolillas: bolillasDe(semilla),
    exportadoEn: new Date().toISOString(),
  };
}

/** Nombre sugerido del archivo de respaldo. */
export function nombreArchivoCampana(semilla: number): string {
  const dia = new Date().toISOString().slice(0, 10);
  return `campana-bingo-${semilla}-${dia}.json`;
}

function esArreglo(v: unknown): v is unknown[] {
  return Array.isArray(v);
}

/**
 * Valida la lista elemento por elemento. No alcanza con que sea un arreglo:
 * un `.json` con basura adentro (ej: `ventas: [null]`) se guardaba igual y
 * después rompía la app al leerlo, sin forma de deshacerlo desde la pantalla.
 */
function validarLista<T>(
  lista: unknown[],
  es: (v: unknown) => v is T,
  singular: string,
): T[] {
  const i = lista.findIndex((el) => !es(el));
  if (i !== -1) {
    throw new Error(
      `El archivo tiene ${singular} con datos inválidos (el N° ${i + 1} de la lista). No se importó nada.`,
    );
  }
  return lista as T[];
}

/**
 * Valida un objeto leído de un .json y, si está bien formado, lo escribe
 * pisando lo que hubiera de esa semilla. Lanza un Error con un mensaje
 * entendible si el archivo no sirve, para poder mostrarlo tal cual.
 */
export function importarCampana(json: unknown): CampanaExportada {
  if (typeof json !== "object" || json === null) {
    throw new Error("El archivo no tiene el formato esperado.");
  }
  const datos = json as Partial<Omit<CampanaExportada, "version">> & {
    version?: unknown;
  };

  if (datos.version !== 1 && datos.version !== 2) {
    throw new Error(
      "El archivo fue creado con otra versión de la app y no se puede importar.",
    );
  }
  if (!Number.isInteger(datos.semilla) || (datos.semilla as number) < 0) {
    throw new Error("El archivo no tiene una semilla válida.");
  }
  if (
    !esArreglo(datos.registro) ||
    !esArreglo(datos.ventas) ||
    !esArreglo(datos.premios)
  ) {
    throw new Error(
      "El archivo está incompleto: faltan las tiradas, las ventas o los premios.",
    );
  }

  const semilla = datos.semilla as number;
  // Todo o nada: primero se valida el archivo COMPLETO y recién después se
  // escribe. Si la validación de las ventas fallara con las tiradas ya
  // escritas, la campaña quedaría a medio pisar (numeración nueva con ventas
  // viejas) y no hay forma de volver atrás.
  const registro = validarLista(datos.registro, esTirada, "una tirada");
  const ventas = validarLista(datos.ventas, esVenta, "una venta");
  const premios = validarLista(datos.premios, esPremio, "un premio").map(
    normalizarPremio,
  );
  // Los archivos de la versión 1 son de antes del bolillero: no traen bolillas.
  let bolillas: number[] = [];
  if (datos.version === 2) {
    if (!esListaDeBolillas(datos.bolillas)) {
      throw new Error(
        "El archivo tiene bolillas con datos inválidos (o repetidas). No se importó nada.",
      );
    }
    bolillas = datos.bolillas;
  }

  reemplazarTiradas(semilla, registro);
  reemplazarVentas(semilla, ventas);
  reemplazarPremios(semilla, premios);
  reemplazarBolillas(semilla, bolillas);

  return {
    version: 2,
    semilla,
    registro,
    ventas,
    premios,
    bolillas,
    exportadoEn:
      typeof datos.exportadoEn === "string"
        ? datos.exportadoEn
        : new Date().toISOString(),
  };
}
