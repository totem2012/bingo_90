import { describe, it, expect, beforeEach } from "vitest";
import {
  agregarBolilla,
  bolillasDe,
  esListaDeBolillas,
  leerBolillasDe,
  reemplazarBolillas,
  reiniciarBolillas,
} from "../lib/bolillas.ts";

// Mock mínimo de localStorage para correr las bolillas fuera del navegador.
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

const CLAVE = "bingo90:bolillas:v1";

describe("bolillas", () => {
  beforeEach(() => {
    instalarLocalStorage();
  });

  it("se guardan en el orden en que salieron, por semilla", () => {
    agregarBolilla(7, 45);
    agregarBolilla(7, 3);
    agregarBolilla(8, 90);

    expect(bolillasDe(7)).toEqual([45, 3]);
    expect(bolillasDe(8)).toEqual([90]);
  });

  it("una bolilla no puede salir dos veces", () => {
    agregarBolilla(7, 45);
    expect(() => agregarBolilla(7, 45)).toThrow(/ya salió/);
    expect(bolillasDe(7)).toEqual([45]);
  });

  it("rechaza números fuera del bolillero", () => {
    expect(() => agregarBolilla(7, 0)).toThrow();
    expect(() => agregarBolilla(7, 91)).toThrow();
    expect(() => agregarBolilla(7, 2.5)).toThrow();
  });

  it("reiniciar vuelve a meter todas, sin tocar otras semillas", () => {
    agregarBolilla(7, 45);
    agregarBolilla(8, 90);

    expect(reiniciarBolillas(7)).toEqual([]);
    expect(bolillasDe(7)).toEqual([]);
    expect(bolillasDe(8)).toEqual([90]);
  });

  it("reemplazar pisa la lista de la semilla (import de campaña)", () => {
    agregarBolilla(7, 45);
    reemplazarBolillas(7, [1, 2, 3]);
    expect(bolillasDe(7)).toEqual([1, 2, 3]);
  });

  it("descarta lo dañado o repetido y lo cuenta", () => {
    localStorage.setItem(CLAVE, JSON.stringify({ "7": [5, "x", 5, 99, 12] }));

    expect(leerBolillasDe(7)).toEqual({
      bolillas: [5, 12],
      descartados: 3,
      ilegible: false,
    });
  });

  it("distingue un storage ilegible de uno vacío", () => {
    localStorage.setItem(CLAVE, "{roto");
    expect(leerBolillasDe(7).ilegible).toBe(true);

    localStorage.removeItem(CLAVE);
    expect(leerBolillasDe(7)).toEqual({ bolillas: [], descartados: 0, ilegible: false });
  });
});

describe("esListaDeBolillas", () => {
  it("acepta listas válidas y rechaza repetidas o fuera de rango", () => {
    expect(esListaDeBolillas([])).toBe(true);
    expect(esListaDeBolillas([1, 90, 45])).toBe(true);
    expect(esListaDeBolillas([1, 1])).toBe(false);
    expect(esListaDeBolillas([0])).toBe(false);
    expect(esListaDeBolillas("1,2")).toBe(false);
  });
});
