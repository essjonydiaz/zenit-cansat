# 5. Plan de pruebas (CoDR P1–P9 + plan del PDR)

Cada prueba del calendario del CoDR (diapositivas 22–23) y del plan del PDR (diapositiva 29,
ordenado por prioridad) con **qué programa usar** y
**cuándo se considera aprobada**. Anoten fecha, resultado y evidencia (foto/video/log) en
la tabla del final: eso va directo al PDR y al CDR.

| Prueba | Cómo | Criterio de aprobación |
|---|---|---|
| **P1** Continuidad y encendido | Multímetro sin energía (sin cortos 5V–GND y 3V3–GND). MP1584EN ajustado a 5.0 V **antes** de conectar. Luego `firmware/pruebas` → `env:p1_autodiagnostico` (también lo muestra en la OLED) | Todos los módulos en **PASA** |
| **P2** Calibración del GY-91 | `env:p2_sensores`: quieto 10 s, luego 30 s girándolo en todas direcciones (brújula); al final subirlo un piso y girarlo frente a una brújula de celular | Ruido de altitud < 0.5 m · \|a\| = 1.00 ± 0.05 g · giroscopio < 2 °/s · subir 3 m se ve como ~3 m · rumbo ±15° · copiar `MAG_CENTRO_*` a `config.h` |
| **P3** Alcance LoRa (PDR prioridad 1) | `env:p3_alcance_lora` en el CanSat **cerrado** + receptor Heltec + `npm start`. Alejarse 100/250/500/750/1000 m. Con la secundaria encendida se prueba también SX1262 ↔ RFM95W | A **1 km** (requisito 4 del PDR): pérdidas < 10 % y RSSI mejor que −115 dBm. **Grabar video** |
| **P4** Autonomía de la pila de 9 V | `env:p4_bateria` con pila nueva (requiere el divisor en GPIO6) | ≥ 60 min transmitiendo (PDR pide ≥ 30 min de vuelo activo) |
| **P4b** Registro OpenLog | `env:p5_registro_openlog` con `config.txt` a 115200 | 1000/1000 líneas en el archivo |
| **P5** Autogiro (caídas de prueba) | `env:primaria` con sensores reales, soltar desde un edificio/puente con permiso. Analizar con `herramientas/analisis_vuelo.py` el `LOGxxxxx.TXT` del OpenLog | Velocidad estable entre 8 y 12 m/s |
| **P6** Desacople y autogiro | `env:p6_servos`: `d`/`g` para elegir servo, ajustar ángulos, `ciclo` con la secundaria colgando y `secuencia` (la de vuelo) | 20/20 liberaciones de cada mecanismo; copiar ángulos a `config.h` |
| **P7** Impacto con huevo simulado | Soltar la carga a ~10 m/s (desde ~5 m) con huevo real o simulado | Huevo intacto en 5/5 caídas |
| **P8** Integración estructural | CanSat completo: sacudir, dejar caer 1 m sobre pasto, transportar | Nada suelto; `p1_autodiagnostico` sigue en PASA |
| **P9** Ensayo general | CanSat final pesado y medido + `env:primaria` + estación terrena + checklist [06](06-dia-de-lanzamiento.md) | ≤ 600 g con 2 huevos de 65 g · Ø 9–10 cm · alto 20–23 cm · todos los requisitos del panel en ✓ con un vuelo simulado |
| **GPS** Fijación y precisión (PDR prioridad 1) | Primaria y secundaria juntas a cielo abierto 5 min; luego separarlas una distancia medida con cinta (p. ej. 30 m) | Ambas con fix en < 2 min · distancia en el panel ±5 m de la real (requisito 7 del PDR) |

## Prueba desde el techo (modo prueba)

Sirve para probar todo el sistema sin dron: detección de la caída, desacople, servos,
registro, aterrizaje e impacto del huevo. Un edificio de 2–3 pisos (6–10 m) basta.

1. Subir a la primaria `env:primaria_prueba` (en `firmware/primaria`). Al arrancar dice
   `INFO,MODO_PRUEBA` y la estación terrena muestra el aviso amarillo "Primaria en MODO PRUEBA".
2. **Encenderla abajo, en el suelo**: ahí queda el 0 m. Encender también la secundaria.
3. Laptop con la estación terrena abajo (`npm start` + receptor). Empezar a grabar la pantalla
   (Win + Alt + R o OBS) y, con un celular, la caída.
4. Subir el CanSat por la escalera. Al pasar de 3 m el panel marca **ASCENSO**; al pasar de 4 m
   se arma el desacople. Puede esperar arriba lo que sea: a más de 2.5 m no cuenta como aterrizado.
5. Antes de soltarlo, alguien dice "¡ya!" frente a la cámara y a la laptop (para sincronizar el video).
6. Soltarlo (sin aventarlo). Debe salir: LIBERACIÓN → DESACOPLE (≈1.5 m abajo del techo) →
   AUTOGIRO (0.4 s después) → ATERRIZAJE → POST-ATERRIZAJE.
7. Revisar: huevo, servos, que la secundaria se soltó, y el archivo del OpenLog
   (`herramientas/analisis_vuelo.py`).
8. **Para el concurso subir `env:primaria`.** Con el firmware normal, la misma caída NO desacopla
   (hay una prueba automática para eso).

Desde 8 m el CanSat llega al suelo a ~12 m/s en ~1.3 s: el autogiro no alcanza a estabilizarse,
así que la velocidad de 8–12 m/s con autogiro (P5) necesita más altura (dron con permiso).

## Pruebas de software (automáticas)

| Qué | Comando | Cuándo |
|---|---|---|
| Lógica del firmware | `pio test -e native` (en `firmware/primaria`) | Antes de cada commit que toque `firmware/comun` |
| Protocolo y simulador de la estación | `npm test` (en `estacion-terrena`) | Antes de cada commit que toque `estacion-terrena` |
| Firmware completo sin sensores | Subir `env:primaria_sim` a la Heltec y ver un vuelo en la estación | Antes de cada prueba de campo |

GitHub Actions corre las dos primeras y compila todos los firmwares en cada *push*
(`.github/workflows/ci.yml`).

> En Windows, `pio test -e native` necesita un compilador de C++ para PC (MinGW). Si no lo
> tienen, no pasa nada: GitHub Actions las corre solas.

## Bitácora

| Prueba | Fecha | Responsable | Resultado | Evidencia |
|---|---|---|---|---|
| P1 | | | | |
| P2 | | | | |
| P3 | | | | |
| P4 | | | | |
| P5 | | | | |
| P6 | | | | |
| P7 | | | | |
| P8 | | | | |
| P9 | | | | |
