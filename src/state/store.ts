// ─────────────────────────────────────────────────────────────────────────
// Estado global de la app (Zustand).
//
// Mantiene la configuración del usuario y un cartón de muestra para la vista
// previa. La semilla identifica la CAMPAÑA: la app lleva sola el registro de
// cuántos cartones de esa semilla ya se entregaron (persistido en el
// navegador), así cada nueva tirada continúa automáticamente desde donde
// terminó la anterior y nunca se pisan cartones ya impresos.
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
import {
  consumidos,
  deshacerUltima,
  recordarSemilla,
  registrarTirada,
  reiniciarSemilla,
  semillaRecordada,
  tiradasDe,
  type Tirada,
} from "../lib/registro.ts";

export interface BingoState {
  /** Cantidad de cartones a generar en la próxima tirada. */
  cantidad: number;
  /** Cartones por hoja A4. */
  cartonesPorHoja: number;
  /** Semilla = identidad de la campaña (define toda la secuencia de cartones). */
  semilla: number;
  /** Historial de tiradas ya generadas para la semilla actual. */
  registro: Tirada[];
  /** Cartón de muestra = primer cartón de la secuencia de la semilla actual. */
  preview: Carton;
  /** Si está generando el PDF en este momento. */
  generando: boolean;
  /** Personalización de marca (título, color, logo). */
  marca: Marca;

  setCantidad: (n: number) => void;
  setCartonesPorHoja: (n: number) => void;
  setSemilla: (n: number) => void;
  setTitulo: (titulo: string) => void;
  setSubtitulo: (subtitulo: string) => void;
  setEvento: (evento: string) => void;
  setSerie: (serie: string) => void;
  setColor: (color: string) => void;
  setLogo: (slot: SlotLogo, logo: LogoImagen | null) => void;
  /** Sortea una semilla nueva → arranca una campaña limpia. */
  nuevaSemilla: () => void;
  /** Borra la última tirada del historial (para corregir un error). */
  deshacerUltimaTirada: () => void;
  /** Borra todo el historial de la semilla actual. */
  reiniciarCampana: () => void;
  /** Genera el PDF de la próxima tirada, lo descarga y lo registra. */
  generarPdf: () => Promise<void>;
}

/** Próximo N° por el que arranca la siguiente tirada según lo ya consumido. */
export function proximoDesdeDe(registro: Tirada[]): number {
  return consumidos(registro) + 1;
}

/**
 * Nombre del PDF a partir del título. Así cada escuela/título descarga su
 * propio archivo identificable (ej: "bingo-escuela-pepito-201-400.pdf").
 */
function nombreArchivoPdf(titulo: string, desde: number, hasta: number): string {
  const slug = titulo
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // saca tildes
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const base = slug ? `bingo-${slug}` : "bingo";
  return `${base}-${desde}-${hasta}.pdf`;
}

// Al abrir la app retomamos la última campaña usada (si la hay) para no perder
// la cuenta de cartones ya entregados.
const semillaInicial = semillaRecordada() ?? semillaAleatoria();
recordarSemilla(semillaInicial);

export const useBingo = create<BingoState>((set, get) => ({
  cantidad: 12,
  cartonesPorHoja: CARTONES_POR_HOJA_DEFECTO,
  semilla: semillaInicial,
  registro: tiradasDe(semillaInicial),
  preview: generarCarton(semillaInicial),
  generando: false,
  marca: MARCA_INICIAL,

  setCantidad: (n) => set({ cantidad: Math.max(1, Math.floor(n || 1)) }),

  setCartonesPorHoja: (n) => set({ cartonesPorHoja: n }),

  setSemilla: (n) => {
    const semilla = Math.max(0, Math.floor(n || 0)) >>> 0;
    recordarSemilla(semilla);
    set({ semilla, registro: tiradasDe(semilla), preview: generarCarton(semilla) });
  },

  setTitulo: (titulo) => set((s) => ({ marca: { ...s.marca, titulo } })),

  setSubtitulo: (subtitulo) => set((s) => ({ marca: { ...s.marca, subtitulo } })),

  setEvento: (evento) => set((s) => ({ marca: { ...s.marca, evento } })),

  setSerie: (serie) => set((s) => ({ marca: { ...s.marca, serie } })),

  setColor: (color) => set((s) => ({ marca: { ...s.marca, color } })),

  setLogo: (slot, logo) => set((s) => ({ marca: { ...s.marca, [slot]: logo } })),

  nuevaSemilla: () => {
    const semilla = semillaAleatoria();
    recordarSemilla(semilla);
    set({ semilla, registro: tiradasDe(semilla), preview: generarCarton(semilla) });
  },

  deshacerUltimaTirada: () => {
    const { semilla } = get();
    set({ registro: deshacerUltima(semilla) });
  },

  reiniciarCampana: () => {
    const { semilla } = get();
    set({ registro: reiniciarSemilla(semilla) });
  },

  generarPdf: async () => {
    const { cantidad, cartonesPorHoja, semilla, marca, registro } = get();
    // El "desde" lo decide la app, no el usuario: continúa donde terminó la
    // última tirada de esta semilla, así nunca se pisan cartones ya impresos.
    const desde = proximoDesdeDe(registro);
    const hasta = desde + cantidad - 1;
    set({ generando: true });
    try {
      // Carga diferida del motor de PDF: solo cuando se genera de verdad.
      const { construirPdf } = await import("../pdf/buildPdf.ts");
      const { cartones } = generarLote({ cantidad, semilla, desde });
      // `numeroInicial: desde` hace que el N° impreso en el talón sea
      // consecutivo entre tandas (Pepito 1–200, Ramon 201–400…), sin reiniciar.
      const bytes = await construirPdf(cartones, {
        cartonesPorHoja,
        marca,
        numeroInicial: desde,
      });
      descargarArchivo(bytes, nombreArchivoPdf(marca.titulo, desde, hasta));
      // Recién registramos la tirada cuando el PDF salió bien.
      set({ registro: registrarTirada(semilla, marca.titulo, cantidad) });
    } catch (error) {
      console.error(error);
      alert("Hubo un problema al generar el PDF. Probá con una cantidad menor.");
    } finally {
      set({ generando: false });
    }
  },
}));
