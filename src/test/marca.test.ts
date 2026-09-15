import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  guardarLogosMarca,
  guardarTextoMarca,
  leerMarca,
  MARCA_INICIAL,
  type Marca,
} from "../lib/marca.ts";
import { reiniciarPersistencia } from "../lib/persistencia.ts";

/** localStorage de mentira cuya cuota se puede llenar a mitad del test. */
function instalarLocalStorage(): { llenarCuota: () => void } {
  const data = new Map<string, string>();
  let lleno = false;
  // @ts-expect-error: definimos un localStorage simplificado para el test.
  globalThis.localStorage = {
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    setItem: (k: string, v: string) => {
      if (lleno) throw new Error("QuotaExceededError");
      data.set(k, v);
    },
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
  };
  return {
    llenarCuota: () => {
      lleno = true;
    },
  };
}

// PNG de 1x1 real, para que los bytes se puedan reconstruir de verdad.
const PNG_1X1 =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const CON_LOGO: Marca = {
  titulo: "Escuela Pepito",
  subtitulo: "Bella Vista",
  evento: "Bingo Solidario 2026",
  serie: "A",
  color: "#dc2626",
  logoIzquierdo: {
    bytes: new Uint8Array([1, 2, 3]),
    tipo: "image/png",
    dataUrl: PNG_1X1,
  },
  logoDerecho: null,
};

describe("persistencia de la marca", () => {
  beforeEach(() => {
    instalarLocalStorage();
    reiniciarPersistencia();
  });

  afterEach(() => {
    reiniciarPersistencia();
  });

  it("sin nada guardado devuelve la marca por defecto", () => {
    expect(leerMarca()).toEqual(MARCA_INICIAL);
  });

  it("el texto sobrevive al refresh", () => {
    guardarTextoMarca(CON_LOGO);

    const leida = leerMarca();

    expect(leida.titulo).toBe("Escuela Pepito");
    expect(leida.subtitulo).toBe("Bella Vista");
    expect(leida.evento).toBe("Bingo Solidario 2026");
    expect(leida.serie).toBe("A");
    expect(leida.color).toBe("#dc2626");
  });

  it("los logos sobreviven y sus bytes se reconstruyen para el PDF", () => {
    expect(guardarLogosMarca(CON_LOGO)).toBe(true);

    const leida = leerMarca();

    expect(leida.logoIzquierdo?.tipo).toBe("image/png");
    expect(leida.logoIzquierdo?.dataUrl).toBe(PNG_1X1);
    // Los bytes no se guardan (serializar un Uint8Array a JSON es carísimo):
    // se reconstruyen del data URL y tienen que ser un PNG de verdad.
    const bytes = leida.logoIzquierdo!.bytes;
    expect(bytes.length).toBeGreaterThan(8);
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
    expect(leida.logoDerecho).toBeNull();
  });

  it("el texto se guarda aparte de los logos", () => {
    guardarTextoMarca(CON_LOGO);
    guardarLogosMarca(CON_LOGO);
    // Quitar el logo no se lleva puesto el título.
    guardarLogosMarca({ ...CON_LOGO, logoIzquierdo: null });

    const leida = leerMarca();
    expect(leida.titulo).toBe("Escuela Pepito");
    expect(leida.logoIzquierdo).toBeNull();
  });

  it("un logo que no entra en el navegador se informa, sin perder el resto", () => {
    const storage = instalarLocalStorage();
    guardarTextoMarca(CON_LOGO);
    storage.llenarCuota(); // el logo ya no entra

    expect(guardarLogosMarca(CON_LOGO)).toBe(false);
    // Y no dispara la alarma de "se está perdiendo la campaña": lo que no
    // entró es un logo, no los datos del bingo.
    expect(leerMarca().titulo).toBe("Escuela Pepito");
  });

  it("lo guardado dañado se ignora y se cae a los valores por defecto", () => {
    localStorage.setItem("bingo90:marca:v1", "{no es json");
    localStorage.setItem("bingo90:marca-logos:v1", JSON.stringify({ logoIzquierdo: 42 }));

    const leida = leerMarca();

    expect(leida).toEqual(MARCA_INICIAL);
  });

  it("un campo suelto con el tipo equivocado no se lleva puesto el resto", () => {
    localStorage.setItem(
      "bingo90:marca:v1",
      JSON.stringify({ titulo: "Escuela Pepito", color: 42 }),
    );

    const leida = leerMarca();

    expect(leida.titulo).toBe("Escuela Pepito");
    expect(leida.color).toBe(MARCA_INICIAL.color);
  });

  it("un data URL roto no rompe la lectura", () => {
    localStorage.setItem(
      "bingo90:marca-logos:v1",
      JSON.stringify({
        logoIzquierdo: { tipo: "image/png", dataUrl: "data:image/png;base64,%%%" },
        logoDerecho: null,
      }),
    );

    expect(() => leerMarca()).not.toThrow();
    expect(leerMarca().logoIzquierdo).toBeNull();
  });
});

describe("color por defecto", () => {
  it("coincide con el preset Azul de ConfigPanel", () => {
    // Si no coinciden, al abrir la app no se ve ningún swatch seleccionado.
    expect(MARCA_INICIAL.color).toBe("#2563eb");
  });
});
