import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { SEMILLA_MAXIMA, type useBingo as UseBingo } from "../state/store.ts";
import { registrarTirada, semillaRecordada, tiradasDe } from "../lib/registro.ts";
import { agregarRango, ventasDe, type DatosVenta } from "../lib/ventas.ts";
import { premiosDe, registrarPremio } from "../lib/premios.ts";
import { bolillasDe } from "../lib/bolillas.ts";
import { SECUENCIA, cumple, generarLote, type ModalidadBolillero } from "../core/index.ts";
import { reiniciarPersistencia } from "../lib/persistencia.ts";

// Mock mínimo de localStorage para correr el store fuera del navegador.
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

/**
 * El store lee el storage al EVALUARSE el módulo, así que hay que importarlo
 * de nuevo (con el localStorage ya instalado y sembrado) en cada test.
 */
async function cargarStore(): Promise<typeof UseBingo> {
  vi.resetModules();
  const { useBingo } = await import("../state/store.ts");
  return useBingo;
}

const PEPITO: DatosVenta = {
  comprador: "Escuela Pepito",
  telefono: "3794-111111",
  vendedor: "Ana",
};

const SEMILLA = 7;

/** Dos tiradas de 100 (N° 1–200) y 11 cartones vendidos en la segunda. */
function sembrarCampana(): void {
  registrarTirada(SEMILLA, "Escuela Pepito", 100);
  registrarTirada(SEMILLA, "Escuela Ramón", 100);
  agregarRango(SEMILLA, 150, 160, PEPITO, 200);
}

describe("deshacerUltimaTirada", () => {
  beforeEach(() => {
    instalarLocalStorage();
  });

  it("se niega si en el tramo a deshacer hay cartones vendidos", async () => {
    sembrarCampana();
    const useBingo = await cargarStore();
    useBingo.getState().setSemilla(SEMILLA);

    const r = useBingo.getState().deshacerUltimaTirada();

    if (r.ok) throw new Error("se esperaba que el deshacer se negara");
    expect(r.motivo).toMatch(/11 cartones vendidos entre el 101 y el 200/);
    expect(r.motivo).toMatch(/de baja/i);
    // Nada se movió: ni en el estado ni en el storage.
    expect(useBingo.getState().registro).toHaveLength(2);
    expect(tiradasDe(SEMILLA)).toHaveLength(2);
    expect(ventasDe(SEMILLA)).toHaveLength(11);
  });

  it("dando de baja las ventas del tramo, el deshacer pasa", async () => {
    sembrarCampana();
    const useBingo = await cargarStore();
    useBingo.getState().setSemilla(SEMILLA);
    for (let n = 150; n <= 160; n++) useBingo.getState().anularVenta(n);

    const r = useBingo.getState().deshacerUltimaTirada();

    expect(r.ok).toBe(true);
    expect(useBingo.getState().registro).toHaveLength(1);
    expect(tiradasDe(SEMILLA)).toHaveLength(1);
  });

  it("las ventas de tramos anteriores no frenan el deshacer", async () => {
    registrarTirada(SEMILLA, "Escuela Pepito", 100);
    agregarRango(SEMILLA, 1, 50, PEPITO, 100);
    registrarTirada(SEMILLA, "Escuela Ramón", 100);
    const useBingo = await cargarStore();
    useBingo.getState().setSemilla(SEMILLA);

    expect(useBingo.getState().deshacerUltimaTirada().ok).toBe(true);
    expect(useBingo.getState().registro).toHaveLength(1);
    expect(ventasDe(SEMILLA)).toHaveLength(50); // las ventas quedan intactas
  });

  it("se niega también si en el tramo hay un premio ya sorteado", async () => {
    registrarTirada(SEMILLA, "Escuela Pepito", 100);
    registrarTirada(SEMILLA, "Escuela Ramón", 100);
    // Premio cantado en el evento y venta dada de baja después: el historial
    // de premios no se reescribe (ver lib/premios.ts).
    registrarPremio(SEMILLA, {
      descripcion: "Bicicleta",
      numero: 175,
      comprador: "Escuela Pepito",
      telefono: "",
    });
    const useBingo = await cargarStore();
    useBingo.getState().setSemilla(SEMILLA);

    const r = useBingo.getState().deshacerUltimaTirada();

    if (r.ok) throw new Error("se esperaba que el deshacer se negara");
    expect(r.motivo).toMatch(/1 premio ya sorteado entre el 101 y el 200/);
    expect(useBingo.getState().registro).toHaveLength(2);
  });

  it("sin tiradas no hace nada y no rompe", async () => {
    const useBingo = await cargarStore();
    useBingo.getState().setSemilla(SEMILLA);
    expect(useBingo.getState().deshacerUltimaTirada().ok).toBe(true);
    expect(useBingo.getState().registro).toEqual([]);
  });
});

