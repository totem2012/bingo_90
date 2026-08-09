# Generador de Bingo 90

Herramienta web para generar cartones únicos de **bingo de 90 bolas** y
exportarlos a **PDF listo para imprimir**, con **logo y título del negocio**
personalizables. Corre 100% en el navegador (sin servidor, sin cuentas).

## Estado por fases

- [x] **Fase 0** — Arquitectura y diseño
- [x] **Fase 1** — Dominio (`src/core`): generador + validador + tests
- [x] **Fase 2** — Render a PDF (`src/pdf`) + script de ejemplo
- [x] **Fase 3** — UI (configuración + vista previa en vivo + descarga)
- [x] **Fase 4** — Personalización: logo + título + color en el PDF
- [x] **Fase 4.5** — Talón (cupón de control) + N° secuencial + QR + encabezado completo
- [x] **Fase 5** — Pulido: lazy-load de pdf-lib, manejo de errores, favicon, deploy
- [x] **Fase 6** — Ventas y sorteo: registro de cartones vendidos, sorteo de
      varios premios sin repetir ganador, y respaldo de campaña en `.json`

## Requisitos

- **Node.js 18+** y npm.

## Comandos

```bash
npm install        # instalar dependencias
npm test           # correr los tests (dominio + PDF) con Vitest
npm run ejemplo    # generar un PDF de ejemplo (ejemplo.pdf) para revisarlo
npm run dev        # levantar la app en desarrollo (Fase 3 en adelante)
npm run build      # build de producción (sitio estático)
```

## Arquitectura

- `src/core/` — **dominio puro** (sin React ni DOM). Genera y valida cartones,
  y sortea el ganador. Es portable: el mismo código podría correr en Node.
- `src/pdf/` — render de las unidades (talón + cartón) a PDF con `pdf-lib` + QR.
- `src/lib/` — modelo de marca, persistencia (tiradas, ventas, premios,
  respaldo de campaña) y helpers del navegador.
- `src/components/` — UI en React.
- `src/state/` — estado de la app (Zustand).
- `src/test/` — tests del dominio.

### Reglas del cartón de 90 bolas

- 3 filas × 9 columnas; 15 números y 12 celdas vacías.
- Cada fila: exactamente 5 números.
- Cada columna: entre 1 y 3 números, dentro de su rango
  (col 1 → 1–9, … col 9 → 80–90), ordenados de arriba hacia abajo.

El lote es **reproducible**: con la misma semilla se obtienen los mismos
cartones (útil para reimprimir sin duplicar).

## Ventas y sorteo

La pestaña **Ventas y sorteo** cierra el ciclo después de imprimir:

- **Cargar los vendidos**: por rango (“del 1 al 200 → Escuela Pepito”) o de a
  uno con nombre, teléfono y vendedor. Solo se pueden vender cartones que ya
  se imprimieron, y un N° no se puede vender dos veces.
- **Sortear**: la app elige al azar entre los vendidos. Se pueden sortear
  varios premios seguidos (1°, 2°, 3°…) y **el que ya ganó sale del bombo**,
  así nadie se lleva dos. Queda el historial de quién ganó qué.
- Al salir un ganador se muestra el **cartón regenerado** en pantalla, para
  cotejarlo contra el papel que trae la persona.

Como los cartones son deterministas a partir de la semilla, solo se guarda el
**N° de cartón**: los 15 números se regeneran cuando hacen falta.

### Respaldo de la campaña

Todo se guarda en el navegador (`localStorage`). Si se limpia el caché se
pierden la numeración y las ventas, así que conviene usar
**Exportar campaña** (en el panel de configuración): baja un `.json` con
semilla + tiradas + ventas + premios. **Importar** lo restaura, y también sirve
para sortear desde otra computadora o celular.

### Estructura de cada unidad impresa

Cada cartón se imprime junto a un **talón** (cupón de control) que el vendedor
desprende por la línea de corte punteada:

- **Talón**: "CUPÓN DE CONTROL", N° de cartón secuencial, serie, campos
  NOMBRE / TELÉFONO / DOMICILIO / VENDEDOR y un **QR offline** con los datos
  del cartón (N°, serie, id y los 15 números).
- **Cartón**: encabezado con dos logos + título + subtítulo, banda con el
  nombre del evento, encabezados de columna (1-9 … 80-90) y la grilla.

## Publicar la app (deploy)

La app es un **sitio estático** (no necesita servidor). El build se genera en
la carpeta `dist/`:

```bash
npm run build      # genera dist/
```

Opciones para publicarlo gratis:

1. **Netlify Drop (lo más rápido, sin cuenta):**
   entrá a <https://app.netlify.com/drop> y arrastrá la carpeta `dist/`.
   Te da una URL pública al instante.

2. **Vercel / Netlify / Cloudflare Pages (con repo Git):**
   conectá el repositorio y configurá:
   - Build command: `npm run build`
   - Output directory: `dist`

No hace falta ninguna variable de entorno: todo corre en el navegador y el
logo del cliente nunca sale de su máquina.
