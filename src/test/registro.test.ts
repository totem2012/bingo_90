import { describe, it, expect, beforeEach } from "vitest";
import {
  consumidos,
  deshacerUltima,
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