describe("venderRango", () => {
  beforeEach(() => {
    instalarLocalStorage();
  });

  it("no deja vender más allá de los cartones impresos", async () => {
    registrarTirada(SEMILLA, "Escuela Pepito", 100);
    const useBingo = await cargarStore();
    useBingo.getState().setSemilla(SEMILLA);

    expect(() => useBingo.getState().venderRango(1, 101, PEPITO)).toThrow(
      /impresos/i,
    );
    expect(ventasDe(SEMILLA)).toHaveLength(0);

    const { agregados } = useBingo.getState().venderRango(1, 100, PEPITO);
    expect(agregados).toBe(100);
    expect(useBingo.getState().ventas).toHaveLength(100);
  });

  it("sin tiradas no se puede vender nada", async () => {
    const useBingo = await cargarStore();
    useBingo.getState().setSemilla(SEMILLA);
    expect(() => useBingo.getState().venderRango(1, 10, PEPITO)).toThrow();
    expect(ventasDe(SEMILLA)).toHaveLength(0);
  });
});

describe("venderUno", () => {
  beforeEach(() => {
    instalarLocalStorage();
  });

  it("no deja vender un N° que no está impreso", async () => {
    registrarTirada(SEMILLA, "Escuela Pepito", 100);
    const useBingo = await cargarStore();
    useBingo.getState().setSemilla(SEMILLA);

    expect(() => useBingo.getState().venderUno(101, PEPITO)).toThrow(/impres/i);
    expect(ventasDe(SEMILLA)).toHaveLength(0);

    useBingo.getState().venderUno(100, PEPITO);
    expect(useBingo.getState().ventas).toHaveLength(1);
  });
});

describe("registrosDanados", () => {
  beforeEach(() => {
    instalarLocalStorage();
  });

  it("cuenta lo descartado de tiradas, ventas y premios juntos", async () => {
    localStorage.setItem(
      "bingo90:registro:v1",
      JSON.stringify({
        [SEMILLA]: [
          { titulo: "Rota", cantidad: 100, desde: 1, hasta: 5, fecha: "x" },
        ],
      }),
    );
    localStorage.setItem("bingo90:ventas:v1", JSON.stringify({ [SEMILLA]: [null, 42] }));
    localStorage.setItem("bingo90:premios:v1", JSON.stringify({ [SEMILLA]: ["x"] }));

    const useBingo = await cargarStore();
    useBingo.getState().setSemilla(SEMILLA);

    expect(useBingo.getState().registrosDanados).toBe(4);
    expect(useBingo.getState().registro).toEqual([]);
  });

  it("una campaña sana no dispara el aviso", async () => {
    sembrarCampana();
    const useBingo = await cargarStore();
    useBingo.getState().setSemilla(SEMILLA);
    expect(useBingo.getState().registrosDanados).toBe(0);
  });

  it("se puede ocultar el aviso sin tocar lo guardado", async () => {
    localStorage.setItem("bingo90:ventas:v1", JSON.stringify({ [SEMILLA]: [null] }));
    const useBingo = await cargarStore();
    useBingo.getState().setSemilla(SEMILLA);
    expect(useBingo.getState().registrosDanados).toBe(1);

    useBingo.getState().ocultarAvisoDatos();
    expect(useBingo.getState().registrosDanados).toBe(0);
    expect(localStorage.getItem("bingo90:ventas:v1")).toBe(
      JSON.stringify({ [SEMILLA]: [null] }),
    );
  });

  it("reimportar el respaldo limpia el aviso", async () => {
    sembrarCampana();
    const useBingo = await cargarStore();
    useBingo.getState().setSemilla(SEMILLA);
    const respaldo = JSON.stringify({
      version: 1,
      semilla: SEMILLA,
      registro: tiradasDe(SEMILLA),
      ventas: ventasDe(SEMILLA),
      premios: [],
      exportadoEn: new Date().toISOString(),
    });

    // Storage envenenado → aviso arriba.
    localStorage.setItem("bingo90:ventas:v1", JSON.stringify({ [SEMILLA]: [null] }));
    useBingo.getState().setSemilla(SEMILLA);
    expect(useBingo.getState().registrosDanados).toBe(1);

    useBingo.getState().importar(respaldo);

    expect(useBingo.getState().registrosDanados).toBe(0);
    expect(useBingo.getState().ventas).toHaveLength(11);
    expect(useBingo.getState().registro).toHaveLength(2);
  });
});

