# 7. Requisitos y riesgos

## Trazabilidad (Guía de Misión CASAT-FIT2026 → proyecto)

| # | Requisito de la guía | Solución | Verificación | Estado |
|---|---|---|---|---|
| R1 | Transmitir presión, temperatura, orientación y aceleración en tiempo real | Trama `T` 2 Hz por LoRa (PDR: ≥ 1 Hz) | Panel · P3 | Software listo |
| R2 | Calcular velocidad en todo el trayecto | Filtro complementario barómetro + IMU | Prueba automática: error < 0.1 m/s en simulación | Software listo |
| R3 | Calcular altura máxima | `MaquinaEstados::alturaMaxima()` | Prueba automática | Software listo |
| R4 | Liberación desde 450 m (dron) | Detección de caída libre | Simulación | Software listo |
| R5 | Autogiro + desacople de la secundaria a 200 m | Máquina de estados + secuencia de 2 servos SG90 (desacople, confirmación con el IMU, autogiro 400 ms después) | Emulador ESP32-S3: desacople a 198 m, separación confirmada, autogiro a 183 m · P6 | Falta mecánica |
| R6 | Descenso con autogiro 8–12 m/s | Diseño de aspas (mecánica) | P5 caídas de prueba | **Pendiente (mecánica)** |
| R7 | Autogiro sin motor eléctrico | Aspas pasivas; el servo solo libera | Revisión | Conforme al diseño |
| R8 | Primaria detecta distancia y dirección de la secundaria | Baliza GPS + Haversine (trama `P`) | Prueba automática de `Geo` · prueba de campo | Falta hardware |
| R9 | Transmitir ≥ 10 s tras aterrizar | Transmite siempre; evento `POST_ATERRIZAJE_OK` | Emulador | Software listo |
| R10 | Estación terrena en tiempo real | `estacion-terrena/` | Simulación | Software listo |
| R11 | Alcance ≥ 250 m (guía) y ≥ 1 km (requisito 4 del PDR) | LoRa 915 MHz SF7 250 kHz 20 dBm (SX1262 / RFM95W) | P3 con antena interna | **Pendiente (campo)** |
| R12 | Antenas dentro del satélite | Antena ¼ λ interna (8.2 cm a 915 MHz) | P3 | Pendiente |
| R13 | Solo pila cuadrada de 9 V | Pila 9 V + MP1584EN en ambas cargas (PDR diap. 12) | P1 · P4 | Resuelto en la lista del PDR; **corregir diap. 9 y 27** (aún dicen Li-Po) |
| R14 | Interruptor ON/OFF que no sobresalga | Mecánica/electrónica | P9 | Pendiente |
| R15 | ≤ 600 g con huevos (65 g c/u); Ø 9–10 cm; alto 20–23 cm; primaria ≤ 16 cm; secundaria ≤ 7 cm | Presupuesto de masa | P9 (báscula) | Pendiente |
| R16 | Un solo orificio (tapa superior, Ø 9–10 mm, ≥ 3 mm) | Mecánica | P9 | Pendiente |
| R17 | Sin fluidos, gases comprimidos ni explosivos | Espuma EVA sólida | Revisión | Conforme al diseño |
| R18 | Presupuesto ≤ 100 USD | Lista de materiales | Reportar en el RAM | Pendiente |
| R19 | RAM ≤ 7 h después del aterrizaje | `herramientas/analisis_vuelo.py` | Probado con vuelos simulados | Software listo |

## Requisitos propios del PDR (diapositiva 5)

| # | Requisito del PDR | Valor | Cómo se cumple / verifica |
|---|---|---|---|
| PDR-1 | Velocidad de descenso de la primaria | 8–12 m/s | Se mide en vivo (panel) y en el análisis; ajuste mecánico (P5) |
| PDR-2 | Masa total | ≤ 600 g | Báscula (P9) |
| PDR-3 | Diámetro máximo | ≤ 10 cm (el PDR dice "600 cm": error de captura) | Vernier (P9) |
| PDR-4 | Alcance LoRa | ≥ 1 km | P3 |
| PDR-5 | Tasa de telemetría | ≥ 1 Hz | Firmware: 2 Hz (T) + 1 Hz (P) |
| PDR-6 | Autonomía en vuelo activo | ≥ 30 min | P4 (meta 60 min) |
| PDR-7 | Precisión de la distancia post-aterrizaje | ± 5 m | Prueba GPS con cinta medida (plan de pruebas) |

