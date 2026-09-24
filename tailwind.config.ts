import type { Config } from "tailwindcss";

export default {
  // Los tests quedan fuera del escaneo: Tailwind busca nombres de clase en
  // cualquier texto, comentarios incluidos, así que una palabra corriente en
  // castellano que además sea una utilidad ("visible", "invisible", "bloque"…)
  // metía una regla muerta en el CSS que baja el usuario. No se puede esquivar
  // escribiendo con cuidado: pasa incluso al redactar la advertencia.
  content: ["./index.html", "./src/**/*.{ts,tsx}", "!./src/test/**"],
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
      // Bolillero (components/juego): la bolilla que sale cae desde el bombo
      // y rebota un poco. Los componentes la anulan con `motion-reduce`.
      keyframes: {
        "bolilla-sale": {
          "0%": { transform: "translateY(-3rem) scale(0.4)", opacity: "0" },
          "60%": { transform: "translateY(0.4rem) scale(1.08)", opacity: "1" },
          "100%": { transform: "translateY(0) scale(1)", opacity: "1" },
        },
      },
      animation: {
        "bolilla-sale": "bolilla-sale 500ms ease-out",
        "bombo-gira": "spin 700ms linear infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
