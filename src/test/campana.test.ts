import { describe, it, expect, beforeEach } from "vitest";
import { exportarCampana, importarCampana } from "../lib/campana.ts";
import { registrarTirada, tiradasDe } from "../lib/registro.ts";
import { agregarRango, ventasDe } from "../lib/ventas.ts";
import { premiosDe, registrarPremio } from "../lib/premios.ts";

// Mock mínimo de localStorage para correr la campaña fuera del navegador.
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

/** Deja una campaña con tiradas, ventas y un premio ya sorteado. */
function armarCampana(semilla: number): void {
  registrarTirada(semilla, "Escuela Pepito", 50);
  agregarRango(semilla, 1, 20, {
    comprador: "Escuela Pepito",
    telefono: "3794-111111",
    vendedor: "Ana",
  });
  registrarPremio(semilla, {
    descripcion: "Bicicleta",
    numero: 7,
    comprador: "Escuela Pepito",
    telefono: "3794-111111",
  });
}

describe("exportarCampana", () => {
  beforeEach(() => {
    instalarLocalStorage();
  });

  it("junta semilla, tiradas, ventas y premios", () => {
    armarCampana(42);
    const campana = exportarCampana(42);

    expect(campana.version).toBe(1);
    expect(campana.semilla).toBe(42);
    expect(campana.registro).toHaveLength(1);
    expect(campana.ventas).toHaveLength(20);
    expect(campana.premios).toHaveLength(1);
    expect(campana.exportadoEn).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("de una semilla sin datos exporta listas vacías", () => {
    const campana = exportarCampana(99);
    expect(campana.registro).toEqual([]);
    expect(campana.ventas).toEqual([]);
    expect(campana.premios).toEqual([]);
  });
});

describe("importarCampana", () => {
  beforeEach(() => {
    instalarLocalStorage();
  });

  it("round-trip: exportar e importar en un storage limpio preserva todo", () => {
    armarCampana(42);
    const json = JSON.stringify(exportarCampana(42));

    // Simulamos otra computadora: storage vacío.
    instalarLocalStorage();
    expect(tiradasDe(42)).toHaveLength(0);

    importarCampana(JSON.parse(json));

    expect(tiradasDe(42)).toHaveLength(1);
    expect(tiradasDe(42)[0]).toMatchObject({ titulo: "Escuela Pepito", desde: 1 });
    expect(ventasDe(42)).toHaveLength(20);
    expect(ventasDe(42)[6]).toMatchObject({ numero: 7, comprador: "Escuela Pepito" });
    expect(premiosDe(42)).toHaveLength(1);
    expect(premiosDe(42)[0]).toMatchObject({ numero: 7, descripcion: "Bicicleta" });
  });

  it("reemplaza los datos previos de esa semilla", () => {
    armarCampana(42);
    const json = JSON.stringify(exportarCampana(42));

    // Ensuciamos la campaña después de exportar.
    agregarRango(42, 21, 50, { comprador: "Otro", telefono: "", vendedor: "" });
    expect(ventasDe(42)).toHaveLength(50);

    importarCampana(JSON.parse(json));
    expect(ventasDe(42)).toHaveLength(20);
  });

  it("rechaza un archivo que no es un objeto", () => {
    expect(() => importarCampana(null)).toThrow(/formato/i);
    expect(() => importarCampana("hola")).toThrow(/formato/i);
  });

  it("rechaza otra versión del formato", () => {
    expect(() => importarCampana({ version: 2, semilla: 1 })).toThrow(/versión/i);
  });

  it("rechaza una semilla inválida", () => {
    expect(() => importarCampana({ version: 1 })).toThrow(/semilla/i);
    expect(() => importarCampana({ version: 1, semilla: -3 })).toThrow(/semilla/i);
    expect(() => importarCampana({ version: 1, semilla: "abc" })).toThrow(/semilla/i);
  });

  it("rechaza un archivo al que le faltan listas", () => {
    expect(() =>
      importarCampana({ version: 1, semilla: 1, registro: [], ventas: [] }),
    ).toThrow(/incompleto/i);
  });

  it("no escribe nada si el archivo es inválido", () => {
    armarCampana(42);
    expect(() => importarCampana({ version: 2, semilla: 42 })).toThrow();
    // La campaña original sigue intacta.
    expect(ventasDe(42)).toHaveLength(20);
  });
});
