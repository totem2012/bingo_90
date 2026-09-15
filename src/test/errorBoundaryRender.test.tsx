// @vitest-environment jsdom
//
// Acá se prueba lo que el boundary hace de verdad: atrapar un error DURANTE EL
// RENDER. No se podía cubrir con `renderToStaticMarkup` —los boundaries no
// funcionan en render de servidor, ahí el error se propaga— así que hasta
// ahora esta red de seguridad solo se había visto funcionar en el navegador.
// La parte pura (rescatar la semilla) sigue en errorBoundary.test.ts, en node.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorBoundary } from "../components/ErrorBoundary.tsx";

/** Un componente que revienta al renderizar, como el bug que esto tapa. */
function Explota(): JSX.Element {
  throw new Error("cartón con forma inesperada");
}

function Sano() {
  return <p>contenido sano</p>;
}

describe("ErrorBoundary", () => {
  beforeEach(() => {
    localStorage.clear();
    // React escribe el error en consola además de pasarlo al boundary; lo
    // silenciamos para no ensuciar la salida de la suite.
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("deja pasar lo que no falla", () => {
    render(
      <ErrorBoundary>
        <Sano />
      </ErrorBoundary>,
    );

    expect(screen.getByText("contenido sano")).toBeDefined();
  });

  it("atrapa el error en vez de dejar la pantalla en blanco", () => {
    render(
      <ErrorBoundary>
        <Explota />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Se rompió esta pantalla")).toBeDefined();
    // Y lo primero que ofrece es lo único irrecuperable: la semilla.
    expect(screen.getByText(/no se borró nada/i)).toBeDefined();
  });

  it("rescata la semilla guardada y la muestra para anotarla", () => {
    localStorage.setItem("bingo90:semilla:v1", "2282149015");

    render(
      <ErrorBoundary>
        <Explota />
      </ErrorBoundary>,
    );

    expect(screen.getByText("2282149015")).toBeDefined();
    expect(screen.getByRole("button", { name: /Copiar semilla/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /Descargar respaldo/i })).toBeDefined();
  });

  it("sin semilla legible lo dice, en vez de mostrar cualquier cosa", () => {
    localStorage.setItem("bingo90:semilla:v1", "no-es-un-numero");

    render(
      <ErrorBoundary>
        <Explota />
      </ErrorBoundary>,
    );

    expect(screen.getByText(/No pudimos leer la semilla guardada/i)).toBeDefined();
    expect(screen.queryByText("no-es-un-numero")).toBeNull();
  });

  it("muestra el mensaje del error en el detalle técnico", () => {
    render(
      <ErrorBoundary>
        <Explota />
      </ErrorBoundary>,
    );

    expect(screen.getByText("cartón con forma inesperada")).toBeDefined();
  });

  it("registra el error en consola con el nombre de la parte que falló", () => {
    render(
      <ErrorBoundary nombre="PanelSorteo">
        <Explota />
      </ErrorBoundary>,
    );

    const llamadas = (console.error as unknown as { mock: { calls: unknown[][] } })
      .mock.calls;
    expect(
      llamadas.some((args) =>
        String(args[0]).includes("error de render en PanelSorteo"),
      ),
    ).toBe(true);
  });

  it("con `fallback` muestra eso y no la pantalla completa", async () => {
    const usuario = userEvent.setup();
    let fallo = true;
    function AVeces() {
      if (fallo) throw new Error("falla la primera vez");
      return <p>ya anda</p>;
    }

    render(
      <ErrorBoundary
        fallback={(error, reintentar) => (
          <button type="button" onClick={reintentar}>
            {error?.message} — reintentar
          </button>
        )}
      >
        <AVeces />
      </ErrorBoundary>,
    );

    expect(screen.queryByText("Se rompió esta pantalla")).toBeNull();
    const boton = screen.getByRole("button", { name: /reintentar/i });

    // El reintento vuelve a montar los hijos: si el problema pasó, se recupera
    // sin recargar la página.
    fallo = false;
    await usuario.click(boton);

    expect(screen.getByText("ya anda")).toBeDefined();
  });

  // Lo que NO se puede fijar acá: que un error de manejador de evento no lo
  // atrape el boundary (es cierto, y está documentado en el componente). El
  // build de desarrollo de React relanza ese error fuera del click, y vitest
  // lo cuenta como error no manejado del archivo: el test quedaba en rojo
  // probando algo que no es nuestro. Preferí no tenerlo antes que tenerlo
  // ruidoso.
});
