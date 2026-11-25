# 9. Guía: dejar todo listo y hacer la primera prueba con el hardware

Esta guía tiene dos partes:

- **Parte A — Hoy, sin hardware.** Preparar la computadora y VS Code para que, cuando
  electrónica entregue las placas, solo sea conectar y subir. Toma ~1 hora (la mayor parte es
  esperar descargas).
- **Parte B — El día que entregan la electrónica.** El orden exacto de pruebas, de lo más
  simple a lo más completo, para encontrar fallas una por una.

> El código ya está adaptado a los componentes del PDR. Lo que falta es preparar la PC y
> probar con el hardware real.

---

## Parte A — Preparar la computadora (hacer HOY)

### A1. Programas que deben estar instalados

Abre una terminal de PowerShell (o la terminal de VS Code con `Ctrl+ñ`) y revisa cada uno:

| Programa | Para qué | Comprobar con | Si falta |
|---|---|---|---|
| Visual Studio Code | Editor | — | https://code.visualstudio.com |
| Git | Subir y bajar cambios | `git --version` | https://git-scm.com/download/win |
| Node.js LTS (18.17 o más nuevo) | Estación terrena | `node --version` | https://nodejs.org |
| Python 3.10+ | Análisis del vuelo y PlatformIO | `python --version` | https://www.python.org (marcar *Add to PATH*) |
| Driver **CP210x** | Que Windows vea la Heltec V3 | Administrador de dispositivos → *Puertos (COM y LPT)* | https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers |

El **ESP32-C3 SuperMini** (secundaria) no necesita driver: usa el USB nativo y Windows 10/11
lo reconoce solo.

### A2. Extensiones de VS Code

1. Abre VS Code → `Archivo → Abrir área de trabajo desde archivo…` →
   `C:\Users\jona_\Documents\zenit-cansat\zenit.code-workspace`.
2. VS Code mostrará abajo a la derecha *"Este espacio de trabajo tiene extensiones
   recomendadas"* → **Instalar todas**. Son:
   - **PlatformIO IDE** (compila y sube el firmware)
   - **C/C++** (autocompletado del código C++)
   - **Python**
   - **Markdown Preview Mermaid** (para ver los diagramas de `docs/`)
3. La primera vez que se activa PlatformIO tarda varios minutos (instala su propio Python y
   herramientas). Espera a que la barra de abajo deje de decir *"PlatformIO: Installing…"* y
   **reinicia VS Code**.

Al terminar debe aparecer el ícono de la **hormiga** (PlatformIO) en la barra izquierda.

### A3. Descargar TODO lo de PlatformIO ahora (importante)

La primera compilación de cada placa descarga el compilador del ESP32-S3, el del ESP32-C3 y
las librerías (RadioLib, Adafruit, OLED, etc.): **cerca de 1 GB**. Hazlo hoy con buen
internet; en la cancha o en el laboratorio puede no haber.

Opción con clics: hormiga → **PROJECT TASKS** → en cada carpeta (`firmware · primaria`,
`firmware · secundaria`, `firmware · receptor`, `firmware · pruebas`) → abrir el entorno →
**Build**.

Opción con terminal (más rápido): en la terminal de VS Code, desde la carpeta `zenit-cansat`:

```powershell
pio run -d firmware/primaria -e primaria -e primaria_sim
pio run -d firmware/secundaria
pio run -d firmware/receptor
pio run -d firmware/pruebas
```

> Si dice que `pio` no se reconoce: abre la terminal **desde PlatformIO** (hormiga →
> *Quick Access* → *Miscellaneous* → **New Terminal**), ahí sí funciona.

Cada uno debe terminar con **`SUCCESS`** en verde. Si alguno falla, copia el error completo
y pásaselo a Claude o al equipo.

### A4. Estación terrena

```powershell
cd estacion-terrena
npm install
npm test
npm run simular
```

- `npm test` debe terminar con `# pass 8` y `# fail 0`.
- `npm run simular` → abre **http://localhost:3000/panel** y mira un vuelo simulado completo
  (eventos: Ascenso, Liberación, Desacople, Autogiro, Aterrizaje). Detenlo con `Ctrl+C`.

### A5. Análisis del vuelo (Python)

```powershell
cd ..
pip install -r herramientas/requirements.txt
python herramientas/analisis_vuelo.py herramientas/ejemplos/VUELO_SIMULADO.CSV --salida prueba_resultados
```

Debe crear la carpeta `prueba_resultados` con `resumen.md` y gráficas (puedes borrarla
después; no se sube a GitHub).

### A6. Subir los cambios a GitHub

```powershell
git status          # debe decir "working tree clean"
git push
```

Así tus compañeros (y la PC del laboratorio) tienen la misma versión.

### A7. Lista de material para el día de la prueba

