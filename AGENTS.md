# AGENTS.md — Guía para asistentes de IA (Claude Code, Copilot, Codex, Cursor…)

Proyecto: software del CanSat **Zénit** (concurso CanSat 2026, PEU-UM, misión CASAT-FIT2026).
Idioma del proyecto: **español** (código, comentarios, commits y respuestas).

## 1. Ahorra tokens: lee el mapa antes que el código

1. **`graphify-out/GRAPH_REPORT.md`** (≈10 KB): comunidades, nodos centrales y conexiones del
   código. Léelo primero en vez de abrir archivos al azar.
2. Para preguntas concretas usa el grafo, no `grep` por todo el repo:
   ```bash
   graphify query "¿dónde se decide el desacople?" --budget 800
   graphify explain "Secuencia"
   graphify path "procesarComando()" "iniciarSeparacion()"
   ```
3. Después abre **solo** los archivos que el grafo señala (las líneas vienen en `loc=`).
4. Si cambiaste código, actualiza el mapa (sin costo de API): `graphify update .`
   (si cambió mucho: `graphify update . --force` y `graphify cluster-only .`).
   Qué entra y qué no, y qué conceptos debe conectar: **[GRAPHIFY.md](GRAPHIFY.md)**.

## 2. Qué es cada cosa

| Ruta | Qué hay | Lenguaje |
|---|---|---|
| `firmware/primaria/` | Vuelo: Heltec WiFi LoRa 32 V3 (ESP32-S3), GY-91, NEO-M8N, OpenLog, 2 servos, OLED | C++ / PlatformIO |
| `firmware/secundaria/` | Baliza: ESP32-C3 SuperMini + RFM95W + NEO-6M | C++ |
| `firmware/receptor/` | Receptor de tierra: Heltec V3 por USB (puente radio ↔ PC) | C++ |
| `firmware/pruebas/` | P1 autodiagnóstico, P2 GY-91, P3 alcance, P4 pila, P5 OpenLog, P6 servos | C++ |
| `firmware/comun/ZenitComun` | **C++ puro** (sin Arduino): pines, radio, protocolo, filtros, máquina de estados, separación, Haversine, UBX, tiempo en el aire, simulador | C++ |
| `firmware/comun/ZenitRadio` · `ZenitSensores` · `ZenitPantalla` | Drivers solo-ESP32 (RadioLib, GY-91, OLED) | C++ |
| `estacion-terrena/` | Node.js: `server.js` + `src/` (protocolo, simulador, registro) + `public/` (panel web) | JavaScript |
| `estacion-terrena/public/` | En `/` se abre primero el prototipo; su «Abrir panel» y `/panel` llevan a la 3.ª edición (la predeterminada del panel); las tres se cambian con el selector «Edición 1 · 2 · 3» (`.ediciones` en `estilos.css`). Primera edición en `/v1`: `index.html` · `app.js` · `estilos.css`. Segunda edición en `/v2`: `v2.html` · `v2.css` · `v2.js` (se carga después de `app.js` y solo agrega o corrige encima; misma lógica y mismos IDs). Tercera edición «modo misión» en `/v3`: `v3.html` · `v3.css` · `v3.js` (HUD, igual que la v2 sobre `app.js`) · `mision3d.js` (vuelo en 3D que solo lee `window.zenit.estado()`). Compartido: `base.css` (tokens + intro) · `intro.js` (logo al inicio) · `cansat3d.js` (modelo 3D). `visor3d.js` (orientación en vivo) · `diagnostico.js` (botón «Diagnóstico» de la consola: qué falla y qué revisar, en .txt o PDF). Prototipo: `prototipo.html/.css/.js` | HTML/CSS/JS + three.js |
| `herramientas/analisis_vuelo.py` | Tabla y gráficas para el documento RAM | Python |
| `docs/` | 01 arquitectura · 02 conexiones · 03 protocolo · 04 máquina de estados · 05 pruebas · 06 lanzamiento · 07 requisitos/riesgos · 08 git · 09 primera prueba · 10 pendientes · 11 servidor local | Markdown |
| `docs/decisiones/` | ADR: el *por qué* de cada decisión (recursos locales, sistema visual, modelo 3D) | Markdown |
| `DESIGN.md` · `PRODUCT.md` | Sistema visual (formato DESIGN.md de Google) y verdad del producto (quién usa la interfaz, dónde, qué no se negocia) | Markdown |

Valores de la misión: liberación a **450 m**, desacople + autogiro a **200 m**, descenso
**8–12 m/s**, transmitir **≥ 10 s** tras aterrizar, **pila de 9 V**, **≤ 600 g**, 2 huevos de 65 g,
LoRa **915 MHz**, alcance **≥ 1 km** (PDR).

## 3. Comandos

