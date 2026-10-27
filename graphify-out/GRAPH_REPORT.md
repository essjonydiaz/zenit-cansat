# Graph Report - zenit-cansat  (2026-10-26)

## Corpus Check
- 85 files · ~63,547 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 17 file(s) not represented in the graph (top: (none) 4, .properties 4, .ini 4)

## Summary
- 953 nodes · 1491 edges · 54 communities (48 shown, 6 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 86 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `fb19274a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Panel web: dibujo, alertas y diagnóstico (app.js)
- Drivers GY-91 y GPS (ZenitSensores)
- Firmware de vuelo de la primaria (main.cpp)
- MaquinaEstados
- Filtros.cpp
- Radio + OpenLog en tarea aparte (Comunicaciones)
- ZenitComun.h
- Enlace LoRa RadioLib (ZenitRadio)
- Servidor de la estación terrena (server.js)
- Análisis de vuelo para el RAM (Python)
- Protocolo de tramas en JavaScript
- Secuencia
- Datos de sensores de la primaria
- Parte B — Primera prueba con el hardware (en este orden)
- Pruebas del servidor (node:test)
- Lecturas del simulador de vuelo
- cansat3d.js
- package.json
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
- decisiones/README.md
- Simulador
- 1. Arquitectura del sistema
- 2. Conexiones (pinout) — según el PDR
- Empezar (Windows)
- 4. Máquina de estados de la misión
- 8. Git y GitHub para el equipo
- 7. Requisitos y riesgos
- 10. Pendientes del equipo antes de la primera prueba
- README.md
- FiltroVertical
- AGENTS.md — Guía para asistentes de IA (Claude Code, Copilot, Codex, Cursor…)
- GRAPHIFY.md — Mapa de conocimiento del repositorio
- documentos/README.md
- mecanica/README.md
- Orientacion
- DESIGN.md — Zénit
- test_vuelo_simulado_completo
- PRODUCT.md — Zénit
- Geo.cpp
- sonidoDespegue
- Parametros
- usarFuente

## God Nodes (most connected - your core abstractions)
1. `Simulador` - 23 edges
2. `Orientacion` - 23 edges
3. `SimuladorVuelo` - 23 edges
4. `DatosSensores` - 22 edges
5. `Lectura` - 19 edges
6. `iniciar()` - 18 edges
7. `MaquinaEstados` - 18 edges
8. `Imu` - 18 edges
9. `dibujarTodo()` - 17 edges
10. `Secuencia` - 17 edges

## Surprising Connections (you probably didn't know these)
- `Consecuencias` --references--> `crearCanSat()`  [INFERRED]
  docs/decisiones/0003-modelo-3d-procedural-ilustrativo.md → estacion-terrena/public/cansat3d.js
- `Modos de compilación` --references--> `SimuladorVuelo`  [INFERRED]
  docs/01-arquitectura.md → firmware/comun/ZenitComun/src/SimuladorVuelo.h
- `Conceptos que el grafo debe conectar` --references--> `MaquinaEstados`  [INFERRED]
  GRAPHIFY.md → firmware/comun/ZenitComun/src/MaquinaEstados.h
- `4. Reglas que NO se pueden romper` --references--> `banderas()`  [INFERRED]
  AGENTS.md → firmware/primaria/src/main.cpp
- `Conceptos que el grafo debe conectar` --references--> `banderas()`  [INFERRED]
  GRAPHIFY.md → firmware/primaria/src/main.cpp

## Import Cycles
- None detected.

## Communities (54 total, 6 thin omitted)

### Community 0 - "Panel web: dibujo, alertas y diagnóstico (app.js)"
Cohesion: 0.07
Nodes (66): agregar(), ahora(), alerta(), alertas, aplicarTema(), bandaAutogiro, cardinal(), cargarPuertos() (+58 more)

### Community 1 - "Drivers GY-91 y GPS (ZenitSensores)"
Cohesion: 0.07
Nodes (26): Barometro, dir_, configurarGpsAereo(), escanearI2c(), Imu, ajusteMag_, bus_, dir_ (+18 more)

### Community 2 - "Firmware de vuelo de la primaria (main.cpp)"
Cohesion: 0.09
Nodes (45): abrirAutogiro(), abrirDesacople(), actualizarGps(), actualizarIndicadores(), actualizarLocalizacionRelativa(), actualizarPantalla(), actualizarSeparacion(), apagarServosInactivos() (+37 more)

### Community 3 - "MaquinaEstados"
Cohesion: 0.05
Nodes (34): Entrada, altura, gTotal, t, velocidad, Estado, ASCENSO, ATERRIZADO (+26 more)

### Community 4 - "Filtros.cpp"
Cohesion: 0.20
Nodes (3): diferenciaAngular(), invSqrt(), test_yaw_converge_a_la_brujula()

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

### Community 11 - "Secuencia"
Cohesion: 0.17
Nodes (7): Secuencia, autogiro_, cambioMax_, gRef_, p_, reintentando_, t0_

### Community 12 - "Datos de sensores de la primaria"
Cohesion: 0.06
Nodes (26): DatosSensores, ax, ay, az, baroOk, gpsSimulado, gx, gy (+18 more)

### Community 13 - "Parte B — Primera prueba con el hardware (en este orden)"
Cohesion: 0.11
Nodes (19): 9. Guía: dejar todo listo y hacer la primera prueba con el hardware, A1. Programas que deben estar instalados, A2. Extensiones de VS Code, A3. Descargar TODO lo de PlatformIO ahora (importante), A4. Estación terrena, A5. Análisis del vuelo (Python), A6. Subir los cambios a GitHub, A7. Lista de material para el día de la prueba (+11 more)

### Community 14 - "Pruebas del servidor (node:test)"
Cohesion: 0.13
Nodes (12): assert, http, { once }, path, { spawn }, test, assert, http (+4 more)

### Community 15 - "Lecturas del simulador de vuelo"
Cohesion: 0.12
Nodes (17): Lectura, alturaReal, ax, ay, az, fase, gx, gy (+9 more)

### Community 16 - "cansat3d.js"
Cohesion: 0.08
Nodes (41): caja(), crearCanSat(), actualizar(), en(), huevo(), lerp(), materiales(), pila9v() (+33 more)

### Community 17 - "package.json"
Cohesion: 0.06
Nodes (29): dependencies, chart.js, express, @fontsource-variable/archivo, @fontsource-variable/jetbrains-mono, serialport, @serialport/parser-readline, three (+21 more)

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
Cohesion: 0.33
Nodes (6): 6. Día del lanzamiento — checklist, Carga de huevos (máximo 45 minutos desde que los entregan), Después de aterrizar, Durante el vuelo, En la mesa (antes del turno), La noche anterior

### Community 29 - "Tramas"
Cohesion: 0.20
Nodes (9): 3. Protocolo de telemetría, `B` — Baliza de la secundaria (cada 2 s ± 300 ms, como pide el PDR), `C` — Comandos desde tierra, `E` — Eventos, Líneas del receptor por USB, `P` — Posición y localización de la secundaria (1 por segundo), `R` — Prueba de alcance (programa `p3_alcance_lora`), `T` — Telemetría de la primaria (2 por segundo) (+1 more)

### Community 30 - "Fases del simulador"
Cohesion: 0.25
Nodes (7): Fase, AUTOGIRO, CAIDA, ESPERA, SUBIDA, SUELO, TIERRA

### Community 31 - "decisiones/README.md"
Cohesion: 0.12
Nodes (13): 0001 · Recursos de la interfaz servidos localmente, Consecuencias, Contexto, Decisión, 0002 · Sistema visual "Vidrio en órbita" en DESIGN.md, Consecuencias, Contexto, Decisión (+5 more)

### Community 33 - "1. Arquitectura del sistema"
Cohesion: 0.25
Nodes (7): 1. Arquitectura del sistema, Cálculos, Estación terrena, Firmware de la carga primaria, Librerías del firmware (`firmware/comun/`), Modos de compilación, Segmentos

### Community 34 - "2. Conexiones (pinout) — según el PDR"
Cohesion: 0.29
Nodes (7): 2. Conexiones (pinout) — según el PDR, Alimentación de la primaria, Antena, Carga primaria — Heltec WiFi LoRa 32 V3, Carga secundaria — ESP32-C3 SuperMini (diagrama del PDR, diapositiva 12), Diferencias encontradas en el PDR (revisar con electrónica), Receptor de tierra — Heltec WiFi LoRa 32 V3

### Community 35 - "Empezar (Windows)"
Cohesion: 0.15
Nodes (13): 1. Instalar una sola vez, 2. Abrir el proyecto, 3. Probar TODO sin hardware (5 minutos), 4. Con la Heltec V3 sola (sin sensores), 5. Con el hardware armado, 6. Después del vuelo (documento RAM, máximo 7 h), Cómo cumple la misión, Documentación (+5 more)

### Community 36 - "4. Máquina de estados de la misión"
Cohesion: 0.33
Nodes (5): 4. Máquina de estados de la misión, Cómo probar cambios, Parámetros, Protecciones del desacople, Secuencia de separación (2 servos)

### Community 37 - "8. Git y GitHub para el equipo"
Cohesion: 0.29
Nodes (6): 8. Git y GitHub para el equipo, Cada integrante, Flujo de trabajo, Quién es dueño de qué (según el CoDR), Qué subir y qué no, Subir el repositorio por primera vez (lo hace una sola persona)

### Community 38 - "7. Requisitos y riesgos"
Cohesion: 0.40
Nodes (5): 7. Requisitos y riesgos, Detalles menores del CoDR para corregir en el PDR, Requisitos propios del PDR (diapositiva 5), Riesgos detectados al revisar el CoDR, Trazabilidad (Guía de Misión CASAT-FIT2026 → proyecto)

### Community 39 - "10. Pendientes del equipo antes de la primera prueba"
Cohesion: 0.13
Nodes (14): 10. Pendientes del equipo antes de la primera prueba, 1. Componentes del sistema, 2. Conexiones de la carga primaria (Heltec WiFi LoRa 32 V3), 3. Conexiones de la carga secundaria (ESP32-C3 SuperMini), 4. Electrónica, 5. Mecánica, 6. Todo el equipo: primera prueba en la mesa, 7. Pruebas de campo después de la primera prueba (+6 more)

### Community 40 - "README.md"
Cohesion: 0.21
Nodes (4): Solo para Claude Code, 5. Plan de pruebas (CoDR P1–P9 + plan del PDR), Bitácora, Pruebas de software (automáticas)

### Community 41 - "FiltroVertical"
Cohesion: 0.19
Nodes (7): FiltroVertical, h_, iniciado_, k1_, k2_, v_, test_filtro_sigue_bajada_constante()

### Community 42 - "AGENTS.md — Guía para asistentes de IA (Claude Code, Copilot, Codex, Cursor…)"
Cohesion: 0.22
Nodes (9): 1. Ahorra tokens: lee el mapa antes que el código, 2. Qué es cada cosa, 3. Comandos, 4. Reglas que NO se pueden romper, 5. Antes de dar algo por terminado, 6. Lo que todavía depende del hardware, AGENTS.md — Guía para asistentes de IA (Claude Code, Copilot, Codex, Cursor…), Radio (+1 more)

### Community 43 - "GRAPHIFY.md — Mapa de conocimiento del repositorio"
Cohesion: 0.40
Nodes (5): Actualizar, Consultar (sin costo de API), GRAPHIFY.md — Mapa de conocimiento del repositorio, Qué entra y qué no, Qué hay en `graphify-out/`

### Community 46 - "Orientacion"
Cohesion: 0.15
Nodes (12): Orientacion, conRumbo_, desfaseYaw_, ix_, iy_, iz_, ki_, kp_ (+4 more)

### Community 47 - "DESIGN.md — Zénit"
Cohesion: 0.22
Nodes (9): Colors, Components, DESIGN.md — Zénit, Do's and Don'ts, Elevation & Depth, Layout, Overview, Shapes (+1 more)

### Community 49 - "PRODUCT.md — Zénit"
Cohesion: 0.29
Nodes (7): Lo que no se negocia, Marca, PRODUCT.md — Zénit, Quién lo usa y dónde, Qué es, Superficies, Voz

### Community 50 - "Geo.cpp"
Cohesion: 0.43
Nodes (4): distanciaMetros(), grad(), rad(), rumboGrados()

### Community 51 - "sonidoDespegue"
Cohesion: 0.25
Nodes (3): cerrar(), medir(), sonidoDespegue()

### Community 52 - "Parametros"
Cohesion: 0.40
Nodes (5): Parametros, cambioMinimoG, duracionReintentoMs, retardoAutogiroMs, ventanaConfirmacionMs

### Community 53 - "usarFuente"
Cohesion: 0.83
Nodes (4): alRecibirLinea(), avisarEstado(), difundir(), usarFuente()

## Knowledge Gaps
- **192 isolated node(s):** `@fontsource-variable/archivo`, `@fontsource-variable/jetbrains-mono`, `chart.js`, `k1_`, `k2_` (+187 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 491 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Consecuencias` connect `decisiones/README.md` to `cansat3d.js`?**
  _High betweenness centrality (0.322) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `SimuladorVuelo` (e.g. with `Modos de compilación` and `test_frenon_del_autogiro_no_confirma_separacion()`) actually correct?**
  _`SimuladorVuelo` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `@fontsource-variable/archivo`, `@fontsource-variable/jetbrains-mono`, `chart.js` to the rest of the system?**
  _192 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Panel web: dibujo, alertas y diagnóstico (app.js)` be split into smaller, more focused modules?**
  _Cohesion score 0.07082494969818913 - nodes in this community are weakly interconnected._
- **Why does `crearCanSat()` connect `cansat3d.js` to `decisiones/README.md`?**
  _High betweenness centrality (0.321) - this node is a cross-community bridge._
- **Should `Drivers GY-91 y GPS (ZenitSensores)` be split into smaller, more focused modules?**
  _Cohesion score 0.06509803921568627 - nodes in this community are weakly interconnected._
- **Should `Firmware de vuelo de la primaria (main.cpp)` be split into smaller, more focused modules?**
  _Cohesion score 0.08953900709219859 - nodes in this community are weakly interconnected._