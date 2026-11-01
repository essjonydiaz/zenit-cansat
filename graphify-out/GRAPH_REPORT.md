# Graph Report - zenit-cansat  (2026-11-01)

## Corpus Check
- 108 files · ~89,645 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 68 file(s) not represented in the graph (top: .step 23, .stl 21, (none) 6)

## Summary
- 1236 nodes · 2027 edges · 83 communities (69 shown, 14 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 97 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ce3e3aee`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Panel web: dibujo, alertas y diagnóstico (app.js)
- p1_autodiagnostico.cpp
- Firmware de vuelo de la primaria (main.cpp)
- Parametros
- Filtros.cpp
- Comunicaciones.cpp
- cansat_completo.py
- Enlace
- Servidor de la estación terrena (server.js)
- Análisis de vuelo para el RAM (Python)
- Simulador
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
- ZenitPantalla.cpp
- Prueba P6 servos
- Registro de sesión (logs CSV)
- Checksums: protocolo y UBX
- AGENTS.md
- fuentes.js
- 6. Día del lanzamiento — checklist
- ZenitComun.h
- Tramas
- Fases del simulador
- decisiones/README.md
- with
- 1. Arquitectura del sistema
- 2. Conexiones (pinout) — según el PDR
- Empezar (Windows)
- 4. Máquina de estados de la misión
- 8. Git y GitHub para el equipo
- planos.py
- 10. Pendientes del equipo antes de la primera prueba
- ZenitSensores.cpp
- FiltroVertical
- protocolo.js
- GRAPHIFY.md — Mapa de conocimiento del repositorio
- documentos/README.md
- mecanica/README.md
- Orientacion
- DESIGN.md — Zénit
- Soporte de electrónica de la carga primaria
- PRODUCT.md — Zénit
- p2_sensores.cpp
- sonidoDespegue
- Parametros
- receptor/src/main.cpp
- SimuladorVuelo.cpp
- Accion
- v3.js
- 11. Prender y apagar el servidor de la estación terrena
- secundaria/src/main.cpp
- diagnostico.js
- alEscuchar
- MaquinaEstados
- CanSat Zénit completo · diseño en CAD (versión 2)
- MaquinaEstados.cpp
- Estado
- GRAPHIFY.md — Mapa de conocimiento del repositorio
- Protección de la electrónica · carga primaria
- test_vuelo_simulado_completo
- Geo.cpp
- Entrada
- test_modo_prueba_techo
- render_cansat.py
- Estado
- ZenitRadio.h
- Imu
- LecturaImu
- exportar_web.py
- ZenitSensores.h
- Recibido

## God Nodes (most connected - your core abstractions)
1. `Simulador` - 24 edges
2. `SimuladorVuelo` - 23 edges
3. `Orientacion` - 23 edges
4. `DatosSensores` - 22 edges
5. `MaquinaEstados` - 21 edges
6. `Imu` - 19 edges
7. `Lectura` - 19 edges
8. `iniciar()` - 18 edges
9. `Secuencia` - 17 edges
10. `dibujarTodo()` - 17 edges

## Surprising Connections (you probably didn't know these)
- `Modos de compilación` --references--> `SimuladorVuelo`  [INFERRED]
  docs/01-arquitectura.md → firmware/comun/ZenitComun/src/SimuladorVuelo.h
- `Todo el equipo` --references--> `procesarComando()`  [INFERRED]
  docs/10-pendientes-del-equipo.md → firmware/primaria/src/main.cpp
- `Consecuencias` --references--> `crearCanSat()`  [INFERRED]
  docs/decisiones/0003-modelo-3d-procedural-ilustrativo.md → estacion-terrena/public/cansat3d.js
- `Conceptos que el grafo debe conectar` --references--> `MaquinaEstados`  [INFERRED]
  GRAPHIFY.md → firmware/comun/ZenitComun/src/MaquinaEstados.h
- `Decisión` --references--> `crearCanSat()`  [INFERRED]
  docs/decisiones/0005-modelo-3d-desde-el-cad.md → estacion-terrena/public/cansat3d.js

## Import Cycles
- None detected.

## Communities (83 total, 14 thin omitted)

### Community 0 - "Panel web: dibujo, alertas y diagnóstico (app.js)"
Cohesion: 0.07
Nodes (71): agregar(), ahora(), alerta(), alertas, aplicarTema(), avisarServidorViejo(), bandaAutogiro, cardinal() (+63 more)

### Community 1 - "p1_autodiagnostico.cpp"
Cohesion: 0.20
Nodes (7): Barometro, dir_, Barometro::leer(), diagnosticar(), hay(), loop(), resultado()

### Community 2 - "Firmware de vuelo de la primaria (main.cpp)"
Cohesion: 0.09
Nodes (46): abrirAutogiro(), abrirDesacople(), actualizarGps(), actualizarIndicadores(), actualizarLocalizacionRelativa(), actualizarPantalla(), actualizarSeparacion(), apagarServosInactivos() (+38 more)

### Community 3 - "Parametros"
Cohesion: 0.14
Nodes (14): Parametros, alturaArmado, alturaDesacople, alturaDeteccionAscenso, alturaMaxAterrizaje, caidaDesacople, gCaidaLibre, lecturasDesacople (+6 more)

### Community 4 - "Filtros.cpp"
Cohesion: 0.20
Nodes (3): diferenciaAngular(), invSqrt(), test_yaw_converge_a_la_brujula()

### Community 5 - "Comunicaciones.cpp"
Cohesion: 0.19
Nodes (10): encolar(), enviarTrama(), escribirLinea(), guardarFisicamente(), iniciarRegistro(), Mensaje, texto, recibir() (+2 more)

### Community 6 - "cansat_completo.py"
Cohesion: 0.13
Nodes (40): ang_xy(), anillo(), anillo_retencion(), aspa(), bandeja_secundaria(), caja(), canal(), carcasa_primaria() (+32 more)

### Community 7 - "Enlace"
Cohesion: 0.20
Nodes (3): Enlace, radio_, spi_

### Community 8 - "Servidor de la estación terrena (server.js)"
Cohesion: 0.07
Nodes (19): app, ARRANQUE_MS, CARPETA_LOGS, crypto, express, fs, historial, http (+11 more)

### Community 9 - "Análisis de vuelo para el RAM (Python)"
Cohesion: 0.16
Nodes (9): analizar(), cumple(), elegir_vuelo(), escribir_resumen(), graficar(), leer_datos(), main(), numero_en() (+1 more)

### Community 11 - "Secuencia"
Cohesion: 0.17
Nodes (7): Secuencia, autogiro_, cambioMax_, gRef_, p_, reintentando_, t0_

### Community 12 - "Datos de sensores de la primaria"
Cohesion: 0.06
Nodes (30): DatosSensores, ax, ay, az, baroOk, gpsSimulado, gx, gy (+22 more)

### Community 13 - "Parte B — Primera prueba con el hardware (en este orden)"
Cohesion: 0.11
Nodes (19): 9. Guía: dejar todo listo y hacer la primera prueba con el hardware, A1. Programas que deben estar instalados, A2. Extensiones de VS Code, A3. Descargar TODO lo de PlatformIO ahora (importante), A4. Estación terrena, A5. Análisis del vuelo (Python), A6. Subir los cambios a GitHub, A7. Lista de material para el día de la prueba (+11 more)

### Community 14 - "Pruebas del servidor (node:test)"
Cohesion: 0.06
Nodes (36): assert, http, { once }, path, { spawn }, test, assert, http (+28 more)

### Community 15 - "Lecturas del simulador de vuelo"
Cohesion: 0.12
Nodes (17): Lectura, alturaReal, ax, ay, az, fase, gx, gy (+9 more)

### Community 16 - "cansat3d.js"
Cohesion: 0.05
Nodes (72): 0005 · El modelo 3D de la web sale del CAD real, Consecuencias, Contexto, Decisión, calcomaniaLogo(), crearCanSat(), actualizar(), GRUPOS (+64 more)

### Community 17 - "package.json"
Cohesion: 0.07
Nodes (29): dependencies, chart.js@^4.4.7, express@^4.21.2, @fontsource-variable/archivo@^5.3.0, @fontsource-variable/jetbrains-mono@^5.3.0, serialport@^12.0.0, @serialport/parser-readline@^12.0.0, three@0.169.0 (+21 more)

### Community 19 - "Parámetros del simulador"
Cohesion: 0.14
Nodes (14): ParametrosSim, alturaLiberacion, giroAutogiroDps, latInicial, lonInicial, presionTierraPa, ruidoAcelG, ruidoPresionPa (+6 more)

### Community 20 - "Simulador de vuelo C++"
Cohesion: 0.13
Nodes (15): SimuladorVuelo, este_, esteSec_, gImpacto_, h_, hSec_, p_, secSuelta_ (+7 more)

### Community 22 - "Prueba P6 servos"
Cohesion: 0.21
Nodes (9): loop(), Mecanismo, abierto, cerrado, nombre, pin, servo, mover() (+1 more)

### Community 23 - "Registro de sesión (logs CSV)"
Cohesion: 0.22
Nodes (5): CAMPOS, fs, marcaTiempo(), path, Registro

### Community 24 - "Checksums: protocolo y UBX"
Cohesion: 0.23
Nodes (6): checksum(), enmarcar(), validar(), valorHex(), checksum(), mensajeModeloDinamico()

### Community 25 - "AGENTS.md"
Cohesion: 0.22
Nodes (9): 1. Ahorra tokens: lee el mapa antes que el código, 2. Qué es cada cosa, 3. Comandos, 4. Reglas que NO se pueden romper, 5. Antes de dar algo por terminado, 6. Lo que todavía depende del hardware, AGENTS.md — Guía para asistentes de IA (Claude Code, Copilot, Codex, Cursor…), Radio (+1 more)

### Community 26 - "fuentes.js"
Cohesion: 0.18
Nodes (4): { EventEmitter }, fs, readline, Reproduccion

### Community 27 - "6. Día del lanzamiento — checklist"
Cohesion: 0.17
Nodes (10): 5. Plan de pruebas (CoDR P1–P9 + plan del PDR), Bitácora, Prueba desde el techo (modo prueba), Pruebas de software (automáticas), 6. Día del lanzamiento — checklist, Carga de huevos (máximo 45 minutos desde que los entregan), Después de aterrizar, Durante el vuelo (+2 more)

### Community 28 - "ZenitComun.h"
Cohesion: 0.16
Nodes (6): Evento, EV_ASCENSO, EV_ATERRIZAJE, EV_DESACOPLE, EV_LIBERACION, EV_NINGUNO

### Community 29 - "Tramas"
Cohesion: 0.20
Nodes (9): 3. Protocolo de telemetría, `B` — Baliza de la secundaria (cada 2 s ± 300 ms, como pide el PDR), `C` — Comandos desde tierra, `E` — Eventos, Líneas del receptor por USB, `P` — Posición y localización de la secundaria (1 por segundo), `R` — Prueba de alcance (programa `p3_alcance_lora`), `T` — Telemetría de la primaria (2 por segundo) (+1 more)

### Community 30 - "Fases del simulador"
Cohesion: 0.25
Nodes (7): Fase, AUTOGIRO, CAIDA, ESPERA, SUBIDA, SUELO, TIERRA

### Community 31 - "decisiones/README.md"
Cohesion: 0.09
Nodes (17): 0001 · Recursos de la interfaz servidos localmente, Consecuencias, Contexto, Decisión, 0002 · Sistema visual "Vidrio en órbita" en DESIGN.md, Consecuencias, Contexto, Decisión (+9 more)

### Community 32 - "with"
Cohesion: 0.06
Nodes (38): name, runs-on, steps, run, defaults, name, runs-on, steps (+30 more)

### Community 33 - "1. Arquitectura del sistema"
Cohesion: 0.25
Nodes (7): 1. Arquitectura del sistema, Cálculos, Estación terrena, Firmware de la carga primaria, Librerías del firmware (`firmware/comun/`), Modos de compilación, Segmentos

### Community 34 - "2. Conexiones (pinout) — según el PDR"
Cohesion: 0.14
Nodes (12): 2. Conexiones (pinout) — según el PDR, Alimentación de la primaria, Antena, Carga primaria — Heltec WiFi LoRa 32 V3, Carga secundaria — ESP32-C3 SuperMini (diagrama del PDR, diapositiva 12), Diferencias encontradas en el PDR (revisar con electrónica), Receptor de tierra — Heltec WiFi LoRa 32 V3, 7. Requisitos y riesgos (+4 more)

### Community 35 - "Empezar (Windows)"
Cohesion: 0.15
Nodes (13): 1. Instalar una sola vez, 2. Abrir el proyecto, 3. Probar TODO sin hardware (5 minutos), 4. Con la Heltec V3 sola (sin sensores), 5. Con el hardware armado, 6. Después del vuelo (documento RAM, máximo 7 h), Cómo cumple la misión, Documentación (+5 more)

### Community 36 - "4. Máquina de estados de la misión"
Cohesion: 0.33
Nodes (5): 4. Máquina de estados de la misión, Cómo probar cambios, Parámetros, Protecciones del desacople, Secuencia de separación (2 servos)

### Community 37 - "8. Git y GitHub para el equipo"
Cohesion: 0.29
Nodes (6): 8. Git y GitHub para el equipo, Cada integrante, Flujo de trabajo, Quién es dueño de qué (según el CoDR), Qué subir y qué no, Subir el repositorio por primera vez (lo hace una sola persona)

### Community 39 - "10. Pendientes del equipo antes de la primera prueba"
Cohesion: 0.13
Nodes (14): 10. Pendientes del equipo antes de la primera prueba, 1. Componentes del sistema, 2. Conexiones de la carga primaria (Heltec WiFi LoRa 32 V3), 3. Conexiones de la carga secundaria (ESP32-C3 SuperMini), 4. Electrónica, 5. Mecánica, 6. Todo el equipo: primera prueba en la mesa, 7. Pruebas de campo después de la primera prueba (+6 more)

### Community 40 - "ZenitSensores.cpp"
Cohesion: 0.20
Nodes (8): Barometro::iniciar(), configurarGpsAereo(), escanearI2c(), Imu::escribir(), Imu::iniciar(), Imu::iniciarMag(), Imu::leerBytes(), Imu::modelo()

### Community 41 - "FiltroVertical"
Cohesion: 0.19
Nodes (7): FiltroVertical, h_, iniciado_, k1_, k2_, v_, test_filtro_sigue_bajada_constante()

### Community 42 - "protocolo.js"
Cohesion: 0.18
Nodes (15): BANDERAS, checksum(), decodificarBanderas(), enmarcar(), ESTADOS, FUENTE, parsearCarga(), procesarLinea() (+7 more)

### Community 43 - "GRAPHIFY.md — Mapa de conocimiento del repositorio"
Cohesion: 0.29
Nodes (3): Solo para Claude Code, Antes de abrir archivos: usa el mapa (graphify), Instrucciones para GitHub Copilot — CanSat Zénit

### Community 46 - "Orientacion"
Cohesion: 0.15
Nodes (12): Orientacion, conRumbo_, desfaseYaw_, ix_, iy_, iz_, ki_, kp_ (+4 more)

### Community 47 - "DESIGN.md — Zénit"
Cohesion: 0.22
Nodes (9): Colors, Components, DESIGN.md — Zénit, Do's and Don'ts, Elevation & Depth, Layout, Overview, Shapes (+1 more)

### Community 48 - "Soporte de electrónica de la carga primaria"
Cohesion: 0.22
Nodes (8): Amortiguación: por qué o-rings y no ligas, Antes de imprimir: medir 4 cosas, Archivos, Armado, Cambiar medidas y volver a generar, Impresión, Soporte de electrónica de la carga primaria, Versión manual de prueba (tubo de PVC)

### Community 49 - "PRODUCT.md — Zénit"
Cohesion: 0.29
Nodes (7): Lo que no se negocia, Marca, PRODUCT.md — Zénit, Quién lo usa y dónde, Qué es, Superficies, Voz

### Community 50 - "p2_sensores.cpp"
Cohesion: 0.23
Nodes (6): calibrarMagnetometro(), Estadistica, n, suma, suma2, setup()

### Community 51 - "sonidoDespegue"
Cohesion: 0.25
Nodes (3): cerrar(), medir(), sonidoDespegue()

### Community 52 - "Parametros"
Cohesion: 0.40
Nodes (5): Parametros, cambioMinimoG, duracionReintentoMs, retardoAutogiroMs, ventanaConfirmacionMs

### Community 53 - "receptor/src/main.cpp"
Cohesion: 0.15
Nodes (3): actualizarPantalla(), loop(), procesarLineaPc()

### Community 55 - "Accion"
Cohesion: 0.29
Nodes (7): Accion, ABRIR_AUTOGIRO, ABRIR_DESACOPLE, CERRAR_DESACOPLE, CONFIRMADA, NINGUNA, NO_CONFIRMADA

### Community 56 - "v3.js"
Cohesion: 0.60
Nodes (4): anunciar(), dibujarHud(), revisarAnuncios(), siguiente()

### Community 57 - "11. Prender y apagar el servidor de la estación terrena"
Cohesion: 0.25
Nodes (7): 11. Prender y apagar el servidor de la estación terrena, Apagar un servidor que quedó prendido, «Cannot GET /v3» (o cualquier página que no abre), Prender el servidor, ¿Qué está fallando? Botón «Diagnóstico», Seguridad en la cancha, Usar otro puerto sin apagar nada

### Community 59 - "secundaria/src/main.cpp"
Cohesion: 0.42
Nodes (6): buzzer(), enviarBaliza(), led(), leerBateria(), loop(), setup()

### Community 60 - "diagnostico.js"
Cohesion: 0.39
Nodes (7): bateria(), comoHtml(), comoTxt(), concluir(), descargar(), mostrar(), reunir()

### Community 61 - "alEscuchar"
Cohesion: 0.36
Nodes (8): alEscuchar(), alRecibirLinea(), avisarEstado(), desactualizado(), difundir(), direccionesDeRed(), mensajeEstado(), usarFuente()

### Community 62 - "MaquinaEstados"
Cohesion: 0.19
Nodes (7): MaquinaEstados, alturaMax_, cuentaDesacople_, p_, tInicioCondicion_, tInicioQuieto_, test_no_desacopla_si_no_se_armo()

### Community 63 - "CanSat Zénit completo · diseño en CAD (versión 2)"
Cohesion: 0.20
Nodes (9): 1. Cumplimiento de la Guía de Misión, 2. Cómo funciona, 3. Piezas para imprimir (`salida/imprimir/`), 4. Lista de compras, 5. Peso estimado, 6. Velocidad del autogiro (8–12 m/s), 7. Armado, 8. Lo que falta comprobar con piezas reales (+1 more)

### Community 65 - "Estado"
Cohesion: 0.25
Nodes (7): Estado, ASCENSO, ATERRIZADO, CAIDA_LIBRE, DESCENSO_AUTOGIRO, PREVUELO, test_pausa_del_dron_no_es_aterrizaje()

### Community 66 - "GRAPHIFY.md — Mapa de conocimiento del repositorio"
Cohesion: 0.25
Nodes (8): Actualizar, Consultar (sin costo de API), GRAPHIFY.md — Mapa de conocimiento del repositorio, Instalarlo en tu compu (una vez por persona), Que los asistentes lo usen, Qué entra y qué no, Qué hay en `graphify-out/`, Verlo en gráfica

### Community 67 - "Protección de la electrónica · carga primaria"
Cohesion: 0.25
Nodes (7): 1. Dónde van, 2. Qué las protege, 3. Cómo se arma el sándwich de hule, 4. Lista para Electrónica: lo que de verdad se rompe, 5. Cómo se verá: colores y logo, 6. Material que se compra para esto, Protección de la electrónica · carga primaria

### Community 69 - "Geo.cpp"
Cohesion: 0.43
Nodes (4): distanciaMetros(), grad(), rad(), rumboGrados()

### Community 70 - "Entrada"
Cohesion: 0.40
Nodes (5): Entrada, altura, gTotal, t, velocidad

### Community 71 - "test_modo_prueba_techo"
Cohesion: 0.67
Nodes (3): Modo prueba (techo), test_modo_prueba_techo(), test_sin_modo_prueba_el_techo_no_desacopla()

### Community 72 - "render_cansat.py"
Cohesion: 0.22
Nodes (4): lin(), mat(), lin(), mat()

### Community 73 - "Estado"
Cohesion: 0.18
Nodes (11): Estado, archivo, crcMalos, descartadas, errorLora, lineasSd, loraOk, sdConfirmada (+3 more)

### Community 75 - "ZenitRadio.h"
Cohesion: 0.22
Nodes (6): Module, Paquete, rssi, snr, texto, PhysicalLayer

### Community 76 - "Imu"
Cohesion: 0.22
Nodes (6): Imu, ajusteMag_, bus_, dir_, magOk_, whoAmI_

### Community 77 - "LecturaImu"
Cohesion: 0.22
Nodes (9): Imu::leer(), LecturaImu, ax, ay, az, gx, gy, gz (+1 more)

### Community 80 - "ZenitSensores.h"
Cohesion: 0.29
Nodes (5): Imu::leerMag(), LecturaMag, mx, my, mz

### Community 81 - "Recibido"
Cohesion: 0.40
Nodes (4): Recibido, rssi, snr, texto

## Knowledge Gaps
- **190 isolated node(s):** `texto_`, `texto`, `dir_`, `ajusteMag_`, `bus_` (+185 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 612 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **14 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `crearCanSat()` connect `cansat3d.js` to `decisiones/README.md`?**
  _High betweenness centrality (0.290) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `SimuladorVuelo` (e.g. with `Modos de compilación` and `test_frenon_del_autogiro_no_confirma_separacion()`) actually correct?**
  _`SimuladorVuelo` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `texto_`, `texto`, `dir_` to the rest of the system?**
  _190 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Panel web: dibujo, alertas y diagnóstico (app.js)` be split into smaller, more focused modules?**
  _Cohesion score 0.06631578947368422 - nodes in this community are weakly interconnected._
- **Why does `Consecuencias` connect `decisiones/README.md` to `cansat3d.js`?**
  _High betweenness centrality (0.289) - this node is a cross-community bridge._
- **Should `Firmware de vuelo de la primaria (main.cpp)` be split into smaller, more focused modules?**
  _Cohesion score 0.08843537414965986 - nodes in this community are weakly interconnected._
- **Should `Parametros` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._