| Qué | Comando (desde la carpeta indicada) |
|---|---|
| Pruebas de la lógica (16) | `firmware/primaria`: `pio test -e native` |
| Compilar | `pio run -d firmware/primaria -e primaria -e primaria_sim` · `pio run -d firmware/secundaria` · `pio run -d firmware/receptor` · `pio run -d firmware/pruebas` |
| Estación terrena | `estacion-terrena`: `npm install` · `npm test` (11) · `npm run simular` → http://localhost:3000 (prototipo 3D) · `/panel` (panel, 3.ª edición «modo misión») · `/v1` y `/v2` (1.ª y 2.ª edición). Detalle: `docs/11-servidor-local.md` |
| Análisis | `python herramientas/analisis_vuelo.py herramientas/ejemplos/VUELO_SIMULADO.CSV` |

GitHub Actions (`.github/workflows/ci.yml`) corre todo esto en cada push.

## 4. Reglas que NO se pueden romper

1. **Pines**: solo en `firmware/comun/ZenitComun/src/Pines.h` (+ tabla en `docs/02-conexiones.md`).
   Heltec V3: GPIO 8–14 son del radio, 17/18/21 de la OLED, 19/20/43/44 del USB, **22–25 no
   existen**, 26/33–38 no usar, 0/45/46 son de arranque. ESP32-C3: solo GPIO 0–10, 20, 21.
2. **Radio**: los parámetros viven en `RadioConfig.h` y deben ser iguales en las 3 placas
   (SX1262 y RFM95W solo se entienden así). Después de cambiarlos, recompilar las tres.
3. **Protocolo**: `$TIPO,...*HH` (XOR). Si cambias un campo en C++ (`main.cpp`,
   `Protocolo.cpp`) cámbialo también en `estacion-terrena/src/protocolo.js` y en
   `docs/03-protocolo-telemetria.md`. La prueba `protocolo.test.js` usa tramas reales del
   firmware (`test/datos/salida_firmware_sim.txt`).
4. **Bits de `flags`**: el orden de `banderas()` en `firmware/primaria/src/main.cpp` y de
   `BANDERAS` en `protocolo.js` debe ser idéntico.
5. **C++11** (núcleo Arduino-ESP32 2.0.17 usa `-std=gnu++11`): nada de `auto` en parámetros,
   variables `inline`, ni inicialización agregada de structs con valores por defecto.
6. **Nada de punto flotante en constructores de objetos globales** en el ESP32-S3 (reinicio en
   bucle por "Coprocessor exception"). Usa constructores `constexpr` (ver `Filtros.h`).
7. `ZenitComun` no puede incluir `Arduino.h` ni librerías de hardware: se prueba en la PC.
8. El `loop()` de la primaria corre a **50 Hz**: no meter `delay()` ni escrituras lentas; la
   radio y el registro van por las colas de `Comunicaciones.cpp` (tarea en el núcleo 0).
9. Uso del canal LoRa ≈ 30 %. No subir la frecuencia de tramas sin recalcular con
   `aire::tiempoEnAireMs` y ajustar `test_tiempo_en_aire`.
10. Seguridad de la misión: el desacople solo se arma después de pasar 250 m; el autogiro se
    abre **siempre** 400 ms después del desacople. No quitar esas protecciones.
11. **Sin internet en la cancha**: la interfaz no usa CDNs ni Google Fonts. three.js
    (0.169.0 exacta), fuentes y Chart.js se sirven desde `node_modules` vía `/vendor` en
    `server.js` (ADR 0001).
12. **La telemetría manda** en el panel: la intro del logo sale una vez por pestaña y se
    salta; el 3D es opcional (sin WebGL queda el horizonte SVG); `visor3d.js` solo lee
    `window.zenit.estado()`. Los IDs de `index.html` los usa `app.js`. Reglas visuales y
    tokens: `DESIGN.md` + `base.css` (cámbialos juntos).

## 5. Antes de dar algo por terminado

- `pio test -e native` y `npm test` en verde; los entornos tocados compilan **sin advertencias**.
- Si cambió el flujo de vuelo: subir `env:primaria_sim` (o el emulador) y revisar que salgan
  `ASCENSO → LIBERACION → DESACOPLE → SEPARACION → AUTOGIRO → ATERRIZAJE → POST_ATERRIZAJE_OK`.
- Si cambió la interfaz: `npm run simular` y revisar `/` y `/prototipo.html` en escritorio y a
  390 px (sin scroll horizontal, con y sin "reducir movimiento").
- Actualizar el doc correspondiente de `docs/` (o un ADR en `docs/decisiones/`) y `graphify update .`.
- Commits en español, en presente: "Agrega…", "Corrige…", "Ajusta…".

## 6. Lo que todavía depende del hardware

Alcance real a 1 km (antena dentro), interoperabilidad SX1262 ↔ RFM95W en campo, ángulos de
los servos (P6), centros de la brújula (P2), velocidad del autogiro (P5), autonomía (P4) y el
divisor de la pila (100k/33k a GPIO6) que no aparece en el PDR. Diferencias del PDR: tabla en
`docs/02-conexiones.md`.
