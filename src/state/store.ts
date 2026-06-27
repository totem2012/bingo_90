// ─────────────────────────────────────────────────────────────────────────
// Estado global de la app (Zustand).
//
// Mantiene la configuración del usuario y un cartón de muestra para la vista
// previa. La semilla se guarda para que el lote sea reproducible: la vista
// previa es siempre el primer cartón del lote que se generará.
// ─────────────────────────────────────────────────────────────────────────

import { create } from "zustand";
import {
  generarCarton,
  generarLote,
  semillaAleatoria,
  type Carton,
} from "../core/index.ts";
// Solo importamos la constante (sin pdf-lib) en el bundle inicial.
// El motor de PDF (pdf-lib) se carga bajo demanda en generarPdf().
import { CARTONES_POR_HOJA_DEFECTO } from "../pdf/layout.ts";
import { descargarArchivo } from "../lib/descargar.ts";
import {
  MARCA_INICIAL,
  type LogoImagen,
  type Marca,
  type SlotLogo,
} from "../lib/marca.ts";

export interface BingoState {
  /** Cantidad de cartones a generar. */
  cantidad: number;
  /** Cartones por hoja A4. */
  cartonesPorHoja: number;
  /** Semilla del lote (define la vista previa y el PDF). */
  semilla: number;
  /** Cartón de muestra = primer cartón del lote con la semilla actual. */
  preview: Carton;
  /** Si está generando el PDF en este momento. */
  generando: boolean;
  /** Personalización de marca (título, color, logo). */
  marca: Marca;

  setCantidad: (n: number) => void;
  setCartonesPorHoja: (n: number) => void;
  setTitulo: (titulo: string) => void;
  setSubtitulo: (subtitulo: string) => void;
  setEvento: (evento: string) => void;
  setSerie: (serie: string) => void;
  setColor: (color: string) => void;
  setLogo: (slot: SlotLogo, logo: LogoImagen | null) => void;
  /** Sortea una semilla nueva → cambia la vista previa y el lote. */
  nuevaSemilla: () => void;
  /** Genera el PDF del lote actual y dispara la descarga. */
  generarPdf: () => Promise<void>;
}

const semillaInicial = semillaAleatoria();

export const useBingo = create<BingoState>((set, get) => ({
  cantidad: 12,
  cartonesPorHoja: CARTONES_POR_HOJA_DEFECTO,
  semilla: semillaInicial,
  preview: generarCarton(semillaInicial),
  generando: false,
  marca: MARCA_INICIAL,

  setCantidad: (n) => set({ cantidad: Math.max(1, Math.floor(n || 1)) }),

  setCartonesPorHoja: (n) => set({ cartonesPorHoja: n }),

  setTitulo: (titulo) => set((s) => ({ marca: { ...s.marca, titulo } })),

  setSubtitulo: (subtitulo) => set((s) => ({ marca: { ...s.marca, subtitulo } })),

  setEvento: (evento) => set((s) => ({ marca: { ...s.marca, evento } })),

  setSerie: (serie) => set((s) => ({ marca: { ...s.marca, serie } })),

  setColor: (color) => set((s) => ({ marca: { ...s.marca, color } })),

  setLogo: (slot, logo) => set((s) => ({ marca: { ...s.marca, [slot]: logo } })),

  nuevaSemilla: () => {
    const semilla = semillaAleatoria();
    set({ semilla, preview: generarCarton(semilla) });
  },

  generarPdf: async () => {
    const { cantidad, cartonesPorHoja, semilla, marca } = get();
    set({ generando: true });
    try {
      // Carga diferida del motor de PDF: solo cuando se genera de verdad.
      const { construirPdf } = await import("../pdf/buildPdf.ts");
      const { cartones } = generarLote({ cantidad, semilla });
      const bytes = await construirPdf(cartones, { cartonesPorHoja, marca });
      descargarArchivo(bytes, `bingo-${cantidad}-cartones.pdf`);
    } catch (error) {
      console.error(error);
      alert("Hubo un problema al generar el PDF. Probá con una cantidad menor.");
    } finally {
      set({ generando: false });
    }
  },
}));
