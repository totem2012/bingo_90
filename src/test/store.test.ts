import { describe, it, expect, beforeEach, vi } from "vitest";
import type { useBingo as UseBingo } from "../state/store.ts";
import { registrarTirada, tiradasDe } from "../lib/registro.ts";
import { agregarRango, ventasDe, type DatosVenta } from "../lib/ventas.ts";
import { registrarPremio } from "../lib/premios.ts";

// Mock mínimo de localStorage para correr el store fuera del navegador.
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

/**
 * El store lee el storage al EVALUARSE el módulo, así que hay que importarlo
 * de nuevo (con el localStorage ya instalado y sembrado) en cada test.
 */
async function cargarStore(): Promise<typeof UseBingo> {
  vi.resetModules();
  const { useBingo } = await import("../state/store.ts");
  return useBingo;
}

const PEPITO: DatosVenta = {
  comprador: "Escuela Pepito",
  telefono: "3794-111111",
  vendedor: "Ana",
};

const SEMILLA = 7;

/** Dos tiradas de 100 (N° 1–200) y 11 cartones vendidos en la segunda. */
function sembrarCampana(): void {
  registrarTirada(SEMILLA, "Escuela Pepito", 100);
  registrarTirada(SEMILLA, "Escuela Ramón", 100);
  agregarRango(SEMILLA, 150, 160, PEPITO, 200);
}

describe("deshacerUltimaTirada", () => {
  beforeEach(() => {
    instalarLocalStorage();
  });

  it("se niega si en el tramo a deshacer hay cartones vendidos", async () => {
    sembrarCampana();
    const useBingo = await cargarStore();
    useBingo.getState().setSemilla(SEMILLA);

    const r = useBingo.getState().deshacerUltimaTirada();

    if (r.ok) throw new Error("se esperaba que el deshacer se negara");
    expect(r.motivo).toMatch(/11 cartones vendidos entre el 101 y el 200/);
    expect(r.motivo).toMatch(/de baja/i);
    // Nada se movió: ni en el estado ni en el storage.
    expect(useBingo.getState().registro).toHaveLength(2);
    expect(tiradasDe(SEMILLA)).toHaveLength(2);
    expect(ventasDe(SEMILLA)).toHaveLength(11);
  });

  it("dando de baja las ventas del tramo, el deshacer pasa", async () => {
    sembrarCampana();
    const useBingo = await cargarStore();
    useBingo.getState().setSemilla(SEMILLA);
    for (let n = 150; n <= 160; n++) useBingo.getState().anularVenta(n);

    const r = useBingo.getState().deshacerUltimaTirada();

    expect(r.ok).toBe(true);
    expect(useBingo.getState().registro).toHaveLength(1);
    expect(tiradasDe(SEMILLA)).toHaveLength(1);
  });

  it("las ventas de tramos anteriores no frenan el deshacer", async () => {
    registrarTirada(SEMILLA, "Escuela Pepito", 100);
    agregarRango(SEMILLA, 1, 50, PEPITO, 100);
    registrarTirada(SEMILLA, "Escuela Ramón", 100);
    const useBingo = await cargarStore();
    useBingo.getState().setSemilla(SEMILLA);

    expect(useBingo.getState().deshacerUltimaTirada().ok).toBe(true);
    expect(useBingo.getState().registro).toHaveLength(1);
    expect(ventasDe(SEMILLA)).toHaveLength(50); // las ventas quedan intactas
  });

  it("se niega también si en el tramo hay un premio ya sorteado", async () => {
    registrarTirada(SEMILLA, "Escuela Pepito", 100);
    registrarTirada(SEMILLA, "Escuela Ramón", 100);
    // Premio cantado en el evento y venta dada de baja después: el historial
    // de premios no se reescribe (ver lib/premios.ts).
    registrarPremio(SEMILLA, {
      descripcion: "Bicicleta",
      numero: 175,
      comprador: "Escuela Pepito",
      telefono: "",
    });
    const useBingo = await cargarStore();
    useBingo.getState().setSemilla(SEMILLA);

    const r = useBingo.getState().deshacerUltimaTirada();

    if (r.ok) throw new Error("se esperaba que el deshacer se negara");
    expect(r.motivo).toMatch(/1 premio ya sorteado entre el 101 y el 200/);
    expect(useBingo.getState().registro).toHaveLength(2);
  });

  it("sin tiradas no hace nada y no rompe", async () => {
    const useBingo = await cargarStore();
    useBingo.getState().setSemilla(SEMILLA);
    expect(useBingo.getState().deshacerUltimaTirada().ok).toBe(true);
    expect(useBingo.getState().registro).toEqual([]);
  });
});

