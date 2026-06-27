// ─────────────────────────────────────────────────────────────────────────
// Generación del código QR del talón.
//
// El QR es OFFLINE: codifica los datos del cartón (N°, serie, id y los 15
// números). No apunta a ningún servidor; al escanearlo se ven esos datos,
// lo que sirve como respaldo/registro y para cotejar un cartón a mano.
// ─────────────────────────────────────────────────────────────────────────

import QRCode from "qrcode";
import type { Carton } from "../core/types.ts";

/** Texto que se codifica dentro del QR de un cartón. */
export function contenidoQr(
  carton: Carton,
  numero: number,
  serie: string,
): string {
  const numeros = carton.filas
    .flat()
    .filter((c): c is number => c !== null)
    .join(",");
  const partes = [
    "BINGO90",
    `N:${String(numero).padStart(4, "0")}`,
    serie.trim() ? `S:${serie.trim()}` : null,
    `ID:${carton.id}`,
    `#:${numeros}`,
  ].filter(Boolean);
  return partes.join(" ");
}

/** Genera el data URL (PNG) del QR para un texto dado. */
export async function generarQrDataUrl(texto: string): Promise<string> {
  return QRCode.toDataURL(texto, {
    margin: 1,
    width: 220,
    errorCorrectionLevel: "M",
  });
}

/** Convierte un data URL (base64) a bytes. Funciona en navegador y en Node. */
export function dataUrlABytes(dataUrl: string): Uint8Array {
  const b64 = dataUrl.split(",")[1] ?? "";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