describe("reiniciarCampana", () => {
  beforeEach(() => {
    instalarLocalStorage();
  });

  it("borra registro, ventas y premios juntos", async () => {
    sembrarCampana();
    registrarPremio(SEMILLA, {
      descripcion: "Bicicleta",
      numero: 155,
      comprador: "Escuela Pepito",
      telefono: "",
    });
    const useBingo = await cargarStore();
    useBingo.getState().setSemilla(SEMILLA);

    useBingo.getState().reiniciarCampana();

    expect(useBingo.getState().registro).toEqual([]);
    expect(useBingo.getState().ventas).toEqual([]);
    expect(useBingo.getState().premios).toEqual([]);
    expect(useBingo.getState().ultimoResultado).toEqual([]);
    expect(tiradasDe(SEMILLA)).toEqual([]);
    expect(ventasDe(SEMILLA)).toEqual([]);
  });

  it("apaga el aviso de datos dañados en vez de dejarlo colgado", async () => {
    // Campaña dañada → cartel arriba → el usuario reinicia a propósito. El
    // cartel no puede seguir diciéndole que revise un historial que acaba de
    // vaciar, ni que importe el respaldo.
    localStorage.setItem(
      "bingo90:ventas:v1",
      JSON.stringify({ [SEMILLA]: [null, 42] }),
    );
    const useBingo = await cargarStore();
    useBingo.getState().setSemilla(SEMILLA);
    expect(useBingo.getState().registrosDanados).toBe(2);

    useBingo.getState().reiniciarCampana();

    expect(useBingo.getState().registrosDanados).toBe(0);
    expect(useBingo.getState().datosIlegibles).toBe(false);
  });
});

describe("datosIlegibles", () => {
  beforeEach(() => {
    instalarLocalStorage();
  });

  it("una clave ilegible se avisa aunque no haya registros descartados", async () => {
    localStorage.setItem("bingo90:ventas:v1", "{no es json");
    const useBingo = await cargarStore();
    useBingo.getState().setSemilla(SEMILLA);

    expect(useBingo.getState().datosIlegibles).toBe(true);
    // Justamente el caso que no avisaba: 0 descartados y campaña vacía.
    expect(useBingo.getState().registrosDanados).toBe(0);
    expect(useBingo.getState().ventas).toEqual([]);
  });

  it("una campaña sana no lo dispara", async () => {
    sembrarCampana();
    const useBingo = await cargarStore();
    useBingo.getState().setSemilla(SEMILLA);
    expect(useBingo.getState().datosIlegibles).toBe(false);
  });

  it("se puede ocultar el aviso sin tocar lo guardado", async () => {
    localStorage.setItem("bingo90:premios:v1", "{no es json");
    const useBingo = await cargarStore();
    useBingo.getState().setSemilla(SEMILLA);
    expect(useBingo.getState().datosIlegibles).toBe(true);

    useBingo.getState().ocultarAvisoDatos();

    expect(useBingo.getState().datosIlegibles).toBe(false);
    expect(localStorage.getItem("bingo90:premios:v1")).toBe("{no es json");
  });
});

/** localStorage al que se le puede romper el guardado. */
function instalarLocalStorageQueNoGuarda(): void {
  const data = new Map<string, string>();
  // @ts-expect-error: definimos un localStorage simplificado para el test.
  globalThis.localStorage = {
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    setItem: () => {
      throw new Error("QuotaExceededError");
    },
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
  };
}

