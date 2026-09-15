// ─────────────────────────────────────────────────────────────────────────
// Registro de TIRADAS por semilla, persistido en el navegador (localStorage).
//
// ¿Para qué? Para repartir una misma semilla entre varios títulos SIN que el
// usuario tenga que elegir a mano dónde empieza cada tanda (y sin riesgo de
// pisar cartones ya impresos). La app recuerda cuántos cartones de esa semilla
// ya se entregaron y la próxima tirada continúa automáticamente desde ahí.
//
// La secuencia de una semilla es continua y sin duplicados, así que tramos
// consecutivos ([1..200], [201..400], …) nunca comparten un cartón.
// ─────────────────────────────────────────────────────────────────────────

/** Una tanda de cartones ya generada para un título, dentro de una semilla. */
export interface Tirada {
  /** Título/escuela al que se entregó (ej: "Escuela Pepito"). */
  titulo: string;
  /** Cuántos cartones llevó. */
  cantidad: number;
  /** Primer N° (1-based) dentro de la secuencia de la semilla. */
  desde: number;
  /** Último N° (inclusive). hasta = desde + cantidad - 1. */
  hasta: number;
  /** Fecha de generación en ISO (para mostrar en el historial). */
  fecha: string;
}

/** Mapa semilla → lista de tiradas, tal como se guarda en localStorage. */
type Registro = Record<string, Tirada[]>;

const CLAVE_REGISTRO = "bingo90:registro:v1";
const CLAVE_SEMILLA = "bingo90:semilla:v1";

/** ¿Tenemos localStorage disponible? (SSR / modo privado viejo / tests). */
function hayStorage(): boolean {
  try {
    return typeof localStorage !== "undefined";
  } catch {
    return false;
  }
}

function leerRegistro(): Registro {
  if (!hayStorage()) return {};
  try {
    const crudo = localStorage.getItem(CLAVE_REGISTRO);
    if (!crudo) return {};
    const datos: unknown = JSON.parse(crudo);
    if (typeof datos !== "object" || datos === null || Array.isArray(datos)) {
      return {};
    }
    return datos as Registro;
  } catch {
    return {};
  }
}

function escribirRegistro(reg: Registro): void {
  if (!hayStorage()) return;
  try {
    localStorage.setItem(CLAVE_REGISTRO, JSON.stringify(reg));
  } catch {
    /* sin persistencia: la app sigue funcionando en memoria */
  }
}

/**
 * ¿Es una tirada bien formada? Se usa para validar lo que entra por el import
 * de campaña (ver campana.ts) y para descartar basura al leer el storage.
 */
export function esTirada(v: unknown): v is Tirada {
  if (typeof v !== "object" || v === null) return false;
  const t = v as Record<string, unknown>;
  return (
    typeof t.titulo === "string" &&
    Number.isInteger(t.cantidad) &&
    (t.cantidad as number) >= 1 &&
    Number.isInteger(t.desde) &&
    (t.desde as number) >= 1 &&
    Number.isInteger(t.hasta) &&
    // La aritmética tiene que cerrar: el total impreso sale de `cantidad`
    // mientras que los tramos (y el bloqueo del deshacer) salen de
    // desde/hasta. Una tirada con `cantidad: 100, desde: 1, hasta: 5`
    // declararía 100 cartones impresos con un tramo de 5, y las ventas del 6
    // al 100 volverían a quedar huérfanas. La app es el único escritor
    // legítimo de este dato, así que se exige coherencia.
    (t.hasta as number) === (t.desde as number) + (t.cantidad as number) - 1 &&
    typeof t.fecha === "string"
  );
}

/** Lo leído de una semilla + cuántos registros dañados hubo que descartar. */
export interface LecturaTiradas {
  tiradas: Tirada[];
  descartados: number;
}

