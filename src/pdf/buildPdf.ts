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
 * Cada cuántas unidades le devolvemos el control al navegador. A ~25 ms por
 * cartón, 10 deja tandas de ~250 ms. Probé con 4 y el bloqueo más largo no
 * bajó (280 ms vs 271 ms con 50 cartones): lo que queda ya no es el loop sino
 * el `doc.save()` final, que es de pdf-lib y no se puede cortar desde acá. Así
 * que 10, que hace menos pausas para el mismo resultado.
 */
const CARTONES_POR_TANDA = 10;

/**
 * Devuelve el control al hilo principal.
 *
 * Tiene que ser una MACROtarea: con `await Promise.resolve()` (microtarea) el
 * navegador no llega a repintar, que es justamente lo que hace que la pantalla
 * se vea congelada.
 *
 * Y tiene que ser MessageChannel y no `setTimeout`, porque Chrome estrangula
 * los timers a uno por segundo en las pestañas que no están a la vista: con
 * `setTimeout(0)`, dejar el PDF generando e irse a otra pestaña multiplicaba
 * el tiempo total (medido con 200 cartones: 7,7 s → 25,5 s). Los mensajes de
 * MessageChannel no se estrangulan. Es el mismo motivo por el que el
 * scheduler de React usa MessageChannel.
 */
function cederControl(): Promise<void> {
  return new Promise((resolve) => {
    const canal = new MessageChannel();
    canal.port1.onmessage = () => {
      canal.port1.close();
      canal.port2.close();
      resolve();
    };
    canal.port2.postMessage(undefined);
  });
}

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

    if ((i + 1) % CARTONES_POR_TANDA === 0) {
      await cederControl();
      // Acá va el aviso de progreso cuando se cablee la barra: un
      // `onProgreso?: (hechos: number, total: number) => void` en OpcionesPdf,
      // llamado con (i + 1, cartones.length). Tiene que ser en este punto: es
      // el único momento en que el navegador puede repintar, así que avisar en
      // cualquier otro lado no se vería hasta que el PDF ya estuviera listo.
    }
  }

  return doc.save();
}
