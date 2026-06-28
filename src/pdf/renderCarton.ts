// ─────────────────────────────────────────────────────────────────────────
// Dibuja una UNIDAD completa = talón (cupón de control) + cartón.
//
//   ┌──────────────┬───────────────────────────────────────┐
//   │ CUPÓN CONTROL │  [logo]  TÍTULO / subtítulo   [logo]   │  ← encabezado
//   │ CARTÓN N°     │  ===  NOMBRE DEL EVENTO  ===           │  ← evento
//   │   0003        │  1-9 10-19 … 80-90                     │  ← columnas
//   │ [SERIE A]     │  ┌─┬─┬─┬─┬─┬─┬─┬─┬─┐                   │
//   │ Nombre: ___   │  │ │5│ │ │ │6│ │8│ │   ...             │  ← grilla
//   │ Teléfono: ___ │  └─┴─┴─┴─┴─┴─┴─┴─┴─┘                   │
//   │ Vendedor: ___ │                                        │
//   │  [QR]         │                                        │
//   └──────────────┴───────────────────────────────────────┘
//                  ↑ línea de corte punteada (se desprende el talón)
// ─────────────────────────────────────────────────────────────────────────

import { rgb, type PDFFont, type PDFImage, type RGB, type PDFPage } from "pdf-lib";
import { COLUMNAS, FILAS, type Carton } from "../core/types.ts";
import { A4, ETIQUETAS_COLUMNA, FRACCION_TALON, type Rect } from "./layout.ts";

const COLOR_BORDE = rgb(0.1, 0.1, 0.1);
const COLOR_NUMERO = rgb(0.05, 0.05, 0.05);
const COLOR_CELDA_VACIA = rgb(0.96, 0.96, 0.96);
const COLOR_LINEA_CAMPO = rgb(0.5, 0.5, 0.5);
const COLOR_TENUE = rgb(0.45, 0.45, 0.45);
const BLANCO = rgb(1, 1, 1);

/** Fuentes que usa el render. */
export interface Fuentes {
  normal: PDFFont;
  bold: PDFFont;
}

/** Marca ya "resuelta" para dibujar: color en RGB y logos embebidos. */
export interface MarcaResuelta {
  titulo: string;
  subtitulo: string;
  evento: string;
  serie: string;
  color: RGB;
  logoIzquierdo: PDFImage | null;
  logoDerecho: PDFImage | null;
}

function yDesdeArriba(top: number): number {
  return A4.alto - top;
}

/** Color de texto (blanco o negro) según la luminancia del fondo. */
function textoSobre(color: RGB): RGB {
  const lum = 0.299 * color.red + 0.587 * color.green + 0.114 * color.blue;
  return lum > 0.6 ? rgb(0.1, 0.1, 0.1) : BLANCO;
}

/** Mezcla un color con blanco (0 = original, 1 = blanco). Para tintes suaves. */
function aclarar(color: RGB, t: number): RGB {
  return rgb(
    color.red + (1 - color.red) * t,
    color.green + (1 - color.green) * t,
    color.blue + (1 - color.blue) * t,
  );
}

/** Dibuja texto centrado horizontalmente en [x, x+ancho], achicando si no entra. */
function textoCentrado(
  page: PDFPage,
  font: PDFFont,
  texto: string,
  x: number,
  ancho: number,
  topBaseline: number,
  tamano: number,
  color: RGB,
): void {
  let t = tamano;
  while (t > 5 && font.widthOfTextAtSize(texto, t) > ancho) t -= 0.5;
  const w = font.widthOfTextAtSize(texto, t);
  page.drawText(texto, {
    x: x + (ancho - w) / 2,
    y: yDesdeArriba(topBaseline) - t * 0.78,
    size: t,
    font,
    color,
  });
}

/** Dibuja una imagen contenida dentro de una caja, manteniendo proporción. */
function dibujarImagenContenida(
  page: PDFPage,
  img: PDFImage,
  x: number,
  top: number,
  ancho: number,
  alto: number,
): void {
  const escala = Math.min(ancho / img.width, alto / img.height);
  const w = img.width * escala;
  const h = img.height * escala;
  page.drawImage(img, {
    x: x + (ancho - w) / 2,
    y: yDesdeArriba(top + (alto + h) / 2),
    width: w,
    height: h,
  });
}

// ─── Talón (cupón de control) ──────────────────────────────────────────────