## Riesgos detectados al revisar el CoDR

| # | Riesgo | Impacto | Qué hacer |
|---|---|---|---|
| 1 | El PDR todavía menciona Li-Po en la secundaria (diap. 9) y en la tabla de pesos (diap. 27); la guía solo permite **pila de 9 V** | Descalificación en la certificación de vuelo | Corregir esas diapositivas; la lista de componentes (diap. 12) ya dice 9 V |
| 2 | El diagrama de la primaria del PDR (diap. 11) usa GPIO 22–25 (no existen en el ESP32-S3) y pines internos del radio/pantalla | Servos o sensores que no responden | Usar el pinout de [02-conexiones](02-conexiones.md) (lista completa de diferencias ahí) |
| 3 | Presupuesto de masa del CoDR cuenta 60 g por huevo; la guía pide considerar 65 g | 10 g menos de margen | Rehacer la tabla con 65 g |
| 4 | Si el servo no libera, falla la misión de doble carga (lo dice el CoDR) | Crítico | Protecciones de software + desacople manual + P6 con 20 ciclos |
| 5 | La secundaria tiene 7 cm: ESP32-C3 + RFM95W + NEO-6M + pila de 9 V + huevo | No se podría ubicar a la secundaria | Probar el acomodo pronto (el PDR ya cambió a ESP32-C3 SuperMini). Respaldo: baliza LED/buzzer |
| 6 | El MPU9250 satura a 16 g; el impacto puede ser mayor | La aceleración máxima reportada queda en "≥ 16 g" | Se documenta así en el RAM; si se quiere medir el impacto, agregar un acelerómetro de ±200 g (p. ej. H3LIS331DL) |
| 7 | Interferencia: otros equipos en 915 MHz | Pérdida de telemetría | Palabra de sincronía propia (0x5A); si hay choque, cambiar la frecuencia en `RadioConfig.h` (914/916 MHz) |
| 10 | Muchos GY-91 baratos traen MPU6500 (sin magnetómetro) | Sin brújula: el yaw deriva | El firmware lo detecta (`mag=0` en `ARRANQUE`) y sigue funcionando; la dirección a la secundaria usa GPS, no la brújula |
| 11 | OpenLog a 9600 baudios de fábrica | Se pierden líneas a 25 Hz | `documentos/openlog/config.txt` (115200) en la microSD · prueba P4b |
| 12 | SX1262 (Heltec) y RFM95W (secundaria) son chips distintos | Que no se escuchen | Mismos parámetros en `RadioConfig.h`; verificar en P3 con la baliza encendida |
| 13 | Pila agotada antes de la recuperación (riesgo 5 del PDR) | No se encuentra el CanSat | Modo de bajo consumo 60 s después de aterrizar (`AHORRO_TRAS_ATERRIZAR_S`): T y P cada 2 s, pantalla y servos apagados, CPU a 80 MHz · P4 |
| 8 | Deriva del barómetro por el sol/viento en la mesa | Altitud desplazada unos metros | Calibrar (encender o comando *Calibrar*) justo antes de entregar al dron |
| 9 | Pila de 9 V alcalina con 100–150 mA dura poco | Se apaga en la espera | Interruptor apagado hasta el turno · P4 · considerar pila de 9 V de litio |

## Detalles menores del CoDR para corregir en el PDR

- Diapositiva 13: el encabezado dice "Programa Espacial Universitario - **UNAM**".
- Diapositiva 12 (tabla de masas): el diagrama menciona "Tensión paracaídas"; la misión usa autogiro.
- La diapositiva 3 pide `PEU-MC2024-CoDR-EQUIPO.pdf` y la 33 `PEU-FIT2026-CoDR-EQUIPO.pdf`: confirmar el nombre correcto de cada entregable con los organizadores.
