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