function dibujarTalon(
  page: PDFPage,
  fuentes: Fuentes,
  rect: Rect,
  numero: string,
  marca: MarcaResuelta,
  qr: PDFImage,
): void {
  const pad = 6;
  const x = rect.left + pad;
  const ancho = rect.ancho - 2 * pad;
  let top = rect.top + pad;

  // "CUPÓN DE CONTROL"
  textoCentrado(page, fuentes.bold, "CUPÓN DE CONTROL", x, ancho, top, 7, COLOR_TENUE);
  top += 12;

  // "CARTÓN N°"
  textoCentrado(page, fuentes.bold, "CARTÓN N°", x, ancho, top, 8, COLOR_BORDE);
  top += 12;

  // Número grande
  textoCentrado(page, fuentes.bold, numero, x, ancho, top, 22, marca.color);
  top += 24;

  // Pill de serie
  if (marca.serie.trim() !== "") {
    const texto = `SERIE ${marca.serie.trim().toUpperCase()}`;
    const tam = 7;
    const w = fuentes.bold.widthOfTextAtSize(texto, tam) + 12;
    const altoPill = 13;
    const px = x + (ancho - w) / 2;
    page.drawRectangle({
      x: px,
      y: yDesdeArriba(top + altoPill),
      width: w,
      height: altoPill,
      color: marca.color,
    });
    page.drawText(texto, {
      x: px + 6,
      y: yDesdeArriba(top + altoPill) + altoPill / 2 - tam * 0.34,
      size: tam,
      font: fuentes.bold,
      color: textoSobre(marca.color),
    });
    top += altoPill + 8;
  }

  // Campos a completar
  const campos = ["NOMBRE", "TELÉFONO", "DOMICILIO", "VENDEDOR"];
  for (const campo of campos) {
    page.drawText(`${campo}:`, {
      x,
      y: yDesdeArriba(top) - 6,
      size: 6.5,
      font: fuentes.normal,
      color: COLOR_TENUE,
    });
    page.drawLine({
      start: { x, y: yDesdeArriba(top + 9) },
      end: { x: x + ancho, y: yDesdeArriba(top + 9) },
      thickness: 0.5,
      color: COLOR_LINEA_CAMPO,
    });
    top += 16;
  }

  // QR + leyenda (lo que quede de alto, hacia abajo)
  const bottom = rect.top + rect.alto - pad;
  const leyendaAlto = 8;
  const qrLado = Math.min(ancho, bottom - top - leyendaAlto - 2);
  if (qrLado > 20) {
    dibujarImagenContenida(page, qr, x, top, ancho, qrLado);
    textoCentrado(
      page,
      fuentes.normal,
      "ESCANEÁ PARA VALIDAR",
      x,
      ancho,
      top + qrLado + 1,
      5.5,
      COLOR_TENUE,
    );
  }
}

// ─── Cartón (lado derecho) ──────────────────────────────────────────────────

