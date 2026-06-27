import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Config de Vite + Vitest. El bloque `test` permite correr los tests del
// dominio (src/core, src/pdf) sin depender de React ni del navegador.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    include: ["src/test/**/*.test.ts"],
  },
});
