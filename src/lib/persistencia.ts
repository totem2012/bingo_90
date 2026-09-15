// ─────────────────────────────────────────────────────────────────────────
// ¿El navegador está guardando de verdad lo que escribimos?
//
// Toda la campaña (tiradas, ventas, premios) vive en localStorage. Si el
// navegador no nos deja guardar —ventana de incógnito, almacenamiento
// bloqueado— o se quedó sin espacio, la app sigue funcionando en memoria y se
// ve exactamente igual que siempre… hasta que se cierra la pestaña y se pierde
// la numeración de los cartones que ya se imprimieron y se vendieron.
//
// De todos los problemas de persistencia es el único que se puede PREVENIR: si
// se avisa a tiempo, el usuario exporta el respaldo y no pierde nada. Por eso
// el estado es uno solo para los tres registros y se muestra en pantalla
// (ver App.tsx), en vez de tragarse el error en cada `escribir*` como antes.
// ─────────────────────────────────────────────────────────────────────────

export type EstadoPersistencia =
  /** Se está guardando normalmente. */
  | "ok"
  /** El navegador no nos deja usar localStorage: nada de esto se va a guardar. */
  | "sin-storage"
  /** Hay storage pero un guardado falló (típicamente, no queda espacio). */
  | "error-al-guardar";

type Escucha = (estado: EstadoPersistencia) => void;

let estado: EstadoPersistencia = "ok";
const escuchas = new Set<Escucha>();

function cambiar(nuevo: EstadoPersistencia): void {
  // "sin-storage" es el diagnóstico más fuerte y no se degrada: si no hay
  // storage, que además falle un guardado no aporta nada nuevo.
  if (estado === nuevo || estado === "sin-storage") return;
  estado = nuevo;
  for (const escucha of escuchas) escucha(estado);
}

/** Cómo viene funcionando el guardado hasta ahora. */
export function estadoPersistencia(): EstadoPersistencia {
  return estado;
}

/** Avisa cuando cambia el estado. Devuelve la función para desuscribirse. */
export function alCambiarPersistencia(escucha: Escucha): () => void {
  escuchas.add(escucha);
  return () => void escuchas.delete(escucha);
}

/** Vuelve a cero. En la app el estado dura la sesión; esto es para los tests. */
export function reiniciarPersistencia(): void {
  estado = "ok";
  for (const escucha of escuchas) escucha(estado);
}

/** ¿Tenemos localStorage disponible? (SSR / modo privado viejo / tests). */
export function hayStorage(): boolean {
  try {
    if (typeof localStorage === "undefined") {
      cambiar("sin-storage");
      return false;
    }
    return true;
  } catch {
    // Acceder a la propiedad ya puede tirar si el navegador la bloqueó.
    cambiar("sin-storage");
    return false;
  }
}

/** Lee una clave. `null` si no hay nada guardado o si no se pudo leer. */
export function leerClave(clave: string): string | null {
  if (!hayStorage()) return null;
  try {
    return localStorage.getItem(clave);
  } catch {
    cambiar("sin-storage");
    return null;
  }
}

/**
 * Escribe una clave. Si falla NO lanza —la app tiene que seguir funcionando en
 * memoria— pero deja registrado que no se guardó, para poder avisarlo.
 */
export function escribirClave(clave: string, texto: string): void {
  if (!hayStorage()) return;
  try {
    localStorage.setItem(clave, texto);
  } catch {
    cambiar("error-al-guardar");
  }
}