function dibujarCuerpoCarton(
  page: PDFPage,
  fuentes: Fuentes,
  carton: Carton,
  rect: Rect,
  marca: MarcaResuelta,
): void {
  let top = rect.top;
  const hayEncabezado =
    marca.titulo.trim() !== "" ||
    marca.subtitulo.trim() !== "" ||
    marca.logoIzquierdo !== null ||
    marca.logoDerecho !== null;

  // Banda de encabezado (logos + título + subtítulo)
  if (hayEncabezado) {
    const altoEnc = Math.min(rect.alto * 0.3, 64);
    page.drawRectangle({
      x: rect.left,
      y: yDesdeArriba(top + altoEnc),
      width: rect.ancho,
      height: altoEnc,
      color: marca.color,
    });
    const colorTexto = textoSobre(marca.color);
    const ladoLogo = altoEnc - 12;
    if (marca.logoIzquierdo) {
      dibujarImagenContenida(page, marca.logoIzquierdo, rect.left + 6, top + 6, ladoLogo, ladoLogo);
    }
    if (marca.logoDerecho) {
      dibujarImagenContenida(
        page,
        marca.logoDerecho,
        rect.left + rect.ancho - 6 - ladoLogo,
        top + 6,
        ladoLogo,
        ladoLogo,
      );
    }
    const xTexto = rect.left + ladoLogo + 12;
    const anchoTexto = rect.ancho - 2 * (ladoLogo + 12);
    if (marca.titulo.trim() !== "") {
      textoCentrado(page, fuentes.bold, marca.titulo, xTexto, anchoTexto, top + altoEnc * 0.34, 13, colorTexto);
    }
    if (marca.subtitulo.trim() !== "") {
      textoCentrado(page, fuentes.normal, marca.subtitulo, xTexto, anchoTexto, top + altoEnc * 0.66, 8, colorTexto);
    }
    top += altoEnc;
  }

  // Banda de evento
  if (marca.evento.trim() !== "") {
    const altoEv = 18;
    page.drawRectangle({
      x: rect.left,
      y: yDesdeArriba(top + altoEv),
      width: rect.ancho,
      height: altoEv,
      color: aclarar(marca.color, 0.85),
    });
    textoCentrado(page, fuentes.bold, marca.evento.toUpperCase(), rect.left, rect.ancho, top + altoEv * 0.5, 10, marca.color);
    top += altoEv;
  }

  // Encabezados de columna
  const anchoCelda = rect.ancho / COLUMNAS;
  const altoCol = 13;
  for (let j = 0; j < COLUMNAS; j++) {
    const left = rect.left + j * anchoCelda;
    page.drawRectangle({
      x: left,
      y: yDesdeArriba(top + altoCol),
      width: anchoCelda,
      height: altoCol,
      color: aclarar(marca.color, 0.7),
      borderColor: BLANCO,
      borderWidth: 0.5,
    });
    textoCentrado(page, fuentes.bold, ETIQUETAS_COLUMNA[j], left, anchoCelda, top + altoCol * 0.5, 6.5, marca.color);
  }
  top += altoCol;

  // Grilla de números
  const altoGrilla = rect.top + rect.alto - top;
  const altoCelda = altoGrilla / FILAS;
  const tamFuente = Math.min(altoCelda * 0.5, anchoCelda * 0.5, 24);
  for (let fila = 0; fila < FILAS; fila++) {
    for (let col = 0; col < COLUMNAS; col++) {
      const left = rect.left + col * anchoCelda;
      const cellTop = top + fila * altoCelda;
      const valor = carton.filas[fila][col];
      page.drawRectangle({
        x: left,
        y: yDesdeArriba(cellTop + altoCelda),
        width: anchoCelda,
        height: altoCelda,
        borderColor: COLOR_BORDE,
        borderWidth: 0.6,
        color: valor === null ? COLOR_CELDA_VACIA : undefined,
      });
      if (valor !== null) {
        const texto = String(valor);
        const w = fuentes.bold.widthOfTextAtSize(texto, tamFuente);
        page.drawText(texto, {
          x: left + (anchoCelda - w) / 2,
          y: yDesdeArriba(cellTop + altoCelda / 2) - tamFuente * 0.34,
          size: tamFuente,
          font: fuentes.bold,
          color: COLOR_NUMERO,
        });
      }
    }
  }
}

// ─── Unidad completa ─────────────────────────────────────────────────────────

/**
 * Dibuja una unidad (talón + cartón) en el rectángulo `rect`.
 * `numero` es el N° secuencial del cartón (1-based).
 */
export function dibujarUnidad(
  page: PDFPage,
  fuentes: Fuentes,
  carton: Carton,
  numero: number,
  rect: Rect,
  marca: MarcaResuelta,
  qr: PDFImage,
): void {
  const numeroFmt = String(numero).padStart(6, "0");
  const anchoTalon = rect.ancho * FRACCION_TALON;
  const xCorte = rect.left + anchoTalon;

  // Talón (izquierda)
  dibujarTalon(
    page,
    fuentes,
    { left: rect.left, top: rect.top, ancho: anchoTalon, alto: rect.alto },
    numeroFmt,
    marca,
    qr,
  );

  // Cartón (derecha)
  const padCarton = 6;
  dibujarCuerpoCarton(
    page,
    fuentes,
    carton,
    {
      left: xCorte + padCarton,
      top: rect.top,
      ancho: rect.ancho - anchoTalon - padCarton,
      alto: rect.alto,
    },
    marca,
  );

  // Borde externo de toda la unidad.
  page.drawRectangle({
    x: rect.left,
    y: yDesdeArriba(rect.top + rect.alto),
    width: rect.ancho,
    height: rect.alto,
    borderColor: marca.color,
    borderWidth: 1.2,
  });

  // Línea de corte punteada entre talón y cartón.
  page.drawLine({
    start: { x: xCorte, y: yDesdeArriba(rect.top) },
    end: { x: xCorte, y: yDesdeArriba(rect.top + rect.alto) },
    thickness: 0.8,
    color: COLOR_TENUE,
    dashArray: [3, 3],
  });
}
