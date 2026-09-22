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
 CARGA SECUNDARIA            CARGA PRIMARIA                       ESTACIÓN TERRENA
 ESP32 + GPS + LoRa   ──B──> ESP32 + BMP280 + MPU6050   ──T,P,E──> Receptor LoRa (ESP32)
 (baliza de posición)        + LoRa + microSD + servo               │ USB
                             + GPS                                  ▼
                                    <────── C (comandos) ───── Node.js ──> panel web
```

## Qué hay en este repositorio

| Carpeta | Qué es | Lenguaje |
|---|---|---|
| [`firmware/primaria`](firmware/primaria) | Firmware de vuelo: sensores, filtros, máquina de estados, desacople, radio, microSD. Incluye **modo simulación** | C++ (PlatformIO) |
| [`firmware/secundaria`](firmware/secundaria) | Baliza GPS de la carga secundaria | C++ |
| [`firmware/receptor`](firmware/receptor) | Receptor LoRa de tierra (puente radio ↔ USB) | C++ |
| [`firmware/pruebas`](firmware/pruebas) | Programas para las pruebas P1–P6 del CoDR | C++ |
| [`firmware/comun`](firmware/comun/ZenitComun) | Librería compartida: pines, protocolo, filtros, máquina de estados, GPS, simulador | C++ puro |
| [`estacion-terrena`](estacion-terrena) | Servidor + panel web en tiempo real, simulador y registro de sesión | JavaScript (Node.js) |
| [`herramientas`](herramientas) | Análisis del vuelo para el documento RAM (gráficas + tabla) | Python |
| [`docs`](docs) | Arquitectura, conexiones, protocolo, pruebas, día del lanzamiento, requisitos | Markdown |
| `mecanica/`, `documentos/` | Lugar para los CAD/STL y los entregables (CoDR, PDR, CDR, RAM) | — |

## Empezar (Windows)

### 1. Instalar una sola vez

1. **[Visual Studio Code](https://code.visualstudio.com/)**
2. Extensión **PlatformIO IDE** (en VS Code: `Ctrl+Shift+X` → buscar *PlatformIO IDE* → Install).
   No hace falta Arduino IDE: PlatformIO descarga solo el compilador y las librerías.
3. **Driver USB** de la placa: [CP210x](https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers)
   o [CH340](https://www.wch-ic.com/downloads/CH341SER_EXE.html) (depende del chip junto al conector USB del ESP32).
4. **[Node.js LTS](https://nodejs.org/)** (para la estación terrena).
5. **[Python 3](https://www.python.org/downloads/)** (para el análisis; marcar *Add to PATH*).
6. **[Git](https://git-scm.com/download/win)**.

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
200 m, autogiro, aterrizaje. Se pueden probar los botones de comandos.

### 4. Con un ESP32 solo (sin sensores)

En la barra de PlatformIO elegir **`env:primaria_sim`** → *Upload* → *Monitor*. La placa
ejecuta el firmware de vuelo real con un vuelo simulado. Conectando la estación terrena a ese
puerto (`npm start` y elegir el COM en el panel) se ve el vuelo "en vivo" desde el ESP32.

### 5. Con el hardware armado

| Placa | Entorno de PlatformIO |
|---|---|
| Carga primaria | `firmware/primaria` → `env:primaria` |
| Carga secundaria | `firmware/secundaria` → `env:secundaria` |
| Receptor de tierra | `firmware/receptor` → `env:receptor` |
| Pruebas | `firmware/pruebas` → `env:p1_autodiagnostico`, `env:p2_sensores`, … |

Primero `env:p1_autodiagnostico`: dice PASA/FALLA para cada módulo. Conexiones en
[docs/02-conexiones.md](docs/02-conexiones.md).

### 6. Después del vuelo (documento RAM, máximo 7 h)

```powershell
pip install -r herramientas/requirements.txt
python herramientas/analisis_vuelo.py estacion-terrena/logs/sesion_XXXX_telemetria.csv
# o con el archivo de la microSD:
python herramientas/analisis_vuelo.py E:/VUELO_000.CSV
```
Genera `resumen.md` con la tabla de resultados (altura máxima, velocidades, desacople,
autogiro, transmisión post-aterrizaje) y las gráficas. Para practicar:
`python herramientas/analisis_vuelo.py herramientas/ejemplos/VUELO_SIMULADO.CSV`.

## Cómo cumple la misión

| Requisito de la guía | Dónde se resuelve |
|---|---|
| Transmitir presión, temperatura, orientación y aceleración en tiempo real | Trama `T` a 4 Hz — `firmware/primaria/src/main.cpp` |
| Calcular velocidad en todo el trayecto | Filtro complementario barómetro + acelerómetro — `Filtros.cpp` |
| Calcular altura máxima | Máquina de estados — `MaquinaEstados.cpp` |
| Desacople + autogiro a 200 m | Máquina de estados + servo, con protección contra disparos falsos |
| Descenso con autogiro entre 8 y 12 m/s | Se mide y se muestra en vivo; el ajuste es mecánico (aspas) |
| Distancia y dirección de la secundaria | Baliza GPS + Haversine — `Geo.cpp`, trama `P` |
| Transmitir ≥ 10 s tras aterrizar | Detección de aterrizaje + evento `POST_ATERRIZAJE_OK` |
| Estación terrena en tiempo real | `estacion-terrena/` |
| Alcance ≥ 250 m | LoRa 433 MHz SF7 — prueba `p3_alcance_lora` |

Matriz completa, riesgos y pendientes: [docs/07-requisitos-y-riesgos.md](docs/07-requisitos-y-riesgos.md).

## Estado verificado

- La lógica (protocolo, filtros, máquina de estados, GPS) tiene **9 pruebas automáticas**
  (`pio test -e native` en `firmware/primaria`) incluyendo un vuelo simulado completo.
- Los 3 firmwares y los 6 programas de prueba **compilan sin advertencias** para ESP32
  (núcleo Arduino-ESP32 2.0.17).
- El firmware de la primaria en modo simulación se **ejecutó en un ESP32 emulado (QEMU)**:
  detectó la liberación a 449 m, desacopló solo a 198 m, midió −10.0 m/s con autogiro y
  confirmó 10 s de transmisión tras aterrizar.
- La estación terrena tiene 6 pruebas (`npm test`), una de ellas con tramas reales del firmware.

Lo que **falta validar con hardware**: pines reales, alcance LoRa con la antena dentro del
cilindro, ángulos del servo, velocidad real del autogiro y autonomía de la pila.

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
