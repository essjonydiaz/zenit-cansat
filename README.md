# ZÉNIT · CanSat 2026

Software completo del satélite enlatado del equipo **Zénit (Vectorcitos)** para el concurso
CanSat 2026 del **Programa Espacial Universitario de la Universidad de Montemorelos (PEU-UM)**,
misión CASAT-FIT2026.

Un dron sube el CanSat a **450 m** y lo suelta. En la caída, la **carga primaria** mide y
transmite presión, temperatura, orientación y aceleración, calcula **velocidad y altura
máxima**, y a **200 m** suelta la **carga secundaria** y despliega el **autogiro** (8–12 m/s).
La primaria también ubica a la secundaria (**distancia y dirección**) y sigue transmitiendo
después de aterrizar.

```
 CARGA SECUNDARIA              CARGA PRIMARIA                          ESTACIÓN TERRENA
 ESP32-C3 SuperMini   ──B──>   Heltec WiFi LoRa 32 V3 (ESP32-S3)  ──T,P,E──> Heltec V3 receptor
 + RFM95W 915 MHz              + GY-91 (MPU9250 + BMP280)                 │ USB
 + GPS NEO-6M                  + GPS NEO-M8N + OpenLog (microSD)          ▼
 + pila 9 V                    + 2 servos SG90 (desacople, autogiro)    Node.js ──> panel web
                               + pila 9 V            <──── C (comandos) ────┘
```

Hardware tal como quedó en el **PDR (etapa 3)**. Pines y diferencias encontradas en el PDR:
[docs/02-conexiones.md](docs/02-conexiones.md).

## Qué hay en este repositorio

| Carpeta | Qué es | Lenguaje |
|---|---|---|
| [`firmware/primaria`](firmware/primaria) | Firmware de vuelo (Heltec V3): GY-91, filtros, máquina de estados, 2 servos, radio, OpenLog, pantalla. Incluye **modo simulación** | C++ (PlatformIO) |
| [`firmware/secundaria`](firmware/secundaria) | Baliza GPS de la carga secundaria (ESP32-C3 + RFM95W) | C++ |
| [`firmware/receptor`](firmware/receptor) | Receptor LoRa de tierra (Heltec V3, puente radio ↔ USB, pantalla con RSSI) | C++ |
| [`firmware/pruebas`](firmware/pruebas) | Programas para las pruebas P1–P6 (autodiagnóstico, GY-91, alcance, pila, OpenLog, servos) | C++ |
| [`firmware/comun`](firmware/comun) | `ZenitComun` (pines, protocolo, filtros, máquina de estados, separación, GPS, simulador; C++ puro) + `ZenitRadio`, `ZenitSensores`, `ZenitPantalla` (drivers) | C++ |
| [`estacion-terrena`](estacion-terrena) | Servidor + panel web en tiempo real (con modelo 3D), página del prototipo, simulador y registro de sesión | JavaScript (Node.js) + three.js |
| [`herramientas`](herramientas) | Análisis del vuelo para el documento RAM (gráficas + tabla) | Python |
| [`docs`](docs) | Arquitectura, conexiones, protocolo, pruebas, día del lanzamiento, requisitos | Markdown |
| `mecanica/`, `documentos/` | Lugar para los CAD/STL y los entregables (CoDR, PDR, CDR, RAM). `documentos/openlog/config.txt` va en la microSD | — |
| [`AGENTS.md`](AGENTS.md), [`graphify-out/`](graphify-out) | Guía para asistentes de IA (Claude, Copilot, Codex…) y mapa del código | — |

## Documentación

| Documento | Para qué |
|---|---|
| [docs/01-arquitectura.md](docs/01-arquitectura.md) | Cómo se conectan las placas, tareas y modos de compilación |
| [docs/02-conexiones.md](docs/02-conexiones.md) | Pines de cada placa y diferencias con el PDR |
| [docs/03-protocolo-telemetria.md](docs/03-protocolo-telemetria.md) | Formato de las tramas T, P, B, E, R, C |
| [docs/04-maquina-de-estados.md](docs/04-maquina-de-estados.md) | Fases del vuelo y secuencia de separación |
| [docs/05-plan-de-pruebas.md](docs/05-plan-de-pruebas.md) | Pruebas P1–P9 y criterios |
| [docs/06-dia-de-lanzamiento.md](docs/06-dia-de-lanzamiento.md) | Checklist del día del lanzamiento |
| [docs/07-requisitos-y-riesgos.md](docs/07-requisitos-y-riesgos.md) | Matriz de requisitos, riesgos y pendientes |
| [docs/08-git-y-github.md](docs/08-git-y-github.md) | Trabajo en equipo con Git |
| [docs/09-guia-primera-prueba.md](docs/09-guia-primera-prueba.md) | Dejar la PC lista y primera prueba con hardware |
| [docs/10-pendientes-del-equipo.md](docs/10-pendientes-del-equipo.md) | Pendientes y preguntas al equipo |
| [docs/11-servidor-local.md](docs/11-servidor-local.md) | Prender y apagar el servidor del panel, y qué hacer con «Cannot GET» |
| [docs/decisiones/](docs/decisiones/README.md) | Por qué se decidió cada cosa (ADR) |
| [DESIGN.md](DESIGN.md) · [PRODUCT.md](PRODUCT.md) | Sistema visual de la interfaz y a quién sirve |
| [AGENTS.md](AGENTS.md) · [CLAUDE.md](CLAUDE.md) · [GRAPHIFY.md](GRAPHIFY.md) | Reglas para asistentes de IA y uso del grafo de conocimiento |

