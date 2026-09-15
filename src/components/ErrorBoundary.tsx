// ─────────────────────────────────────────────────────────────────────────
// Red de seguridad para errores DURANTE EL RENDER de React.
//
// Alcance real, para que nadie le pida más de lo que puede dar:
//   SÍ atrapa: un componente que tira mientras renderiza (por ejemplo un
//     cartón con una forma inesperada llegando a CartonPreview). Sin esto
//     React desmonta el árbol entero y queda la pantalla en blanco.
//   NO atrapa: errores en manejadores de evento (React no los intercepta, y
//     además no tumban la pantalla), ni errores al EVALUAR un módulo —si el
//     import falla, React nunca llega a montar y este componente tampoco
//     existe. De eso se ocupan las lecturas defensivas de `lib/`.
//
// Lo único irreemplazable que tiene el usuario si algo se rompe es la
// SEMILLA: con ella recupera la campaña entera, sin ella no recupera nada.
// Por eso la pantalla de error no es genérica: muestra la semilla y empuja a
// anotarla.
// ─────────────────────────────────────────────────────────────────────────

// Estos dos imports son para el botón de respaldo. Se puede depender de ellos
// ACÁ porque `campana.ts` y `descargar.ts` (y lo que ellos importan) son
// inertes al cargarse: solo definen funciones y constantes, no ejecutan nada de
// nivel superior, así que importarlos no puede fallar. `store.ts`, en cambio,
// SÍ trabaja al importarse, y por eso esta pantalla no lo toca. Si algún día
// alguien le agrega trabajo de nivel superior a `campana.ts`, este razonamiento
// deja de valer y el botón habría que sacarlo.
import { Component, useState, type ErrorInfo, type ReactNode } from "react";
import { exportarCampana, nombreArchivoCampana } from "../lib/campana.ts";
import { descargarArchivo } from "../lib/descargar.ts";

/**
 * La clave se repite acá a propósito en vez de importar `semillaRecordada()`
 * de `lib/registro.ts`: esta pantalla aparece justamente cuando algo del árbol
 * falló, y el dato que tiene que rescatar no puede depender de otro módulo que
 * quizás sea parte del problema. Si cambia en `registro.ts`, cambiala acá.
 */
const CLAVE_SEMILLA = "bingo90:semilla:v1";

/** Lee la semilla guardada sin depender de nada más. `null` si no hay o no sirve. */
export function semillaGuardada(
  almacen?: Pick<Storage, "getItem"> | null,
): string | null {
  try {
    // `undefined` = usar el localStorage del navegador; `null` = no hay dónde
    // leer. Con `??` los dos casos caerían en el navegador y un `null` explícito
    // terminaría leyendo el storage real.
    const store =
      almacen === undefined
        ? typeof localStorage !== "undefined"
          ? localStorage
          : null
        : almacen;
    if (!store) return null;
    const crudo = store.getItem(CLAVE_SEMILLA);
    if (crudo === null) return null;
    const limpio = crudo.trim();
    // Solo dígitos: si hay cualquier otra cosa guardada, mostrarla sería peor
    // que no mostrar nada (el usuario anotaría un número que no sirve).
    return /^\d+$/.test(limpio) ? limpio : null;
  } catch {
    // localStorage puede tirar (incógnito, storage bloqueado).
    return null;
  }
}

// ─── Pantalla de error (raíz) ────────────────────────────────────────────

