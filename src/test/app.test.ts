import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { registrarTirada } from "../lib/registro.ts";
import { agregarRango } from "../lib/ventas.ts";
import { reiniciarPersistencia } from "../lib/persistencia.ts";
import { textoProgreso } from "../components/ConfigPanel.tsx";

// Mock mínimo de localStorage para renderizar la app fuera del navegador.
function instalarLocalStorage(): void {
  const data = new Map<string, string>();
  // @ts-expect-error: definimos un localStorage simplificado para el test.
  globalThis.localStorage = {
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
  };
}

/** Renderiza la app entera a HTML con el storage que haya quedado sembrado. */
async function renderizarApp(): Promise<string> {
  vi.resetModules();
  const { default: App } = await import("../App.tsx");
  return renderToStaticMarkup(createElement(App));
}

const SEMILLA = 7;

describe("aviso de registros dañados", () => {
  beforeEach(() => {
    instalarLocalStorage();
    localStorage.setItem("bingo90:semilla:v1", String(SEMILLA));
  });

  it("no aparece con una campaña sana", async () => {
    registrarTirada(SEMILLA, "Escuela Pepito", 100);
    agregarRango(SEMILLA, 1, 10, { comprador: "Ana", telefono: "", vendedor: "" }, 100);

    const html = await renderizarApp();

    expect(html).not.toMatch(/registro dañado|registros dañados/);
  });

  it("avisa en pantalla cuántos registros se descartaron y qué hacer", async () => {
    // Una tirada incoherente (declara 100 pero el tramo es de 5) y dos ventas
    // podridas: el storage que dejaba un import corrupto.
    localStorage.setItem(
      "bingo90:registro:v1",
      JSON.stringify({
        [SEMILLA]: [
          { titulo: "Rota", cantidad: 100, desde: 1, hasta: 5, fecha: "2026-01-01" },
        ],
      }),
    );
    localStorage.setItem(
      "bingo90:ventas:v1",
      JSON.stringify({ [SEMILLA]: [null, 42] }),
    );

    const html = await renderizarApp();

    expect(html).toMatch(/Se descartaron 3 registros dañados/);
    // El aviso tiene que decir qué hacer, no solo que algo pasó.
    expect(html).toMatch(/numeración/i);
    expect(html).toMatch(/respaldo/i);
  });

  it("con un solo registro dañado el texto va en singular", async () => {
    localStorage.setItem(
      "bingo90:premios:v1",
      JSON.stringify({ [SEMILLA]: ["basura"] }),
    );

    const html = await renderizarApp();

    expect(html).toMatch(/Se descartó 1 registro dañado/);
  });
});

describe("aviso de storage ilegible", () => {
  beforeEach(() => {
    instalarLocalStorage();
    localStorage.setItem("bingo90:semilla:v1", String(SEMILLA));
  });

  it("avisa que no se pudo leer lo guardado, con su propio texto", async () => {
    // Sin esto la app se veía igual que una campaña nueva: vacía y sana.
    localStorage.setItem("bingo90:ventas:v1", "{no es json");

    const html = await renderizarApp();

    expect(html).toMatch(/No se pudo leer lo que había guardado/);
    expect(html).toMatch(/respaldo/i);
    // No se mezcla con el otro aviso.
    expect(html).not.toMatch(/registros dañados/);
  });

  it("una campaña sana no lo dispara", async () => {
    registrarTirada(SEMILLA, "Escuela Pepito", 100);

    const html = await renderizarApp();

    expect(html).not.toMatch(/No se pudo leer/);
  });
});

describe("aviso de que el navegador no guarda", () => {
  beforeEach(() => {
    instalarLocalStorage();
    localStorage.setItem("bingo90:semilla:v1", String(SEMILLA));
  });

  afterEach(() => {
    instalarLocalStorage();
    reiniciarPersistencia();
  });

  it("avisa y dice que exporte el respaldo, sin botón para ocultarlo", async () => {
    reiniciarPersistencia();
    // @ts-expect-error: simulamos un navegador sin localStorage.
    delete globalThis.localStorage;

    const html = await renderizarApp();

    expect(html).toMatch(/Este navegador no está guardando nada/);
    expect(html).toMatch(/Exportá el respaldo/);
    // Los otros dos avisos se pueden dar por enterados; este no.
    expect(html).not.toMatch(/Entendido/);
  });

  it("si falla el guardado, el texto es el de la cuota", async () => {
    reiniciarPersistencia();
    const data = new Map<string, string>();
    // @ts-expect-error: localStorage que lee pero no guarda.
    globalThis.localStorage = {
      getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => {},
      clear: () => data.clear(),
    };

    const html = await renderizarApp();

    expect(html).toMatch(/No se pudo guardar lo último/);
    expect(html).toMatch(/Exportá el respaldo/);
  });

  it("una campaña sana no lo dispara", async () => {
    reiniciarPersistencia();
    registrarTirada(SEMILLA, "Escuela Pepito", 100);

    const html = await renderizarApp();

    expect(html).not.toMatch(/no está guardando nada|No se pudo guardar/);
  });
});

describe("texto de la barra de progreso", () => {
  it("dice cuántos cartones van, no solo que está generando", () => {
    expect(textoProgreso(30, 200)).toBe("30 de 200 cartones");
  });

  it("antes del primer aviso dice que está preparando", () => {
    // El primer aviso llega recién a los 10 cartones (CARTONES_POR_TANDA).
    expect(textoProgreso(0, 200)).toBe("Preparando 200 cartones…");
  });

  it("con los cartones listos avisa que todavía falta armar el archivo", () => {
    expect(textoProgreso(200, 200)).toBe("Armando el archivo…");
  });
});
