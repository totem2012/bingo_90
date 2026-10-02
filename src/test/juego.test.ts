import { describe, it, expect } from "vitest";
import {
  SECUENCIA,
  bolillasRestantes,
  crearRng,
  cumple,
  etapaActual,
  ganadoresDe,
  sacarBolilla,
  type Carton,
} from "../core/index.ts";

/**
 * Cartón armado a mano (no hace falta que respete los rangos por columna:
 * las reglas del juego solo miran qué números tiene y en qué fila).
 */
const CARTON: Carton = {
  id: "test",
  filas: [
    [1, null, 20, null, 40, null, 60, null, 80],
    [null, 11, null, 31, null, 51, null, 71, 85],
    [2, 12, 22, null, 42, null, 62, null, null],
  ],
};
const FILA_1 = [1, 20, 40, 60, 80];
const TODOS = CARTON.filas.flat().filter((c): c is number => c !== null);

const salidas = (...n: number[]) => new Set(n);

describe("cumple: cuaterna", () => {
  it("con 4 números de la misma fila es cuaterna", () => {
    expect(cumple(CARTON, salidas(1, 20, 40, 60), "cuaterna")).toBe(true);
  });

  it("con 4 números en filas distintas NO es cuaterna", () => {
    // El cliente la juega así: los 4 tienen que estar en la misma línea.
    expect(cumple(CARTON, salidas(1, 11, 22, 85), "cuaterna")).toBe(false);
  });

  it("3 + 3 en dos filas no alcanza aunque sean 6 salidos", () => {
    expect(cumple(CARTON, salidas(1, 20, 40, 11, 31, 51), "cuaterna")).toBe(false);
  });

  it("con 3 no alcanza", () => {
    expect(cumple(CARTON, salidas(1, 11, 22), "cuaterna")).toBe(false);
  });

  it("las bolillas que no están en el cartón no cuentan", () => {
    expect(cumple(CARTON, salidas(1, 11, 22, 3, 4, 5, 90), "cuaterna")).toBe(false);
  });
});

describe("cumple: fila", () => {
  it("una fila completa es fila", () => {
    expect(cumple(CARTON, salidas(...FILA_1), "fila")).toBe(true);
  });

  it("4 de 5 en una fila no alcanza, aunque haya muchos salidos en otras", () => {
    expect(
      cumple(CARTON, salidas(1, 20, 40, 60, 11, 31, 51, 71, 2, 12, 22, 42), "fila"),
    ).toBe(false);
  });
});

describe("cumple: cartón lleno", () => {
  it("con los 15 números es cartón lleno", () => {
    expect(cumple(CARTON, salidas(...TODOS), "lleno")).toBe(true);
  });

  it("con 14 no", () => {
    expect(cumple(CARTON, salidas(...TODOS.slice(1)), "lleno")).toBe(false);
  });
});

describe("ganadoresDe", () => {
  const OTRO: Carton = {
    id: "otro",
    filas: [
      [3, null, 23, null, 43, null, 63, null, 83],
      [null, 13, null, 33, null, 53, null, 73, 86],
      [4, 14, 24, null, 44, null, 64, null, null],
    ],
  };
  const cartones = [
    { numero: 10, carton: CARTON },
    { numero: 20, carton: OTRO },
  ];

  it("si completan varios con la misma bolilla, ganan todos", () => {
    // 4 de la primera fila de cada cartón.
    const s = salidas(1, 20, 40, 60, 3, 23, 43, 63);
    expect(ganadoresDe(cartones, s, "cuaterna")).toEqual([10, 20]);
  });

  it("sin nadie que complete, no hay ganadores", () => {
    expect(ganadoresDe(cartones, salidas(1, 3), "cuaterna")).toEqual([]);
  });
});

describe("sacarBolilla", () => {
  it("saca las 90 sin repetir ninguna y después lanza", () => {
    const rng = crearRng(123);
    const salidas: number[] = [];
    for (let i = 0; i < 90; i++) salidas.push(sacarBolilla(salidas, rng));

    expect(new Set(salidas).size).toBe(90);
    expect(Math.min(...salidas)).toBe(1);
    expect(Math.max(...salidas)).toBe(90);
    expect(() => sacarBolilla(salidas, rng)).toThrow(/90 bolillas/);
  });

  it("solo elige entre las que quedan adentro", () => {
    const afuera = bolillasRestantes([]).filter((n) => n !== 47);
    expect(sacarBolilla(afuera, () => 0.99)).toBe(47);
  });
});

describe("etapaActual", () => {
  it("arranca en la cuaterna y sigue la secuencia del cliente", () => {
    expect(SECUENCIA).toEqual([
      "cuaterna",
      "sorteo",
      "fila",
      "sorteo",
      "lleno",
    ]);
    expect(etapaActual([])).toBe(0);
    expect(etapaActual([{ etapa: 0 }])).toBe(1);
    expect(etapaActual([{ etapa: 0 }, { etapa: 0 }, { etapa: 1 }])).toBe(2);
  });

  it("con todas las etapas cerradas, el juego terminó", () => {
    expect(etapaActual(SECUENCIA.map((_, etapa) => ({ etapa })))).toBeNull();
  });

  it("un sorteo guardado después del cartón lleno no reabre el juego", () => {
    // Antes la noche terminaba con un sorteo más (etapa 5).
    const viejos = [0, 1, 2, 3, 4, 5].map((etapa) => ({ etapa }));
    expect(etapaActual(viejos)).toBeNull();
  });

  it("los sorteos de antes de las etapas no hacen avanzar el juego", () => {
    expect(etapaActual([{}, {}])).toBe(0);
  });
});
