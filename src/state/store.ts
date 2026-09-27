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
  guardarLogosMarca,
  guardarTextoMarca,
  leerMarca,
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
  registrarPremios,
  reiniciarPremios,
  type DatosPremio,
  type Premio,
} from "../lib/premios.ts";
import {
  exportarCampana,
  importarCampana,
  nombreArchivoCampana,
} from "../lib/campana.ts";
import { elegibles, sortearUno } from "../core/sorteo.ts";
import {
  SECUENCIA,
  TOTAL_BOLILLAS,
  esModalidadBolillero,
  etapaActual,
  ganadoresDe,
  sacarBolilla as sacarBolillaAlAzar,
  type CartonEnJuego,
} from "../core/juego.ts";
import {
  agregarBolilla,
  leerBolillasDe,
  reiniciarBolillas,
} from "../lib/bolillas.ts";
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
  /**
   * Si los logos entraron en el navegador. Son lo único que puede no entrar
   * por su tamaño; el resto de la marca es texto. En `false`, el logo se ve en
   * pantalla pero no va a estar la próxima vez que abra.
   */
  logosGuardados: boolean;
  /** Cartones vendidos de la semilla actual (los únicos que juegan). */
  ventas: Venta[];
  /** Premios ya ganados en la semilla actual (bolillero y sorteos). */
  premios: Premio[];
  /** Bolillas que salieron del bolillero, en orden de salida. */
  bolillas: number[];
  /**
   * Ganadores de la etapa que se acaba de cerrar, para mostrarlos hasta que
   * el operador pase a la siguiente (`continuar`). Varios = empate. No se
   * guarda: al recargar, la pantalla arranca en la etapa en curso y lo ganado
   * queda en el historial.
   */
  ultimoResultado: Premio[];
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
  /** Avance de la generación en curso (null si no se está generando). */
  progreso: { hechos: number; total: number } | null;

  // ── Ventas ──
  /** Marca un cartón como vendido. */
  venderUno: (numero: number, datos: DatosVenta) => void;
  /** Marca todo un rango [desde, hasta] como vendido al mismo comprador. */
  venderRango: (desde: number, hasta: number, datos: DatosVenta) => ResultadoRango;
  /** Da de baja una venta (el cartón vuelve a figurar sin vender). */
  anularVenta: (numero: number) => void;
  /** Borra todas las ventas de la semilla actual. */
  borrarVentas: () => void;

  // ── Juego ──
  /**
   * Saca una bolilla y revisa si algún cartón vendido ganó la etapa en curso
   * (cuaterna, fila o cartón lleno). `descripcion` es el premio de la etapa,
   * que se guarda si hay ganadores. Devuelve null si ahora no corresponde
   * sacar bolilla (etapa de sorteo, juego terminado, sin vendidos).
   */
  sacarBolilla: (
    descripcion: string,
  ) => { bolilla: number; ganadores: Premio[] } | null;
  /**
   * Sortea un ganador de la etapa de sorteo en curso entre TODOS los
   * vendidos, aunque ya hayan ganado otra cosa.
   */
  sortearGanador: (descripcion: string) => Premio | null;
  /** Deja de mostrar el resultado de la última etapa y pasa a la siguiente. */
  continuar: () => void;
  /**
   * Borra el último premio si fue un sorteo. Uno del bolillero no se puede
   * deshacer: la bolilla sigue afuera y el mismo cartón volvería a ganar.
   */
  deshacerPremio: () => boolean;
  /** Empieza el juego de cero: vuelven todas las bolillas y se borran los premios. */
  reiniciarJuego: () => void;

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
/**
 * Aplica un cambio en los campos de texto de la marca y lo persiste. Los
 * setters son cinco y hacían todos lo mismo; con el guardado de por medio,
 * repetirlo era pedir que alguno se quedara atrás.
 */
function aplicarMarca(
  get: () => BingoState,
  set: (parcial: Partial<BingoState>) => void,
  cambio: Partial<Marca>,
): void {
  const marca = { ...get().marca, ...cambio };
  guardarTextoMarca(marca);
  set({ marca });
}

function estadoDeSemilla(semilla: number) {
  const tiradas = leerTiradasDe(semilla);
  const ventas = leerVentasDe(semilla);
  const premios = leerPremiosDe(semilla);
  const bolillas = leerBolillasDe(semilla);
  return {
    semilla,
    registro: tiradas.tiradas,
    preview: generarCarton(semilla),
    ventas: ventas.ventas,
    premios: premios.premios,
    bolillas: bolillas.bolillas,
    ultimoResultado: [],
    registrosDanados:
      tiradas.descartados +
      ventas.descartados +
      premios.descartados +
      bolillas.descartados,
    datosIlegibles:
      tiradas.ilegible || ventas.ilegible || premios.ilegible || bolillas.ilegible,
  };
}

/**
 * Cartones regenerados de la semilla, del N° 1 al más alto que se pidió.
 * Revisar a los ganadores necesita los 15 números de cada vendido después de
 * CADA bolilla, y `generarLote` es O(n) porque recorre la secuencia desde el
 * principio: pedirlos de a uno sería O(n²) por bolilla. Con un solo lote
 * cacheado, la primera bolilla paga ~180 ms si hay 20.000 cartones y las
 * siguientes nada.
 */
let loteCacheado: { semilla: number; cartones: Carton[] } | null = null;

