// @vitest-environment jsdom
//
// La pantalla completa del sorteo es lo que más se expone de la app —se
// proyecta en el salón— y hasta acá no tenía ningún test: vive en estado local
// del componente, así que no se podía abrir sin montar React de verdad.
//
// Ojo con el vocabulario de los comentarios de este directorio: tailwind.config
// escanea `src/**/*.{ts,tsx}`, tests incluidos, así que cualquier palabra suelta
// que además sea el nombre de una utilidad de Tailwind termina como una regla
// muerta en el CSS de producción. Lo comprobé comparando el build contra el de
// HEAD: una sola palabra en un comentario mío agregaba una regla.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { registrarTirada } from "../lib/registro.ts";
import { agregarRango } from "../lib/ventas.ts";

const SEMILLA = 7;
/** Lo que dura la ruleta en PanelSorteo, más un margen. */
const HASTA_EL_GANADOR = 1600;

function sembrarCampana(): void {
  localStorage.clear();
  localStorage.setItem("bingo90:semilla:v1", String(SEMILLA));
  registrarTirada(SEMILLA, "Escuela Pepito", 200);
  agregarRango(
    SEMILLA,
    150,
    160,
    { comprador: "María Fernández", telefono: "3794-111111", vendedor: "Ana" },
    200,
  );
}

/** Monta el panel con el storage ya sembrado (el store lee al importarse). */
async function montarPanel(): Promise<void> {
  vi.resetModules();
  const { PanelSorteo } = await import("../components/PanelSorteo.tsx");
  render(<PanelSorteo />);
}

/** Deja correr la ruleta hasta que aparece el ganador. */
async function esperarAlGanador(): Promise<void> {
  await act(async () => {
    vi.advanceTimersByTime(HASTA_EL_GANADOR);
  });
}

function escenario(): HTMLElement {
  return screen.getByRole("dialog");
}

/** El N° que se está mostrando, como número. */
function numeroCantado(dentro: HTMLElement): number {
  const texto = dentro.textContent ?? "";
  const match = texto.match(/\d{6}/);
  if (!match) throw new Error("no se está mostrando ningún N° de cartón");
  return Number(match[0]);
}

describe("pantalla completa del sorteo", () => {
  let usuario: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    vi.useFakeTimers();
    usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    sembrarCampana();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    localStorage.clear();
  });

  /** Sortea el primer premio desde el panel y abre la pantalla completa. */
  async function cantarPrimerPremio(descripcion = "Bicicleta") {
    await montarPanel();
    await usuario.type(screen.getByLabelText(/Premio/i), descripcion);
    await usuario.click(screen.getByRole("button", { name: /Sortear ganador/i }));
    await esperarAlGanador();
    await usuario.click(screen.getByRole("button", { name: /Pantalla completa/i }));
  }

  it("junto al ganador NO hay ningún botón que sortee", async () => {
    await cantarPrimerPremio();

    // Delante de la gente, un click accidental que saca un ganador no se
    // puede deshacer sin romper el clima: por eso el botón no existe en este
    // estado, en vez de pedir una confirmación que estorbaría siempre.
    const botones = within(escenario())
      .getAllByRole("button")
      .map((b) => b.textContent);
    expect(botones).toEqual(["Ver cartón", "Siguiente premio →", "Salir (Esc)"]);
    expect(botones.some((t) => /sortear/i.test(t ?? ""))).toBe(false);
  });

  it("muestra el premio, el N° y el comprador en grande", async () => {
    await cantarPrimerPremio("Bicicleta");

    expect(within(escenario()).getByText("Bicicleta")).toBeDefined();
    expect(within(escenario()).getByText("María Fernández")).toBeDefined();
    const numero = numeroCantado(escenario());
    expect(numero).toBeGreaterThanOrEqual(150);
    expect(numero).toBeLessThanOrEqual(160);
  });

  it("se canta una seguidilla entera sin salir de la pantalla completa", async () => {
    await cantarPrimerPremio("Bicicleta");
    const primero = numeroCantado(escenario());

    // Paso 1: pedir el próximo premio. Recién ahí aparece el botón.
    await usuario.click(
      within(escenario()).getByRole("button", { name: /Siguiente premio/i }),
    );
    const campo = within(escenario()).getByLabelText(/Premio/i);
    // El campo queda enfocado: se escribe el premio sin buscar el mouse.
    expect(document.activeElement).toBe(campo);

    // Paso 2: sortear, sin haber salido en ningún momento.
    await usuario.type(campo, "Televisor");
    await usuario.click(
      within(escenario()).getByRole("button", { name: /Sortear ganador/i }),
    );
    await esperarAlGanador();

    expect(screen.queryByRole("dialog")).not.toBeNull();
    expect(within(escenario()).getByText("Televisor")).toBeDefined();
    expect(numeroCantado(escenario())).not.toBe(primero);
    // Y el campo del premio ya no está a la vista junto al ganador.
    expect(within(escenario()).queryByLabelText(/Premio/i)).toBeNull();
  });

  it("el cartón para cotejar muestra el ganador nuevo, no el anterior", async () => {
    await cantarPrimerPremio("Bicicleta");
    const anterior = String(numeroCantado(escenario())).padStart(6, "0");

    await usuario.click(
      within(escenario()).getByRole("button", { name: /Siguiente premio/i }),
    );
    await usuario.click(
      within(escenario()).getByRole("button", { name: /Sortear ganador/i }),
    );
    await esperarAlGanador();
    const ganador = String(numeroCantado(escenario())).padStart(6, "0");

    await usuario.click(
      within(escenario()).getByRole("button", { name: /Ver cartón/i }),
    );

    // El cartón que se ve es el de quien acaba de ganar: mostrar el anterior
    // es exactamente el error que este cotejo tiene que evitar.
    const cartonVisible = within(escenario()).getAllByText(ganador);
    expect(cartonVisible.length).toBeGreaterThanOrEqual(2); // el grande y el del talón
    expect(within(escenario()).queryAllByText(anterior)).toEqual([]);
  });

  it("Escape cierra primero el próximo premio y después la pantalla", async () => {
    await cantarPrimerPremio();
    await usuario.click(
      within(escenario()).getByRole("button", { name: /Siguiente premio/i }),
    );
    expect(within(escenario()).getByText("Próximo premio")).toBeDefined();

    await usuario.keyboard("{Escape}");

    // Vuelve al ganador sin apagar la pantalla proyectada.
    expect(screen.queryByRole("dialog")).not.toBeNull();
    expect(within(escenario()).queryByText("Próximo premio")).toBeNull();

    await usuario.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("sin cartones en el bombo no ofrece sortear otro", async () => {
    // Un solo cartón vendido: después del primer premio no queda nadie.
    localStorage.clear();
    localStorage.setItem("bingo90:semilla:v1", String(SEMILLA));
    registrarTirada(SEMILLA, "Escuela Pepito", 200);
    agregarRango(
      SEMILLA,
      150,
      150,
      { comprador: "María Fernández", telefono: "", vendedor: "" },
      200,
    );

    await montarPanel();
    await usuario.click(screen.getByRole("button", { name: /Sortear ganador/i }));
    await esperarAlGanador();
    await usuario.click(screen.getByRole("button", { name: /Pantalla completa/i }));

    expect(
      within(escenario()).queryByRole("button", { name: /Siguiente premio/i }),
    ).toBeNull();
    expect(
      within(escenario()).getByText(/No quedan cartones en el bombo/i),
    ).toBeDefined();
  });
});
