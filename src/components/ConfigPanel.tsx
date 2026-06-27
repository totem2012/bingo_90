// Panel de configuración: cantidad, cartones por hoja, semilla y botón generar.

import { useState } from "react";
import { useBingo } from "../state/store.ts";
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
    generando,
    marca,
    setCantidad,
    setCartonesPorHoja,
    setTitulo,
    setSubtitulo,
    setEvento,
    setSerie,
    setColor,
    nuevaSemilla,
    generarPdf,
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

  const muchos = cantidad > 1000;

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

      {/* Semilla */}
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-slate-600">
          Semilla del lote
        </span>
        <div className="flex items-center gap-2">
          <code className="flex-1 truncate rounded-lg bg-slate-100 px-3 py-2 font-mono text-sm text-slate-600">
            {semilla}
          </code>
          <button
            type="button"
            onClick={nuevaSemilla}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:border-slate-400"
            title="Sortear una nueva variación"
          >
            ↻ Nueva
          </button>
        </div>
        <span className="text-xs text-slate-400">
          Misma semilla = mismos cartones (para reimprimir sin duplicar).
        </span>
      </div>

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
