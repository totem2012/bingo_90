// Punto de entrada público del dominio. La UI y el módulo de PDF
// importan desde acá, no desde los archivos internos.
export * from "./types.ts";
export * from "./rng.ts";
export { generarCarton, generarCartonConRng } from "./generator.ts";
export { generarLote } from "./batch.ts";
export { validarCarton, esCartonValido } from "./validator.ts";
export type { ResultadoValidacion } from "./validator.ts";
export { elegibles, sortearUno } from "./sorteo.ts";
export {
  SECUENCIA,
  NOMBRE_MODALIDAD,
  TOTAL_BOLILLAS,
  esModalidadBolillero,
  cumple,
  ganadoresDe,
  bolillasRestantes,
  sacarBolilla,
  etapaActual,
} from "./juego.ts";
export type { Modalidad, ModalidadBolillero, CartonEnJuego } from "./juego.ts";