describe("venderRango", () => {
  beforeEach(() => {
    instalarLocalStorage();
  });

  it("no deja vender más allá de los cartones impresos", async () => {
    registrarTirada(SEMILLA, "Escuela Pepito", 100);
    const useBingo = await cargarStore();
    useBingo.getState().setSemilla(SEMILLA);

    expect(() => useBingo.getState().venderRango(1, 101, PEPITO)).toThrow(
      /impresos/i,
    );
    expect(ventasDe(SEMILLA)).toHaveLength(0);

    const { agregados } = useBingo.getState().venderRango(1, 100, PEPITO);
    expect(agregados).toBe(100);
    expect(useBingo.getState().ventas).toHaveLength(100);
  });

  it("sin tiradas no se puede vender nada", async () => {
    const useBingo = await cargarStore();
    useBingo.getState().setSemilla(SEMILLA);
    expect(() => useBingo.getState().venderRango(1, 10, PEPITO)).toThrow();
    expect(ventasDe(SEMILLA)).toHaveLength(0);
  });
});

describe("venderUno", () => {
  beforeEach(() => {
    instalarLocalStorage();
  });

  it("no deja vender un N° que no está impreso", async () => {
    registrarTirada(SEMILLA, "Escuela Pepito", 100);
    const useBingo = await cargarStore();
    useBingo.getState().setSemilla(SEMILLA);

    expect(() => useBingo.getState().venderUno(101, PEPITO)).toThrow(/impres/i);
    expect(ventasDe(SEMILLA)).toHaveLength(0);

    useBingo.getState().venderUno(100, PEPITO);
    expect(useBingo.getState().ventas).toHaveLength(1);
  });
});

describe("registrosDanados", () => {
  beforeEach(() => {
    instalarLocalStorage();
  });

  it("cuenta lo descartado de tiradas, ventas y premios juntos", async () => {
    localStorage.setItem(
      "bingo90:registro:v1",
      JSON.stringify({
        [SEMILLA]: [
          { titulo: "Rota", cantidad: 100, desde: 1, hasta: 5, fecha: "x" },
        ],
      }),
    );
    localStorage.setItem("bingo90:ventas:v1", JSON.stringify({ [SEMILLA]: [null, 42] }));
    localStorage.setItem("bingo90:premios:v1", JSON.stringify({ [SEMILLA]: ["x"] }));

    const useBingo = await cargarStore();
    useBingo.getState().setSemilla(SEMILLA);

    expect(useBingo.getState().registrosDanados).toBe(4);
    expect(useBingo.getState().registro).toEqual([]);
  });

  it("una campaña sana no dispara el aviso", async () => {
    sembrarCampana();
    const useBingo = await cargarStore();
    useBingo.getState().setSemilla(SEMILLA);
    expect(useBingo.getState().registrosDanados).toBe(0);
  });

  it("se puede ocultar el aviso sin tocar lo guardado", async () => {
    localStorage.setItem("bingo90:ventas:v1", JSON.stringify({ [SEMILLA]: [null] }));
    const useBingo = await cargarStore();
    useBingo.getState().setSemilla(SEMILLA);
    expect(useBingo.getState().registrosDanados).toBe(1);

    useBingo.getState().ocultarAvisoDanados();
    expect(useBingo.getState().registrosDanados).toBe(0);
    expect(localStorage.getItem("bingo90:ventas:v1")).toBe(
      JSON.stringify({ [SEMILLA]: [null] }),
    );
  });

  it("reimportar el respaldo limpia el aviso", async () => {
    sembrarCampana();
    const useBingo = await cargarStore();
    useBingo.getState().setSemilla(SEMILLA);
    const respaldo = JSON.stringify({
      version: 1,
      semilla: SEMILLA,
      registro: tiradasDe(SEMILLA),
      ventas: ventasDe(SEMILLA),
      premios: [],
      exportadoEn: new Date().toISOString(),
    });

    // Storage envenenado → aviso arriba.
    localStorage.setItem("bingo90:ventas:v1", JSON.stringify({ [SEMILLA]: [null] }));
    useBingo.getState().setSemilla(SEMILLA);
    expect(useBingo.getState().registrosDanados).toBe(1);

    useBingo.getState().importar(respaldo);

    expect(useBingo.getState().registrosDanados).toBe(0);
    expect(useBingo.getState().ventas).toHaveLength(11);
    expect(useBingo.getState().registro).toHaveLength(2);
  });
});
