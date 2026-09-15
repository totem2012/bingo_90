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
  leerTiradasDe,
  recordarSemilla,
  registrarTirada,
  reiniciarSemilla,
  semillaRecordada,
  type Tirada,
} from "../lib/registro.ts";
import {
  agregarRango,
  agregarVenta,
  leerVentasDe,
  limpiarVentas,
  quitarVenta,
  type DatosVenta,
  type ResultadoRango,
  type Venta,
} from "../lib/ventas.ts";
import {
  deshacerUltimoPremio,
  leerPremiosDe,
  registrarPremio,
  reiniciarPremios,
  type Premio,
} from "../lib/premios.ts";
import {
  exportarCampana,
  importarCampana,
  nombreArchivoCampana,
} from "../lib/campana.ts";
import { elegibles, sortearUno } from "../core/sorteo.ts";
import {
  alCambiarPersistencia,
  estadoPersistencia,
  type EstadoPersistencia,
} from "../lib/persistencia.ts";

/**
 * Semilla más grande que se puede usar. El generador la consume como uint32
 * (ver core/rng.ts), así que más allá de este tope se envolvería y el número
 * que el usuario anota para retomar la campaña dejaría de ser el que quedó
 * guardado. Lo exporta el store para que la UI valide contra el mismo tope que
 * hace cumplir la capa de datos, y no contra una copia suya.
 */
export const SEMILLA_MAXIMA = 4294967295; // 2³² − 1

/**
 * Resultado de intentar deshacer una tirada. Cuando no se puede, el `motivo`
 * es el texto que se le muestra al usuario tal cual.
 */
export type ResultadoDeshacer = { ok: true } | { ok: false; motivo: string };

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
  /** Cartones vendidos de la semilla actual (candidatos al sorteo). */
  ventas: Venta[];
  /** Premios ya sorteados en la semilla actual. */
  premios: Premio[];
  /** Último premio sorteado, para destacarlo en pantalla. */
  ultimoGanador: Premio | null;
  /**
   * Cuántos registros dañados se descartaron al leer la campaña actual. Se
   * avisa en pantalla (App.tsx) porque el descarte puede haber bajado el total
   * impreso, y entonces la próxima tirada reimprimiría N° ya vendidos.
   */
  registrosDanados: number;
  /**
   * No se pudo leer algo de lo guardado (el JSON de una clave entera quedó
   * ilegible). Es peor que unos registros dañados: no se perdió parte de una
   * campaña sino todo lo de esa clave, y sin aviso la app se vería igual que
   * una campaña nueva.
   */
  datosIlegibles: boolean;
  /**
   * Si el navegador está guardando de verdad. A diferencia de los otros dos
   * avisos, este no habla de algo que ya pasó sino de algo que está por pasar:
   * mientras esté mal, todo lo que se imprima y se venda se pierde al cerrar
   * la pestaña. Es el único que se puede prevenir exportando el respaldo.
   */
  persistencia: EstadoPersistencia;

  setCantidad: (n: number) => void;
  setCartonesPorHoja: (n: number) => void;
  /** Cambia de campaña. Lanza si la semilla no es un entero válido. */
  setSemilla: (n: number) => void;
  setTitulo: (titulo: string) => void;
  setSubtitulo: (subtitulo: string) => void;
  setEvento: (evento: string) => void;
  setSerie: (serie: string) => void;
  setColor: (color: string) => void;
  setLogo: (slot: SlotLogo, logo: LogoImagen | null) => void;
  /** Sortea una semilla nueva → arranca una campaña limpia. */
  nuevaSemilla: () => void;
  /**
   * Borra la última tirada del historial (para corregir un error). Se niega
   * si en ese tramo ya hay cartones vendidos o premios sorteados.
   */
  deshacerUltimaTirada: () => ResultadoDeshacer;
  /** Borra todo el historial de la semilla actual. */
  reiniciarCampana: () => void;
  /** Genera el PDF de la próxima tirada, lo descarga y lo registra. */
  generarPdf: () => Promise<void>;

  // ── Ventas ──
  /** Marca un cartón como vendido. */
  venderUno: (numero: number, datos: DatosVenta) => void;
  /** Marca todo un rango [desde, hasta] como vendido al mismo comprador. */
  venderRango: (desde: number, hasta: number, datos: DatosVenta) => ResultadoRango;
  /** Da de baja una venta (el cartón vuelve a figurar sin vender). */
  anularVenta: (numero: number) => void;
  /** Borra todas las ventas de la semilla actual. */
  borrarVentas: () => void;

  // ── Sorteo ──
  /** Sortea un ganador entre los vendidos que todavía no ganaron. */
  sortearGanador: (descripcion: string) => Premio | null;
  /** Borra el último premio (el cartón vuelve al bombo). */
  deshacerPremio: () => void;
  /** Borra todo el historial de premios. */
  borrarPremios: () => void;

  /** Oculta el aviso de datos dañados o ilegibles (no toca lo guardado). */
  ocultarAvisoDatos: () => void;

  // ── Campaña (respaldo / portabilidad) ──
  /** Descarga un .json con semilla + tiradas + ventas + premios. */
  exportar: () => void;
  /** Carga una campaña desde el texto de un .json. Lanza si es inválido. */
  importar: (texto: string) => void;
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

