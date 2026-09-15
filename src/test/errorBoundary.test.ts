// Acá va la parte pura del boundary: rescatar la semilla. Corre en node, sin
// DOM, porque no lo necesita.
// Que el boundary ATRAPE un error de render se prueba en
// errorBoundaryRender.test.tsx, que monta React en jsdom: en render de
// servidor los boundaries no funcionan y el error se propaga, así que eso no
// se podía cubrir desde acá.
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
