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

const CLAVE_VENTAS = "bingo90:ventas:v1";

/** ¿Tenemos localStorage disponible? (SSR / modo privado viejo / tests). */
function hayStorage(): boolean {
  try {
    return typeof localStorage !== "undefined";
  } catch {
    return false;
  }
}

function leerTodo(): RegistroVentas {
  if (!hayStorage()) return {};
  try {
    const crudo = localStorage.getItem(CLAVE_VENTAS);
    return crudo ? (JSON.parse(crudo) as RegistroVentas) : {};
  } catch {
    return {};
  }
}

function escribirTodo(reg: RegistroVentas): void {
  if (!hayStorage()) return;
  try {
    localStorage.setItem(CLAVE_VENTAS, JSON.stringify(reg));
  } catch {
    /* sin persistencia: la app sigue funcionando en memoria */
  }
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

/** Ventas registradas para una semilla, ordenadas por N° de cartón. */
export function ventasDe(semilla: number): Venta[] {
  return porNumero(leerTodo()[String(semilla)] ?? []);
}

/**
 * Agrega una venta. Si ese N° ya estaba vendido no hace nada, para no pisar
 * sin querer los datos del comprador original: primero hay que quitarlo.
 */
export function agregarVenta(
  semilla: number,
  numero: number,
  datos: DatosVenta,
): Venta[] {
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
 */
export function agregarRango(
  semilla: number,
  desde: number,
  hasta: number,
  datos: DatosVenta,
): ResultadoRango {
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
