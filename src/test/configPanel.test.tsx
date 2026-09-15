// @vitest-environment jsdom
//
// Estos dos casos no se podían testear con `renderToStaticMarkup`: zustand v4
// usa `getInitialState` para el snapshot del render de servidor, así que un
// `setState` posterior no llegaba al HTML. Montando de verdad, el hook lee el
// estado actual y se pueden probar.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";

/** Cambia el estado del store y deja que React repinte antes de mirar el DOM. */
function aplicar(
  useBingo: { setState: (parcial: Record<string, unknown>) => void },
  estado: Record<string, unknown>,
): void {
  act(() => useBingo.setState(estado));
}

const SEMILLA = 7;

/** Monta el panel y devuelve el store, para poder forzar estado. */
async function montarPanel() {
  vi.resetModules();
  const { ConfigPanel } = await import("../components/ConfigPanel.tsx");
  const { useBingo } = await import("../state/store.ts");
  render(<ConfigPanel />);
  return useBingo;
}

describe("barra de progreso del PDF", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("bingo90:semilla:v1", String(SEMILLA));
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("sin generar no hay barra", async () => {
    await montarPanel();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("muestra cuántos cartones van y cuánto llenó la barra", async () => {
    const useBingo = await montarPanel();

    aplicar(useBingo, { generando: true, progreso: { hechos: 30, total: 200 } });

    const barra = screen.getByRole("progressbar");
    expect(barra.getAttribute("aria-valuenow")).toBe("30");
    expect(barra.getAttribute("aria-valuemax")).toBe("200");
    expect(screen.getByText("30 de 200 cartones")).toBeDefined();
    const relleno = barra.querySelector<HTMLElement>('div[style*="width"]');
    expect(relleno?.style.width).toBe("15%");
  });

  it("con los cartones listos avisa que falta armar el archivo", async () => {
    // El `doc.save()` de pdf-lib tarda un par de segundos más y no se puede
    // cortar: sin este texto la barra se queda llena y parece trabada.
    const useBingo = await montarPanel();

    aplicar(useBingo, { generando: true, progreso: { hechos: 200, total: 200 } });

    expect(screen.getByText("Armando el archivo…")).toBeDefined();
  });

  it("al terminar, la barra desaparece", async () => {
    const useBingo = await montarPanel();
    aplicar(useBingo, { generando: true, progreso: { hechos: 30, total: 200 } });
    expect(screen.getByRole("progressbar")).toBeDefined();

    aplicar(useBingo, { generando: false, progreso: null });

    expect(screen.queryByRole("progressbar")).toBeNull();
  });
});

describe("aviso de logo que no entró en el navegador", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("bingo90:semilla:v1", String(SEMILLA));
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("con los logos guardados no aparece", async () => {
    await montarPanel();
    expect(screen.queryByText(/demasiado pesado/i)).toBeNull();
  });

  it("avisa que el logo no va a estar la próxima vez", async () => {
    const useBingo = await montarPanel();

    aplicar(useBingo, { logosGuardados: false });

    const aviso = screen.getByText(/demasiado pesado para guardarlo/i);
    expect(aviso.textContent).toMatch(/cargarlo de nuevo/);
    // No es el cartel rojo de persistencia: la campaña no está en riesgo.
    expect(screen.queryByText(/No se pudo guardar lo último/)).toBeNull();
  });
});
