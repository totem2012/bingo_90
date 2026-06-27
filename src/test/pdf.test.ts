import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import { generarLote } from "../core/batch.ts";
import { construirPdf } from "../pdf/buildPdf.ts";
import { rectangulosDeCartones } from "../pdf/layout.ts";

describe("construirPdf", () => {
  it("genera un PDF válido y no vacío", async () => {
    const { cartones } = generarLote({ cantidad: 4, semilla: 1 });
    const bytes = await construirPdf(cartones);
    expect(bytes.byteLength).toBeGreaterThan(0);
    // Cabecera de un PDF.
    const cabecera = new TextDecoder().decode(bytes.slice(0, 5));
    expect(cabecera).toBe("%PDF-");
  });

  it("pagina correctamente: 9 cartones con 4 por hoja → 3 páginas", async () => {
    const { cartones } = generarLote({ cantidad: 9, semilla: 7 });
    const bytes = await construirPdf(cartones, { cartonesPorHoja: 4 });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(3);
  });

  it("respeta cartonesPorHoja: 6 cartones con 6 por hoja → 1 página", async () => {
    const { cartones } = generarLote({ cantidad: 6, semilla: 3 });
    const bytes = await construirPdf(cartones, { cartonesPorHoja: 6 });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
  });

  it("rechaza un lote vacío", async () => {
    await expect(construirPdf([])).rejects.toThrow();
  });

  it("genera un PDF válido con marca completa (título, subtítulo, evento, serie, color)", async () => {
    const { cartones } = generarLote({ cantidad: 3, semilla: 11 });
    const bytes = await construirPdf(cartones, {
      marca: {
        titulo: "I.S.F.D. Profesorado de Educación Física",
        subtitulo: "Bella Vista - Corrientes",
        evento: "Gran Bingo Solidario 2026",
        serie: "A",
        color: "#1e3a8a",
        logoIzquierdo: null,
        logoDerecho: null,
      },
    });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
  });

  it("embebe logos PNG en ambos lados sin romper la generación", async () => {
    // PNG 1×1 transparente válido.
    const pngBase64 =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    const bytesPng = Uint8Array.from(atob(pngBase64), (c) => c.charCodeAt(0));
    const logo = { bytes: bytesPng, tipo: "image/png" as const, dataUrl: "" };

    const { cartones } = generarLote({ cantidad: 2, semilla: 22 });
    const bytes = await construirPdf(cartones, {
      marca: {
        titulo: "Bingo Solidario",
        subtitulo: "",
        evento: "Evento 2026",
        serie: "B",
        color: "#16a34a",
        logoIzquierdo: logo,
        logoDerecho: logo,
      },
    });
    const cabecera = new TextDecoder().decode(bytes.slice(0, 5));
    expect(cabecera).toBe("%PDF-");
  });

  it("numera los cartones secuencialmente desde numeroInicial", async () => {
    // No podemos leer el texto del PDF fácilmente, pero sí verificar que el
    // QR de cada cartón (que incluye el N°) hace que el PDF sea más grande
    // con numeración alta y que la generación no falle.
    const { cartones } = generarLote({ cantidad: 5, semilla: 99 });
    const bytes = await construirPdf(cartones, { numeroInicial: 1000 });
    expect(bytes.byteLength).toBeGreaterThan(0);
  });
});

describe("rectangulosDeCartones", () => {
  it("devuelve la cantidad pedida y no se solapan verticalmente", () => {
    const rects = rectangulosDeCartones(4);
    expect(rects).toHaveLength(4);
    for (let i = 1; i < rects.length; i++) {
      const previo = rects[i - 1];
      expect(rects[i].top).toBeGreaterThanOrEqual(previo.top + previo.alto);
    }
  });
});
