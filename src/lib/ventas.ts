// ─────────────────────────────────────────────────────────────────────────
// Registro de CARTONES VENDIDOS por semilla, persistido en el navegador.
//
// Guardamos solo el N° de cartón (más los datos del comprador), NO los 15
// números: como la secuencia es determinista a partir de la semilla, el
// cartón se puede regenerar cuando haga falta mostrarlo (ver core/batch.ts).
//
// Un N° solo es vendible si ya fue impreso, es decir si está dentro de
// [1, total impreso] según el registro de tiradas (ver registro.ts).
// ─────────────────────────────────────────────────────────────────────────

/** Un cartón vendido y a quién. */
export interface Venta {
  /** N° de cartón (1-based) dentro de la secuencia de la semilla. */
  numero: number;
  /** Nombre del comprador. */
  comprador: string;
  /** Teléfono de contacto (puede quedar vacío). */
  telefono: string;
  /** Quién lo vendió (puede quedar vacío). */
  vendedor: string;
  /** Fecha de carga en ISO. */
  fecha: string;
}

/** Datos del comprador, sin el N° (se usan al cargar de a uno o por rango). */
export type DatosVenta = Pick<Venta, "comprador" | "telefono" | "vendedor">;

/** Mapa semilla → ventas, tal como se guarda en localStorage. */
type RegistroVentas = Record<string, Venta[]>;

import { escribirClave, leerClave } from "./persistencia.ts";

const CLAVE_VENTAS = "bingo90:ventas:v1";

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
function leerCrudo(): { reg: RegistroVentas; ilegible: boolean } {
  const crudo = leerClave(CLAVE_VENTAS);
  if (!crudo) return { reg: {}, ilegible: false };
  try {
    const datos: unknown = JSON.parse(crudo);
    if (typeof datos !== "object" || datos === null || Array.isArray(datos)) {
      return { reg: {}, ilegible: true };
    }
    return { reg: datos as RegistroVentas, ilegible: false };
  } catch {
    return { reg: {}, ilegible: true };
  }
}

function leerTodo(): RegistroVentas {
  return leerCrudo().reg;
}

function escribirTodo(reg: RegistroVentas): void {
  // Si el navegador no guarda, la app sigue andando en memoria; que el usuario
  // se entere es responsabilidad de persistencia.ts (ver App.tsx).
  escribirClave(CLAVE_VENTAS, JSON.stringify(reg));
}

/** Ordena por N° de cartón para que la lista se lea siempre igual. */
function porNumero(ventas: Venta[]): Venta[] {
  return [...ventas].sort((a, b) => a.numero - b.numero);
}

/**
 * ¿Se puede vender este N°? Debe ser un entero dentro de los cartones ya
 * impresos. Función pura para poder testearla sin storage.
 */
export function esNumeroVendible(numero: number, totalImpreso: number): boolean {
  return Number.isInteger(numero) && numero >= 1 && numero <= totalImpreso;
}

/**
 * ¿Es una venta bien formada? Se usa para validar lo que entra por el import
 * de campaña (ver campana.ts) y para descartar basura al leer el storage.
 */
export function esVenta(v: unknown): v is Venta {
  if (typeof v !== "object" || v === null) return false;
  const venta = v as Record<string, unknown>;
  return (
    Number.isInteger(venta.numero) &&
    (venta.numero as number) >= 1 &&
    typeof venta.comprador === "string" &&
    typeof venta.telefono === "string" &&
    typeof venta.vendedor === "string" &&
    typeof venta.fecha === "string"
  );
}

/** Lo leído de una semilla + cuántos registros dañados hubo que descartar. */
export interface LecturaVentas {
  ventas: Venta[];
  descartados: number;
  /** No se pudo leer lo guardado: se perdieron las ventas de todas las semillas. */
  ilegible: boolean;
}

/**
 * Ventas de una semilla, informando cuántos registros dañados se descartaron.
 * Lo corrupto se descarta antes de ordenar: el `sort` sobre basura explotaba al
 * evaluar el store (state/store.ts) y dejaba la app en pantalla en blanco. El
 * descarte se cuenta para poder avisarlo (ver App.tsx): una venta que se cae
 * es un cartón cobrado que deja de entrar al sorteo.
 */
export function leerVentasDe(semilla: number): LecturaVentas {
  const { reg, ilegible } = leerCrudo();
  if (ilegible) return { ventas: [], descartados: 0, ilegible: true };
  const guardadas = reg[String(semilla)];
  if (guardadas === undefined) {
    return { ventas: [], descartados: 0, ilegible: false };
  }
  if (!Array.isArray(guardadas)) {
    return { ventas: [], descartados: 1, ilegible: false };
  }
  const ventas = guardadas.filter(esVenta);
  return {
    ventas: porNumero(ventas),
    descartados: guardadas.length - ventas.length,
    ilegible: false,
  };
}

