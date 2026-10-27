# Mecánica

Archivos del subsistema de estructura y mecanismos:

- `soporte-electronica/` — soporte de las 3 placas de 4 × 6 cm y de la antena GPS de la
  primaria. Incluye diseño en código (CadQuery), STEP, STL, DXF, planos con cotas y plantillas
  1:1. Ver su `README.md`.
- `cad/` — modelos (SolidWorks, Fusion, Inventor, FreeCAD, Onshape exportado).
- `stl/` — piezas listas para imprimir (PLA/PETG).
- `planos/` — PDF o PNG con cotas.

Interfaces con electrónica y software que deben respetarse (ver `docs/02-conexiones.md`):

- Dos servos SG90 en la primaria:
  - desacople: señal en GPIO2;
  - autogiro: señal en GPIO3.

  Los ángulos están en `firmware/primaria/include/config.h` (`DESACOPLE_ANGULO_*`, `AUTOGIRO_ANGULO_*`) y se ajustan con la prueba P6.
- La primaria se calibra al encender, así que debe estar **vertical y quieta**. La Heltec y el GY-91 (IMU) van **fijos**, nunca colgando de ligas ni sueltos entre la espuma.
- Antena LoRa por dentro de la envolvente, vertical, lejos de la pila y de los servos.
- Interruptor de encendido accesible sin sobresalir de la envolvente.
- Medidas de la guía de misión:
  - Ø de 9 a 10 cm;
  - alto de 20 a 23 cm (primaria hasta 16 cm, secundaria hasta 7 cm);
  - un solo orificio de 9 a 10 mm en la tapa superior;
  - autogiro dentro del satélite, sin nada que sobresalga;
  - máximo 600 g con los 2 huevos.