## Empezar (Windows)

### 1. Instalar una sola vez

1. **[Visual Studio Code](https://code.visualstudio.com/)**
2. Extensión **PlatformIO IDE** (en VS Code: `Ctrl+Shift+X` → buscar *PlatformIO IDE* → Install).
   No hace falta Arduino IDE: PlatformIO descarga solo el compilador y las librerías.
3. **Driver USB** de la Heltec V3: [CP210x](https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers).
   El ESP32-C3 SuperMini usa el USB nativo (Windows 10/11 no necesita driver).
4. **[Node.js LTS](https://nodejs.org/)** (para la estación terrena).
5. **[Python 3](https://www.python.org/downloads/)** (para el análisis; marcar *Add to PATH*).
6. **[Git](https://git-scm.com/download/win)**.

> **Guía paso a paso** para dejar la PC lista y hacer la primera prueba con el hardware:
> [docs/09-guia-primera-prueba.md](docs/09-guia-primera-prueba.md).

### 2. Abrir el proyecto

`Archivo → Abrir área de trabajo desde archivo…` → **`zenit.code-workspace`**.
PlatformIO detecta los cuatro proyectos de firmware (primaria, secundaria, receptor, pruebas).

### 3. Probar TODO sin hardware (5 minutos)

```powershell
cd estacion-terrena
npm install
npm run simular
```
Abrir **http://localhost:3000** → se ve un vuelo completo: ascenso, liberación, desacople a
200 m, autogiro, aterrizaje, con el CanSat en 3D siguiendo la orientación. Se pueden probar
los botones de comandos.

Para presentar el proyecto: **http://localhost:3000/prototipo.html**, un recorrido 3D con
scroll (portada de vidrio que se rompe, vista por dentro, desacople y autogiro). Todo
funciona sin internet.
    
Deja esa terminal abierta mientras usas el panel. Para detenerlo y liberar el puerto,
presiona **Ctrl+C** en esa misma terminal. Si aparece «puerto 3000 ocupado», ya hay
otro proceso escuchando: si es la estación, basta abrir la dirección y recargar con
**Ctrl+F5**. También puedes ejecutar `npm run simular -- --http 3001` y abrir
**http://localhost:3001**.

Si cerraste la terminal pero quedó un proceso en segundo plano, identifica su PID
en PowerShell con `Get-NetTCPConnection -LocalPort 3000 -State Listen` y consulta
`Get-Process -Id <PID>`. Solo cuando hayas confirmado que es la instancia que quieres
cerrar, ejecuta `Stop-Process -Id <PID>` (reemplaza `<PID>` por el número real).

### 4. Con la Heltec V3 sola (sin sensores)

En la barra de PlatformIO elegir **`env:primaria_sim`** → *Upload* → *Monitor*. La placa
ejecuta el firmware de vuelo real con un vuelo simulado (y lo transmite por LoRa si tiene la
antena puesta). Conectando la estación terrena a ese puerto (`npm start` y elegir el COM en el
panel) se ve el vuelo "en vivo" desde la placa. **Nunca encender la Heltec sin su antena.**

### 5. Con el hardware armado

| Placa | Entorno de PlatformIO |
|---|---|
| Carga primaria (Heltec V3) | `firmware/primaria` → `env:primaria` |
| Carga secundaria (ESP32-C3) | `firmware/secundaria` → `env:secundaria` |
| Receptor de tierra (Heltec V3) | `firmware/receptor` → `env:receptor` |
| Pruebas | `firmware/pruebas` → `env:p1_autodiagnostico`, `env:p2_sensores`, … |

Primero `env:p1_autodiagnostico`: dice PASA/FALLA para cada módulo (en el monitor y en la
pantalla). Conexiones en [docs/02-conexiones.md](docs/02-conexiones.md). Antes de volar:
`env:p2_sensores` para calibrar la brújula y `env:p6_servos` para los ángulos de los servos.

### 6. Después del vuelo (documento RAM, máximo 7 h)

```powershell
pip install -r herramientas/requirements.txt
python herramientas/analisis_vuelo.py estacion-terrena/logs/sesion_XXXX_telemetria.csv
# o con el archivo del OpenLog (microSD):
python herramientas/analisis_vuelo.py E:/LOG00001.TXT
```
Genera `resumen.md` con la tabla de resultados (altura máxima, velocidades, desacople,
autogiro, transmisión post-aterrizaje) y las gráficas. Para practicar:
`python herramientas/analisis_vuelo.py herramientas/ejemplos/VUELO_SIMULADO.CSV`.

## Cómo cumple la misión

| Requisito de la guía | Dónde se resuelve |
|---|---|
| Transmitir presión, temperatura, orientación y aceleración en tiempo real | Trama `T` a 2 Hz (PDR: ≥ 1 Hz) — `firmware/primaria/src/main.cpp` |
| Calcular velocidad en todo el trayecto | Filtro complementario barómetro + acelerómetro — `Filtros.cpp` |
| Calcular altura máxima | Máquina de estados — `MaquinaEstados.cpp` |
| Desacople + autogiro a 200 m | Máquina de estados + secuencia de 2 servos (desacople → confirmación con IMU → autogiro) — `Separacion.cpp` |
| Descenso con autogiro entre 8 y 12 m/s | Se mide y se muestra en vivo; el ajuste es mecánico (aspas) |
| Distancia y dirección de la secundaria | Baliza GPS + Haversine — `Geo.cpp`, trama `P` |
| Transmitir ≥ 10 s tras aterrizar | Detección de aterrizaje + evento `POST_ATERRIZAJE_OK` |
| Estación terrena en tiempo real | `estacion-terrena/` |
| Alcance ≥ 250 m (guía) / ≥ 1 km (PDR) | LoRa 915 MHz SF7 250 kHz 20 dBm — prueba `p3_alcance_lora` |

Matriz completa, riesgos y pendientes: [docs/07-requisitos-y-riesgos.md](docs/07-requisitos-y-riesgos.md).

## Estado verificado

- La lógica (protocolo, filtros, máquina de estados, separación con 2 servos, brújula, GPS,
  tiempo en el aire de LoRa) tiene **16 pruebas automáticas** (`pio test -e native` en
  `firmware/primaria`), incluido un vuelo simulado completo.
- Los 3 firmwares y los 6 programas de prueba **compilan sin advertencias** para sus placas
  reales: Heltec WiFi LoRa 32 V3 (ESP32-S3) y ESP32-C3 (núcleo Arduino-ESP32 2.0.17,
  RadioLib 7.8).
- El firmware de la primaria en modo simulación se **ejecutó en un ESP32-S3 emulado (QEMU)**:
  liberación a 449 m, desacople automático a 198 m, separación confirmada por el IMU,
  autogiro a 183 m, −10 m/s con autogiro y 10 s de transmisión tras aterrizar.
- La estación terrena tiene 8 pruebas (`npm test`), incluidas tramas reales de ese firmware
  emulado (verifica el orden DESACOPLE → SEPARACION → AUTOGIRO).

Lo que **falta validar con hardware**: alcance a 1 km con la antena dentro del cilindro (y
SX1262 ↔ RFM95W), ángulos de los servos, calibración de la brújula, velocidad real del
autogiro y autonomía de la pila. Para medir la pila hay que agregar el divisor 100k/33k que
no está en el PDR.

## Equipo

| Integrante | Carrera | Áreas |
|---|---|---|
| Araceli Jimenez Perez | IETE | Electrónica · Gestión de la misión |
| Diego Francisco Lopez Lopez | IETE | Electrónica · Mecánica |
| Javier Alexis Aguire Vasquez | IIS | Pruebas · Gestión de la misión |
| Esli Yatziri Muñoz Echeverria | ISC | Mecánica · Integración |
| Hiday Misael Servin Riuz | ISC | Control y programación · Pruebas |
| Jonathan Hiram Clable Garcia | ISC | Control y programación · Ingeniería de sistemas |
| Jonathan Saul Torrez Diaz | ISC | Control y programación · Ingeniería de sistemas |

<sub>Nombres y áreas tal como aparecen en el CoDR (diapositiva 4); corríjanlos aquí si hace falta.</sub>

Cómo trabajar en equipo con Git: [docs/08-git-y-github.md](docs/08-git-y-github.md).
