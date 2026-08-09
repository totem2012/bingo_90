import { describe, it, expect, beforeEach } from "vitest";
import {
  agregarRango,
  agregarVenta,
  esNumeroVendible,
  limpiarVentas,
  quitarVenta,
  ventasDe,
  type DatosVenta,
} from "../lib/ventas.ts";

// Mock mínimo de localStorage para correr las ventas fuera del navegador.
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

const PEPITO: DatosVenta = {
  comprador: "Escuela Pepito",
  telefono: "3794-111111",
  vendedor: "Ana",
};
const RAMON: DatosVenta = { comprador: "Ramón", telefono: "", vendedor: "" };

describe("esNumeroVendible", () => {
  it("acepta solo enteros dentro de los cartones impresos", () => {
    expect(esNumeroVendible(1, 50)).toBe(true);
    expect(esNumeroVendible(50, 50)).toBe(true);
    expect(esNumeroVendible(0, 50)).toBe(false);
    expect(esNumeroVendible(51, 50)).toBe(false);
    expect(esNumeroVendible(1.5, 50)).toBe(false);
    expect(esNumeroVendible(NaN, 50)).toBe(false);
  });

  it("sin cartones impresos no se puede vender nada", () => {
    expect(esNumeroVendible(1, 0)).toBe(false);
  });
});

describe("registro de ventas", () => {
  beforeEach(() => {
    instalarLocalStorage();
  });

  it("arranca vacío", () => {
    expect(ventasDe(7)).toEqual([]);
  });

  it("carga un cartón con los datos del comprador", () => {
    const ventas = agregarVenta(7, 12, PEPITO);
    expect(ventas).toHaveLength(1);
    expect(ventas[0]).toMatchObject({
      numero: 12,
      comprador: "Escuela Pepito",
      telefono: "3794-111111",
      vendedor: "Ana",
    });
  });

  it("no pisa una venta existente al recargar el mismo N°", () => {
    agregarVenta(7, 12, PEPITO);
    const ventas = agregarVenta(7, 12, RAMON);
    expect(ventas).toHaveLength(1);
    expect(ventas[0].comprador).toBe("Escuela Pepito");
  });

  it("carga un rango completo de una vez", () => {
    const { ventas, agregados, salteados } = agregarRango(7, 1, 200, PEPITO);
    expect(agregados).toBe(200);
    expect(salteados).toBe(0);
    expect(ventas).toHaveLength(200);
    expect(ventas[0].numero).toBe(1);
    expect(ventas[199].numero).toBe(200);
  });

  it("un rango solapado saltea los ya vendidos y los informa", () => {
    agregarRango(7, 1, 30, PEPITO);
    const { agregados, salteados, ventas } = agregarRango(7, 20, 40, RAMON);

    expect(agregados).toBe(10); // 31..40
    expect(salteados).toBe(11); // 20..30
    expect(ventas).toHaveLength(40);
    // Los solapados conservan al comprador original.
    expect(ventas.find((v) => v.numero === 25)?.comprador).toBe("Escuela Pepito");
    expect(ventas.find((v) => v.numero === 35)?.comprador).toBe("Ramón");
  });

  it("devuelve las ventas ordenadas por N° de cartón", () => {
    agregarVenta(7, 30, PEPITO);
    agregarVenta(7, 5, PEPITO);
    agregarVenta(7, 17, PEPITO);
    expect(ventasDe(7).map((v) => v.numero)).toEqual([5, 17, 30]);
  });

  it("quitar libera el cartón", () => {
    agregarRango(7, 1, 3, PEPITO);
    const ventas = quitarVenta(7, 2);
    expect(ventas.map((v) => v.numero)).toEqual([1, 3]);
  });

  it("cada semilla lleva sus ventas por separado", () => {
    agregarRango(1, 1, 10, PEPITO);
    expect(ventasDe(1)).toHaveLength(10);
    expect(ventasDe(2)).toHaveLength(0);
  });

  it("limpiar borra todas las ventas de esa semilla", () => {
    agregarRango(1, 1, 10, PEPITO);
    agregarRango(2, 1, 5, RAMON);
    expect(limpiarVentas(1)).toEqual([]);
    expect(ventasDe(1)).toHaveLength(0);
    expect(ventasDe(2)).toHaveLength(5); // la otra semilla no se toca
  });
});
