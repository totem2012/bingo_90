// Vista previa de la unidad (talón + cartón) en pantalla, HTML/CSS.
// Replica el diseño del PDF para que el usuario vea el resultado en vivo.

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import type { Carton } from "../core/index.ts";
import { type Marca } from "../lib/marca.ts";
import { ETIQUETAS_COLUMNA } from "../pdf/layout.ts";
import { contenidoQr } from "../pdf/qr.ts";

interface Props {
  carton: Carton;
  marca: Marca;
  /** N° a mostrar en el talón. Por defecto 1 (vista previa del primer cartón). */
  numero?: number;
}

/** Convierte #rrggbb a rgba con la opacidad dada (para tintes suaves). */
function hexARgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const completo =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const n = parseInt(completo, 16);
  if (Number.isNaN(n)) return `rgba(30,58,138,${alpha})`;
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export function CartonPreview({ carton, marca, numero = 1 }: Props) {
  const [qr, setQr] = useState("");

  useEffect(() => {
    const texto = contenidoQr(carton, numero, marca.serie);
    QRCode.toDataURL(texto, { margin: 1, width: 160 })
      .then(setQr)
      .catch(() => setQr(""));
  }, [carton, marca.serie, numero]);

  const color = marca.color;
  const hayEncabezado =
    marca.titulo.trim() !== "" ||
    marca.subtitulo.trim() !== "" ||
    marca.logoIzquierdo !== null ||
    marca.logoDerecho !== null;

  return (
    <div
      className="flex w-full max-w-2xl overflow-hidden rounded-lg border-2 bg-white text-slate-900 shadow-sm"
      style={{ borderColor: color }}
    >
      {/*
        ── Talón ──
        Se esconde abajo de 640px. En un teléfono de 390px el talón se queda con
        ~100px y su letra de 6px es ilegible, y encima le deja ~28px por celda a
        la grilla, que es el dato que de verdad hay que leer cuando se canta un
        número. Escondiéndolo, las 9 columnas pasan a ~40px. El N° de cartón, que
        es lo único del talón que se necesita en pantalla, se muestra arriba de
        la grilla (ver abajo). En el PDF impreso el talón está siempre: esto es
        una adaptación de la pantalla chica, no un cambio del cartón.
      */}
      <div
        className="hidden w-[26%] flex-col items-center gap-1 border-r-2 border-dashed px-2 py-2 text-center sm:flex"
        style={{ borderColor: hexARgba("#000000", 0.4) }}
      >
        <span className="text-[8px] font-bold tracking-wide text-slate-500">
          CUPÓN DE CONTROL
        </span>
        <span className="text-[9px] font-bold text-slate-700">CARTÓN N°</span>
        {/*
          `text-lg` y no `text-2xl`: este mismo componente se usa en el panel de
          sorteo, que vive en una columna de 24rem, y ahí los seis dígitos se
          salían del talón (que es el 26% del ancho). El tamaño se elige por el
          caso más angosto, no por el más ancho: `sm:`/`md:` no sirven porque
          miran el ancho de la ventana, no el de la tarjeta.
        */}
        <span
          className="w-full text-center text-lg font-extrabold leading-none tabular-nums"
          style={{ color }}
        >
          {String(numero).padStart(6, "0")}
        </span>
        {marca.serie.trim() !== "" && (
          <span
            className="rounded px-2 py-0.5 text-[8px] font-bold text-white"
            style={{ backgroundColor: color }}
          >
            SERIE {marca.serie.trim().toUpperCase()}
          </span>
        )}
        <div className="mt-1 w-full space-y-1">
          {["NOMBRE", "TELÉFONO", "DOMICILIO", "VENDEDOR"].map((c) => (
            <div key={c} className="flex flex-col items-start">
              <span className="text-[6px] text-slate-400">{c}:</span>
              <span className="h-px w-full bg-slate-300" />
            </div>
          ))}
        </div>
        {qr && <img src={qr} alt="QR" className="mt-1 w-2/3" />}
        <span className="text-[5px] text-slate-400">ESCANEÁ PARA VALIDAR</span>
      </div>

      {/* ── Cartón ── */}
      <div className="flex flex-1 flex-col">
        {/* Reemplazo del talón en pantallas angostas: el N° y la serie. */}
        <div className="flex items-baseline justify-between gap-2 px-2 py-1 sm:hidden">
          <span className="text-[9px] font-bold text-slate-500">CARTÓN N°</span>
          <span className="text-base font-extrabold leading-none" style={{ color }}>
            {String(numero).padStart(6, "0")}
          </span>
          {marca.serie.trim() !== "" && (
            <span
              className="rounded px-1.5 py-0.5 text-[8px] font-bold text-white"
              style={{ backgroundColor: color }}
            >
              SERIE {marca.serie.trim().toUpperCase()}
            </span>
          )}
        </div>

        {hayEncabezado && (
          <div
            className="flex items-center gap-2 px-2 py-1.5"
            style={{ backgroundColor: color }}
          >
            {marca.logoIzquierdo && (
              <img
                src={marca.logoIzquierdo.dataUrl}
                alt="Logo"
                className="h-8 w-8 shrink-0 object-contain"
              />
            )}
            <div className="flex min-w-0 flex-1 flex-col items-center text-center text-white">
              {marca.titulo.trim() !== "" && (
                <span className="truncate text-[11px] font-bold leading-tight">
                  {marca.titulo}
                </span>
              )}
              {marca.subtitulo.trim() !== "" && (
                <span className="truncate text-[8px] leading-tight opacity-90">
                  {marca.subtitulo}
                </span>
              )}
            </div>
            {marca.logoDerecho && (
              <img
                src={marca.logoDerecho.dataUrl}
                alt="Logo"
                className="h-8 w-8 shrink-0 object-contain"
              />
            )}
          </div>
        )}

        {marca.evento.trim() !== "" && (
          <div
            className="px-2 py-1 text-center text-[10px] font-bold uppercase"
            style={{ backgroundColor: hexARgba(color, 0.15), color }}
          >
            {marca.evento}
          </div>
        )}

        {/* Encabezados de columna */}
        <div className="grid grid-cols-9">
          {ETIQUETAS_COLUMNA.map((etq) => (
            <div
              key={etq}
              className="border border-white py-0.5 text-center text-[6px] font-bold"
              style={{ backgroundColor: hexARgba(color, 0.3), color }}
            >
              {etq}
            </div>
          ))}
        </div>

        {/*
          Grilla. Las celdas NO son cuadradas: en el PDF se estiran para llenar
          el alto del cartón (renderCarton.ts: `altoCelda = altoGrilla / FILAS`).
          Con `aspect-square` las tres filas no llegaban a llenar el contenedor
          `flex-1` y el fondo del grid asomaba debajo de cada una como una banda
          gris de ancho completo: parecían seis filas. `grid-rows-3` reparte el
          alto en tres partes iguales, igual que el PDF.
        */}
        <div className="grid flex-1 grid-cols-9 grid-rows-3 gap-px bg-slate-800">
          {carton.filas.flatMap((fila, i) =>
            fila.map((celda, j) => (
              <div
                key={`${i}-${j}`}
                // `min-h` solo en pantallas angostas: ahí el talón está oculto y
                // nada más le da alto a la grilla, así que las filas se
                // achataban a la altura del texto. En el PDF la celda es más
                // alta que ancha (~43 × 77 pt), y este mínimo la mantiene en esa
                // proporción a lo ancho de un teléfono.
                className="flex min-h-[3.75rem] items-center justify-center text-sm font-bold tabular-nums sm:min-h-0 sm:text-base"
                // Mismo gris que el PDF para las casillas vacías: COLOR_CELDA_VACIA
                // en renderCarton.ts es rgb(0.96, 0.96, 0.96).
                style={{ backgroundColor: celda === null ? "#f5f5f5" : "#ffffff" }}
              >
                {celda ?? ""}
              </div>
            )),
          )}
        </div>
      </div>
    </div>
  );
}
