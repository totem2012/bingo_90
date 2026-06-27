import { describe, it, expect } from "vitest";
import type { Carton, Celda } from "../core/types.ts";
import { validarCarton } from "../core/validator.ts";

// Helper: arma un Carton a partir de una matriz cruda (id ficticio).
function carton(filas: Celda[][]): Carton {
  return { id: "test", filas };
}

// Un cartón válido de referencia (cada fila con 5, columnas en rango y ordenadas).
const VALIDO: Celda[][] = [
  [1, null, 20, null, 40, null, 60, null, 80],
  [null, 15, null, 35, null, 55, null, 75, 85],
  [9, 19, null, null, 49, 59, 69, null, null],
];

describe("validarCarton", () => {
  it("acepta un cartón válido de referencia", () => {
    const r = validarCarton(carton(VALIDO));
    expect(r.valido).toBe(true);
    expect(r.errores).toHaveLength(0);
  });

  it("rechaza una fila que no tiene 5 números", () => {
    const malo = VALIDO.map((f) => [...f]);
    malo[0][1] = 5; // fila 0 pasa a tener 6 números
    const r = validarCarton(carton(malo));
    expect(r.valido).toBe(false);
    expect(r.errores.some((e) => e.includes("fila 0"))).toBe(true);
  });

  it("rechaza un número fuera del rango de su columna", () => {
    const malo = VALIDO.map((f) => [...f]);
    malo[0][0] = 50; // columna 0 debe ser 1..9
    const r = validarCarton(carton(malo));
    expect(r.valido).toBe(false);
    expect(r.errores.some((e) => e.includes("fuera del rango"))).toBe(true);
  });

  it("rechaza una columna desordenada", () => {
    const desordenado: Celda[][] = [
      [9, null, 20, null, 40, null, 60, null, 80],
      [null, 15, null, 35, null, 55, null, 75, 85],
      [1, 19, null, null, 49, 59, 69, null, null], // col 0: 9 arriba, 1 abajo
    ];
    const r = validarCarton(carton(desordenado));
    expect(r.valido).toBe(false);
    expect(r.errores.some((e) => e.includes("ascendente"))).toBe(true);
  });

  it("rechaza estructura incorrecta (menos de 3 filas)", () => {
    const r = validarCarton(carton([VALIDO[0], VALIDO[1]]));
    expect(r.valido).toBe(false);
  });
});
