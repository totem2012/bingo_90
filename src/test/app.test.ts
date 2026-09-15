import { describe, it, expect, beforeEach, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { registrarTirada } from "../lib/registro.ts";
import { agregarRango } from "../lib/ventas.ts";

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