- [ ] 2 cables **USB-C de datos** (algunos cables solo cargan: si Windows no hace ningún
      sonido al conectar, cambia de cable).
- [ ] Antena IPEX de 915 MHz para la primaria y antena **SMA** de 915 MHz para el receptor.
- [ ] Antena de 915 MHz para el RFM95W de la secundaria.
- [ ] Multímetro.
- [ ] 2 pilas de 9 V nuevas.
- [ ] Laptop cargada con todo lo de esta Parte A ya hecho.

---

## Parte B — Primera prueba con el hardware (en este orden)

**Regla de oro: nunca encender una placa LoRa sin su antena puesta.** Transmitir sin antena
puede dañar el radio.

### Cómo se sube un programa (sirve para todos los pasos)

1. Conecta la placa por USB.
2. En la barra azul de abajo de VS Code, haz clic en el **entorno** (dice algo como
   `env:primaria (primaria)`) y elige el que indica el paso. También se puede desde la
   hormiga → *PROJECT TASKS* → carpeta → entorno.
3. Clic en la **flecha →** de la barra azul (*Upload*). PlatformIO encuentra el puerto COM solo.
4. Clic en el **enchufe** de la barra azul (*Serial Monitor*) para ver lo que imprime la placa
   (115200 baudios). Ciérralo (`Ctrl+C` o el bote de basura) antes de volver a subir o de
   abrir la estación terrena: **un puerto COM solo lo puede usar un programa a la vez**.

Si el *Upload* falla con `Failed to connect`:
- **Heltec V3**: mantén presionado el botón **PRG**, presiona y suelta **RST**, suelta PRG y
  vuelve a dar Upload.
- **ESP32-C3 SuperMini**: mantén presionado **BOOT**, conecta el USB (o presiona RESET),
  suelta BOOT y vuelve a dar Upload.

### Paso 1 — Las dos Heltec solas (solo con antena, sin nada más conectado)

Objetivo: comprobar que los radios funcionan antes de cablear sensores.

1. Heltec del **receptor**: `firmware · receptor` → `env:receptor` → Upload. La pantalla
   debe decir `ZENIT receptor` y `915.0 MHz SF7 BW250`.
2. Heltec de la **primaria**: `firmware · primaria` → **`env:primaria_sim`** → Upload.
   Desconéctala de la PC y aliméntala con un cargador USB o power bank.
3. Conecta el receptor a la laptop, cierra cualquier monitor serie y corre:
   ```powershell
   cd estacion-terrena
   npm start
   ```
   Abre http://localhost:3000/panel → elige el puerto COM del receptor → **Conectar**.
4. Debe verse el vuelo simulado **llegando por radio** (Radio en verde con su RSSI en dBm).
   La pantalla del receptor cuenta los paquetes `RX:`.

Si el receptor dice `SIN RADIO` o el panel *"Sin módulo LoRa"*: revisa que la antena esté
bien enroscada y reinicia la placa.

### Paso 2 — Revisar la alimentación (antes de conectar la placa a la pila)

Con el multímetro, **sin la Heltec conectada**:

| Punto | Debe medir |
|---|---|
| Pila nueva | 9.0–9.6 V |
| Salida del MP1584EN | **5.0 V** (ajustar el tornillito antes; de fábrica puede dar más de 10 V y quemar todo) |
| Salida del AMS1117 | 3.3 V |
| 5 V contra GND y 3.3 V contra GND | sin corto (en modo continuidad no debe pitar) |

Solo si todo está bien, conecta la Heltec (por su pin **5V**, ver `docs/02-conexiones.md`).

### Paso 3 — Autodiagnóstico de la primaria (P1)

`firmware · pruebas` → `env:p1_autodiagnostico` → Upload → Serial Monitor.

Cada 10 s imprime una lista como esta (también la resume en la pantalla de la placa):

```
  [PASA ] Barometro BMP280/BME280   BMP280 0x76: 96300 Pa, 25.1 C
  [PASA ] IMU MPU9250               MPU9250 (WHO_AM_I 0x71): |a| = 1.00 g
  [PASA ] Magnetometro AK8963       28 / -3 / -40 uT
  [PASA ] LoRa SX1262               SX1262 915.0 MHz, ok
  [PASA ] GPS NEO-M8N (UART1)       1032 caracteres en 1.5 s
  [PASA ] Pila 9 V                  pin=2.30 V -> pila ~9.27 V
```

Si algo falla, al final aparece la lista **QUE ARREGLAR (en este orden)** con la
instrucción concreta para cada pieza, por ejemplo:

```
  ---------------- QUE ARREGLAR (en este orden) ----------------
  1) GPS NEO-M8N: no llega nada. 1) el GPS debe tener su LED encendido/parpadeando (si no: VCC y
     GND). 2) el TX del GPS va a GPIO5 (si esta en GPIO6 estan invertidos).
  2) Pila 9 V: no hay divisor: soldar 100k de la pila a GPIO7 y 33k de GPIO7 a GND.
```