describe("aviso de persistencia", () => {
  beforeEach(() => {
    instalarLocalStorage();
    reiniciarPersistencia();
  });

  afterEach(() => {
    instalarLocalStorage();
    reiniciarPersistencia();
  });

  it("con un navegador que guarda, no avisa nada", async () => {
    sembrarCampana();
    const useBingo = await cargarStore();
    expect(useBingo.getState().persistencia).toBe("ok");
  });

  it("sin localStorage avisa desde que abre, antes de imprimir nada", async () => {
    // @ts-expect-error: simulamos un navegador sin localStorage.
    delete globalThis.localStorage;

    const useBingo = await cargarStore();

    expect(useBingo.getState().persistencia).toBe("sin-storage");
  });

  it("si el guardado falla en mitad de la sesión, el aviso aparece solo", async () => {
    registrarTirada(SEMILLA, "Escuela Pepito", 100);
    const useBingo = await cargarStore();
    useBingo.getState().setSemilla(SEMILLA);
    expect(useBingo.getState().persistencia).toBe("ok");

    // Se llena la cuota recién ahora, cargando una venta.
    instalarLocalStorageQueNoGuarda();
    useBingo.getState().venderUno(5, PEPITO);

    // La venta se ve en pantalla (la app sigue andando en memoria)…
    expect(useBingo.getState().ventas).toHaveLength(1);
    // …pero el usuario se entera de que no quedó guardada.
    expect(useBingo.getState().persistencia).toBe("error-al-guardar");
  });
});

describe("setSemilla", () => {
  beforeEach(() => {
    instalarLocalStorage();
  });

  it("acepta el rango válido, incluidos los bordes", async () => {
    const useBingo = await cargarStore();

    useBingo.getState().setSemilla(0);
    expect(useBingo.getState().semilla).toBe(0);

    useBingo.getState().setSemilla(SEMILLA_MAXIMA);
    expect(useBingo.getState().semilla).toBe(SEMILLA_MAXIMA);
  });

  it("rechaza una semilla fuera de rango en vez de envolverla en silencio", async () => {
    const useBingo = await cargarStore();
    useBingo.getState().setSemilla(123);

    // 2³² se envolvía a 0: el usuario anotaba 4294967296 y se guardaba otra
    // campaña, así que no podía retomar la suya.
    expect(() => useBingo.getState().setSemilla(SEMILLA_MAXIMA + 1)).toThrow(
      /entero entre 0/,
    );
    expect(() => useBingo.getState().setSemilla(-1)).toThrow();
    expect(() => useBingo.getState().setSemilla(1.5)).toThrow();
    expect(() => useBingo.getState().setSemilla(NaN)).toThrow();

    // Y la campaña anterior quedó intacta.
    expect(useBingo.getState().semilla).toBe(123);
    expect(semillaRecordada()).toBe(123);
  });
});

describe("marca", () => {
  beforeEach(() => {
    instalarLocalStorage();
  });

  it("sobrevive al refresh, igual que la campaña", async () => {
    const useBingo = await cargarStore();
    useBingo.getState().setTitulo("Escuela Pepito");
    useBingo.getState().setSubtitulo("Bella Vista");
    useBingo.getState().setColor("#dc2626");
    useBingo.getState().setSerie("A");

    // El usuario recarga la página.
    const recargado = await cargarStore();

    expect(recargado.getState().marca.titulo).toBe("Escuela Pepito");
    expect(recargado.getState().marca.subtitulo).toBe("Bella Vista");
    expect(recargado.getState().marca.color).toBe("#dc2626");
    expect(recargado.getState().marca.serie).toBe("A");
  });

  it("es global: cambiar de campaña no borra el branding", async () => {
    const useBingo = await cargarStore();
    useBingo.getState().setTitulo("Escuela Pepito");

    useBingo.getState().nuevaSemilla();

    expect(useBingo.getState().marca.titulo).toBe("Escuela Pepito");
  });

  it("un logo que no entra en el navegador se avisa en el estado", async () => {
    const useBingo = await cargarStore();
    const data = new Map<string, string>();
    // @ts-expect-error: localStorage que lee pero no guarda.
    globalThis.localStorage = {
      getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => {},
      clear: () => data.clear(),
    };

    useBingo.getState().setLogo("logoIzquierdo", {
      bytes: new Uint8Array([1, 2, 3]),
      tipo: "image/png",
      dataUrl: "data:image/png;base64,iVBORw0KGgo=",
    });

    // Se ve en pantalla y entra en el PDF de ahora…
    expect(useBingo.getState().marca.logoIzquierdo).not.toBeNull();
    // …pero el usuario se entera de que no va a estar la próxima vez.
    expect(useBingo.getState().logosGuardados).toBe(false);
  });
});

