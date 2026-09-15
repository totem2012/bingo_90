import { describe, it, expect, beforeEach } from "vitest";
import {
  deshacerUltimoPremio,
  esPremio,
  leerPremiosDe,
  premiosDe,
  registrarPremio,
  reiniciarPremios,
  reemplazarPremios,
  type DatosPremio,
} from "../lib/premios.ts";

// Mock mínimo de localStorage para correr los premios fuera del navegador.
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

const BICI: DatosPremio = {
  descripcion: "Bicicleta",
  numero: 7,
  comprador: "Escuela Pepito",
  telefono: "3794-111111",
};
const TELE: DatosPremio = {
  descripcion: "Televisor",
  numero: 12,
  comprador: "Ramón",
  telefono: "",
};

describe("esPremio", () => {
  it("acepta un premio bien formado", () => {
    expect(
      esPremio({
        orden: 1,
        descripcion: "Bicicleta",
        numero: 7,
        comprador: "Ana",
        telefono: "",
        fecha: "2026-01-01T00:00:00.000Z",
      }),
    ).toBe(true);
  });

  it("rechaza basura y premios incompletos", () => {
    expect(esPremio(null)).toBe(false);
    expect(esPremio("x")).toBe(false);
    expect(esPremio({})).toBe(false);
    const base = {
      orden: 1,
      descripcion: "Bici",
      numero: 7,
      comprador: "Ana",
      telefono: "",
      fecha: "2026-01-01",
    };
    expect(esPremio({ ...base, orden: 0 })).toBe(false);
    expect(esPremio({ ...base, numero: 1.5 })).toBe(false);
    expect(esPremio({ ...base, comprador: 42 })).toBe(false);
    expect(esPremio({ ...base, fecha: undefined })).toBe(false);
  });
});

describe("historial de premios", () => {
  beforeEach(() => {
    instalarLocalStorage();
  });

  it("arranca vacío", () => {
    expect(premiosDe(7)).toEqual([]);
  });

  it("numera los premios por orden de sorteo", () => {
    registrarPremio(7, BICI);
    const premios = registrarPremio(7, TELE);

    expect(premios.map((p) => p.orden)).toEqual([1, 2]);
    expect(premios[0]).toMatchObject({ numero: 7, descripcion: "Bicicleta" });
    expect(premios[1]).toMatchObject({ numero: 12, descripcion: "Televisor" });
    expect(premios[1].fecha).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("guarda el snapshot del comprador tal como se cantó", () => {
    const [premio] = registrarPremio(7, BICI);
    expect(premio.comprador).toBe("Escuela Pepito");
    expect(premio.telefono).toBe("3794-111111");
  });

  it("recorta la descripción pero deja pasar la vacía", () => {
    const [premio] = registrarPremio(7, { ...BICI, descripcion: "  Bici  " });
    expect(premio.descripcion).toBe("Bici");
    const premios = registrarPremio(7, { ...TELE, descripcion: "" });
    expect(premios[1].descripcion).toBe("");
  });

  it("deshacer saca el último y el siguiente vuelve a numerar bien", () => {
    registrarPremio(7, BICI);
    registrarPremio(7, TELE);

    expect(deshacerUltimoPremio(7).map((p) => p.numero)).toEqual([7]);
    expect(registrarPremio(7, TELE).map((p) => p.orden)).toEqual([1, 2]);
  });

  it("deshacer sin premios no rompe", () => {
    expect(deshacerUltimoPremio(7)).toEqual([]);
  });

  it("cada semilla lleva su historial por separado", () => {
    registrarPremio(1, BICI);
    registrarPremio(2, TELE);

    expect(premiosDe(1)).toHaveLength(1);
    expect(reiniciarPremios(1)).toEqual([]);
    expect(premiosDe(1)).toEqual([]);
    expect(premiosDe(2)).toHaveLength(1); // la otra semilla no se toca
  });

  it("reemplazar pisa el historial de esa semilla (lo usa el import)", () => {
    registrarPremio(7, BICI);
    const premios = premiosDe(7);
    reemplazarPremios(7, []);
    expect(premiosDe(7)).toEqual([]);
    reemplazarPremios(7, premios);
    expect(premiosDe(7)).toEqual(premios);
  });
});

describe("lectura de premios dañados", () => {
  beforeEach(() => {
    instalarLocalStorage();
  });

  it("descarta lo corrupto, conserva lo sano y cuenta cuánto se cayó", () => {
    registrarPremio(7, BICI);
    const sano = premiosDe(7)[0];
    localStorage.setItem(
      "bingo90:premios:v1",
      JSON.stringify({ "7": [null, sano, "basura"] }),
    );

    expect(leerPremiosDe(7)).toEqual({
      premios: [sano],
      descartados: 2,
      ilegible: false,
    });
  });

  it("una semilla sin premios no cuenta descartes", () => {
    expect(leerPremiosDe(7)).toEqual({
      premios: [],
      descartados: 0,
      ilegible: false,
    });
  });

  it("si lo guardado ni siquiera es una lista, cuenta como dañado", () => {
    localStorage.setItem("bingo90:premios:v1", JSON.stringify({ "7": "hola" }));
    expect(leerPremiosDe(7)).toEqual({
      premios: [],
      descartados: 1,
      ilegible: false,
    });
  });

  it("un storage ilegible se lee vacío, sin romper pero avisando", () => {
    localStorage.setItem("bingo90:premios:v1", "{no es json");
    expect(() => premiosDe(7)).not.toThrow();
    expect(leerPremiosDe(7)).toEqual({
      premios: [],
      descartados: 0,
      ilegible: true,
    });
  });

  it("una clave que no es un objeto también es ilegible", () => {
    localStorage.setItem("bingo90:premios:v1", JSON.stringify([1, 2, 3]));
    expect(leerPremiosDe(7).ilegible).toBe(true);
  });

  it("no haber guardado nunca nada NO es ilegible", () => {
    expect(leerPremiosDe(7).ilegible).toBe(false);
  });
});
