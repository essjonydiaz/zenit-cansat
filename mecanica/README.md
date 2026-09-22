# Mecánica

Aquí van los archivos del subsistema de estructura y mecanismos:

- `cad/` — modelos (SolidWorks, Fusion 360, FreeCAD, Onshape exportado).
- `stl/` — piezas listas para imprimir (PLA/PETG).
- `planos/` — PDF o PNG con cotas.

Interfaces con electrónica/software que deben respetarse (ver `docs/02-conexiones.md`):

- Servo SG90 en la primaria: señal en GPIO 13; ángulos en `firmware/primaria/include/config.h`
  (`SERVO_ANGULO_CERRADO` / `SERVO_ANGULO_ABIERTO`), se ajustan con la prueba P6.
- La primaria debe encenderse **vertical y quieta** (se calibra al encender): el ESP32 y el
  MPU6050 deben ir fijos, no sueltos entre la espuma.
- Antena LoRa por dentro de la envolvente, lejos de la pila y del servo.
- Interruptor de encendido accesible sin sobresalir de la envolvente.
