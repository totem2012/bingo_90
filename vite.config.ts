import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Config de Vite + Vitest.
//
// El entorno por defecto es `node`: los tests del dominio (src/core, src/lib,
// src/pdf) no necesitan DOM y en node arrancan más rápido. Los que sí lo
// necesitan —los de componentes, que montan React de verdad— piden jsdom
// archivo por archivo con un docblock arriba de todo:
//
//     // @vitest-environment jsdom
//
// Así la suite completa sigue siendo barata de correr, que es parte de por qué
// se corre.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    include: ["src/test/**/*.test.{ts,tsx}"],
  },
});