function cartonesVendidos(semilla: number, ventas: Venta[]): CartonEnJuego[] {
  const maximo = ventas.reduce((m, v) => Math.max(m, v.numero), 0);
  if (maximo === 0) return [];
  if (
    !loteCacheado ||
    loteCacheado.semilla !== semilla ||
    loteCacheado.cartones.length < maximo
  ) {
    loteCacheado = {
      semilla,
      cartones: generarLote({ cantidad: maximo, semilla, desde: 1 }).cartones,
    };
  }
  const { cartones } = loteCacheado;
  return ventas.map((v) => ({ numero: v.numero, carton: cartones[v.numero - 1] }));
}

/** Datos del premio de un cartón, con el snapshot del comprador. */
function datosPremio(
  numero: number,
  ventas: Venta[],
  extra: Omit<DatosPremio, "numero" | "comprador" | "telefono">,
): DatosPremio {
  const venta = ventas.find((v) => v.numero === numero);
  return {
    ...extra,
    numero,
    // Snapshot: si después se edita la venta, lo cantado no cambia.
    comprador: venta?.comprador ?? "",
    telefono: venta?.telefono ?? "",
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
  progreso: null,
  marca: leerMarca(),
  logosGuardados: true,
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

  // Los campos de texto se guardan en cada tecla: es una clave chica y aparte
  // de los logos justamente para que salga barato (ver lib/marca.ts).
  setTitulo: (titulo) => aplicarMarca(get, set, { titulo }),

  setSubtitulo: (subtitulo) => aplicarMarca(get, set, { subtitulo }),

  setEvento: (evento) => aplicarMarca(get, set, { evento }),

  setSerie: (serie) => aplicarMarca(get, set, { serie }),

  setColor: (color) => aplicarMarca(get, set, { color }),

  setLogo: (slot, logo) => {
    const marca = { ...get().marca, [slot]: logo };
    set({ marca, logosGuardados: guardarLogosMarca(marca) });
  },

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
    // pero sus ventas seguirían jugando (el juego solo mira las ventas) y se podría sortear un cartón que nadie tiene en la
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
    reiniciarBolillas(semilla);
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
    set({ generando: true, progreso: { hechos: 0, total: cantidad } });
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
        onProgreso: (hechos, total) => set({ progreso: { hechos, total } }),
      });
      descargarArchivo(bytes, nombreArchivoPdf(marca.titulo, desde, hasta));
      // Recién registramos la tirada cuando el PDF salió bien.
      set({ registro: registrarTirada(semilla, marca.titulo, cantidad) });
    } catch (error) {
      console.error(error);
      alert("Hubo un problema al generar el PDF. Probá con una cantidad menor.");
    } finally {
      set({ generando: false, progreso: null });
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

  sacarBolilla: (descripcion) => {
    const { semilla, ventas, premios, bolillas } = get();
    const etapa = etapaActual(premios);
    if (etapa === null) return null;
    const modalidad = SECUENCIA[etapa];
    if (!esModalidadBolillero(modalidad)) return null;
    if (ventas.length === 0 || bolillas.length >= TOTAL_BOLILLAS) return null;

    const bolilla = sacarBolillaAlAzar(bolillas);
    const salidas = agregarBolilla(semilla, bolilla);
    const numeros = ganadoresDe(
      cartonesVendidos(semilla, ventas),
      new Set(salidas),
      modalidad,
    );
    if (numeros.length === 0) {
      set({ bolillas: salidas });
      return { bolilla, ganadores: [] };
    }

    // Empate: ganan todos los que completaron con esta bolilla.
    const actualizados = registrarPremios(
      semilla,
      numeros.map((numero) =>
        datosPremio(numero, ventas, {
          descripcion,
          modalidad,
          etapa,
          bolillas: salidas.length,
        }),
      ),
    );
    const ganadores = actualizados.slice(-numeros.length);
    set({ bolillas: salidas, premios: actualizados, ultimoResultado: ganadores });
    return { bolilla, ganadores };
  },

  sortearGanador: (descripcion) => {
    const { semilla, ventas, premios } = get();
    const etapa = etapaActual(premios);
    if (etapa === null || SECUENCIA[etapa] !== "sorteo") return null;
    if (ventas.length === 0) return null;

    // Entran los vendidos aunque hayan ganado el cuaterno o la línea (así lo
    // juega el cliente), pero no el que ya ganó un sorteo de esta noche: el
    // mismo cartón no se lleva dos sorteos. Los "sorteos anteriores" (sin
    // etapa) son de antes del bolillero y no cuentan. Si ya ganaron todos
    // (un solo cartón vendido), se sortea entre todos para no trabar la noche.
    const vendidos = ventas.map((v) => v.numero);
    const yaGanaronSorteo = premios
      .filter((p) => p.modalidad === "sorteo" && p.etapa !== undefined)
      .map((p) => p.numero);
    const bombo = elegibles(vendidos, yaGanaronSorteo);
    const numero = sortearUno(bombo.length > 0 ? bombo : vendidos);
    const actualizados = registrarPremios(semilla, [
      datosPremio(numero, ventas, { descripcion, modalidad: "sorteo", etapa }),
    ]);
    const ganador = actualizados[actualizados.length - 1];
    set({ premios: actualizados, ultimoResultado: [ganador] });
    return ganador;
  },

  continuar: () => set({ ultimoResultado: [] }),

  deshacerPremio: () => {
    const { semilla, premios } = get();
    const ultimo = premios[premios.length - 1];
    if (!ultimo || ultimo.modalidad !== "sorteo") return false;
    set({ premios: deshacerUltimoPremio(semilla), ultimoResultado: [] });
    return true;
  },

  reiniciarJuego: () => {
    const { semilla } = get();
    set({
      bolillas: reiniciarBolillas(semilla),
      premios: reiniciarPremios(semilla),
      ultimoResultado: [],
    });
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
