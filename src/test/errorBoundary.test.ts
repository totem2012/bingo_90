// Del boundary solo se puede testear acá la parte pura: rescatar la semilla.
// El comportamiento de atrapar un error de render NO se puede cubrir con estos
// tests: los boundaries no funcionan en render de servidor, que es lo que usa
// `renderToStaticMarkup`, y ahí el error se propaga en vez de ser atrapado.
// Eso se verifica en el navegador.
import { describe, it, expect } from "vitest";
import { semillaGuardada } from "../components/ErrorBoundary.tsx";

/** localStorage de mentira, para no depender del navegador. */
function almacen(valor: string | null) {
  return { getItem: () => valor };
}

describe("semillaGuardada", () => {
  it("devuelve la semilla guardada", () => {
    expect(semillaGuardada(almacen("2282149015"))).toBe("2282149015");
  });

  it("ignora los espacios de más", () => {
    expect(semillaGuardada(almacen(" 42\n"))).toBe("42");
  });

  it("devuelve null si no hay nada guardado", () => {
    expect(semillaGuardada(almacen(null))).toBeNull();
  });

  it("devuelve null si lo guardado no es un número", () => {
    // Mostrar un valor raro sería peor que no mostrar nada: el usuario
    // anotaría algo que no le sirve para retomar la campaña.
    expect(semillaGuardada(almacen("null"))).toBeNull();
    expect(semillaGuardada(almacen("-5"))).toBeNull();
    expect(semillaGuardada(almacen("12abc"))).toBeNull();
    expect(semillaGuardada(almacen(""))).toBeNull();
  });

  it("no explota si el almacenamiento tira", () => {
    const roto = {
      getItem() {
        throw new Error("storage bloqueado");
      },
    };
    expect(semillaGuardada(roto)).toBeNull();
  });

  it("devuelve null si no hay almacenamiento", () => {
    expect(semillaGuardada(null)).toBeNull();
  });
});
