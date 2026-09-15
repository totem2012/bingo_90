import { describe, it, expect, beforeEach } from "vitest";
import {
  consumidos,
  deshacerUltima,
  esTirada,
  leerTiradasDe,
  proximoDesde,
  registrarTirada,
  reiniciarSemilla,
  tiradasDe,
} from "../lib/registro.ts";

// Mock mínimo de localStorage para correr el registro fuera del navegador.
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

describe("registro de tiradas", () => {
  beforeEach(() => {
    instalarLocalStorage();
  });

  it("la próxima tirada continúa automáticamente desde donde terminó la anterior", () => {
    const semilla = 7;
    expect(proximoDesde(semilla)).toBe(1);

    registrarTirada(semilla, "Escuela Pepito", 200);
    expect(proximoDesde(semilla)).toBe(201);

    registrarTirada(semilla, "Escuela Ramon", 300);
    expect(proximoDesde(semilla)).toBe(501);
  });

  it("guarda el tramo [desde, hasta] de cada tirada sin solapar", () => {
    const semilla = 7;
    registrarTirada(semilla, "A", 200);
    const tiradas = registrarTirada(semilla, "B", 300);

    expect(tiradas[0]).toMatchObject({ titulo: "A", desde: 1, hasta: 200 });
    expect(tiradas[1]).toMatchObject({ titulo: "B", desde: 201, hasta: 500 });
    expect(consumidos(tiradas)).toBe(500);
  });

  it("cada semilla lleva su propia cuenta independiente", () => {
    registrarTirada(1, "X", 50);
    expect(proximoDesde(1)).toBe(51);
    expect(proximoDesde(2)).toBe(1); // otra semilla arranca de cero
  });

  it("deshacer última libera el tramo para la próxima tirada", () => {
    const semilla = 9;
    registrarTirada(semilla, "A", 100);
    registrarTirada(semilla, "B", 100);
    expect(proximoDesde(semilla)).toBe(201);

    deshacerUltima(semilla);
    expect(proximoDesde(semilla)).toBe(101);
    expect(tiradasDe(semilla)).toHaveLength(1);
  });

  it("reiniciar vacía el historial y vuelve a empezar en 1", () => {
    const semilla = 9;
    registrarTirada(semilla, "A", 100);
    reiniciarSemilla(semilla);
    expect(tiradasDe(semilla)).toHaveLength(0);
    expect(proximoDesde(semilla)).toBe(1);
  });
});

describe("esTirada", () => {
  const SANA = {
    titulo: "Escuela Pepito",
    cantidad: 100,
    desde: 1,
    hasta: 100,
    fecha: "2026-01-01T00:00:00.000Z",
  };

  it("acepta una tirada bien formada", () => {
    expect(esTirada(SANA)).toBe(true);
  });

  it("rechaza basura y campos con el tipo equivocado", () => {
    expect(esTirada(null)).toBe(false);
    expect(esTirada("x")).toBe(false);
    expect(esTirada({})).toBe(false);
    expect(esTirada({ ...SANA, titulo: 42 })).toBe(false);
    expect(esTirada({ ...SANA, cantidad: 0 })).toBe(false);
    expect(esTirada({ ...SANA, desde: 0 })).toBe(false);
    expect(esTirada({ ...SANA, fecha: undefined })).toBe(false);
  });

  it("rechaza una tirada cuya aritmética no cierra", () => {
    // El caso peligroso: declara 100 cartones impresos con un tramo de 5. El
    // total impreso sale de `cantidad` y el bloqueo del deshacer de
    // desde/hasta, así que las ventas del 6 al 100 quedarían huérfanas.
    expect(esTirada({ ...SANA, hasta: 5 })).toBe(false);
    expect(esTirada({ ...SANA, cantidad: 50 })).toBe(false);
    expect(esTirada({ ...SANA, desde: 10 })).toBe(false);
    // Una tanda de un solo cartón sí cierra.
    expect(esTirada({ ...SANA, cantidad: 1, desde: 7, hasta: 7 })).toBe(true);
  });

  it("lo que registra la app siempre cierra", () => {
    instalarLocalStorage();
    registrarTirada(7, "Escuela Pepito", 100);
    registrarTirada(7, "Escuela Ramón", 250);
    expect(tiradasDe(7).every(esTirada)).toBe(true);
  });
});

describe("lectura de tiradas dañadas", () => {
  beforeEach(() => {
    instalarLocalStorage();
  });

  it("descarta lo corrupto, conserva lo sano y cuenta cuánto se cayó", () => {
    registrarTirada(7, "Escuela Pepito", 100);
    const sana = tiradasDe(7)[0];
    localStorage.setItem(
      "bingo90:registro:v1",
      JSON.stringify({
        "7": [sana, { titulo: "Rota", cantidad: 100, desde: 1, hasta: 5, fecha: "x" }],
      }),
    );

    expect(leerTiradasDe(7)).toEqual({
      tiradas: [sana],
      descartados: 1,
      ilegible: false,
    });
    // Y el total impreso solo cuenta lo sano.
    expect(proximoDesde(7)).toBe(101);
  });

  it("una semilla sin tiradas no cuenta descartes", () => {
    expect(leerTiradasDe(7)).toEqual({
      tiradas: [],
      descartados: 0,
      ilegible: false,
    });
  });

  it("si lo guardado ni siquiera es una lista, cuenta como dañado", () => {
    localStorage.setItem("bingo90:registro:v1", JSON.stringify({ "7": 5 }));
    expect(leerTiradasDe(7)).toEqual({
      tiradas: [],
      descartados: 1,
      ilegible: false,
    });
  });
});

describe("storage ilegible (registro)", () => {
  beforeEach(() => {
    instalarLocalStorage();
  });

  it("un JSON roto se informa como ilegible, no como campaña vacía", () => {
    localStorage.setItem("bingo90:registro:v1", "{no es json");
    expect(leerTiradasDe(7)).toEqual({
      tiradas: [],
      descartados: 0,
      ilegible: true,
    });
    // Y la app sigue de pie.
    expect(() => tiradasDe(7)).not.toThrow();
    expect(proximoDesde(7)).toBe(1);
  });

  it("no haber guardado nunca nada NO es ilegible", () => {
    expect(leerTiradasDe(7).ilegible).toBe(false);
  });

  it("escribir después de un storage ilegible lo deja sano de nuevo", () => {
    localStorage.setItem("bingo90:registro:v1", "{no es json");
    registrarTirada(7, "Escuela Pepito", 100);
    expect(leerTiradasDe(7)).toEqual({
      tiradas: [expect.objectContaining({ desde: 1, hasta: 100 })],
      descartados: 0,
      ilegible: false,
    });
  });
});
