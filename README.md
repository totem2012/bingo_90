# Generador de Bingo 90

Herramienta web para generar cartones únicos de **bingo de 90 bolas** y
exportarlos a **PDF listo para imprimir**, con **logo y título del negocio**
personalizables. Corre 100% en el navegador (sin servidor, sin cuentas).

### Reglas del cartón de 90 bolas

- 3 filas × 9 columnas; 15 números y 12 celdas vacías.
- Cada fila: exactamente 5 números.
- Cada columna: entre 1 y 3 números, dentro de su rango
  (col 1 → 1–9, … col 9 → 80–90), ordenados de arriba hacia abajo.

El lote es **reproducible**: con la misma semilla se obtienen los mismos
cartones (útil para reimprimir sin duplicar).

## Ventas

La pestaña **Ventas** registra qué cartones se vendieron, después de imprimir:
por rango (“del 1 al 200 → Escuela Pepito”) o de a uno con nombre, teléfono y
vendedor. Solo se pueden vender cartones que ya se imprimieron, y un N° no se
puede vender dos veces. **Solo los cartones vendidos juegan.**

## Juego

La pestaña **Juego** tiene un **bolillero digital**: saca las bolillas del 1 al
90 de a una, con animación, y las marca en un tablero. Se puede proyectar en
**pantalla completa** (Esc para salir), y la barra espaciadora saca la bolilla
siguiente.

La noche sigue siempre esta secuencia:

1. **Cuaterno**: gana el primer cartón con 4 números salidos, en cualquier
   parte del cartón.
2. **Sorteo**: un cartón al azar entre todos los vendidos.
3. **Línea**: gana el primer cartón que complete una línea horizontal.
4. **Sorteo**
5. **Cartón lleno**: gana el primer cartón con sus 15 números salidos. Con
   esto termina el juego.

- La app revisa **sola** los cartones vendidos después de cada bolilla, y
  frena el bolillero cuando alguien completa.
- Si varios completan con la misma bolilla, **ganan todos** (empate).
- Las bolillas **no se reinician** entre etapas: el sorteo solo frena el
  bolillero.
- El que ganó una etapa **sigue jugando** las siguientes, y los sorteos son
  entre todos los vendidos aunque hayan ganado el cuaterno o la línea. Lo que
  no puede pasar es que el **mismo cartón gane los dos sorteos**.
- Al ganador se le muestra el **cartón regenerado** con los números salidos
  resaltados, para cotejarlo contra el papel.
- Si se cierra la pestaña a mitad del juego, al volver sigue en la misma
  bolilla y la misma etapa.

Como los cartones son deterministas a partir de la semilla, solo se guarda el
**N° de cartón**: los 15 números se regeneran cuando hacen falta.

### Respaldo de la campaña

Todo se guarda en el navegador (`localStorage`). Si se limpia el caché se
pierden la numeración y las ventas, así que conviene usar
**Exportar campaña** (en el panel de configuración): baja un `.json` con
semilla + tiradas + ventas + premios + bolillas. **Importar** lo restaura, y
también sirve para jugar desde otra computadora o celular.

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

No hace falta ninguna variable de entorno: todo corre en el navegador y el
logo del cliente nunca sale de su máquina.