/**
 * Todo lo que depende de la semilla, leído de una sola vez. Cambiar de campaña
 * tiene que mover registro, ventas y premios JUNTOS: si quedaran desfasados se
 * podría sortear un cartón que pertenece a otra campaña.
 */
function estadoDeSemilla(semilla: number) {
  const tiradas = leerTiradasDe(semilla);
  const ventas = leerVentasDe(semilla);
  const premios = leerPremiosDe(semilla);
  return {
    semilla,
    registro: tiradas.tiradas,
    preview: generarCarton(semilla),
    ventas: ventas.ventas,
    premios: premios.premios,
    ultimoGanador: null,
    registrosDanados:
      tiradas.descartados + ventas.descartados + premios.descartados,
    datosIlegibles: tiradas.ilegible || ventas.ilegible || premios.ilegible,
  };
}

// Al abrir la app retomamos la última campaña usada (si la hay) para no perder
// la cuenta de cartones ya entregados.
const semillaInicial = semillaRecordada() ?? semillaAleatoria();
recordarSemilla(semillaInicial);

export const useBingo = create<BingoState>((set, get) => ({
  cantidad: 12,
  cartonesPorHoja: CARTONES_POR_HOJA_DEFECTO,
  generando: false,
  marca: MARCA_INICIAL,
  // Semilla, registro, ventas, premios y el contador de registros dañados
  // salen de la misma lectura que usa cambiar de campaña, para que abrir la
  // app y cambiar de semilla nunca den estados distintos.
  ...estadoDeSemilla(semillaInicial),
  // Después de las lecturas de arriba: si el navegador no deja guardar, ya
  // quedó registrado al intentar leer.
  persistencia: estadoPersistencia(),

  setCantidad: (n) => set({ cantidad: Math.max(1, Math.floor(n || 1)) }),

  setCartonesPorHoja: (n) => set({ cartonesPorHoja: n }),

  setSemilla: (n) => {
    // Antes esto era `>>> 0`: una semilla de más de 2³² se envolvía en
    // silencio y el usuario anotaba un número que no era el de su campaña.
    // Ahora el tope lo hace cumplir el store, no el formulario.
    if (!Number.isInteger(n) || n < 0 || n > SEMILLA_MAXIMA) {
      throw new Error(
        `La semilla tiene que ser un número entero entre 0 y ${SEMILLA_MAXIMA}.`,
      );
    }
    recordarSemilla(n);
    set(estadoDeSemilla(n));
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
    set(estadoDeSemilla(semilla));
  },

  deshacerUltimaTirada: () => {
    const { semilla, registro, ventas, premios } = get();
    const ultima = registro[registro.length - 1];
    if (!ultima) return { ok: true };

    // Deshacer achica el total impreso: los N° de ese tramo dejan de existir,
    // pero sus ventas seguirían entrando al bombo del sorteo (elegibles() solo
    // mira las ventas) y se podría sortear un cartón que nadie tiene en la
    // mano. Igual que en reiniciarCampana, registro + ventas + premios se
    // mueven juntos; acá preferimos frenar antes que borrar en silencio lo que
    // se vendió o, peor, lo que ya se cantó en el evento.
    const enElTramo = (numero: number) =>
      numero >= ultima.desde && numero <= ultima.hasta;
    const vendidos = ventas.filter((v) => enElTramo(v.numero)).length;
    const sorteados = premios.filter((p) => enElTramo(p.numero)).length;
    const tramo = `entre el ${ultima.desde} y el ${ultima.hasta}`;

    if (vendidos > 0) {
      return {
        ok: false,
        motivo:
          `No se puede deshacer esta tirada: hay ${vendidos} ` +
          `${vendidos === 1 ? "cartón vendido" : "cartones vendidos"} ${tramo}. ` +
          `${vendidos === 1 ? "Dalo" : "Dalos"} de baja primero.`,
      };
    }
    if (sorteados > 0) {
      return {
        ok: false,
        motivo:
          `No se puede deshacer esta tirada: hay ${sorteados} ` +
          `${sorteados === 1 ? "premio ya sorteado" : "premios ya sorteados"} ${tramo}.`,
      };
    }

    set({ registro: deshacerUltima(semilla) });
    return { ok: true };
  },

  reiniciarCampana: () => {
    const { semilla } = get();
    // Volver a empezar la campaña reimprime desde el N° 1, así que las ventas
    // y los premios viejos quedarían apuntando a cartones que ahora le tocan a
    // otra persona. Se limpia todo junto o no se limpia nada.
    reiniciarSemilla(semilla);
    limpiarVentas(semilla);
    reiniciarPremios(semilla);
    // Y se relee por el mismo camino que setSemilla/nuevaSemilla/importar en
    // vez de armar el estado a mano: esta función ya se quedó atrás una vez
    // (el aviso de datos dañados seguía en pantalla después de reiniciar) y
    // volvería a pasar con el próximo campo que dependa de la semilla.
    set(estadoDeSemilla(semilla));
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

  // ── Ventas ────────────────────────────────────────────────────────────────

  venderUno: (numero, datos) => {
    const { semilla, registro } = get();
    // Mismo tope que venderRango: solo se vende lo ya impreso.
    const totalImpreso = proximoDesdeDe(registro) - 1;
    set({ ventas: agregarVenta(semilla, numero, datos, totalImpreso) });
  },

  venderRango: (desde, hasta, datos) => {
    const { semilla, registro } = get();
    // El tope de lo vendible es lo ya impreso: lo sabe el registro de tiradas,
    // así que se lo pasamos a la capa de datos en vez de dejar la invariante
    // solo en el formulario.
    const totalImpreso = proximoDesdeDe(registro) - 1;
    const resultado = agregarRango(semilla, desde, hasta, datos, totalImpreso);
    set({ ventas: resultado.ventas });
    return resultado;
  },

  anularVenta: (numero) => {
    const { semilla } = get();
    set({ ventas: quitarVenta(semilla, numero) });
  },

  borrarVentas: () => {
    const { semilla } = get();
    set({ ventas: limpiarVentas(semilla) });
  },

  // ── Sorteo ────────────────────────────────────────────────────────────────

  sortearGanador: (descripcion) => {
    const { semilla, ventas, premios } = get();
    // Los que ya ganaron salen del bombo: un cartón no puede llevarse dos premios.
    const enJuego = elegibles(
      ventas.map((v) => v.numero),
      premios.map((p) => p.numero),
    );
    if (enJuego.length === 0) return null;

    const numero = sortearUno(enJuego);
    const venta = ventas.find((v) => v.numero === numero);
    const actualizados = registrarPremio(semilla, {
      descripcion,
      numero,
      // Snapshot: si después se edita la venta, lo cantado no cambia.
      comprador: venta?.comprador ?? "",
      telefono: venta?.telefono ?? "",
    });
    const ganador = actualizados[actualizados.length - 1];
    set({ premios: actualizados, ultimoGanador: ganador });
    return ganador;
  },

  deshacerPremio: () => {
    const { semilla } = get();
    set({ premios: deshacerUltimoPremio(semilla), ultimoGanador: null });
  },

  borrarPremios: () => {
    const { semilla } = get();
    set({ premios: reiniciarPremios(semilla), ultimoGanador: null });
  },

  ocultarAvisoDatos: () => set({ registrosDanados: 0, datosIlegibles: false }),

  // ── Campaña ───────────────────────────────────────────────────────────────

  exportar: () => {
    const { semilla } = get();
    const datos = exportarCampana(semilla);
    const bytes = new TextEncoder().encode(JSON.stringify(datos, null, 2));
    descargarArchivo(bytes, nombreArchivoCampana(semilla), "application/json");
  },

  importar: (texto) => {
    // JSON.parse y la validación lanzan: el componente muestra el mensaje.
    const datos = importarCampana(JSON.parse(texto));
    recordarSemilla(datos.semilla);
    set(estadoDeSemilla(datos.semilla));
  },
}));

// El estado de persistencia lo descubren los módulos de lib/ cuando leen o
// escriben, en cualquier momento de la sesión (la cuota se puede llenar
// recién en la tirada 12). Una suscripción evita tener que acordarse de
// refrescarlo en cada acción que escribe.
alCambiarPersistencia((estado) => useBingo.setState({ persistencia: estado }));
