# 7. Requisitos y riesgos

## Trazabilidad (Guía de Misión CASAT-FIT2026 → proyecto)

| # | Requisito de la guía | Solución | Verificación | Estado |
|---|---|---|---|---|
| R1 | Transmitir presión, temperatura, orientación y aceleración en tiempo real | Trama `T` 4 Hz por LoRa | Panel · P3 | Software listo |
| R2 | Calcular velocidad en todo el trayecto | Filtro complementario barómetro + IMU | Prueba automática: error < 0.1 m/s en simulación | Software listo |
| R3 | Calcular altura máxima | `MaquinaEstados::alturaMaxima()` | Prueba automática | Software listo |
| R4 | Liberación desde 450 m (dron) | Detección de caída libre | Simulación | Software listo |
| R5 | Autogiro + desacople de la secundaria a 200 m | Máquina de estados + servo SG90 | Emulador: desacople a 198 m · P6 | Falta mecánica |
| R6 | Descenso con autogiro 8–12 m/s | Diseño de aspas (mecánica) | P5 caídas de prueba | **Pendiente (mecánica)** |
| R7 | Autogiro sin motor eléctrico | Aspas pasivas; el servo solo libera | Revisión | Conforme al diseño |
| R8 | Primaria detecta distancia y dirección de la secundaria | Baliza GPS + Haversine (trama `P`) | Prueba automática de `Geo` · prueba de campo | Falta hardware |
| R9 | Transmitir ≥ 10 s tras aterrizar | Transmite siempre; evento `POST_ATERRIZAJE_OK` | Emulador | Software listo |
| R10 | Estación terrena en tiempo real | `estacion-terrena/` | Simulación | Software listo |
| R11 | Alcance ≥ 250 m (prueba de aceptación, con video) | LoRa 433 MHz SF7 17 dBm | P3 con antena interna | **Pendiente (campo)** |
| R12 | Antenas dentro del satélite | Antena ¼ λ interna | P3 | Pendiente |
| R13 | Solo pila cuadrada de 9 V | Ver riesgo 1 | — | **Conflicto con el CoDR** |
| R14 | Interruptor ON/OFF que no sobresalga | Mecánica/electrónica | P9 | Pendiente |
| R15 | ≤ 600 g con huevos (65 g c/u); Ø 9–10 cm; alto 20–23 cm; primaria ≤ 16 cm; secundaria ≤ 7 cm | Presupuesto de masa | P9 (báscula) | Pendiente |
| R16 | Un solo orificio (tapa superior, Ø 9–10 mm, ≥ 3 mm) | Mecánica | P9 | Pendiente |
| R17 | Sin fluidos, gases comprimidos ni explosivos | Espuma EVA sólida | Revisión | Conforme al diseño |
| R18 | Presupuesto ≤ 100 USD | Lista de materiales | Reportar en el RAM | Pendiente |
| R19 | RAM ≤ 7 h después del aterrizaje | `herramientas/analisis_vuelo.py` | Probado con vuelos simulados | Software listo |

## Riesgos detectados al revisar el CoDR

| # | Riesgo | Impacto | Qué hacer |
|---|---|---|---|
| 1 | **El CoDR propone batería Li-Po 3.7 V + TP4056**, pero la guía dice: *"pilas de tipo cuadrada de 9 volts. No se aceptará ningún otro tipo de batería"* | Descalificación en la certificación de vuelo | Cambiar a pila de 9 V + step-down a 5 V (ver [02-conexiones](02-conexiones.md)). El firmware ya mide 9 V por defecto |
| 2 | El esquemático del CoDR usa GPIO 6/20/24 (no utilizables o inexistentes) | La placa no arranca o el módulo no responde | Usar el pinout de [02-conexiones](02-conexiones.md) |
| 3 | Presupuesto de masa del CoDR cuenta 60 g por huevo; la guía pide considerar 65 g | 10 g menos de margen | Rehacer la tabla con 65 g |
| 4 | Si el servo no libera, falla la misión de doble carga (lo dice el CoDR) | Crítico | Protecciones de software + desacople manual + P6 con 20 ciclos |
| 5 | La secundaria tiene 7 cm: ESP32 DevKit + GPS + LoRa + pila de 9 V pueden no caber | No se podría ubicar a la secundaria | Probar el acomodo pronto. Alternativas: placa más chica (ESP32-C3 SuperMini, mismo código con cambios de pines) o baliza solo por RSSI |
| 6 | El MPU6050 satura a 16 g; el impacto puede ser mayor | La aceleración máxima reportada queda en "≥ 16 g" | Se documenta así en el RAM; si se quiere medir el impacto, agregar un acelerómetro de ±200 g (p. ej. H3LIS331DL) |
| 7 | Interferencia: varios equipos en 433 MHz | Pérdida de telemetría | Palabra de sincronía propia (0x5A); si hay choque, cambiar la frecuencia en `RadioConfig.h` |
| 8 | Deriva del barómetro por el sol/viento en la mesa | Altitud desplazada unos metros | Calibrar (encender o comando *Calibrar*) justo antes de entregar al dron |
| 9 | Pila de 9 V alcalina con 100–150 mA dura poco | Se apaga en la espera | Interruptor apagado hasta el turno · P4 · considerar pila de 9 V de litio |

## Detalles menores del CoDR para corregir en el PDR

- Diapositiva 13: el encabezado dice "Programa Espacial Universitario - **UNAM**".
- Diapositiva 12 (tabla de masas): el diagrama menciona "Tensión paracaídas"; la misión usa autogiro.
- La diapositiva 3 pide `PEU-MC2024-CoDR-EQUIPO.pdf` y la 33 `PEU-FIT2026-CoDR-EQUIPO.pdf`: confirmar el nombre correcto de cada entregable con los organizadores.