describe("juego", () => {
  beforeEach(() => {
    instalarLocalStorage();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** Los cartones regenerados de la semilla, por N°. */
  function cartonDe(numero: number) {
    return generarLote({ cantidad: 1, semilla: SEMILLA, desde: numero }).cartones[0];
  }

  /** Saca bolillas hasta que alguien gana la etapa en curso. */
  function sacarHastaGanador(useBingo: typeof UseBingo) {
    for (let i = 0; i < 90; i++) {
      const r = useBingo.getState().sacarBolilla("");
      if (!r) throw new Error("sacarBolilla se negó en una etapa de bolillero");
      if (r.ganadores.length > 0) return r;
    }
    throw new Error("salieron las 90 bolillas sin ganador");
  }

  it("los ganadores cumplen con las bolillas que salieron, y antes nadie cumplía", async () => {
    sembrarCampana();
    const useBingo = await cargarStore();
    useBingo.getState().setSemilla(SEMILLA);

    const { ganadores } = sacarHastaGanador(useBingo);
    const { bolillas, ventas } = useBingo.getState();
    const salidas = new Set(bolillas);
    const antes = new Set(bolillas.slice(0, -1));

    expect(ganadores.length).toBeGreaterThan(0);
    for (const g of ganadores) {
      expect(g.modalidad).toBe("cuaterna");
      expect(g.etapa).toBe(0);
      expect(g.bolillas).toBe(bolillas.length);
      expect(g.comprador).toBe("Escuela Pepito");
      expect(cumple(cartonDe(g.numero), salidas, "cuaterna")).toBe(true);
    }
    // Nadie tenía cuaterna una bolilla antes: el primero es el primero.
    for (const v of ventas) {
      expect(cumple(cartonDe(v.numero), antes, "cuaterna")).toBe(false);
    }
    // Y todos los que la completaron con esa bolilla ganaron (empate).
    const conCuaterna = ventas
      .map((v) => v.numero)
      .filter((n) => cumple(cartonDe(n), salidas, "cuaterna"));
    expect(ganadores.map((g) => g.numero)).toEqual(conCuaterna);
    expect(bolillasDe(SEMILLA)).toEqual(bolillas);
  });

  it("recorre la noche entera sin reiniciar las bolillas entre etapas", async () => {
    sembrarCampana();
    const useBingo = await cargarStore();
    useBingo.getState().setSemilla(SEMILLA);

    let bolillasAntes = 0;
    for (const [etapa, modalidad] of SECUENCIA.entries()) {
      if (modalidad === "sorteo") {
        // En un sorteo no se puede sacar bolilla.
        expect(useBingo.getState().sacarBolilla("")).toBeNull();
        const ganador = useBingo.getState().sortearGanador("Bici");
        expect(ganador).toMatchObject({ modalidad: "sorteo", etapa, descripcion: "Bici" });
      } else {
        // Y en una etapa de bolillero no se puede sortear.
        expect(useBingo.getState().sortearGanador("")).toBeNull();
        const { ganadores } = sacarHastaGanador(useBingo);
        const salidas = new Set(useBingo.getState().bolillas);
        for (const g of ganadores) {
          expect(g.etapa).toBe(etapa);
          expect(
            cumple(cartonDe(g.numero), salidas, modalidad as ModalidadBolillero),
          ).toBe(true);
        }
      }
      // Las bolillas siguen donde estaban: nunca vuelven a cero.
      expect(useBingo.getState().bolillas.length).toBeGreaterThanOrEqual(bolillasAntes);
      bolillasAntes = useBingo.getState().bolillas.length;
      expect(useBingo.getState().ultimoResultado.length).toBeGreaterThan(0);
      useBingo.getState().continuar();
      expect(useBingo.getState().ultimoResultado).toEqual([]);
    }

    // Terminó: ni bolillas ni sorteos.
    expect(useBingo.getState().sacarBolilla("")).toBeNull();
    expect(useBingo.getState().sortearGanador("")).toBeNull();
    const etapas = new Set(premiosDe(SEMILLA).map((p) => p.etapa));
    expect([...etapas].sort()).toEqual([0, 1, 2, 3]);
  });

  it("el sorteo incluye a los que ya ganaron otra cosa", async () => {
    // Un solo cartón vendido: gana la cuaterna, línea y cartón lleno, y tiene que poder ganar el sorteo.
    registrarTirada(SEMILLA, "Escuela Pepito", 10);
    agregarRango(SEMILLA, 3, 3, PEPITO, 10);
    const useBingo = await cargarStore();
    useBingo.getState().setSemilla(SEMILLA);

    sacarHastaGanador(useBingo); // cuaterna
    useBingo.getState().continuar();
    sacarHastaGanador(useBingo); // línea
    useBingo.getState().continuar();
    sacarHastaGanador(useBingo); // lleno
    useBingo.getState().continuar();

    expect(useBingo.getState().sortearGanador("")?.numero).toBe(3);
  });

  it("si ya había un ganador de sorteo previo, no se repite en el siguiente sorteo", async () => {
    // Dos cartones vendidos: si el cartón 3 ya ganó un sorteo, el sorteo debe ser para el 4.
    registrarTirada(SEMILLA, "Escuela Pepito", 10);
    agregarRango(SEMILLA, 3, 4, PEPITO, 10);
    registrarPremio(SEMILLA, {
      numero: 3,
      comprador: "Pepito",
      telefono: "",
      descripcion: "",
      modalidad: "sorteo",
      etapa: 99,
    });
    const useBingo = await cargarStore();
    useBingo.getState().setSemilla(SEMILLA);

    sacarHastaGanador(useBingo); // cuaterna
    useBingo.getState().continuar();
    sacarHastaGanador(useBingo); // línea
    useBingo.getState().continuar();
    sacarHastaGanador(useBingo); // lleno
    useBingo.getState().continuar();

    const ganador = useBingo.getState().sortearGanador("")!.numero;
    expect(ganador).toBe(4);
  });

  it("con un solo cartón vendido, igual se puede sortear aunque ya haya ganado un sorteo previo", async () => {
    registrarTirada(SEMILLA, "Escuela Pepito", 10);
    agregarRango(SEMILLA, 3, 3, PEPITO, 10);
    registrarPremio(SEMILLA, {
      numero: 3,
      comprador: "Pepito",
      telefono: "",
      descripcion: "",
      modalidad: "sorteo",
      etapa: 99,
    });
    const useBingo = await cargarStore();
    useBingo.getState().setSemilla(SEMILLA);

    sacarHastaGanador(useBingo); // cuaterna
    useBingo.getState().continuar();
    sacarHastaGanador(useBingo); // línea
    useBingo.getState().continuar();
    sacarHastaGanador(useBingo); // lleno
    useBingo.getState().continuar();

    expect(useBingo.getState().sortearGanador("")?.numero).toBe(3);
  });

  it("sin cartones vendidos no se juega", async () => {
    registrarTirada(SEMILLA, "Escuela Pepito", 10);
    const useBingo = await cargarStore();
    useBingo.getState().setSemilla(SEMILLA);

    expect(useBingo.getState().sacarBolilla("")).toBeNull();
    expect(useBingo.getState().bolillas).toEqual([]);
  });

  it("solo deja deshacer un sorteo, no un ganador del bolillero", async () => {
    sembrarCampana();
    const useBingo = await cargarStore();
    useBingo.getState().setSemilla(SEMILLA);

    sacarHastaGanador(useBingo);
    const tras = useBingo.getState().premios;
    expect(useBingo.getState().deshacerPremio()).toBe(false);
    expect(useBingo.getState().premios).toEqual(tras);

    useBingo.getState().continuar();
    useBingo.getState().sortearGanador("");
    expect(useBingo.getState().deshacerPremio()).toBe(true);
    // Volvió a la etapa del sorteo.
    expect(useBingo.getState().premios).toEqual(tras);
    expect(useBingo.getState().sortearGanador("")).not.toBeNull();
  });

  it("reiniciar el juego devuelve las bolillas y borra los ganadores, no las ventas", async () => {
    sembrarCampana();
    const useBingo = await cargarStore();
    useBingo.getState().setSemilla(SEMILLA);
    sacarHastaGanador(useBingo);

    useBingo.getState().reiniciarJuego();

    expect(useBingo.getState().bolillas).toEqual([]);
    expect(useBingo.getState().premios).toEqual([]);
    expect(useBingo.getState().ultimoResultado).toEqual([]);
    expect(bolillasDe(SEMILLA)).toEqual([]);
    expect(useBingo.getState().ventas).toHaveLength(11);
  });

  it("al recargar, el juego sigue en la misma bolilla y la misma etapa", async () => {
    sembrarCampana();
    let useBingo = await cargarStore();
    useBingo.getState().setSemilla(SEMILLA);
    sacarHastaGanador(useBingo);
    useBingo.getState().sacarBolilla("");
    const { bolillas, premios } = useBingo.getState();

    useBingo = await cargarStore();

    expect(useBingo.getState().bolillas).toEqual(bolillas);
    expect(useBingo.getState().premios).toEqual(premios);
    // Etapa 1 (sorteo) en curso: sacar bolilla no corresponde.
    expect(useBingo.getState().sacarBolilla("")).toBeNull();
  });
});
