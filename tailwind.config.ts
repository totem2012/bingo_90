import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Acento de marca (azul sobrio) y grises de la UI.
        marca: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#1e3a8a",
        },
      },
      fontFamily: {
        // Sin Inter a propósito. Estaba declarada acá pero nunca se cargaba
        // (index.html no la pide y no hay @font-face), así que la app venía
        // usando system-ui igual. Traerla de un CDN sería una descarga
        // bloqueante que falla justo en el peor escenario de esta app: un
        // celular sin señal en el salón. Todo lo demás acá funciona offline.
        sans: ["system-ui", "Segoe UI", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
