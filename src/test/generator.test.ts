import { describe, it, expect } from "vitest";
import {
  COLUMNAS,
  FILAS,
  NUMEROS_POR_CARTON,
  NUMEROS_POR_FILA,
  RANGOS_COLUMNA,
} from "../core/types.ts";
import { generarCarton } from "../core/generator.ts";
import { generarLote } from "../core/batch.ts";
import { esCartonValido } from "../core/validator.ts";

describe("generarCarton", () => {
  it("produce cartones válidos de forma consistente (5000 cartones)", () => {
    for (let n = 0; n < 5000; n++) {
      const carton = generarCarton();
      expect(esCartonValido(carton), `cartón inválido en iteración ${n}`).toBe(true);
    }
  });

  it("cada fila tiene exactamente 5 números", () => {
    for (let n = 0; n < 500; n++) {
      const c = generarCarton();
      for (let i = 0; i < FILAS; i++) {
        const cuenta = c.filas[i].filter((x) => x !== null).length;
        expect(cuenta).toBe(NUMEROS_POR_FILA);
      }
    }
  });

  it("cada columna respeta su rango y tiene entre 1 y 3 números", () => {
    for (let n = 0; n < 500; n++) {
      const c = generarCarton();
      for (let j = 0; j < COLUMNAS; j++) {
        const [min, max] = RANGOS_COLUMNA[j];
        const col = [c.filas[0][j], c.filas[1][j], c.filas[2][j]].filter(
          (x): x is number => x !== null,
        );
        expect(col.length).toBeGreaterThanOrEqual(1);
        expect(col.length).toBeLessThanOrEqual(3);
        for (const v of col) {
          expect(v).toBeGreaterThanOrEqual(min);
          expect(v).toBeLessThanOrEqual(max);
        }
      }
    }
  });

  it("tiene 15 números en total", () => {
    const c = generarCarton();
    const total = c.filas.flat().filter((x) => x !== null).length;
    expect(total).toBe(NUMEROS_POR_CARTON);
  });

  it("es determinista: misma semilla → mismo cartón", () => {
    const a = generarCarton(12345);
    const b = generarCarton(12345);
    expect(a.id).toBe(b.id);
    expect(a.filas).toEqual(b.filas);
  });

  it("semillas distintas suelen dar cartones distintos", () => {
    const a = generarCarton(1);
    const b = generarCarton(2);
    expect(a.id).not.toBe(b.id);
  });
});

describe("generarLote", () => {
  it("genera la cantidad pedida, todos válidos y sin duplicados", () => {
    const { cartones } = generarLote({ cantidad: 200 });
    expect(cartones).toHaveLength(200);

    const ids = new Set(cartones.map((c) => c.id));
    expect(ids.size).toBe(200); // sin duplicados

    for (const c of cartones) {
      expect(esCartonValido(c)).toBe(true);
    }
  });

  it("es reproducible vía la semilla devuelta", () => {
    const primero = generarLote({ cantidad: 50 });
    const segundo = generarLote({ cantidad: 50, semilla: primero.semilla });
    expect(segundo.cartones.map((c) => c.id)).toEqual(
      primero.cartones.map((c) => c.id),
    );
  });

  it("garantiza unicidad por CONTENIDO en un lote grande (no por hash)", () => {
    const { cartones } = generarLote({ cantidad: 3000 });
    const claves = new Set(
      cartones.map((c) =>
        c.filas.map((f) => f.map((x) => x ?? "_").join(",")).join("|"),
      ),
    );
    expect(claves.size).toBe(3000);
  });

  it("rechaza cantidades inválidas", () => {
    expect(() => generarLote({ cantidad: 0 })).toThrow();
    expect(() => generarLote({ cantidad: -3 })).toThrow();
    expect(() => generarLote({ cantidad: 2.5 })).toThrow();
  });
});
