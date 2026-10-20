# 2. Conexiones (pinout) — según el PDR

Fuente única en el código: [`firmware/comun/ZenitComun/src/Pines.h`](../firmware/comun/ZenitComun/src/Pines.h).
Si se cambia un cable, cambiar **ese archivo y esta tabla**.

Componentes (PDR, diapositivas 10 y 12):

| Carga | Placa | Radio | Sensores / módulos | Energía |
|---|---|---|---|---|
| Primaria | **Heltec WiFi LoRa 32 V3** (ESP32-S3) | SX1262 integrado, 915 MHz | GY-91 (MPU9250 + BMP280), GPS NEO-M8N, OpenLog + microSD, 2× SG90 | Pila 9 V → interruptor → MP1584EN (5 V) → AMS1117 (3.3 V) |
| Secundaria | **ESP32-C3 SuperMini** | RFM95W (SX1276), 915 MHz | GPS NEO-6M, baliza LED/buzzer | Pila 9 V → reed switch → MP1584EN (3.3 V) |
| Receptor de tierra | **Heltec WiFi LoRa 32 V3** | SX1262 integrado + antena SMA 915 MHz | — | USB de la laptop |

## Carga primaria — Heltec WiFi LoRa 32 V3

| Módulo | Pin del módulo | Pin de la Heltec | Notas |
|---|---|---|---|
| **GY-91** | VIN / GND | 3.3 V del AMS1117 / GND | El GY-91 trae su propio regulador: acepta 3.3–5 V |
| | SDA / SCL | **GPIO41 / GPIO42** | Bus `Wire`. MPU9250 en 0x68, BMP280 en 0x76, magnetómetro en 0x0C |
| **GPS NEO-M8N** | VCC / GND | 3.3 V o 5 V según el módulo / GND | Antena cerámica mirando hacia arriba |
| | TX del GPS | **GPIO47** | La placa recibe aquí |
| | RX del GPS | **GPIO48** | Para mandarle el modo "aerotransportado" |
| **OpenLog** | VCC / GND | 3.3 V / GND | microSD FAT32 con `documentos/openlog/config.txt` (115200 baudios) |
| | RXI | **GPIO4** | La placa escribe aquí |
| | TXO | **GPIO5** | Para saber si el OpenLog está vivo (responde `<`) |
| **Servo DESACOPLE (SG90)** | Rojo / Café | **5 V del MP1584EN** / GND | Nunca del 3.3 V de la placa. Capacitor 470 µF entre 5 V y GND |
| | Naranja (señal) | **GPIO2** | |
| **Servo AUTOGIRO (SG90)** | Rojo / Café | 5 V del MP1584EN / GND | |
| | Naranja (señal) | **GPIO3** | |
| **Pila 9 V (medición)** | divisor 100 kΩ / 33 kΩ | **GPIO6** | **Falta en el PDR**: ver abajo |
| Buzzer activo (opcional) | + / − | **GPIO7** / GND | Para encontrar el CanSat en el pasto |
| Radio SX1262 | — | GPIO 8–14 (internos) | Ya viene conectado. Antena IPEX de 915 MHz, **nunca transmitir sin antena** |
| Pantalla OLED | — | GPIO 17, 18, 21 y Vext (36) (internos) | Muestra el estado en tierra; se apaga en vuelo |
| LED blanco | — | GPIO35 (interno) | Parpadeo lento en tierra, rápido en vuelo, fijo al aterrizar |

### Alimentación de la primaria

```
Pila 9V ─ reed switch ─┬─> MP1584EN ajustado a 5.0 V ─┬─> pin 5V de la Heltec
                       │                              ├─> servo DESACOPLE  (470 µF junto a los servos)
                       │                              ├─> servo AUTOGIRO
                       │                              └─> AMS1117-3.3 ─> GY-91, NEO-M8N, OpenLog
                       └─> 100 kΩ ─┬─ GPIO6
                                   33 kΩ
                                   └─ GND
```

- **Alimentar la Heltec por su pin 5V**, no por 3V3: la placa tiene su propio regulador y así no
  se pelea con el AMS1117 cuando además se conecta el USB para programar.
- **No alimentar sensores desde los pines "Ve"** de la Heltec: el firmware apaga Vext en vuelo
  para ahorrar batería (corta la pantalla) y se quedarían sin energía.
- Ajustar el MP1584EN a 5.0 V con el multímetro **antes** de conectar la placa (de fábrica
  puede venir a más de 10 V).
- Con 9.6 V (pila nueva) el GPIO6 recibe 2.38 V: dentro del rango del ADC. Si se usa otro
  divisor, cambiar `BATERIA_R_ARRIBA_KOHM` y `BATERIA_R_ABAJO_KOHM` en
  `firmware/primaria/include/config.h`. Sin divisor el firmware funciona igual y el panel dice
  "sin medir" (no da falsas alarmas).

