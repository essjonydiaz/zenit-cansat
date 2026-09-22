# 5. Plan de pruebas (P1–P9 del CoDR)

Cada prueba del calendario del CoDR (diapositivas 22–23) con **qué programa usar** y
**cuándo se considera aprobada**. Anoten fecha, resultado y evidencia (foto/video/log) en
la tabla del final: eso va directo al PDR y al CDR.

| Prueba | Cómo | Criterio de aprobación |
|---|---|---|
| **P1** Continuidad y encendido | Multímetro sin energía (sin cortos 5V–GND y 3V3–GND). Luego `firmware/pruebas` → `env:p1_autodiagnostico` | Todos los módulos en **PASA** |
| **P2** Calibración BMP280 / MPU6050 | `env:p2_sensores`, CanSat quieto 10 s; luego subirlo un piso | Ruido de altitud < 0.5 m · \|a\| = 1.00 ± 0.05 g · giroscopio < 2 °/s · subir 3 m se ve como ~3 m |
| **P3** Alcance LoRa | `env:p3_alcance_lora` en el CanSat **cerrado** + receptor + `npm start`. Alejarse 50/100/150/200/250/300 m | A 250 m: pérdidas < 10 % y RSSI mejor que −115 dBm. **Grabar video** (Etapa 5) |
| **P4** Autonomía de batería | `env:p4_bateria` con pila nueva hasta que se apague | ≥ 60 min transmitiendo |
| **P5** Autogiro (caídas de prueba) | `env:primaria` con sensores reales, soltar desde un edificio/puente con permiso. Analizar con `herramientas/analisis_vuelo.py` el archivo de la microSD | Velocidad estable entre 8 y 12 m/s |
| **P6** Mecanismo de desacople | `env:p6_servo`: ajustar ángulos, luego `ciclo` con la secundaria colgando | 20/20 liberaciones; copiar ángulos a `config.h` |
| **P7** Impacto con huevo simulado | Soltar la carga a ~10 m/s (desde ~5 m) con huevo real o simulado | Huevo intacto en 5/5 caídas |
| **P8** Integración estructural | CanSat completo: sacudir, dejar caer 1 m sobre pasto, transportar | Nada suelto; `p1_autodiagnostico` sigue en PASA |
| **P9** Ensayo general | CanSat final pesado y medido + `env:primaria` + estación terrena + checklist [06](06-dia-de-lanzamiento.md) | ≤ 600 g con 2 huevos de 65 g · Ø 9–10 cm · alto 20–23 cm · todos los requisitos del panel en ✓ con un vuelo simulado |

## Pruebas de software (automáticas)

| Qué | Comando | Cuándo |
|---|---|---|
| Lógica del firmware | `pio test -e native` (en `firmware/primaria`) | Antes de cada commit que toque `firmware/comun` |
| Protocolo y simulador de la estación | `npm test` (en `estacion-terrena`) | Antes de cada commit que toque `estacion-terrena` |
| Firmware completo sin sensores | Subir `env:primaria_sim` y ver un vuelo en la estación | Antes de cada prueba de campo |

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
