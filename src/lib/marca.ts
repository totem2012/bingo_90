// ─────────────────────────────────────────────────────────────────────────
// Modelo de "marca" (branding) del cartón: encabezado, evento, serie, color
// y logos. Es toda la personalización que el usuario aplica.
//
// Se persiste en el navegador, como el resto de lo que carga el usuario: antes
// la semilla, las tiradas y las ventas sobrevivían al refresh y el branding no,
// así que recargar dejaba la campaña intacta pero sin el logo de la escuela.
//
// Es GLOBAL, no por semilla: el modo de uso que documenta ConfigPanel es dejar
// la semilla fija e ir cambiando el título por escuela, así que la marca no
// pertenece a una campaña. Además, atarla a la semilla haría que estrenar una
// campaña borrara el logo que el usuario acababa de subir.
//
// Va en dos claves a propósito:
//  • el texto se reescribe en cada tecla, y tiene que ser barato;
//  • los logos son imágenes en base64, pesan, y pueden no entrar en la cuota.
// Separados, que no entre un logo no se lleva puesto el resto.
// ─────────────────────────────────────────────────────────────────────────

import { escribirClave, intentarEscribirClave, leerClave } from "./persistencia.ts";

/** Logo cargado por el usuario, en memoria (nunca sale del navegador). */
export interface LogoImagen {
  /** Bytes de la imagen, para embeber en el PDF. */
  bytes: Uint8Array;
  /** Tipo soportado por pdf-lib. */
  tipo: "image/png" | "image/jpeg";
  /** Data URL para mostrar la miniatura/preview en el DOM. */
  dataUrl: string;
}

/** Cuál de los dos logos del encabezado. */
export type SlotLogo = "logoIzquierdo" | "logoDerecho";

/** Configuración de marca del cartón. */
export interface Marca {
  /** Título principal (ej: "I.S.F.D. Profesorado de Educación Física"). */
  titulo: string;
  /** Subtítulo / ubicación (ej: "Bella Vista - Corrientes"). */
  subtitulo: string;
  /** Nombre del evento (ej: "Gran Bingo Solidario 2026"). */
  evento: string;
  /** Etiqueta de serie del talón (ej: "A"). Vacío = sin serie. */
  serie: string;
  /** Color principal en formato hex (#rrggbb). */
  color: string;
  /** Logo del lado izquierdo del encabezado. */
  logoIzquierdo: LogoImagen | null;
  /** Logo del lado derecho del encabezado. */
  logoDerecho: LogoImagen | null;
}

/** Marca por defecto. */
export const MARCA_INICIAL: Marca = {
  titulo: "",
  subtitulo: "",
  evento: "",
  serie: "",
  // Igual que el preset "Azul" de ConfigPanel: si no coinciden, al abrir la
  // app no se ve ningún color elegido.
  color: "#2563eb",
  logoIzquierdo: null,
  logoDerecho: null,
};

/** ¿Hay algo que mostrar en la banda de encabezado (título/subtítulo/logos)? */
export function tieneEncabezado(marca: Marca): boolean {
  return (
    marca.titulo.trim().length > 0 ||
    marca.subtitulo.trim().length > 0 ||
    marca.logoIzquierdo !== null ||
    marca.logoDerecho !== null
  );
}

const CLAVE_MARCA = "bingo90:marca:v1";
const CLAVE_LOGOS = "bingo90:marca-logos:v1";

/** Los campos de texto de la marca (todo menos los logos). */
type TextoMarca = Omit<Marca, "logoIzquierdo" | "logoDerecho">;

/** Un logo tal como se guarda: sin los bytes, que se reconstruyen al leer. */
interface LogoGuardado {
  tipo: LogoImagen["tipo"];
  dataUrl: string;
}

function esTexto(v: unknown): v is string {
  return typeof v === "string";
}

function esLogoGuardado(v: unknown): v is LogoGuardado {
  if (typeof v !== "object" || v === null) return false;
  const l = v as Record<string, unknown>;
  return (
    (l.tipo === "image/png" || l.tipo === "image/jpeg") &&
    typeof l.dataUrl === "string" &&
    l.dataUrl.startsWith("data:")
  );
}

/** Reconstruye los bytes para el PDF a partir del data URL guardado. */
function bytesDeDataUrl(dataUrl: string): Uint8Array | null {
  try {
    const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
    const binario = atob(base64);
    const bytes = new Uint8Array(binario.length);
    for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

function leerJson(clave: string): Record<string, unknown> | null {
  const crudo = leerClave(clave);
  if (!crudo) return null;
  try {
    const datos: unknown = JSON.parse(crudo);
    if (typeof datos !== "object" || datos === null || Array.isArray(datos)) {
      return null;
    }
    return datos as Record<string, unknown>;
  } catch {
    return null;
  }
}

function leerLogo(datos: Record<string, unknown>, slot: SlotLogo): LogoImagen | null {
  const guardado = datos[slot];
  if (!esLogoGuardado(guardado)) return null;
  const bytes = bytesDeDataUrl(guardado.dataUrl);
  if (!bytes) return null;
  return { bytes, tipo: guardado.tipo, dataUrl: guardado.dataUrl };
}

/**
 * La marca guardada, campo por campo sobre los valores por defecto. Lo que
 * esté dañado o falte se ignora en silencio: a diferencia de la campaña, acá
 * no hay nada que el usuario pueda perder sin darse cuenta (ve el cartón en la
 * vista previa), así que no vale la pena molestarlo con un aviso.
 */
export function leerMarca(): Marca {
  const marca: Marca = { ...MARCA_INICIAL };

  const texto = leerJson(CLAVE_MARCA);
  if (texto) {
    const campos: (keyof TextoMarca)[] = [
      "titulo",
      "subtitulo",
      "evento",
      "serie",
      "color",
    ];
    for (const campo of campos) {
      if (esTexto(texto[campo])) marca[campo] = texto[campo];
    }
  }

  const logos = leerJson(CLAVE_LOGOS);
  if (logos) {
    marca.logoIzquierdo = leerLogo(logos, "logoIzquierdo");
    marca.logoDerecho = leerLogo(logos, "logoDerecho");
  }

  return marca;
}

/**
 * Guarda los campos de texto. Es barato y se llama en cada tecla; si falla,
 * pasa por el estado global de persistencia (si no entra ni el título, la
 * campaña tampoco se está guardando y eso sí hay que avisarlo).
 */
export function guardarTextoMarca(marca: Marca): void {
  const texto: TextoMarca = {
    titulo: marca.titulo,
    subtitulo: marca.subtitulo,
    evento: marca.evento,
    serie: marca.serie,
    color: marca.color,
  };
  escribirClave(CLAVE_MARCA, JSON.stringify(texto));
}

/**
 * Guarda los logos. Devuelve `false` si no entraron: son lo único de la app
 * que puede no entrar por su tamaño, y el usuario tiene que saber que ese logo
 * no va a estar cuando vuelva.
 */
export function guardarLogosMarca(marca: Marca): boolean {
  const guardables: Record<SlotLogo, LogoGuardado | null> = {
    logoIzquierdo: marca.logoIzquierdo
      ? { tipo: marca.logoIzquierdo.tipo, dataUrl: marca.logoIzquierdo.dataUrl }
      : null,
    logoDerecho: marca.logoDerecho
      ? { tipo: marca.logoDerecho.tipo, dataUrl: marca.logoDerecho.dataUrl }
      : null,
  };
  return intentarEscribirClave(CLAVE_LOGOS, JSON.stringify(guardables));
}
