# Graph Report - zenit  (2026-10-19)

## Corpus Check
- 71 files · ~46,693 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 14 file(s) not represented in the graph (top: .properties 4, .ini 4, (none) 3)

## Summary
- 809 nodes · 1274 edges · 46 communities (38 shown, 8 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 69 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `0fdc446d`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Panel web: dibujo, alertas y diagnóstico (app.js)
- Drivers GY-91 y GPS (ZenitSensores)
- Firmware de vuelo de la primaria (main.cpp)
- Máquina de estados de la misión
- Filtros: altitud, velocidad, orientación, brújula
- Radio + OpenLog en tarea aparte (Comunicaciones)
- ZenitComun.h
- Enlace LoRa RadioLib (ZenitRadio)
- Servidor de la estación terrena (server.js)
- Análisis de vuelo para el RAM (Python)
- Protocolo de tramas en JavaScript
- Secuencia de separación (2 servos)
- Datos de sensores de la primaria
- Simulador
- Pruebas del servidor (node:test)
- Lecturas del simulador de vuelo
- Clase Sensores (real/simulado)
- package.json de la estación
- Pruebas de separación (Unity)
- Parámetros del simulador
- Simulador de vuelo C++
- Prueba P2 calibración GY-91
- Prueba P6 servos
- Registro de sesión (logs CSV)
- Checksums: protocolo y UBX
- ZenitPantalla.cpp
- Reproducción de sesiones
- 6. Día del lanzamiento — checklist
- SimuladorVuelo.cpp
- Tramas
- Fases del simulador
- Haversine y rumbo (Geo)
- AGENTS.md — Guía para asistentes de IA (Claude Code, Copilot, Codex, Cursor…)
- 1. Arquitectura del sistema
- 2. Conexiones (pinout) — según el PDR
- Empezar (Windows)
- 4. Máquina de estados de la misión
- 8. Git y GitHub para el equipo
- 7. Requisitos y riesgos
- ZÉNIT · CanSat 2026
- usarFuente
- documentos/README.md
- mecanica/README.md

## God Nodes (most connected - your core abstractions)
1. `Simulador` - 23 edges
2. `Orientacion` - 23 edges
3. `SimuladorVuelo` - 23 edges
4. `DatosSensores` - 22 edges
5. `Lectura` - 19 edges
6. `Imu` - 18 edges
7. `dibujarTodo()` - 17 edges
8. `MaquinaEstados` - 17 edges
9. `Secuencia` - 17 edges
10. `ParametrosSim` - 16 edges

## Surprising Connections (you probably didn't know these)
- `Modos de compilación` --references--> `SimuladorVuelo`  [INFERRED]
  docs/01-arquitectura.md → firmware/comun/ZenitComun/src/SimuladorVuelo.h
- `4. Reglas que NO se pueden romper` --references--> `banderas()`  [INFERRED]
  AGENTS.md → firmware/primaria/src/main.cpp
- `4. Reglas que NO se pueden romper` --references--> `test_tiempo_en_aire()`  [INFERRED]
  AGENTS.md → firmware/primaria/test/test_logica/test_main.cpp
- `Radio` --references--> `test_tiempo_en_aire()`  [INFERRED]
  docs/03-protocolo-telemetria.md → firmware/primaria/test/test_logica/test_main.cpp
- `test_frenon_del_autogiro_no_confirma_separacion()` --references--> `SimuladorVuelo`  [INFERRED]
  firmware/primaria/test/test_logica/test_main.cpp → firmware/comun/ZenitComun/src/SimuladorVuelo.h

## Import Cycles
- None detected.

## Communities (46 total, 8 thin omitted)

### Community 0 - "Panel web: dibujo, alertas y diagnóstico (app.js)"
Cohesion: 0.07
Nodes (65): agregar(), ahora(), alerta(), alertas, aplicarTema(), bandaAutogiro, cardinal(), cargarPuertos() (+57 more)

### Community 1 - "Drivers GY-91 y GPS (ZenitSensores)"
Cohesion: 0.07
Nodes (25): Barometro, dir_, configurarGpsAereo(), escanearI2c(), Imu, ajusteMag_, bus_, dir_ (+17 more)

### Community 2 - "Firmware de vuelo de la primaria (main.cpp)"
Cohesion: 0.09
Nodes (44): abrirAutogiro(), abrirDesacople(), actualizarGps(), actualizarIndicadores(), actualizarLocalizacionRelativa(), actualizarPantalla(), actualizarSeparacion(), apagarServosInactivos() (+36 more)

### Community 3 - "Máquina de estados de la misión"
Cohesion: 0.05
Nodes (34): Entrada, altura, gTotal, t, velocidad, Estado, ASCENSO, ATERRIZADO (+26 more)

### Community 4 - "Filtros: altitud, velocidad, orientación, brújula"
Cohesion: 0.07
Nodes (23): diferenciaAngular(), FiltroVertical, h_, iniciado_, k1_, k2_, v_, invSqrt() (+15 more)

### Community 5 - "Radio + OpenLog en tarea aparte (Comunicaciones)"
Cohesion: 0.08
Nodes (25): encolar(), enviarTrama(), escribirLinea(), Estado, archivo, crcMalos, descartadas, errorLora (+17 more)

### Community 6 - "ZenitComun.h"
Cohesion: 0.06
Nodes (22): Evento, EV_ASCENSO, EV_ATERRIZAJE, EV_DESACOPLE, EV_LIBERACION, EV_NINGUNO, Accion, ABRIR_AUTOGIRO (+14 more)

### Community 7 - "Enlace LoRa RadioLib (ZenitRadio)"
Cohesion: 0.10
Nodes (9): Enlace, radio_, spi_, Module, Paquete, rssi, snr, texto (+1 more)

### Community 8 - "Servidor de la estación terrena (server.js)"
Cohesion: 0.09
Nodes (18): app, CARPETA_LOGS, express, fs, historial, http, infoFuente, ORDENES_PERMITIDAS (+10 more)

### Community 9 - "Análisis de vuelo para el RAM (Python)"
Cohesion: 0.16
Nodes (9): analizar(), cumple(), elegir_vuelo(), escribir_resumen(), graficar(), leer_datos(), main(), numero_en() (+1 more)

### Community 10 - "Protocolo de tramas en JavaScript"
Cohesion: 0.15
Nodes (18): BANDERAS, checksum(), decodificarBanderas(), enmarcar(), ESTADOS, FUENTE, parsearCarga(), procesarLinea() (+10 more)

### Community 11 - "Secuencia de separación (2 servos)"
Cohesion: 0.10
Nodes (12): Parametros, cambioMinimoG, duracionReintentoMs, retardoAutogiroMs, ventanaConfirmacionMs, Secuencia, autogiro_, cambioMax_ (+4 more)

### Community 12 - "Datos de sensores de la primaria"
Cohesion: 0.10
Nodes (21): DatosSensores, ax, ay, az, baroOk, gpsSimulado, gx, gy (+13 more)

### Community 14 - "Pruebas del servidor (node:test)"
Cohesion: 0.13
Nodes (12): assert, http, { once }, path, { spawn }, test, assert, http (+4 more)

### Community 15 - "Lecturas del simulador de vuelo"
Cohesion: 0.12
Nodes (17): Lectura, alturaReal, ax, ay, az, fase, gx, gy (+9 more)

### Community 16 - "Clase Sensores (real/simulado)"
Cohesion: 0.14
Nodes (5): Sensores, autogiro_, dirBaro_, tJalon_, tUltimoMag_

### Community 17 - "package.json de la estación"
Cohesion: 0.07
Nodes (24): dependencies, chart.js, express, serialport, @serialport/parser-readline, ws, description, engines (+16 more)

### Community 18 - "Pruebas de separación (Unity)"
Cohesion: 0.13
Nodes (3): test_frenon_del_autogiro_no_confirma_separacion(), test_separacion_confirmada(), test_separacion_sin_jalon_reintenta_y_abre_autogiro()

### Community 19 - "Parámetros del simulador"
Cohesion: 0.14
Nodes (14): ParametrosSim, alturaLiberacion, giroAutogiroDps, latInicial, lonInicial, presionTierraPa, ruidoAcelG, ruidoPresionPa (+6 more)

### Community 20 - "Simulador de vuelo C++"
Cohesion: 0.15
Nodes (13): SimuladorVuelo, este_, esteSec_, gImpacto_, h_, hSec_, p_, secSuelta_ (+5 more)

### Community 21 - "Prueba P2 calibración GY-91"
Cohesion: 0.23
Nodes (6): calibrarMagnetometro(), Estadistica, n, suma, suma2, setup()

### Community 22 - "Prueba P6 servos"
Cohesion: 0.21
Nodes (9): loop(), Mecanismo, abierto, cerrado, nombre, pin, servo, mover() (+1 more)

### Community 23 - "Registro de sesión (logs CSV)"
Cohesion: 0.20
Nodes (6): CAMPOS, { CAMPOS }, fs, marcaTiempo(), path, Registro

### Community 24 - "Checksums: protocolo y UBX"
Cohesion: 0.23
Nodes (6): checksum(), enmarcar(), validar(), valorHex(), checksum(), mensajeModeloDinamico()

### Community 26 - "Reproducción de sesiones"
Cohesion: 0.18
Nodes (4): { EventEmitter }, fs, readline, Reproduccion

### Community 27 - "6. Día del lanzamiento — checklist"
Cohesion: 0.18
Nodes (9): 5. Plan de pruebas (CoDR P1–P9 + plan del PDR), Bitácora, Pruebas de software (automáticas), 6. Día del lanzamiento — checklist, Carga de huevos (máximo 45 minutos desde que los entregan), Después de aterrizar, Durante el vuelo, En la mesa (antes del turno) (+1 more)

### Community 29 - "Tramas"
Cohesion: 0.20
Nodes (9): 3. Protocolo de telemetría, `B` — Baliza de la secundaria (cada 2 s ± 300 ms, como pide el PDR), `C` — Comandos desde tierra, `E` — Eventos, Líneas del receptor por USB, `P` — Posición y localización de la secundaria (1 por segundo), `R` — Prueba de alcance (programa `p3_alcance_lora`), `T` — Telemetría de la primaria (2 por segundo) (+1 more)

### Community 30 - "Fases del simulador"
Cohesion: 0.25
Nodes (7): Fase, AUTOGIRO, CAIDA, ESPERA, SUBIDA, SUELO, TIERRA

### Community 31 - "Haversine y rumbo (Geo)"
Cohesion: 0.43
Nodes (4): distanciaMetros(), grad(), rad(), rumboGrados()

### Community 32 - "AGENTS.md — Guía para asistentes de IA (Claude Code, Copilot, Codex, Cursor…)"
Cohesion: 0.22
Nodes (9): 1. Ahorra tokens: lee el mapa antes que el código, 2. Qué es cada cosa, 3. Comandos, 4. Reglas que NO se pueden romper, 5. Antes de dar algo por terminado, 6. Lo que todavía depende del hardware, AGENTS.md — Guía para asistentes de IA (Claude Code, Copilot, Codex, Cursor…), Radio (+1 more)

### Community 33 - "1. Arquitectura del sistema"
Cohesion: 0.25
Nodes (7): 1. Arquitectura del sistema, Cálculos, Estación terrena, Firmware de la carga primaria, Librerías del firmware (`firmware/comun/`), Modos de compilación, Segmentos

### Community 34 - "2. Conexiones (pinout) — según el PDR"
Cohesion: 0.29
Nodes (7): 2. Conexiones (pinout) — según el PDR, Alimentación de la primaria, Antena, Carga primaria — Heltec WiFi LoRa 32 V3, Carga secundaria — ESP32-C3 SuperMini (diagrama del PDR, diapositiva 12), Diferencias encontradas en el PDR (revisar con electrónica), Receptor de tierra — Heltec WiFi LoRa 32 V3

### Community 35 - "Empezar (Windows)"
Cohesion: 0.29
Nodes (7): 1. Instalar una sola vez, 2. Abrir el proyecto, 3. Probar TODO sin hardware (5 minutos), 4. Con la Heltec V3 sola (sin sensores), 5. Con el hardware armado, 6. Después del vuelo (documento RAM, máximo 7 h), Empezar (Windows)

### Community 36 - "4. Máquina de estados de la misión"
Cohesion: 0.33
Nodes (5): 4. Máquina de estados de la misión, Cómo probar cambios, Parámetros, Protecciones del desacople, Secuencia de separación (2 servos)

### Community 37 - "8. Git y GitHub para el equipo"
Cohesion: 0.33
Nodes (6): 8. Git y GitHub para el equipo, Cada integrante, Flujo de trabajo, Quién es dueño de qué (según el CoDR), Qué subir y qué no, Subir el repositorio por primera vez (lo hace una sola persona)

### Community 40 - "7. Requisitos y riesgos"
Cohesion: 0.40
Nodes (5): 7. Requisitos y riesgos, Detalles menores del CoDR para corregir en el PDR, Requisitos propios del PDR (diapositiva 5), Riesgos detectados al revisar el CoDR, Trazabilidad (Guía de Misión CASAT-FIT2026 → proyecto)

### Community 41 - "ZÉNIT · CanSat 2026"
Cohesion: 0.40
Nodes (5): Cómo cumple la misión, Equipo, Estado verificado, Qué hay en este repositorio, ZÉNIT · CanSat 2026

### Community 42 - "usarFuente"
Cohesion: 0.83
Nodes (4): alRecibirLinea(), avisarEstado(), difundir(), usarFuente()

## Knowledge Gaps
- **190 isolated node(s):** `chart.js`, `k1_`, `k2_`, `h_`, `v_` (+185 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 422 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `4. Reglas que NO se pueden romper` connect `AGENTS.md — Guía para asistentes de IA (Claude Code, Copilot, Codex, Cursor…)` to `Firmware de vuelo de la primaria (main.cpp)`?**
  _High betweenness centrality (0.069) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `SimuladorVuelo` (e.g. with `Modos de compilación` and `test_frenon_del_autogiro_no_confirma_separacion()`) actually correct?**
  _`SimuladorVuelo` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `chart.js`, `k1_`, `k2_` to the rest of the system?**
  _190 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Panel web: dibujo, alertas y diagnóstico (app.js)` be split into smaller, more focused modules?**
  _Cohesion score 0.07204968944099378 - nodes in this community are weakly interconnected._
- **Why does `AGENTS.md — Guía para asistentes de IA (Claude Code, Copilot, Codex, Cursor…)` connect `AGENTS.md — Guía para asistentes de IA (Claude Code, Copilot, Codex, Cursor…)` to `README.md`?**
  _High betweenness centrality (0.066) - this node is a cross-community bridge._
- **Should `Drivers GY-91 y GPS (ZenitSensores)` be split into smaller, more focused modules?**
  _Cohesion score 0.06612244897959184 - nodes in this community are weakly interconnected._
- **Why does `test_tiempo_en_aire()` connect `AGENTS.md — Guía para asistentes de IA (Claude Code, Copilot, Codex, Cursor…)` to `Pruebas de separación (Unity)`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._