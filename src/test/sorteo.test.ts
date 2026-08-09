import { describe, it, expect } from "vitest";
import { elegibles, sortearUno } from "../core/sorteo.ts";
import { crearRng } from "../core/rng.ts";

describe("elegibles", () => {
  it("saca del bombo a los que ya ganaron", () => {
    expect(elegibles([1, 2, 3, 4, 5], [2, 4])).toEqual([1, 3, 5]);
  });

  it("devuelve todos si nadie ganó todavía", () => {
    expect(elegibles([7, 8, 9], [])).toEqual([7, 8, 9]);
  });

  it("devuelve vacío si ya ganaron todos", () => {
    expect(elegibles([1, 2], [2, 1])).toEqual([]);
  });

  it("ignora ganadores que no están entre los vendidos", () => {
    expect(elegibles([1, 2], [99])).toEqual([1, 2]);
  });

  it("mantiene el orden de los vendidos", () => {
    expect(elegibles([5, 1, 3], [1])).toEqual([5, 3]);
  });
});

describe("sortearUno", () => {
  it("lanza si el bombo está vacío", () => {
    expect(() => sortearUno([])).toThrow();
  });

  it("con un solo candidato devuelve ese", () => {
    expect(sortearUno([42])).toBe(42);
  });

  it("siempre devuelve un elemento de la lista", () => {
    const items = [10, 20, 30, 40];
    for (let i = 0; i < 200; i++) {
      expect(items).toContain(sortearUno(items));
    }
  });

  it("es determinista con un RNG con semilla", () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const a = sortearUno(items, crearRng(1234));
    const b = sortearUno(items, crearRng(1234));
    expect(a).toBe(b);
  });

  it("sorteando sin reponer se agota el bombo sin repetir", () => {
    const vendidos = [1, 2, 3, 4, 5];
    const rng = crearRng(7);
    const ganadores: number[] = [];

    while (true) {
      const bombo = elegibles(vendidos, ganadores);
      if (bombo.length === 0) break;
      ganadores.push(sortearUno(bombo, rng));
    }

    expect(ganadores).toHaveLength(5);
    expect(new Set(ganadores).size).toBe(5);
    expect([...ganadores].sort((a, b) => a - b)).toEqual(vendidos);
  });
});