/** Ventas registradas para una semilla, ordenadas por N° de cartón. */
export function ventasDe(semilla: number): Venta[] {
  return leerVentasDe(semilla).ventas;
}

/**
 * Agrega una venta. Si ese N° ya estaba vendido no hace nada, para no pisar
 * sin querer los datos del comprador original: primero hay que quitarlo.
 *
 * Igual que en `agregarRango`, `totalImpreso` es obligatorio: la invariante
 * "solo se vende lo ya impreso" vive acá y no solo en el formulario. Lanza un
 * Error con un mensaje mostrable si el N° no es vendible.
 */
export function agregarVenta(
  semilla: number,
  numero: number,
  datos: DatosVenta,
  totalImpreso: number,
): Venta[] {
  if (!esNumeroVendible(numero, totalImpreso)) {
    throw new Error(
      totalImpreso >= 1
        ? `Solo se pueden vender cartones ya impresos (del 1 al ${totalImpreso}).`
        : "Todavía no hay cartones impresos para vender.",
    );
  }

  const reg = leerTodo();
  const clave = String(semilla);
  const previas = reg[clave] ?? [];
  if (previas.some((v) => v.numero === numero)) return porNumero(previas);

  const venta: Venta = {
    numero,
    comprador: datos.comprador.trim(),
    telefono: datos.telefono.trim(),
    vendedor: datos.vendedor.trim(),
    fecha: new Date().toISOString(),
  };
  reg[clave] = [...previas, venta];
  escribirTodo(reg);
  return porNumero(reg[clave]);
}

/** Resultado de cargar un rango: cuántos entraron y cuántos ya estaban. */
export interface ResultadoRango {
  ventas: Venta[];
  agregados: number;
  salteados: number;
}

/**
 * Carga de un saque el rango [desde, hasta] a un mismo comprador.
 * Los N° que ya estaban vendidos se saltean (y se informan), así reintentar
 * un rango solapado nunca pisa datos cargados antes.
 *
 * `totalImpreso` (cuántos cartones de la semilla ya se entregaron, lo sabe el
 * registro de tiradas) es obligatorio: la invariante "solo se vende lo ya
 * impreso" tiene que vivir acá y no solo en el formulario, si no cualquier
 * llamada directa puede meter miles de ventas de cartones que no existen.
 * Lanza un Error con un mensaje mostrable si el rango no sirve.
 */
export function agregarRango(
  semilla: number,
  desde: number,
  hasta: number,
  datos: DatosVenta,
  totalImpreso: number,
): ResultadoRango {
  if (!Number.isInteger(desde) || !Number.isInteger(hasta) || hasta < desde) {
    throw new Error("El rango de cartones no es válido.");
  }
  if (
    !esNumeroVendible(desde, totalImpreso) ||
    !esNumeroVendible(hasta, totalImpreso)
  ) {
    throw new Error(
      totalImpreso >= 1
        ? `Solo se pueden vender cartones ya impresos (del 1 al ${totalImpreso}).`
        : "Todavía no hay cartones impresos para vender.",
    );
  }

  const reg = leerTodo();
  const clave = String(semilla);
  const previas = reg[clave] ?? [];
  const yaVendidos = new Set(previas.map((v) => v.numero));

  const fecha = new Date().toISOString();
  const nuevas: Venta[] = [];
  let salteados = 0;

  for (let numero = desde; numero <= hasta; numero++) {
    if (yaVendidos.has(numero)) {
      salteados++;
      continue;
    }
    nuevas.push({
      numero,
      comprador: datos.comprador.trim(),
      telefono: datos.telefono.trim(),
      vendedor: datos.vendedor.trim(),
      fecha,
    });
  }

  reg[clave] = [...previas, ...nuevas];
  escribirTodo(reg);
  return {
    ventas: porNumero(reg[clave]),
    agregados: nuevas.length,
    salteados,
  };
}

/** Quita una venta (el cartón vuelve a figurar como no vendido). */
export function quitarVenta(semilla: number, numero: number): Venta[] {
  const reg = leerTodo();
  const clave = String(semilla);
  const previas = reg[clave] ?? [];
  reg[clave] = previas.filter((v) => v.numero !== numero);
  escribirTodo(reg);
  return porNumero(reg[clave]);
}

/** Borra todas las ventas de una semilla. */
export function limpiarVentas(semilla: number): Venta[] {
  const reg = leerTodo();
  delete reg[String(semilla)];
  escribirTodo(reg);
  return [];
}

/** Reemplaza las ventas de una semilla (lo usa el import de campaña). */
export function reemplazarVentas(semilla: number, ventas: Venta[]): Venta[] {
  const reg = leerTodo();
  reg[String(semilla)] = ventas;
  escribirTodo(reg);
  return porNumero(ventas);
}
