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

const CLAVE_PREMIOS = "bingo90:premios:v1";

/** ¿Tenemos localStorage disponible? (SSR / modo privado viejo / tests). */
function hayStorage(): boolean {
  try {
    return typeof localStorage !== "undefined";
  } catch {
    return false;
  }
}

function leerTodo(): RegistroPremios {
  if (!hayStorage()) return {};
  try {
    const crudo = localStorage.getItem(CLAVE_PREMIOS);
    return crudo ? (JSON.parse(crudo) as RegistroPremios) : {};
  } catch {
    return {};
  }
}

function escribirTodo(reg: RegistroPremios): void {
  if (!hayStorage()) return;
  try {
    localStorage.setItem(CLAVE_PREMIOS, JSON.stringify(reg));
  } catch {
    /* sin persistencia: la app sigue funcionando en memoria */
  }
}

/** Premios sorteados para una semilla, en orden de sorteo. */
export function premiosDe(semilla: number): Premio[] {
  return leerTodo()[String(semilla)] ?? [];
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
