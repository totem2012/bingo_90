// Panel de configuración: cantidad, cartones por hoja, semilla y botón generar.

import { useRef, useState } from "react";
import { proximoDesdeDe, useBingo } from "../state/store.ts";
import { LogoUploader } from "./LogoUploader.tsx";

// Colores predeterminados frecuentes (el usuario igual puede elegir uno libre).
const COLORES_PRESET: { hex: string; nombre: string }[] = [
  { hex: "#2563eb", nombre: "Azul" },
  { hex: "#dc2626", nombre: "Rojo" },
  { hex: "#16a34a", nombre: "Verde" },
  { hex: "#9333ea", nombre: "Violeta" },
  { hex: "#ea580c", nombre: "Naranja" },
  { hex: "#0d9488", nombre: "Turquesa" },
  { hex: "#db2777", nombre: "Rosa" },
  { hex: "#1e293b", nombre: "Negro" },
];

export function ConfigPanel() {
  const {
    cantidad,
    cartonesPorHoja,
    semilla,
    registro,
    generando,
    marca,
    setCantidad,
    setCartonesPorHoja,
    setSemilla,
    setTitulo,
    setSubtitulo,
    setEvento,
    setSerie,
    setColor,
    nuevaSemilla,
    deshacerUltimaTirada,
    reiniciarCampana,
    generarPdf,
    exportar,
    importar,
  } = useBingo();

  const claseInput =
    "rounded-lg border border-slate-300 px-3 py-2 text-slate-800 outline-none focus:border-marca-500 focus:ring-2 focus:ring-marca-100";

  // Texto local del campo de cantidad: permite borrarlo del todo mientras
  // se escribe. Se valida al salir del campo (onBlur).
  const [cantidadTexto, setCantidadTexto] = useState(String(cantidad));

  function onCambioCantidad(valor: string) {
    setCantidadTexto(valor);
    const n = parseInt(valor, 10);
    if (Number.isInteger(n) && n >= 1) setCantidad(n);
  }

  function onSalirCantidad() {
    const n = parseInt(cantidadTexto, 10);
    if (!Number.isInteger(n) || n < 1) {
      setCantidad(1);
      setCantidadTexto("1");
    } else {
      setCantidadTexto(String(n));
    }
  }

  // Texto local del campo de semilla (permite editarla para retomar una
  // campaña existente). Se valida al salir del campo.
  const [semillaTexto, setSemillaTexto] = useState(String(semilla));

  function onSalirSemilla() {
    const n = parseInt(semillaTexto, 10);
    if (!Number.isInteger(n) || n < 0) {
      setSemillaTexto(String(semilla));
    } else if (n !== semilla) {
      setSemilla(n);
    }
  }

  function onNuevaSemilla() {
    nuevaSemilla();
    // El input es no-controlado respecto del store; lo sincronizamos a mano.
    setSemillaTexto(String(useBingo.getState().semilla));
  }

  // Respaldo / portabilidad de la campaña completa (semilla + tiradas +
  // ventas + premios) en un .json que sube y baja el propio usuario.
  const archivoRef = useRef<HTMLInputElement>(null);

  async function onImportar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Permite volver a elegir el mismo archivo si hubo un error.
    e.target.value = "";

    if (
      !confirm(
        "Importar va a reemplazar las tiradas, ventas y premios guardados de esa campaña. ¿Seguir?",
      )
    ) {
      return;
    }

    try {
      importar(await file.text());
      setSemillaTexto(String(useBingo.getState().semilla));
      alert("Campaña importada correctamente.");
    } catch (error) {
      console.error(error);
      alert(
        error instanceof Error
          ? `No se pudo importar: ${error.message}`
          : "No se pudo importar el archivo.",
      );
    }
  }

  // La app decide dónde empieza la próxima tirada (continúa el historial).
  const desde = proximoDesdeDe(registro);
  const hasta = desde + cantidad - 1;
  const totalImpreso = desde - 1;

  const muchos = cantidad > 1000;

  const fmtFecha = (iso: string) =>
    new Date(iso).toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    });

  return (
    <div className="flex flex-col gap-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-800">Personalización</h2>

      {/* Título principal */}
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-slate-600">Título principal</span>
        <input
          type="text"
          value={marca.titulo}
          maxLength={60}
          placeholder="Ej: I.S.F.D. Profesorado de Educación Física"
          onChange={(e) => setTitulo(e.target.value)}
          className={claseInput}
        />
      </label>

      {/* Subtítulo */}
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-slate-600">Subtítulo</span>
        <input
          type="text"
          value={marca.subtitulo}
          maxLength={60}
          placeholder="Ej: Bella Vista - Corrientes"
          onChange={(e) => setSubtitulo(e.target.value)}
          className={claseInput}
        />
      </label>

      {/* Nombre del evento */}
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-slate-600">Nombre del evento</span>
        <input
          type="text"
          value={marca.evento}
          maxLength={50}
          placeholder="Ej: Gran Bingo Solidario 2026"
          onChange={(e) => setEvento(e.target.value)}
          className={claseInput}
        />
      </label>

      {/* Logos */}
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-slate-600">Logos (opcionales)</span>
        <div className="flex gap-3">
          <LogoUploader slot="logoIzquierdo" etiqueta="Izquierdo" />
          <LogoUploader slot="logoDerecho" etiqueta="Derecho" />
        </div>
      </div>

      {/* Serie */}
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-slate-600">
          Serie <span className="font-normal text-slate-400">(en el talón)</span>
        </span>
        <input
          type="text"
          value={marca.serie}
          maxLength={12}
          placeholder="Ej: A"
          onChange={(e) => setSerie(e.target.value)}
          className={claseInput}
        />
      </label>

      {/* Color principal */}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-slate-600">Color principal</span>

        {/* Presets */}
        <div className="flex flex-wrap gap-2">
          {COLORES_PRESET.map(({ hex, nombre }) => {
            const activo = marca.color.toLowerCase() === hex.toLowerCase();
            return (
              <button
                key={hex}
                type="button"
                title={nombre}
                aria-label={nombre}
                onClick={() => setColor(hex)}
                className={[
                  "h-7 w-7 rounded-full border-2 transition",
                  activo
                    ? "border-slate-800 ring-2 ring-slate-300"
                    : "border-white shadow-sm hover:scale-110",
                ].join(" ")}
                style={{ backgroundColor: hex }}
              />
            );
          })}
        </div>

        {/* Selector libre */}
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={marca.color}
            onChange={(e) => setColor(e.target.value)}
            className="h-10 w-14 cursor-pointer rounded border border-slate-300 bg-white"
          />
          <span className="text-xs text-slate-400">o elegí uno a medida →</span>
          <code className="font-mono text-sm uppercase text-slate-500">
            {marca.color}
          </code>
        </div>
      </div>

      <hr className="border-slate-200" />

      <h2 className="text-lg font-semibold text-slate-800">Tirada</h2>

      {/* Cantidad */}
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-slate-600">
          Cantidad de cartones
        </span>
        <input
          type="number"
          min={1}
          value={cantidadTexto}
          onChange={(e) => onCambioCantidad(e.target.value)}
          onBlur={onSalirCantidad}
          className="rounded-lg border border-slate-300 px-3 py-2 text-slate-800 outline-none focus:border-marca-500 focus:ring-2 focus:ring-marca-100"
        />
        {muchos && (
          <span className="text-xs text-amber-600">
            Generar muchos cartones puede tardar unos segundos.
          </span>
        )}
      </label>

      {/* Tramo automático de esta tirada (lo decide la app, no el usuario) */}
      <div className="rounded-lg border border-marca-200 bg-marca-50 px-3 py-2">
        <span className="text-sm font-medium text-marca-800">
          Esta tirada: cartones N° {desde} al {hasta}
        </span>
        <p className="mt-0.5 text-xs text-marca-700">
          La app continúa automáticamente desde donde terminó la última tirada
          de esta semilla. Imposible pisar cartones ya impresos.
        </p>
      </div>

      {/* Cartones por hoja */}
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-slate-600">
          Cartones por hoja
        </span>
        <div className="flex gap-2">
          {[2, 3, 4].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setCartonesPorHoja(n)}
              className={[
                "flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition",
                cartonesPorHoja === n
                  ? "border-marca-600 bg-marca-50 text-marca-700"
                  : "border-slate-300 text-slate-600 hover:border-slate-400",
              ].join(" ")}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Semilla = identidad de la campaña */}
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-slate-600">
          Semilla de la campaña
        </span>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            value={semillaTexto}
            onChange={(e) => setSemillaTexto(e.target.value)}
            onBlur={onSalirSemilla}
            className="w-full flex-1 rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm text-slate-700 outline-none focus:border-marca-500 focus:ring-2 focus:ring-marca-100"
            title="Escribí la semilla de una campaña anterior para retomarla"
          />
          <button
            type="button"
            onClick={onNuevaSemilla}
            className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:border-slate-400"
            title="Sortear una semilla nueva (campaña nueva)"
          >
            ↻ Nueva
          </button>
        </div>
        <span className="text-xs text-slate-400">
          Misma semilla = misma campaña. Para repartir entre escuelas sin
          repetir, dejá esta semilla fija y cambiá solo el título y la cantidad.
          Anotala: escribiéndola acá retomás la campaña cuando quieras.
        </span>
      </div>

      {/* Respaldo y portabilidad de la campaña */}
      <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <span className="text-sm font-medium text-slate-600">
          Respaldo de la campaña
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={exportar}
            className="flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-400"
            title="Bajar un .json con la semilla, las tiradas, las ventas y los premios"
          >
            ↓ Exportar
          </button>
          <button
            type="button"
            onClick={() => archivoRef.current?.click()}
            className="flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-400"
            title="Cargar una campaña desde un .json exportado antes"
          >
            ↑ Importar
          </button>
          <input
            ref={archivoRef}
            type="file"
            accept="application/json,.json"
            onChange={onImportar}
            className="hidden"
          />
        </div>
        <span className="text-xs text-slate-400">
          Guardá el archivo: si se limpia el caché del navegador perdés la
          numeración y las ventas. También sirve para sortear desde otra
          computadora.
        </span>
      </div>

      {/* Historial de tiradas de esta semilla */}
      {registro.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-600">
              Tiradas de esta semilla
            </span>
            <span className="text-xs text-slate-400">
              {totalImpreso} cartones entregados
            </span>
          </div>
          <ul className="flex flex-col gap-1">
            {registro.map((t, i) => (
              <li
                key={i}
                className="flex items-baseline justify-between gap-2 text-xs"
              >
                <span className="truncate font-medium text-slate-700">
                  {t.titulo}
                </span>
                <span className="shrink-0 font-mono text-slate-500">
                  N° {t.desde}–{t.hasta} · {fmtFecha(t.fecha)}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={deshacerUltimaTirada}
              className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:border-slate-400"
              title="Borrar la última tirada del historial"
            >
              ↶ Deshacer última
            </button>
            <button
              type="button"
              onClick={() => {
                if (
                  confirm(
                    "¿Borrar todo el historial de esta semilla?\n\nSe borran también las VENTAS y los PREMIOS cargados, y la próxima tirada volverá a empezar en el cartón N° 1.",
                  )
                ) {
                  reiniciarCampana();
                }
              }}
              className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-rose-600 hover:border-rose-400"
              title="Vaciar el historial y empezar de cero"
            >
              Reiniciar
            </button>
          </div>
        </div>
      )}

      {/* Generar */}
      <button
        type="button"
        onClick={generarPdf}
        disabled={generando}
        className="mt-2 rounded-lg bg-marca-600 px-4 py-3 font-semibold text-white shadow-sm transition hover:bg-marca-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {generando ? "Generando PDF…" : "Generar PDF"}
      </button>
    </div>
  );
}