function PantallaDeError({ error }: { error: Error | null }) {
  const semilla = semillaGuardada();
  const [copiado, setCopiado] = useState(false);
  const [falloRespaldo, setFalloRespaldo] = useState(false);

  async function copiar() {
    if (!semilla) return;
    try {
      await navigator.clipboard.writeText(semilla);
      setCopiado(true);
    } catch {
      // Sin permiso de portapapeles: el número está a la vista igual.
      setCopiado(false);
    }
  }

  function descargarRespaldo() {
    if (!semilla) return;
    try {
      const datos = exportarCampana(Number(semilla));
      const bytes = new TextEncoder().encode(JSON.stringify(datos, null, 2));
      descargarArchivo(bytes, nombreArchivoCampana(Number(semilla)), "application/json");
      setFalloRespaldo(false);
    } catch (e) {
      // El respaldo es un extra: si lo guardado es justo lo que está roto,
      // que falle acá no puede tapar el dato importante, que es la semilla.
      console.error("[bingo90] no se pudo exportar el respaldo:", e);
      setFalloRespaldo(true);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-5 px-6 py-10">
      <div>
        <h1 className="text-xl font-bold text-slate-800">
          Se rompió esta pantalla
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          La app se cortó por un error, pero{" "}
          <strong className="font-semibold">no se borró nada</strong>: las
          tiradas, las ventas y los premios siguen guardados en este navegador.
        </p>
      </div>

      {semilla ? (
        <div className="rounded-xl border-2 border-marca-600 bg-marca-50 p-5">
          <p className="text-sm font-medium text-slate-700">
            Antes de nada, anotá la semilla de la campaña:
          </p>
          <p className="my-2 select-all font-mono text-3xl font-extrabold tracking-tight text-marca-900">
            {semilla}
          </p>
          <p className="text-sm text-slate-600">
            Con este número recuperás la campaña entera. Sin él, no.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copiar}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-slate-400 focus-visible:ring-2 focus-visible:ring-marca-500 focus-visible:ring-offset-2"
            >
              {copiado ? "✓ Copiada" : "Copiar semilla"}
            </button>
            <button
              type="button"
              onClick={descargarRespaldo}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-slate-400 focus-visible:ring-2 focus-visible:ring-marca-500 focus-visible:ring-offset-2"
            >
              ↓ Descargar respaldo
            </button>
          </div>
          {falloRespaldo && (
            <p className="mt-2 text-sm text-rose-700">
              El respaldo no se pudo generar. Anotá igual la semilla de arriba:
              con eso alcanza para retomar la campaña.
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-5 text-sm text-amber-900">
          <p className="font-medium">No pudimos leer la semilla guardada.</p>
          <p className="mt-1">
            Si tenés anotada la semilla de esta campaña, guardala a mano: es lo
            que hace falta para retomarla.
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => location.reload()}
          className="rounded-lg bg-marca-600 px-4 py-2 text-sm font-bold text-white hover:bg-marca-700 focus-visible:ring-2 focus-visible:ring-marca-500 focus-visible:ring-offset-2"
        >
          Recargar la página
        </button>
      </div>

      <details className="text-sm text-slate-500">
        <summary className="cursor-pointer">Detalle técnico</summary>
        <p className="mt-2 break-words font-mono text-xs text-slate-600">
          {error?.message ?? "Sin mensaje."}
        </p>
        <p className="mt-1 text-xs">
          El error completo quedó en la consola del navegador.
        </p>
      </details>
    </div>
  );
}

// ─── El boundary ─────────────────────────────────────────────────────────

interface Props {
  children: ReactNode;
  /**
   * Qué mostrar en lugar de lo que se rompió. Si no se pasa, se muestra la
   * pantalla de error completa (la de la raíz).
   */
  fallback?: (error: Error | null, reintentar: () => void) => ReactNode;
  /** Etiqueta para distinguir en la consola qué parte falló. */
  nombre?: string;
}

interface Estado {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, Estado> {
  state: Estado = { error: null };

  static getDerivedStateFromError(error: Error): Estado {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Nunca nos tragamos el error: sin esto nos quedamos ciegos para depurar.
    console.error(
      `[bingo90] error de render${this.props.nombre ? ` en ${this.props.nombre}` : ""}:`,
      error,
      info.componentStack,
    );
  }

  reintentar = () => this.setState({ error: null });

  render() {
    if (this.state.error !== null) {
      return this.props.fallback
        ? this.props.fallback(this.state.error, this.reintentar)
        : <PantallaDeError error={this.state.error} />;
    }
    return this.props.children;
  }
}
