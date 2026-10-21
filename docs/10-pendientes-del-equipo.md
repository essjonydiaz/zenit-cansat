# 10. Pendientes del equipo antes de la primera prueba

Lista de lo que cada área debe hacer **antes** de entregar el hardware a Control y
programación para la primera prueba. Está basada en el PDR (etapa 3) y en el software del
repositorio `zenit-cansat`.

Documentos de referencia en el repositorio:

| Archivo | Qué contiene |
|---|---|
| `docs/02-conexiones.md` | Tabla completa de pines de las 3 placas y diferencias encontradas en el PDR |
| `docs/09-guia-primera-prueba.md` | Paso a paso de la primera prueba con el hardware |
| `docs/05-plan-de-pruebas.md` | Pruebas de campo y criterios de aprobación |
| `firmware/comun/ZenitComun/src/Pines.h` | Los mismos pines, tal como los usa el código |

## 1. Electrónica (Araceli, Diego)

1. Ajustar el regulador MP1584EN a **5.0 V** con el multímetro **antes** de conectar la
   Heltec. De fábrica puede entregar más de 10 V y quemar la placa.
2. Medir con el multímetro que **no haya corto** entre 5 V y GND ni entre 3.3 V y GND.
3. Alimentar la Heltec V3 por su pin **5V**, no por el pin 3V3.
4. **No alimentar** sensores desde los pines "Ve" de la Heltec: el firmware los apaga en vuelo.
5. Agregar el divisor para medir la pila (no aparece en el PDR):
   **100 kΩ de la pila a GPIO6 y 33 kΩ de GPIO6 a GND** en la primaria. En la secundaria,
   lo mismo pero hacia GPIO1.
6. Conectar con los pines de la tabla de abajo, **no** con los del diagrama de la
   diapositiva 11 del PDR: ese diagrama usa GPIO 22 a 25, que no existen en el ESP32-S3, y
   pines que la Heltec ya usa por dentro.
7. Usar **pila cuadrada de 9 V** en las dos cargas. El PDR todavía dice Li-Po en las
   diapositivas 9 y 27, y la Guía de Misión solo permite pila de 9 V.
8. **Antes de cerrar la carcasa**, avisar a Control y programación para correr juntos la
   prueba P1 (autodiagnóstico) con la laptop.
9. Dejar el **puerto USB-C de la Heltec y del ESP32-C3 accesibles** sin desarmar: por ahí se
   suben los programas y se ajustan los parámetros.
10. Antenas de 915 MHz: IPEX en la primaria, SMA en el receptor y la del RFM95W en la
    secundaria. **Nunca encender una placa LoRa sin su antena.**
11. Entregar la **segunda Heltec V3** (receptor de la estación terrena) a Control y
    programación.
12. Poner en la microSD del OpenLog el archivo `documentos/openlog/config.txt` del
    repositorio (deja el OpenLog a 115200 baudios). La tarjeta debe estar en FAT32.

### Pines de la carga primaria (Heltec WiFi LoRa 32 V3)

| Módulo | Pin del módulo | Pin de la Heltec |
|---|---|---|
| GY-91 | VIN / GND | 3.3 V del AMS1117 / GND |
| GY-91 | SDA / SCL | GPIO41 / GPIO42 |
| GPS NEO-M8N | TX del GPS / RX del GPS | GPIO47 / GPIO48 |
| OpenLog | RXI / TXO | GPIO4 / GPIO5 |
| Servo de desacople | señal (naranja) | GPIO2 (alimentación 5 V del MP1584EN) |
| Servo del autogiro | señal (naranja) | GPIO3 (alimentación 5 V del MP1584EN) |
| Pila 9 V (medición) | divisor 100k / 33k | GPIO6 |
| Buzzer (opcional) | + | GPIO7 |

Capacitor de 470 µF entre 5 V y GND junto a los servos.

### Pines de la carga secundaria (ESP32-C3 SuperMini)

| Módulo | Pin del módulo | Pin del C3 |
|---|---|---|
| RFM95W | SCK / MISO / MOSI | GPIO4 / GPIO5 / GPIO6 |
| RFM95W | NSS (con 10 kΩ a 3.3 V) / RESET / DIO0 | GPIO7 / GPIO3 / GPIO10 |
| GPS NEO-6M | TX del GPS / RX del GPS | GPIO20 / GPIO21 |
| Pila 9 V (medición, opcional) | divisor 100k / 33k | GPIO1 |
| Buzzer (opcional) | + | GPIO0 |

## 2. Mecánica (Diego, Esli)

1. Hacer las caídas de prueba del autogiro junto con Control y programación. La velocidad
   de descenso con el autogiro abierto debe quedar entre **8 y 12 m/s**. Si sale más rápida,
   se corrige con el tamaño o el ángulo de las palas (el software solo la mide).
2. Verificar que un SG90 mueva sin atorarse el pasador de desacople y el seguro de las palas
   del autogiro (se prueba con el programa P6).
3. Peso total con los 2 huevos de 65 g: **máximo 600 g**. Diámetro de 9 a 10 cm y alto de
   20 a 23 cm.
4. Dejar el orificio de la tapa superior (Ø 9 mm) libre para el pasador del dron.

## 3. Todo el equipo: sesión conjunta en la mesa

Una sola reunión con el CanSat **abierto**, en este orden:

1. Electrónica mide voltajes (pila, 5 V, 3.3 V) y que no haya cortos.
2. Control y programación prueba que las dos Heltec se comuniquen (receptor y primaria).
3. Control y programación corre **P1**. El programa imprime la lista "QUE ARREGLAR" con la
   pieza y el cable exactos; electrónica corrige y la prueba se repite sola cada 10 s.
4. Se prueba la secundaria: su baliza debe aparecer en el panel de la estación terrena.
5. **P2**: calibración de la brújula.
6. **P6**: ángulos de los dos servos, con mecánica revisando los mecanismos.
7. Se carga el firmware de vuelo y se revisa que el panel muestre todo en verde.

Después siguen las pruebas de campo: alcance de 1 km, autonomía de la pila, caídas del
autogiro, impacto de los huevos y ensayo general.

## 4. Correcciones pendientes en el documento PDR

| Diapositiva | Qué dice | Qué debe decir |
|---|---|---|
| 5 (requisito 3) | Diámetro máximo ≤ 600 cm | ≤ 10 cm |
| 9 y 27 | Batería Li-Po | Pila cuadrada de 9 V |
| 11 | Pines GPIO 22–25 y pines internos de la Heltec | Pines de la tabla de la sección 1 |
| 13 y 24 | BME280 + MPU9250 separados | GY-91 (MPU9250 + BMP280) |
| 21 | MPU6050 | MPU9250 (GY-91) |
| 25 | Estación terrena con RFM95W + ESP32 | Heltec WiFi LoRa 32 V3 |
| 26 | Batería + TP4056 | Pila de 9 V (el TP4056 es para Li-Po) |
| 27 | GPS NEO-6M (x2) | NEO-M8N en la primaria y NEO-6M en la secundaria |
| 8, 10, 11 | OpenLog y "Módulo MicroSD" mezclados | Definir uno (el software usa OpenLog por defecto) |
| 24 | Voltaje de batería con 0.01 V | Agregar el divisor 100k / 33k para poder medirlo |