## Carga secundaria — ESP32-C3 SuperMini (diagrama del PDR, diapositiva 12)

| Módulo | Pin del módulo | Pin del C3 | Notas |
|---|---|---|---|
| **RFM95W** | 3.3V / GND | 3.3 V del MP1584EN / GND | Capacitor de 100 nF junto al módulo |
| | SCK / MISO / MOSI | **GPIO4 / GPIO5 / GPIO6** | |
| | NSS | **GPIO7** | Con 10 kΩ a 3.3 V (como en el PDR) |
| | RESET | **GPIO3** | |
| | DIO0 | **GPIO10** | Avisa cuando terminó de transmitir |
| | ANT | antena 915 MHz (8.2 cm) | |
| **GPS NEO-6M** | VCC / GND | 3.3 V / GND | |
| | TX del GPS | **GPIO20** | |
| | RX del GPS | **GPIO21** | |
| Pila 9 V (opcional) | divisor 100 kΩ / 33 kΩ | **GPIO1** | Para reportar el voltaje en la baliza |
| Buzzer (opcional) | + / − | **GPIO0** / GND | Baliza sonora de respaldo |
| LED azul | — | GPIO8 (interno) | Parpadea con cada transmisión |

El monitor serie del C3 va por su **USB nativo** (no tiene chip USB-serie): en PlatformIO ya
está activado (`ARDUINO_USB_CDC_ON_BOOT=1`).

## Receptor de tierra — Heltec WiFi LoRa 32 V3

Solo la placa con la **antena SMA de 915 MHz** y el cable USB a la laptop. La pantalla muestra
paquetes recibidos, RSSI y SNR (útil para apuntar la antena).

## Diferencias encontradas en el PDR (revisar con electrónica)

Estas inconsistencias están en el PDR entregado. El firmware ya está preparado para la opción
correcta o para ambas, pero conviene corregirlas en el documento y en el armado:

| # | Dónde (PDR) | Qué dice | Problema | Qué hace el firmware |
|---|---|---|---|---|
| 1 | Diap. 11, diagrama de la primaria | Servos en "GPIO25", señales en GPIO 14–17 y 21–25 | En el ESP32-S3 **no existen GPIO 22–25**; 14 es el radio, 17/18/21 son la pantalla. Varias etiquetas están repetidas | Usa la tabla de arriba (pines libres reales) |
| 2 | Diap. 9 y 27 | Secundaria con "mini batería Li-Po"; "Baterías Li-Po (x2)" | La Guía de Misión solo permite **pila cuadrada de 9 V** (y la diap. 12 dice 9 V) | Supone pila de 9 V en ambas cargas |
| 3 | Diap. 13 y 24 vs 10 | "BME280 + MPU9250" separados vs "GY-91" | El GY-91 trae **BMP280**; la diap. 21 además dice MPU6050 | Detecta solo BMP280 o BME280 y MPU9250/6500/6050 |
| 4 | Diap. 27 | "GPS NEO-6M (x2)" | La primaria lleva **NEO-M8N** (diap. 6 y 10) | Funciona con los dos (ambos u-blox, 9600 baudios) |
| 5 | Diap. 25 | Estación terrena con "RFM95W + ESP32" | La tabla de la diap. 12 dice **Heltec V3** | Receptor para Heltec V3 |
| 6 | Diap. 8/11 vs 10 | OpenLog vs "Módulo MicroSD" | Son distintos (UART vs SPI) | OpenLog por defecto; `REGISTRO_TIPO` en `config.h` cambia a lector SPI |
| 7 | Diap. 5, requisito 3 | "Diámetro máximo ≤ 600 cm" | Error de captura: el CanSat mide Ø 9–10 cm | — |
| 8 | Diap. 26 | "Batería + TP4056" | El TP4056 carga Li-Po; no se usa con pila de 9 V | — |
| 9 | Diap. 24 | "Voltaje de batería, 0.01 V" | El diagrama no trae divisor para medirlo | Agregar 100k/33k a GPIO6 (primaria) y GPIO1 (secundaria) |
| 10 | Diap. 11 | 3.3 V del AMS1117 al pin 3V3 de la Heltec | Funciona, pero se pelea con el USB al programar | Recomendado: Heltec por su pin 5V |

## Antena

La guía exige que la antena quede **dentro** del cilindro. A 915 MHz el cuarto de onda mide
**8.2 cm** (como en la diap. 7 del PDR): vertical, lejos de la pila y de los cables de los servos.
Medir el alcance **ya montado** con la prueba P3 (requisito del PDR: ≥ 1 km).
