// ─────────────────────────────────────────────────────────────────────────
// Modelo de "marca" (branding) del cartón: encabezado, evento, serie, color
// y logos. Es toda la personalización que el usuario aplica.
// ─────────────────────────────────────────────────────────────────────────

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
  color: "#1e3a8a",
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
