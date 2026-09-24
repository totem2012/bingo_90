// El juego de la noche: bolillero, sorteos y ganadores.
//
// La noche sigue la secuencia de core/juego.ts (cuaterna → sorteo → fila →
// sorteo → cartón lleno → sorteo). La etapa en curso se deriva de los premios
// del store; acá solo vive lo visual (animaciones, pantalla completa, qué
// cartón se está cotejando).

import { useEffect, useMemo, useRef, useState } from "react";
import {
  NOMBRE_MODALIDAD,
  SECUENCIA,
  TOTAL_BOLILLAS,
  bolillasRestantes,
  esModalidadBolillero,
  etapaActual,
  generarLote,
  type Carton,
  type Modalidad,
} from "../../core/index.ts";
import type { Marca } from "../../lib/marca.ts";
import type { Premio } from "../../lib/premios.ts";
import { useBingo } from "../../state/store.ts";
import { CartonPreview } from "../CartonPreview.tsx";
import { Bolilla, Bolillero } from "./Bolillero.tsx";
import { DatosGanador, fmtCarton, type Tono } from "./DatosGanador.tsx";
import { TableroBolillas } from "./TableroBolillas.tsx";

/** Cuánto gira el bombo antes de soltar una bolilla. */
export const DURACION_BOLILLA = 1200;
/** Cuánto dura la ruleta de N° de cartón de un sorteo. */
export const DURACION_SORTEO = 1500;
const PASO_ANIMACION = 70;

/** Qué hay que lograr en cada modalidad, para explicarlo en pantalla. */
const REGLA: Record<Modalidad, string> = {
  cuaterna: "Gana el primer cartón con 4 números salidos, en cualquier parte.",
  fila: "Gana el primer cartón que complete una fila entera.",
  lleno: "Gana el primer cartón con sus 15 números salidos.",
  sorteo: "Sale un cartón al azar entre todos los vendidos.",
};

/** "de la cuaterna", "del sorteo"… para los textos. */
const DE_LA_MODALIDAD: Record<Modalidad, string> = {
  cuaterna: "de la cuaterna",
  fila: "de la fila",
  lleno: "del cartón lleno",
  sorteo: "del sorteo",
};

/**
 * Regenera un cartón para cotejarlo contra el papel. Es O(n) porque recorre
 * la secuencia desde el principio (2 ms en el N° 200, 181 ms en el 20.000),
 * pero se pide solo al tocar "Ver cartón".
 */
function cartonDe(semilla: number, numero: number): Carton | null {
  try {
    return generarLote({ cantidad: 1, semilla, desde: numero }).cartones[0];
  } catch {
    return null;
  }
}

