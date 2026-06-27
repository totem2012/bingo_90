// ─────────────────────────────────────────────────────────────────────────
// Arma el documento PDF completo paginando las unidades (talón + cartón).
// Función (async) pura: recibe cartones (+ marca opcional) y devuelve bytes.
// Sirve igual en el navegador o en Node.
// ─────────────────────────────────────────────────────────────────────────

import {
  PDFDocument,
  rgb,
  StandardFonts,
  type PDFImage,
  type RGB,
} from "pdf-lib";
import type { Carton } from "../core/types.ts";
import type { Marca } from "../lib/marca.ts";
import {
  A4,
  CARTONES_POR_HOJA_DEFECTO,
  rectangulosDeCartones,
} from "./layout.ts";
import { dibujarUnidad, type MarcaResuelta } from "./renderCarton.ts";
import { contenidoQr, dataUrlABytes, generarQrDataUrl } from "./qr.ts";

export interface OpcionesPdf {
  /** Cartones por hoja A4 (apilados verticalmente). Por defecto 3. */
  cartonesPorHoja?: number;
  /** Título del documento PDF (metadato). */
  tituloDocumento?: string;
  /** Número del primer cartón (por defecto 1). Útil para imprimir por tandas. */
  numeroInicial?: number;
  /** Personalización de marca (logos, título, color, evento, serie). */
  marca?: Marca;
}

/** Convierte un color hex (#rrggbb o #rgb) a RGB de pdf-lib. */
function hexARgb(hex: string): RGB {
  const limpio = hex.replace("#", "").trim();
  const completo =
    limpio.length === 3
      ? limpio
          .split("")
          .map((c) => c + c)
          .join("")
      : limpio;
  const n = parseInt(completo, 16);
  if (Number.isNaN(n)) return rgb(0.12, 0.23, 0.54);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

const MARCA_VACIA: Marca = {
  titulo: "",
  subtitulo: "",
  evento: "",
  serie: "",
  color: "#1e3a8a",
  logoIzquierdo: null,
  logoDerecho: null,
};

/**
 * Construye un PDF con todas las unidades y devuelve sus bytes.
 */
export async function construirPdf(
  cartones: Carton[],
  opciones: OpcionesPdf = {},
): Promise<Uint8Array> {
  if (cartones.length === 0) {
    throw new Error("No hay cartones para generar el PDF");
  }

  const porHoja = opciones.cartonesPorHoja ?? CARTONES_POR_HOJA_DEFECTO;
  const numeroInicial = opciones.numeroInicial ?? 1;
  const marca = opciones.marca ?? MARCA_VACIA;
  const rects = rectangulosDeCartones(porHoja);

  const doc = await PDFDocument.create();
  doc.setTitle(opciones.tituloDocumento ?? "Cartones de Bingo 90");
  doc.setProducer("Generador de Bingo 90");
  const fuentes = {
    normal: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
  };

  // Embeber los logos una sola vez.
  async function embeber(
    logo: Marca["logoIzquierdo"],
  ): Promise<PDFImage | null> {
    if (!logo) return null;
    return logo.tipo === "image/png"
      ? doc.embedPng(logo.bytes)
      : doc.embedJpg(logo.bytes);
  }

  const marcaResuelta: MarcaResuelta = {
    titulo: marca.titulo,
    subtitulo: marca.subtitulo,
    evento: marca.evento,
    serie: marca.serie,
    color: hexARgb(marca.color),
    logoIzquierdo: await embeber(marca.logoIzquierdo),
    logoDerecho: await embeber(marca.logoDerecho),
  };

  let page = doc.addPage([A4.ancho, A4.alto]);
  for (let i = 0; i < cartones.length; i++) {
    if (i > 0 && i % porHoja === 0) {
      page = doc.addPage([A4.ancho, A4.alto]);
    }
    const numero = numeroInicial + i;
    // QR offline con los datos del cartón.
    const textoQr = contenidoQr(cartones[i], numero, marca.serie);
    const qrImg = await doc.embedPng(dataUrlABytes(await generarQrDataUrl(textoQr)));

    dibujarUnidad(page, fuentes, cartones[i], numero, rects[i % porHoja], marcaResuelta, qrImg);
  }

  return doc.save();
}
