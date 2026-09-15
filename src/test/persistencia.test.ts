import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  alCambiarPersistencia,
  escribirClave,
  estadoPersistencia,
  hayStorage,
  leerClave,
  reiniciarPersistencia,
} from "../lib/persistencia.ts";

/** localStorage de mentira al que se le puede romper cada operación. */
function instalarLocalStorage(fallas: {
  getItem?: boolean;
  setItem?: boolean;
} = {}): Map<string, string> {
  const data = new Map<string, string>();
  // @ts-expect-error: definimos un localStorage simplificado para el test.
  globalThis.localStorage = {
    getItem: (k: string) => {
      if (fallas.getItem) throw new Error("bloqueado");
      return data.has(k) ? data.get(k)! : null;
    },
    setItem: (k: string, v: string) => {
      if (fallas.setItem) throw new Error("QuotaExceededError");
      data.set(k, v);
    },
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
  };
  return data;
}

function sacarLocalStorage(): void {
  // @ts-expect-error: simulamos un navegador sin localStorage.
  delete globalThis.localStorage;
}

describe("estado de persistencia", () => {
  beforeEach(() => {
    instalarLocalStorage();
    reiniciarPersistencia();
  });

  afterEach(() => {
    reiniciarPersistencia();
  });

  it("con un navegador normal se guarda y el estado queda en ok", () => {
    escribirClave("bingo90:prueba", "hola");
    expect(leerClave("bingo90:prueba")).toBe("hola");
    expect(estadoPersistencia()).toBe("ok");
  });

  it("leer una clave que no existe no es un problema de persistencia", () => {
    expect(leerClave("bingo90:nada")).toBeNull();
    expect(estadoPersistencia()).toBe("ok");
  });

  it("sin localStorage avisa que no se está guardando nada", () => {
    sacarLocalStorage();
    expect(hayStorage()).toBe(false);
    expect(estadoPersistencia()).toBe("sin-storage");
    // Y la app sigue de pie: escribir y leer no rompen.
    expect(() => escribirClave("bingo90:prueba", "hola")).not.toThrow();
    expect(leerClave("bingo90:prueba")).toBeNull();
  });

  it("si el navegador bloquea la lectura también avisa", () => {
    instalarLocalStorage({ getItem: true });
    expect(leerClave("bingo90:prueba")).toBeNull();
    expect(estadoPersistencia()).toBe("sin-storage");
  });

  it("si falla el guardado (cuota llena) avisa, sin lanzar", () => {
    instalarLocalStorage({ setItem: true });
    expect(() => escribirClave("bingo90:prueba", "hola")).not.toThrow();
    expect(estadoPersistencia()).toBe("error-al-guardar");
  });

  it("no hay storage gana sobre falló un guardado", () => {
    sacarLocalStorage();
    escribirClave("bingo90:prueba", "hola");
    expect(estadoPersistencia()).toBe("sin-storage");
  });

  it("avisa a quien esté escuchando, una sola vez por cambio", () => {
    const vistos: string[] = [];
    const desuscribir = alCambiarPersistencia((e) => vistos.push(e));

    instalarLocalStorage({ setItem: true });
    escribirClave("bingo90:prueba", "1");
    escribirClave("bingo90:prueba", "2");
    expect(vistos).toEqual(["error-al-guardar"]);

    desuscribir();
    reiniciarPersistencia();
    expect(vistos).toEqual(["error-al-guardar"]);
  });
});