export function PanelJuego() {
  const ventas = useBingo((s) => s.ventas);
  const premios = useBingo((s) => s.premios);
  const bolillas = useBingo((s) => s.bolillas);
  const semilla = useBingo((s) => s.semilla);
  const marca = useBingo((s) => s.marca);
  const ultimoResultado = useBingo((s) => s.ultimoResultado);
  const sacarBolilla = useBingo((s) => s.sacarBolilla);
  const sortearGanador = useBingo((s) => s.sortearGanador);
  const continuar = useBingo((s) => s.continuar);
  const deshacerPremio = useBingo((s) => s.deshacerPremio);
  const reiniciarJuego = useBingo((s) => s.reiniciarJuego);

  const [descripcion, setDescripcion] = useState("");
  const [girando, setGirando] = useState(false);
  // Lo que pasa por la pantalla mientras gira: bolillas o N° de cartón.
  const [numeroGirando, setNumeroGirando] = useState<number | null>(null);
  // Golpe de escala al frenar la ruleta del sorteo.
  const [aterrizando, setAterrizando] = useState(false);
  const [pantallaCompleta, setPantallaCompleta] = useState(false);
  // N° del ganador cuyo cartón se está mostrando para cotejar (uno a la vez:
  // en un empate, los cartones uno abajo del otro no entran proyectados).
  const [cartonVisible, setCartonVisible] = useState<number | null>(null);

  const timers = useRef<{ intervalo?: number; fin?: number; pop?: number }>({});
  useEffect(() => {
    const t = timers.current;
    return () => {
      if (t.intervalo) clearInterval(t.intervalo);
      if (t.fin) clearTimeout(t.fin);
      if (t.pop) clearTimeout(t.pop);
    };
  }, []);

  const etapa = etapaActual(premios);
  const modalidad = etapa === null ? null : SECUENCIA[etapa];
  const enBolillero = modalidad !== null && esModalidadBolillero(modalidad);
  // El resultado de una etapa queda en pantalla hasta que el operador pasa a
  // la siguiente: el botón de la próxima acción nunca aparece junto al
  // ganador. Delante de la gente, un click de más no se arregla.
  const mostrandoResultado = !girando && ultimoResultado.length > 0;
  const quedanBolillas = bolillas.length < TOTAL_BOLILLAS;
  const puedeActuar =
    !girando &&
    !mostrandoResultado &&
    etapa !== null &&
    ventas.length > 0 &&
    (!enBolillero || quedanBolillas);

  const salidas = useMemo(() => new Set(bolillas), [bolillas]);
  const cartonMostrado = useMemo(
    () => (cartonVisible === null ? null : cartonDe(semilla, cartonVisible)),
    [semilla, cartonVisible],
  );

  function accion() {
    if (!puedeActuar) return;
    const esBolillero = enBolillero;
    // La descripción se lee ahora: es la que estaba escrita al tocar el botón.
    const premio = descripcion;
    setGirando(true);
    setCartonVisible(null);
    const candidatos = esBolillero
      ? bolillasRestantes(bolillas)
      : ventas.map((v) => v.numero);
    const alAzar = () => candidatos[Math.floor(Math.random() * candidatos.length)];
    setNumeroGirando(alAzar());
    timers.current.intervalo = window.setInterval(
      () => setNumeroGirando(alAzar()),
      PASO_ANIMACION,
    );
    timers.current.fin = window.setTimeout(
      () => {
        if (timers.current.intervalo) clearInterval(timers.current.intervalo);
        // Lo que sale lo decide el store, no la animación.
        const hubo = esBolillero
          ? (sacarBolilla(premio)?.ganadores.length ?? 0) > 0
          : sortearGanador(premio) !== null;
        if (hubo) {
          setDescripcion("");
          setAterrizando(true);
          timers.current.pop = window.setTimeout(() => setAterrizando(false), 30);
        }
        setNumeroGirando(null);
        setGirando(false);
      },
      esBolillero ? DURACION_BOLILLA : DURACION_SORTEO,
    );
  }

  // Referencia fresca para el atajo de teclado, que se registra una sola vez.
  const accionRef = useRef(accion);
  accionRef.current = accion;
  const enBolilleroRef = useRef(enBolillero);
  enBolilleroRef.current = enBolillero;

  // Barra espaciadora = sacar bolilla. En la noche se sacan decenas y el
  // operador está mirando al salón, no al mouse. No se usa para sortear: un
  // sorteo es un momento aparte y se hace a propósito, con el botón.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key !== " " || !enBolilleroRef.current) return;
      const t = e.target as HTMLElement | null;
      // Sobre un campo se está escribiendo; sobre un botón, el espacio ya lo
      // aprieta el navegador y se sacarían dos bolillas.
      if (t && /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(t.tagName)) return;
      e.preventDefault();
      accionRef.current();
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, []);

  // Salir de la pantalla completa con Escape, como cualquier modal.
  useEffect(() => {
    if (!pantallaCompleta) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPantallaCompleta(false);
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [pantallaCompleta]);

  const ultimoPremio = premios[premios.length - 1];
  const sePuedeDeshacer =
    !girando && ultimoPremio !== undefined && ultimoPremio.modalidad === "sorteo";

  /** La escena principal: la misma en la tarjeta y en la pantalla completa. */
  function escena(tono: Tono) {
    const escenario = tono === "escenario";
    const textoSuave = escenario ? "text-marca-100" : "text-slate-600";

    if (mostrandoResultado) {
      return (
        <Resultado
          ganadores={ultimoResultado}
          tono={tono}
          aterrizando={aterrizando}
          proxima={modalidad}
          cartonVisible={cartonVisible}
          onVerCarton={(n) => setCartonVisible((v) => (v === n ? null : n))}
          carton={cartonMostrado}
          marcados={salidas}
          bolillaGanadora={bolillas[bolillas.length - 1] ?? null}
          marca={marca}
          onContinuar={() => {
            setCartonVisible(null);
            continuar();
          }}
        />
      );
    }

    if (etapa === null || modalidad === null) {
      return (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <span
            className={
              escenario
                ? "text-5xl font-extrabold text-white"
                : "text-2xl font-bold text-slate-800"
            }
          >
            ¡Terminó el juego!
          </span>
          <span className={textoSuave}>
            Los ganadores de cada etapa quedan en la lista.
          </span>
        </div>
      );
    }

    return (
      <div className="flex w-full flex-col items-center gap-5 text-center">
        <div className="flex flex-col items-center gap-1">
          <span
            className={[
              "text-xs font-semibold uppercase tracking-wide",
              escenario ? "text-marca-200" : "text-marca-700",
            ].join(" ")}
          >
            Etapa {etapa + 1} de {SECUENCIA.length}
          </span>
          <span
            className={
              escenario
                ? "text-5xl font-extrabold text-white sm:text-6xl"
                : "text-3xl font-bold text-slate-800"
            }
          >
            {NOMBRE_MODALIDAD[modalidad]}
          </span>
          <span className={["text-sm", textoSuave].join(" ")}>
            {REGLA[modalidad]}
          </span>
        </div>

        {enBolillero ? (
          <Bolillero
            girando={girando}
            numeroVisible={girando ? numeroGirando : (bolillas[bolillas.length - 1] ?? null)}
            ultimas={
              girando ? bolillas.slice(-5).reverse() : bolillas.slice(-6, -1).reverse()
            }
            tono={tono}
          />
        ) : (
          girando &&
          numeroGirando !== null && (
            <div className="flex flex-col items-center gap-1">
              <span
                className={[
                  "text-sm font-semibold uppercase tracking-wide",
                  escenario ? "text-marca-200" : "text-marca-700",
                ].join(" ")}
              >
                Sorteando…
              </span>
              <DatosGanador
                premio={null}
                numero={numeroGirando}
                aterrizando={false}
                tono={tono}
              />
            </div>
          )
        )}

        <div className="flex w-full max-w-md flex-col gap-3">
          <label className="flex flex-col gap-1 text-left">
            <span
              className={[
                "text-sm font-medium",
                escenario ? "text-marca-100" : "text-slate-600",
              ].join(" ")}
            >
              Premio {DE_LA_MODALIDAD[modalidad]}{" "}
              <span className="font-normal opacity-80">(opcional)</span>
            </span>
            <input
              type="text"
              value={descripcion}
              maxLength={60}
              placeholder="Ej: Licuadora"
              disabled={girando}
              onChange={(e) => setDescripcion(e.target.value)}
              className={[
                "rounded-lg border px-3 py-2 text-slate-800 outline-none",
                "focus:border-marca-500 focus:ring-2 focus:ring-marca-100",
                "disabled:bg-slate-50",
                escenario
                  ? "border-marca-200 bg-white text-base"
                  : "border-slate-300 text-sm",
              ].join(" ")}
            />
          </label>
          <button
            type="button"
            onClick={accion}
            disabled={!puedeActuar}
            className={[
              "rounded-lg bg-marca-600 px-4 py-4 font-bold text-white shadow-sm transition",
              "hover:bg-marca-700 disabled:cursor-not-allowed disabled:opacity-60",
              "focus-visible:ring-2 focus-visible:ring-marca-500 focus-visible:ring-offset-2",
              escenario ? "text-xl focus-visible:ring-offset-marca-900" : "text-lg",
            ].join(" ")}
          >
            {enBolillero
              ? girando
                ? "Mezclando…"
                : "🎱 Sacar bolilla"
              : girando
                ? "Sorteando…"
                : "🎲 Sortear ganador"}
          </button>
          {enBolillero && puedeActuar && (
            <span
              className={
                escenario ? "text-xs text-marca-200" : "text-xs text-slate-400"
              }
            >
              También con la barra espaciadora.
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <main className="mx-auto grid max-w-5xl gap-6 px-4 py-8 sm:px-6 md:grid-cols-[1fr_22rem]">
      {/* ── Escena del juego ── */}
      <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm md:self-start">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-800">Juego</h2>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">
              <strong className="text-slate-700">{ventas.length}</strong>{" "}
              {ventas.length === 1 ? "cartón en juego" : "cartones en juego"}
            </span>
            <button
              type="button"
              onClick={() => setPantallaCompleta(true)}
              className="rounded-md border border-marca-600 px-3 py-1.5 text-sm font-medium text-marca-700 hover:bg-marca-100 focus-visible:ring-2 focus-visible:ring-marca-500 focus-visible:ring-offset-2"
              title="Mostrar el juego en grande para el salón"
            >
              ⛶ Pantalla completa
            </button>
          </div>
        </div>

        {ventas.length === 0 && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Todavía no cargaste ningún cartón vendido. Solo juegan los cartones
            vendidos: cargalos en la pestaña “Ventas” para poder empezar.
          </p>
        )}

        {escena("tarjeta")}
      </section>

      {/* ── Tablero + etapas ── */}
      <aside className="flex flex-col gap-6">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <TableroBolillas bolillas={bolillas} tono="tarjeta" />
        </div>
        <ListaEtapas
          premios={premios}
          etapa={etapa}
          sePuedeDeshacer={sePuedeDeshacer}
          hayJuego={bolillas.length > 0 || premios.length > 0}
          girando={girando}
          onDeshacer={() => {
            setCartonVisible(null);
            deshacerPremio();
          }}
          onReiniciar={() => {
            if (
              confirm(
                "¿Empezar el juego de cero? Vuelven todas las bolillas al bolillero y se borran los ganadores.",
              )
            ) {
              setCartonVisible(null);
              setDescripcion("");
              reiniciarJuego();
            }
          }}
        />
      </aside>

      {/* ── Pantalla completa para el salón ──
          Se proyecta: todo tiene que leerse de lejos. Va sobria a propósito
          —fondo plano, tipografía grande— porque lo que importa es que se lea.
          El contenido es la misma escena que la tarjeta, así que no es una
          segunda pantalla que mantener. */}
      {pantallaCompleta && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Juego en pantalla completa"
          className="fixed inset-0 z-50 overflow-auto bg-marca-900 p-6"
        >
          <div className="mx-auto grid min-h-full max-w-6xl items-center gap-8 lg:grid-cols-[1fr_24rem]">
            <div className="flex flex-col items-center gap-6">{escena("escenario")}</div>
            <div className="flex flex-col items-center gap-4">
              <TableroBolillas bolillas={bolillas} tono="escenario" />
              <button
                type="button"
                onClick={() => setPantallaCompleta(false)}
                className="rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-marca-900 hover:bg-marca-50 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-marca-900"
              >
                Salir (Esc)
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

/** Los ganadores de la etapa que se acaba de cerrar. */
function Resultado({
  ganadores,
  tono,
  aterrizando,
  proxima,
  cartonVisible,
  onVerCarton,
  carton,
  marcados,
  bolillaGanadora,
  marca,
  onContinuar,
}: {
  ganadores: Premio[];
  tono: Tono;
  aterrizando: boolean;
  /** Modalidad de la etapa que sigue (null si terminó el juego). */
  proxima: Modalidad | null;
  cartonVisible: number | null;
  onVerCarton: (numero: number) => void;
  carton: Carton | null;
  marcados: ReadonlySet<number>;
  /** La bolilla con la que se completó (la última que salió). */
  bolillaGanadora: number | null;
  marca: Marca;
  onContinuar: () => void;
}) {
  const escenario = tono === "escenario";
  const primero = ganadores[0];
  const modalidad = primero.modalidad;
  const conBolillero = esModalidadBolillero(modalidad);
  const empate = ganadores.length > 1;
  const botonSecundario = escenario
    ? "rounded-md border border-marca-200 px-3 py-1.5 text-sm font-medium text-marca-100 hover:bg-marca-800 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-marca-900"
    : "rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:border-slate-400 focus-visible:ring-2 focus-visible:ring-marca-500 focus-visible:ring-offset-2";

  return (
    <div
      className={[
        "flex w-full flex-col items-center gap-4 text-center",
        escenario ? "" : "rounded-xl border-2 border-marca-600 bg-marca-50 p-6",
      ].join(" ")}
    >
      <span
        className={
          escenario
            ? "text-5xl font-extrabold text-white sm:text-6xl"
            : "text-3xl font-extrabold text-marca-800"
        }
      >
        {conBolillero ? `¡${NOMBRE_MODALIDAD[modalidad]}!` : "Ganador del sorteo"}
      </span>
      {primero.descripcion && (
        <span
          className={
            escenario
              ? "text-3xl font-semibold text-marca-100 sm:text-4xl"
              : "text-xl font-bold text-marca-800"
          }
        >
          {primero.descripcion}
        </span>
      )}
      {conBolillero && primero.bolillas !== undefined && (
        <span
          className={[
            "flex items-center gap-2 text-sm",
            escenario ? "text-marca-100" : "text-slate-600",
          ].join(" ")}
        >
          Con la bolilla
          {bolillaGanadora !== null && (
            <Bolilla numero={bolillaGanadora} tamano="chica" destacada />
          )}
          (salieron {primero.bolillas})
        </span>
      )}
      {empate && (
        <span
          className={[
            "rounded-full px-3 py-1 text-sm font-semibold",
            escenario ? "bg-amber-400 text-marca-900" : "bg-amber-100 text-amber-900",
          ].join(" ")}
        >
          Empate: ganan {ganadores.length} cartones
        </span>
      )}

      <ul className="flex flex-wrap items-start justify-center gap-6">
        {ganadores.map((g) => (
          <li key={g.orden} className="flex flex-col items-center gap-2">
            <DatosGanador
              premio={g}
              numero={g.numero}
              aterrizando={aterrizando}
              tono={tono}
              compacto={empate}
            />
            <button
              type="button"
              onClick={() => onVerCarton(g.numero)}
              className={botonSecundario}
            >
              {cartonVisible === g.numero
                ? "Ocultar cartón"
                : empate
                  ? `Ver cartón ${fmtCarton(g.numero)}`
                  : "Ver cartón"}
            </button>
          </li>
        ))}
      </ul>

      {/* El cotejo contra el papel: con los números salidos resaltados, se
          controla de un vistazo si el que canta tiene razón. */}
      {carton && cartonVisible !== null && (
        <div className="w-full max-w-md rounded-xl bg-white p-3 text-left">
          <CartonPreview
            carton={carton}
            marca={marca}
            numero={cartonVisible}
            marcados={conBolillero ? marcados : undefined}
          />
        </div>
      )}

      <button
        type="button"
        onClick={onContinuar}
        className={[
          "rounded-lg px-5 py-3 text-lg font-bold shadow-sm transition",
          "focus-visible:ring-2 focus-visible:ring-offset-2",
          escenario
            ? "bg-white text-marca-900 hover:bg-marca-50 focus-visible:ring-white focus-visible:ring-offset-marca-900"
            : "bg-marca-600 text-white hover:bg-marca-700 focus-visible:ring-marca-500",
        ].join(" ")}
      >
        {proxima ? `Siguiente: ${NOMBRE_MODALIDAD[proxima]} →` : "Terminar"}
      </button>
    </div>
  );
}

/** Las seis etapas de la noche con sus ganadores, y el historial viejo. */
function ListaEtapas({
  premios,
  etapa,
  sePuedeDeshacer,
  hayJuego,
  girando,
  onDeshacer,
  onReiniciar,
}: {
  premios: Premio[];
  etapa: number | null;
  sePuedeDeshacer: boolean;
  hayJuego: boolean;
  girando: boolean;
  onDeshacer: () => void;
  onReiniciar: () => void;
}) {
  // Sorteos de antes de que existieran las etapas: no se pierden, pero no
  // cuentan para la secuencia de esta noche.
  const anteriores = premios.filter((p) => p.etapa === undefined);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-600">Etapas de la noche</h3>
      <ol className="flex flex-col gap-1">
        {SECUENCIA.map((m, i) => {
          const ganadores = premios.filter((p) => p.etapa === i);
          const actual = i === etapa;
          return (
            <li
              key={i}
              className={[
                "flex flex-col gap-0.5 rounded-lg px-2 py-1.5 text-sm",
                actual ? "bg-marca-50 ring-1 ring-marca-200" : "",
              ].join(" ")}
            >
              <span className="flex items-center justify-between gap-2">
                <span
                  className={
                    ganadores.length > 0
                      ? "font-semibold text-slate-700"
                      : actual
                        ? "font-semibold text-marca-700"
                        : "text-slate-400"
                  }
                >
                  {i + 1}. {NOMBRE_MODALIDAD[m]}
                </span>
                {actual && (
                  <span className="text-xs font-medium text-marca-700">en juego</span>
                )}
                {ganadores.length > 0 && ganadores[0].bolillas !== undefined && (
                  <span className="text-xs text-slate-500">
                    bolilla {ganadores[0].bolillas}
                  </span>
                )}
              </span>
              {ganadores.map((g) => (
                <span
                  key={g.orden}
                  className="flex items-baseline justify-between gap-2 pl-4 text-slate-600"
                >
                  <span className="min-w-0 flex-1 truncate">
                    {g.descripcion && (
                      <span className="text-slate-500">{g.descripcion} — </span>
                    )}
                    {g.comprador || "(sin nombre)"}
                  </span>
                  <span className="shrink-0 font-mono text-xs text-slate-500">
                    N° {g.numero}
                  </span>
                </span>
              ))}
            </li>
          );
        })}
      </ol>

      {anteriores.length > 0 && (
        <div className="flex flex-col gap-1 border-t border-slate-100 pt-2">
          <h4 className="text-xs font-semibold text-slate-500">Sorteos anteriores</h4>
          {anteriores.map((p) => (
            <span
              key={p.orden}
              className="flex items-baseline justify-between gap-2 text-sm text-slate-600"
            >
              <span className="min-w-0 flex-1 truncate">
                {p.descripcion && (
                  <span className="text-slate-500">{p.descripcion} — </span>
                )}
                {p.comprador || "(sin nombre)"}
              </span>
              <span className="shrink-0 font-mono text-xs text-slate-500">
                N° {p.numero}
              </span>
            </span>
          ))}
        </div>
      )}

      {hayJuego && (
        <div className="flex flex-wrap gap-2 pt-1">
          {sePuedeDeshacer && (
            <button
              type="button"
              onClick={onDeshacer}
              className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:border-slate-400 focus-visible:ring-2 focus-visible:ring-marca-500 focus-visible:ring-offset-2"
              title="Borra el ganador del último sorteo para volver a sortearlo"
            >
              ↶ Deshacer último sorteo
            </button>
          )}
          <button
            type="button"
            onClick={onReiniciar}
            disabled={girando}
            className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-rose-600 hover:border-rose-400 disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-marca-500 focus-visible:ring-offset-2"
          >
            Reiniciar juego
          </button>
        </div>
      )}
    </div>
  );
}