Esa lista es lo que le pasas a electrónica. Se arregla una cosa a la vez y la prueba se
repite sola cada 10 s hasta que todo diga PASA. La pantalla de la placa muestra el resumen.
Los servos no se prueban aquí (para no soltar nada por accidente): eso es el Paso 6. Notas:
- *Magnetómetro: no hay* con un GY-91 que trae **MPU6500** es normal (no trae brújula); todo lo
  demás funciona.
- *Pila 9 V sin divisor*: faltan las resistencias 100k/33k hacia GPIO7 (no está en el PDR).
- El GPS adentro de un edificio puede no mandar posición, pero sí debe mandar caracteres.

### Paso 4 — La secundaria

`firmware · secundaria` → `env:secundaria` → Upload → Serial Monitor. Debe imprimir:

```
INFO,ZENIT_SECUNDARIA,lora=1,chip=SX1276,err=0(ok),freq=915.0
USB,$B,1,2513,0.000000,0.000000,0,0,0.00*..
```

Con la estación terrena conectada al receptor (Paso 1), la **Carga secundaria** de la cadena
de conexión debe ponerse en verde ("baliza hace X s"). Esto confirma que el **RFM95W** y el
**SX1262** se entienden.

### Paso 5 — Calibrar los sensores (P2)

`env:p2_sensores` → Upload → Serial Monitor. Sigue las instrucciones de la pantalla:
1. 10 s **quieto** → dice PASA/REVISAR para el ruido.
2. 30 s **girándolo en todas direcciones** → imprime 3 líneas `#define MAG_CENTRO_...`.
   Cópialas a `firmware/primaria/include/config.h` (reemplazando las que dicen `0.0f`).

### Paso 6 — Servos (P6)

`env:p6_servos` → Upload → Serial Monitor. Escribe y presiona Enter:
- `d` (servo de desacople) o `g` (servo del autogiro).
- Prueba ángulos (`10`, `90`, `120`…) hasta encontrar **cerrado** y **abierto** de cada
  mecanismo, y cópialos a `config.h` (`DESACOPLE_ANGULO_*`, `AUTOGIRO_ANGULO_*`).
- `ciclo` → 20 aperturas seguidas (con la secundaria colgando: deben ser 20 de 20).
- `secuencia` → lo mismo que en vuelo (desacople y 400 ms después el autogiro).

### Paso 7 — Firmware de vuelo

`firmware · primaria` → **`env:primaria`** (¡no `primaria_sim`!) → Upload.
Con la estación terrena conectada debe salir el evento `ARRANQUE` con
`baro=1 imu=1 mag=1 lora=1 sd=1` y los 6 mosaicos de *Salud de subsistemas* en verde.
Prueba los botones **Ping**, **Probar buzzer** y **Calibrar en tierra**.

Prueba en la mano: sube la primaria por una escalera (unos 3 m) y mira que la altitud del
panel suba ~3 m y regrese a ~0.

Después siguen las pruebas de campo (alcance a 1 km, autonomía de la pila, caídas del
autogiro): están en [05-plan-de-pruebas.md](05-plan-de-pruebas.md).

---

## Problemas comunes

| Síntoma | Causa probable | Solución |
|---|---|---|
| No aparece ningún puerto COM | Cable de solo carga o falta el driver CP210x | Otro cable USB-C; instalar el driver (A1) |
| `Failed to connect to ESP32` al subir | La placa no entró en modo de programación | Botones PRG+RST (Heltec) o BOOT (C3), ver arriba |
| `Access is denied` / puerto ocupado | El Serial Monitor o la estación terrena tienen el puerto abierto | Cerrar el monitor o detener `npm start` y volver a subir |
| La placa se reinicia en bucle | Fuente débil o corto | Medir 5 V con la carga conectada; revisar soldaduras |
| `LoRa: FALLA` / `no se encontro el chip` | Antena o placa dañada, firmware equivocado | Revisar antena; subir de nuevo el entorno correcto |
| No llegan paquetes al receptor | Frecuencia o parámetros distintos | Las 3 placas deben compilarse con el mismo `RadioConfig.h` |
| Altitud que se mueve sola varios metros | Sol o viento sobre el barómetro | Taparlo con espuma; comando *Calibrar en tierra* antes de volar |
| `pio` no se reconoce en la terminal | PlatformIO no está en el PATH | Usar la terminal de PlatformIO (A3) |

Detalle de pines: [02-conexiones.md](02-conexiones.md) · Protocolo: [03-protocolo-telemetria.md](03-protocolo-telemetria.md) ·
Día del lanzamiento: [06-dia-de-lanzamiento.md](06-dia-de-lanzamiento.md).
