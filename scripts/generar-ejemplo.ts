// Script de ayuda: genera un PDF de ejemplo en disco para revisarlo a ojo.
// Uso:  npm run ejemplo            (12 cartones, 4 por hoja)
//       npm run ejemplo -- 30 6    (30 cartones, 6 por hoja)
import { writeFileSync } from "node:fs";
import { generarLote } from "../src/core/batch.ts";
import { construirPdf } from "../src/pdf/buildPdf.ts";

const cantidad = Number(process.argv[2] ?? 12);
const porHoja = Number(process.argv[3] ?? 4);

const { cartones, semilla } = generarLote({ cantidad });
const bytes = await construirPdf(cartones, { cartonesPorHoja: porHoja });

const salida = "ejemplo.pdf";
writeFileSync(salida, bytes);

console.log(`✓ ${cantidad} cartones (${porHoja} por hoja) → ${salida}`);
console.log(`  Semilla del lote: ${semilla} (para reproducirlo)`);
