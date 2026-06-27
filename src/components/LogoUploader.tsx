// Carga de logo: lee la imagen en el navegador (no se sube a ningún servidor),
// guarda los bytes para el PDF y un data URL para la miniatura.

import { useRef } from "react";
import { useBingo } from "../state/store.ts";
import type { LogoImagen, SlotLogo } from "../lib/marca.ts";

function leerComoDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

interface Props {
  slot: SlotLogo;
  etiqueta: string;
}

export function LogoUploader({ slot, etiqueta }: Props) {
  const logo = useBingo((s) => s.marca[slot]);
  const setLogo = useBingo((s) => s.setLogo);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const tipo =
      file.type === "image/png"
        ? "image/png"
        : file.type === "image/jpeg"
          ? "image/jpeg"
          : null;
    if (!tipo) {
      alert("El logo debe ser una imagen PNG o JPG.");
      return;
    }

    const [bytes, dataUrl] = await Promise.all([
      file.arrayBuffer().then((b) => new Uint8Array(b)),
      leerComoDataUrl(file),
    ]);
    const nuevo: LogoImagen = { bytes, tipo, dataUrl };
    setLogo(slot, nuevo);
  }

  function quitar() {
    setLogo(slot, null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="flex flex-1 flex-col gap-1">
      <span className="text-xs font-medium text-slate-500">{etiqueta}</span>

      {logo ? (
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
          <img
            src={logo.dataUrl}
            alt={etiqueta}
            className="h-10 w-10 rounded object-contain"
          />
          <button
            type="button"
            onClick={quitar}
            className="text-xs font-medium text-red-600 hover:underline"
          >
            Quitar
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="rounded-lg border border-dashed border-slate-300 px-2 py-3 text-xs text-slate-500 hover:border-marca-500 hover:text-marca-600"
        >
          + Subir
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg"
        onChange={onArchivo}
        className="hidden"
      />
    </div>
  );
}
