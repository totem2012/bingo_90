// Carga de cartones vendidos: por rango (una escuela se lleva del 1 al 200) o
// de a uno con los datos del comprador. Solo se pueden vender cartones YA
// IMPRESOS, es decir dentro de la numeración que llevan las tiradas.

import { useState } from "react";
import { proximoDesdeDe, useBingo } from "../state/store.ts";
import { esNumeroVendible, type DatosVenta } from "../lib/ventas.ts";

const DATOS_VACIOS: DatosVenta = { comprador: "", telefono: "", vendedor: "" };

const claseInput =
  "w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-marca-500 focus:ring-2 focus:ring-marca-100";

export function PanelVentas() {
  const ventas = useBingo((s) => s.ventas);
  const registro = useBingo((s) => s.registro);
  const venderUno = useBingo((s) => s.venderUno);
  const venderRango = useBingo((s) => s.venderRango);
  const anularVenta = useBingo((s) => s.anularVenta);
  const borrarVentas = useBingo((s) => s.borrarVentas);

  // Cuántos cartones se imprimieron en esta campaña: es el tope vendible.
  const totalImpreso = proximoDesdeDe(registro) - 1;

  const [modo, setModo] = useState<"rango" | "uno">("rango");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [numero, setNumero] = useState("");
  const [datos, setDatos] = useState<DatosVenta>(DATOS_VACIOS);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "error"; texto: string } | null>(
    null,
  );
  const [busqueda, setBusqueda] = useState("");

  const cambiar = (campo: keyof DatosVenta, valor: string) =>
    setDatos((d) => ({ ...d, [campo]: valor }));

  function limpiarFormulario() {
    setDesde("");
    setHasta("");
    setNumero("");
    setDatos(DATOS_VACIOS);
  }

  function cargarRango() {
    const d = parseInt(desde, 10);
    const h = parseInt(hasta, 10);

    if (!esNumeroVendible(d, totalImpreso) || !esNumeroVendible(h, totalImpreso)) {
      setAviso({
        tipo: "error",
        texto: `Los N° deben estar entre 1 y ${totalImpreso} (los cartones ya impresos).`,
      });
      return;
    }
    if (h < d) {
      setAviso({ tipo: "error", texto: "El N° final no puede ser menor que el inicial." });
      return;
    }
    if (datos.comprador.trim() === "") {
      setAviso({ tipo: "error", texto: "Poné a nombre de quién va el rango." });
      return;
    }

    // Las validaciones de arriba repiten las de la capa de datos, así que hoy
    // esto no debería lanzar. Si algún día se desincronizan, que se vea el
    // mensaje y no una pantalla en blanco.
    let resultado: ReturnType<typeof venderRango>;
    try {
      resultado = venderRango(d, h, datos);
    } catch (e) {
      setAviso({
        tipo: "error",
        texto: e instanceof Error ? e.message : "No se pudo cargar el rango.",
      });
      return;
    }

    const { agregados, salteados } = resultado;
    setAviso({
      tipo: "ok",
      texto:
        salteados > 0
          ? `Se cargaron ${agregados} cartones (${salteados} ya estaban vendidos).`
          : `Se cargaron ${agregados} cartones.`,
    });
    limpiarFormulario();
  }

  function cargarUno() {
    const n = parseInt(numero, 10);

    if (!esNumeroVendible(n, totalImpreso)) {
      setAviso({
        tipo: "error",
        texto: `El N° debe estar entre 1 y ${totalImpreso} (los cartones ya impresos).`,
      });
      return;
    }
    if (ventas.some((v) => v.numero === n)) {
      setAviso({ tipo: "error", texto: `El cartón N° ${n} ya figura vendido.` });
      return;
    }
    if (datos.comprador.trim() === "") {
      setAviso({ tipo: "error", texto: "Poné el nombre del comprador." });
      return;
    }

    try {
      venderUno(n, datos);
    } catch (e) {
      setAviso({
        tipo: "error",
        texto:
          e instanceof Error ? e.message : `No se pudo cargar el cartón N° ${n}.`,
      });
      return;
    }

    setAviso({ tipo: "ok", texto: `Cartón N° ${n} cargado.` });
    limpiarFormulario();
  }

  const filtradas = busqueda.trim()
    ? ventas.filter((v) => {
        const q = busqueda.trim().toLowerCase();
        return (
          String(v.numero).includes(q) ||
          v.comprador.toLowerCase().includes(q) ||
          v.vendedor.toLowerCase().includes(q)
        );
      })
    : ventas;

  if (totalImpreso === 0) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
        <p className="font-medium">Todavía no hay cartones impresos.</p>
        <p className="mt-1">
          Andá a <strong>Generar cartones</strong> y creá una tirada. Después vas
          a poder cargar acá cuáles se vendieron.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-800">Cartones vendidos</h2>
        <span className="text-sm text-slate-500">
          <strong className="text-slate-700">{ventas.length}</strong> de{" "}
          {totalImpreso} impresos
        </span>
      </div>

      {/* Selector de modo de carga */}
      <div className="flex gap-2">
        {(["rango", "uno"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setModo(m);
              setAviso(null);
            }}
            className={[
              "flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-marca-500 focus-visible:ring-offset-2",
              modo === m
                ? "border-marca-600 bg-marca-50 text-marca-700"
                : "border-slate-300 text-slate-600 hover:border-slate-400",
            ].join(" ")}
          >
            {m === "rango" ? "Cargar un rango" : "Cargar de a uno"}
          </button>
        ))}
      </div>

      {/* Campos de N° según el modo */}
      {modo === "rango" ? (
        <div className="flex items-end gap-2">
          <label className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-sm font-medium text-slate-600">Del N°</span>
            <input
              type="number"
              min={1}
              max={totalImpreso}
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className={claseInput}
            />
          </label>
          <label className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-sm font-medium text-slate-600">Al N°</span>
            <input
              type="number"
              min={1}
              max={totalImpreso}
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className={claseInput}
            />
          </label>
        </div>
      ) : (
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-600">N° de cartón</span>
          <input
            type="number"
            min={1}
            max={totalImpreso}
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            className={claseInput}
          />
        </label>
      )}

      {/* Datos del comprador */}
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-600">Comprador</span>
          <input
            type="text"
            value={datos.comprador}
            maxLength={60}
            placeholder="Ej: Escuela Pepito / María González"
            onChange={(e) => cambiar("comprador", e.target.value)}
            className={claseInput}
          />
        </label>
        <div className="flex gap-2">
          <label className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-sm font-medium text-slate-600">Teléfono</span>
            <input
              type="tel"
              value={datos.telefono}
              maxLength={30}
              placeholder="Opcional"
              onChange={(e) => cambiar("telefono", e.target.value)}
              className={claseInput}
            />
          </label>
          <label className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-sm font-medium text-slate-600">Vendedor</span>
            <input
              type="text"
              value={datos.vendedor}
              maxLength={40}
              placeholder="Opcional"
              onChange={(e) => cambiar("vendedor", e.target.value)}
              className={claseInput}
            />
          </label>
        </div>
      </div>

      <button
        type="button"
        onClick={modo === "rango" ? cargarRango : cargarUno}
        className="rounded-lg bg-marca-600 px-4 py-3 font-semibold text-white shadow-sm transition hover:bg-marca-700 focus-visible:ring-2 focus-visible:ring-marca-500 focus-visible:ring-offset-2"
      >
        {modo === "rango" ? "Cargar rango" : "Cargar cartón"}
      </button>

      {aviso && (
        <p
          className={[
            "rounded-lg px-3 py-2 text-sm",
            aviso.tipo === "ok"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-rose-50 text-rose-700",
          ].join(" ")}
        >
          {aviso.texto}
        </p>
      )}

      {/* Lista de vendidos */}
      {ventas.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-slate-200 pt-4">
          <input
            type="search"
            value={busqueda}
            placeholder="Buscar por N°, comprador o vendedor…"
            onChange={(e) => setBusqueda(e.target.value)}
            className={claseInput}
          />

          <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
            {filtradas.map((v) => (
              <li
                key={v.numero}
                className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
              >
                <span className="w-16 shrink-0 font-mono font-semibold text-slate-700">
                  N° {v.numero}
                </span>
                {/* El comprador manda; teléfono y vendedor van en gris a su
                    lado. El vendedor se podía buscar pero no se veía: el
                    buscador prometía un dato que la lista no mostraba. */}
                <span className="min-w-0 flex-1 truncate text-slate-700">
                  {v.comprador || "(sin nombre)"}
                  {v.telefono && (
                    <span className="text-slate-500"> · {v.telefono}</span>
                  )}
                  {v.vendedor && (
                    <span className="text-slate-500"> · vendió {v.vendedor}</span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => anularVenta(v.numero)}
                  className="shrink-0 text-xs font-medium text-rose-600 hover:underline focus-visible:ring-2 focus-visible:ring-marca-500 focus-visible:ring-offset-2"
                  title="Dar de baja esta venta"
                >
                  Quitar
                </button>
              </li>
            ))}
            {filtradas.length === 0 && (
              <li className="px-3 py-4 text-center text-sm text-slate-500">
                No hay resultados para “{busqueda}”.
              </li>
            )}
          </ul>

          <button
            type="button"
            onClick={() => {
              if (
                confirm(
                  `¿Borrar las ${ventas.length} ventas cargadas? No se puede deshacer.`,
                )
              ) {
                borrarVentas();
                setAviso(null);
              }
            }}
            className="self-start rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-rose-600 hover:border-rose-400 focus-visible:ring-2 focus-visible:ring-marca-500 focus-visible:ring-offset-2"
          >
            Borrar todas las ventas
          </button>
        </div>
      )}
    </div>
  );
}
