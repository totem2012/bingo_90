import { describe, it, expect, beforeEach } from "vitest";
import {
  agregarRango,
  agregarVenta,
  esNumeroVendible,
  leerVentasDe,
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
    const ventas = agregarVenta(7, 12, PEPITO, 50);
    expect(ventas).toHaveLength(1);
    expect(ventas[0]).toMatchObject({
      numero: 12,
      comprador: "Escuela Pepito",
      telefono: "3794-111111",
      vendedor: "Ana",
    });
  });

  it("no pisa una venta existente al recargar el mismo N°", () => {
    agregarVenta(7, 12, PEPITO, 50);
    const ventas = agregarVenta(7, 12, RAMON, 50);
    expect(ventas).toHaveLength(1);
    expect(ventas[0].comprador).toBe("Escuela Pepito");
  });

  it("no se puede vender de a uno un N° que no está impreso", () => {
    // Mismo agujero que tenía el rango: la invariante no puede vivir solo en
    // el formulario.
    expect(() => agregarVenta(7, 51, PEPITO, 50)).toThrow(/impres/i);
    expect(() => agregarVenta(7, 0, PEPITO, 50)).toThrow(/impres/i);
    expect(() => agregarVenta(7, 1.5, PEPITO, 50)).toThrow(/impres/i);
    expect(() => agregarVenta(7, 1, PEPITO, 0)).toThrow(/impres/i);
    expect(ventasDe(7)).toEqual([]);
  });

  it("carga un rango completo de una vez", () => {
    const { ventas, agregados, salteados } = agregarRango(7, 1, 200, PEPITO, 200);
    expect(agregados).toBe(200);
    expect(salteados).toBe(0);
    expect(ventas).toHaveLength(200);
    expect(ventas[0].numero).toBe(1);
    expect(ventas[199].numero).toBe(200);
  });

  it("un rango solapado saltea los ya vendidos y los informa", () => {
    agregarRango(7, 1, 30, PEPITO, 40);
    const { agregados, salteados, ventas } = agregarRango(7, 20, 40, RAMON, 40);

    expect(agregados).toBe(10); // 31..40
    expect(salteados).toBe(11); // 20..30
    expect(ventas).toHaveLength(40);
    // Los solapados conservan al comprador original.
    expect(ventas.find((v) => v.numero === 25)?.comprador).toBe("Escuela Pepito");
    expect(ventas.find((v) => v.numero === 35)?.comprador).toBe("Ramón");
  });

  it("no se puede vender un rango que se pasa de los cartones impresos", () => {
    // El caso que motivó la validación: llamando a la capa de datos directo
    // se cargaban 50.000 ventas sin un solo cartón impreso.
    expect(() => agregarRango(7, 1, 50_000, PEPITO, 0)).toThrow(/impres/i);
    expect(() => agregarRango(7, 1, 51, PEPITO, 50)).toThrow(/impres/i);
    expect(ventasDe(7)).toEqual([]);
  });

  it("no se puede vender un rango dado vuelta o con N° no enteros", () => {
    expect(() => agregarRango(7, 40, 20, PEPITO, 50)).toThrow(/rango/i);
    expect(() => agregarRango(7, 1.5, 20, PEPITO, 50)).toThrow(/rango/i);
    expect(() => agregarRango(7, NaN, 20, PEPITO, 50)).toThrow(/rango/i);
    expect(() => agregarRango(7, 0, 20, PEPITO, 50)).toThrow(/impres/i);
    expect(ventasDe(7)).toEqual([]);
  });

  it("acepta el rango completo de lo impreso", () => {
    const { agregados } = agregarRango(7, 1, 50, PEPITO, 50);
    expect(agregados).toBe(50);
  });

  it("devuelve las ventas ordenadas por N° de cartón", () => {
    agregarVenta(7, 30, PEPITO, 50);
    agregarVenta(7, 5, PEPITO, 50);
    agregarVenta(7, 17, PEPITO, 50);
    expect(ventasDe(7).map((v) => v.numero)).toEqual([5, 17, 30]);
  });

  it("quitar libera el cartón", () => {
    agregarRango(7, 1, 3, PEPITO, 3);
    const ventas = quitarVenta(7, 2);
    expect(ventas.map((v) => v.numero)).toEqual([1, 3]);
  });

  it("cada semilla lleva sus ventas por separado", () => {
    agregarRango(1, 1, 10, PEPITO, 10);
    expect(ventasDe(1)).toHaveLength(10);
    expect(ventasDe(2)).toHaveLength(0);
  });

  it("limpiar borra todas las ventas de esa semilla", () => {
    agregarRango(1, 1, 10, PEPITO, 10);
    agregarRango(2, 1, 5, RAMON, 5);
    expect(limpiarVentas(1)).toEqual([]);
    expect(ventasDe(1)).toHaveLength(0);
    expect(ventasDe(2)).toHaveLength(5); // la otra semilla no se toca
  });
});

describe("lectura de ventas dañadas", () => {
  beforeEach(() => {
    instalarLocalStorage();
  });

  it("descarta lo corrupto, conserva lo sano y cuenta cuánto se cayó", () => {
    agregarVenta(7, 3, PEPITO, 50);
    const sana = ventasDe(7)[0];
    localStorage.setItem(
      "bingo90:ventas:v1",
      JSON.stringify({ "7": [null, sana, 42, { numero: 5 }] }),
    );

    expect(leerVentasDe(7)).toEqual({
      ventas: [sana],
      descartados: 3,
      ilegible: false,
    });
  });

  it("una semilla sin ventas no cuenta descartes", () => {
    expect(leerVentasDe(7)).toEqual({
      ventas: [],
      descartados: 0,
      ilegible: false,
    });
  });

  it("si lo guardado ni siquiera es una lista, cuenta como dañado", () => {
    localStorage.setItem("bingo90:ventas:v1", JSON.stringify({ "7": "hola" }));
    expect(leerVentasDe(7)).toEqual({
      ventas: [],
      descartados: 1,
      ilegible: false,
    });
  });
});

describe("storage ilegible (ventas)", () => {
  beforeEach(() => {
    instalarLocalStorage();
  });

  it("un JSON roto se informa como ilegible, no como campaña vacía", () => {
    localStorage.setItem("bingo90:ventas:v1", "{no es json");
    expect(leerVentasDe(7)).toEqual({
      ventas: [],
      descartados: 0,
      ilegible: true,
    });
    expect(() => ventasDe(7)).not.toThrow();
  });

  it("una clave que no es un objeto también es ilegible", () => {
    localStorage.setItem("bingo90:ventas:v1", JSON.stringify(["x"]));
    expect(leerVentasDe(7).ilegible).toBe(true);
  });

  it("no haber guardado nunca nada NO es ilegible", () => {
    expect(leerVentasDe(7).ilegible).toBe(false);
  });
});