/**
 * Tiradas de una semilla, informando cuántos registros dañados se descartaron.
 *
 * Lo corrupto se descarta en vez de dejar que explote más arriba: si el storage
 * quedó envenenado (import viejo, edición a mano) el usuario igual tiene que
 * poder abrir la app y reimportar su respaldo, que es el único camino de
 * recuperación que le queda. Pero descartar una tirada BAJA el total impreso,
 * así que la próxima tirada reimprimiría N° que pueden estar vendidos: por eso
 * el descarte se cuenta y la app lo avisa en pantalla (ver App.tsx).
 */
export function leerTiradasDe(semilla: number): LecturaTiradas {
  const guardadas = leerRegistro()[String(semilla)];
  if (guardadas === undefined) return { tiradas: [], descartados: 0 };
  // Si lo guardado ni siquiera es una lista se perdió todo el historial de esa
  // semilla: cuenta como un registro dañado para que el aviso salga igual.
  if (!Array.isArray(guardadas)) return { tiradas: [], descartados: 1 };
  const tiradas = guardadas.filter(esTirada);
  return { tiradas, descartados: guardadas.length - tiradas.length };
}

/** Tiradas ya registradas para una semilla (ordenadas por aparición). */
export function tiradasDe(semilla: number): Tirada[] {
  return leerTiradasDe(semilla).tiradas;
}

/** Cuántos cartones de esa semilla ya se entregaron (suma de cantidades). */
export function consumidos(tiradas: Tirada[]): number {
  return tiradas.reduce((acc, t) => acc + t.cantidad, 0);
}

/** Próximo N° por el que debe empezar la siguiente tirada (1-based). */
export function proximoDesde(semilla: number): number {
  return consumidos(tiradasDe(semilla)) + 1;
}

/**
 * Registra una tirada nueva al final de la semilla y devuelve la lista
 * actualizada. El `desde` se calcula solo a partir de lo ya consumido.
 */
export function registrarTirada(
  semilla: number,
  titulo: string,
  cantidad: number,
): Tirada[] {
  const reg = leerRegistro();
  const clave = String(semilla);
  const previas = reg[clave] ?? [];
  const desde = consumidos(previas) + 1;
  const tirada: Tirada = {
    titulo: titulo.trim() || "(sin título)",
    cantidad,
    desde,
    hasta: desde + cantidad - 1,
    fecha: new Date().toISOString(),
  };
  reg[clave] = [...previas, tirada];
  escribirRegistro(reg);
  return reg[clave];
}

/** Borra la última tirada de la semilla (para corregir un error). */
export function deshacerUltima(semilla: number): Tirada[] {
  const reg = leerRegistro();
  const clave = String(semilla);
  const previas = reg[clave] ?? [];
  reg[clave] = previas.slice(0, -1);
  escribirRegistro(reg);
  return reg[clave];
}

/** Borra todo el historial de una semilla (empezar la campaña de cero). */
export function reiniciarSemilla(semilla: number): Tirada[] {
  const reg = leerRegistro();
  delete reg[String(semilla)];
  escribirRegistro(reg);
  return [];
}

/** Reemplaza las tiradas de una semilla (lo usa el import de campaña). */
export function reemplazarTiradas(semilla: number, tiradas: Tirada[]): Tirada[] {
  const reg = leerRegistro();
  reg[String(semilla)] = tiradas;
  escribirRegistro(reg);
  return tiradas;
}

/** Recuerda la última semilla usada para retomar la campaña al reabrir. */
export function recordarSemilla(semilla: number): void {
  if (!hayStorage()) return;
  try {
    localStorage.setItem(CLAVE_SEMILLA, String(semilla));
  } catch {
    /* ignore */
  }
}

/** Última semilla usada (o null si es la primera vez). */
export function semillaRecordada(): number | null {
  if (!hayStorage()) return null;
  try {
    const v = localStorage.getItem(CLAVE_SEMILLA);
    if (v === null) return null;
    const n = Number(v);
    return Number.isInteger(n) && n >= 0 ? n : null;
  } catch {
    return null;
  }
}
