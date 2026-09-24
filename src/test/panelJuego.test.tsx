// @vitest-environment jsdom
//
// La pantalla del juego es lo que se proyecta en el salón: bolillero, sorteos
// y ganadores. Todo lo visual vive en estado local del componente (animación,
// pantalla completa, cartón a cotejar), así que se prueba montando React.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { registrarTirada } from "../lib/registro.ts";
import { agregarRango } from "../lib/ventas.ts";
import { bolillasDe } from "../lib/bolillas.ts";

const SEMILLA = 7;
/** Lo que gira el bombo o la ruleta, con margen (ver PanelJuego). */
const HASTA_QUE_SALE = 1600;

function sembrarCampana({ conVentas = true } = {}): void {
  localStorage.clear();
  localStorage.setItem("bingo90:semilla:v1", String(SEMILLA));
  registrarTirada(SEMILLA, "Escuela Pepito", 200);
  if (conVentas) {
    agregarRango(
      SEMILLA,
      150,
      160,
      { comprador: "María Fernández", telefono: "3794-111111", vendedor: "Ana" },
      200,
    );
  }
}

/** Monta el panel con el storage ya sembrado (el store lee al importarse). */
async function montarPanel(): Promise<void> {
  vi.resetModules();
  const { PanelJuego } = await import("../components/juego/PanelJuego.tsx");
  render(<PanelJuego />);
}

async function esperarQueSalga(): Promise<void> {
  await act(async () => {
    vi.advanceTimersByTime(HASTA_QUE_SALE);
  });
}

/** Casilleros del tablero que ya salieron. */
function salidasEnTablero(): number {
  return document.querySelectorAll("[data-salio]").length / (screen.queryByRole("dialog") ? 2 : 1);
}

describe("juego", () => {
  let usuario: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    vi.useFakeTimers();
    usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    localStorage.clear();
  });

  /** Saca bolillas con el botón hasta que se cierra la etapa. */
  async function sacarHastaGanador(): Promise<void> {
    for (let i = 0; i < 90; i++) {
      await usuario.click(screen.getByRole("button", { name: /Sacar bolilla/i }));
      await esperarQueSalga();
      if (screen.queryByRole("button", { name: /Siguiente/i })) return;
    }
    throw new Error("salieron las 90 bolillas sin ganador");
  }

  it("arranca en la cuaterna y cada bolilla queda en el tablero y guardada", async () => {
    sembrarCampana();
    await montarPanel();

    expect(screen.getByText("Etapa 1 de 6")).toBeTruthy();
    expect(screen.getAllByText("Cuaterna").length).toBeGreaterThan(0);

    await usuario.click(screen.getByRole("button", { name: /Sacar bolilla/i }));
    // Mientras gira, no se puede sacar otra.
    expect(
      (screen.getByRole("button", { name: /Mezclando/i }) as HTMLButtonElement).disabled,
    ).toBe(true);
    await esperarQueSalga();

    expect(salidasEnTablero()).toBe(1);
    expect(bolillasDe(SEMILLA)).toHaveLength(1);
  });

  it("la barra espaciadora saca una bolilla, pero no mientras se escribe el premio", async () => {
    sembrarCampana();
    await montarPanel();

    await usuario.click(screen.getByLabelText(/Premio de la cuaterna/i));
    await usuario.keyboard(" ");
    await esperarQueSalga();
    expect(bolillasDe(SEMILLA)).toHaveLength(0);

    (document.activeElement as HTMLElement).blur();
    await usuario.keyboard(" ");
    await esperarQueSalga();
    expect(bolillasDe(SEMILLA)).toHaveLength(1);
  });

  it("al completar la cuaterna frena: muestra al ganador y ningún botón para seguir sacando", async () => {
    sembrarCampana();
    await montarPanel();
    await usuario.type(screen.getByLabelText(/Premio de la cuaterna/i), "Licuadora");

    await sacarHastaGanador();

    expect(screen.getByText("¡Cuaterna!")).toBeTruthy();
    expect(screen.getByText("Licuadora")).toBeTruthy();
    expect(screen.getAllByText("María Fernández").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /Sacar bolilla/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Sortear/i })).toBeNull();

    // La barra espaciadora tampoco saca bolillas con el ganador en pantalla.
    const antes = bolillasDe(SEMILLA).length;
    (document.activeElement as HTMLElement).blur();
    await usuario.keyboard(" ");
    await esperarQueSalga();
    expect(bolillasDe(SEMILLA)).toHaveLength(antes);
  });

  it("el cartón para cotejar trae resaltados los números que salieron", async () => {
    sembrarCampana();
    await montarPanel();
    await sacarHastaGanador();

    await usuario.click(screen.getAllByRole("button", { name: /Ver cartón/i })[0]);

    const marcados = document.querySelectorAll("[data-marcado]").length;
    expect(marcados).toBeGreaterThanOrEqual(4);
  });

  it("después de la cuaterna viene un sorteo, y después la fila con las mismas bolillas", async () => {
    sembrarCampana();
    await montarPanel();
    await sacarHastaGanador();
    const bolillasCuaterna = bolillasDe(SEMILLA).length;

    await usuario.click(screen.getByRole("button", { name: /Siguiente: Sorteo/i }));
    expect(screen.getByText("Etapa 2 de 6")).toBeTruthy();
    await usuario.type(screen.getByLabelText(/Premio del sorteo/i), "Bicicleta");
    await usuario.click(screen.getByRole("button", { name: /Sortear ganador/i }));
    await esperarQueSalga();

    expect(screen.getByText("Ganador del sorteo")).toBeTruthy();
    expect(screen.getByText("Bicicleta")).toBeTruthy();

    await usuario.click(screen.getByRole("button", { name: /Siguiente: Fila/i }));
    expect(screen.getByText("Etapa 3 de 6")).toBeTruthy();
    // Las bolillas no volvieron al bolillero.
    expect(salidasEnTablero()).toBe(bolillasCuaterna);
  });

  it("la pantalla completa se abre antes de la primera bolilla y se cierra con Escape", async () => {
    sembrarCampana();
    await montarPanel();

    await usuario.click(screen.getByRole("button", { name: /Pantalla completa/i }));
    const escenario = screen.getByRole("dialog");
    await usuario.click(within(escenario).getByRole("button", { name: /Sacar bolilla/i }));
    await esperarQueSalga();
    expect(within(escenario).getByText(/1 bolilla|\/ 90 bolillas/)).toBeTruthy();
    expect(bolillasDe(SEMILLA)).toHaveLength(1);

    await usuario.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("sin cartones vendidos no deja sacar bolillas y manda a Ventas", async () => {
    sembrarCampana({ conVentas: false });
    await montarPanel();

    expect(
      (screen.getByRole("button", { name: /Sacar bolilla/i }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(screen.getByText(/pestaña “Ventas”/)).toBeTruthy();
  });
});
