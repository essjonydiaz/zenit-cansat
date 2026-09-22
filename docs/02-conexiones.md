# 2. Conexiones (pinout)

Fuente única en el código: [`firmware/comun/ZenitComun/src/Pines.h`](../firmware/comun/ZenitComun/src/Pines.h).
Si se cambia un cable, cambiar **ese archivo y esta tabla**.

## Carga primaria — ESP32 DevKit V1 (30 pines)

| Módulo | Pin del módulo | GPIO del ESP32 | Notas |
|---|---|---|---|
| **BMP280** | VCC / GND | 3V3 / GND | Módulos de 6 pines: CSB a 3V3 para modo I2C |
| | SDA / SCL | **21 / 22** | Dirección 0x76 (SDO a GND) o 0x77 |
| **MPU6050** | VCC / GND | 3V3 (o 5V si el módulo trae regulador) / GND | |
| | SDA / SCL | **21 / 22** | Mismo bus que el BMP280. AD0 a GND → 0x68 |
| **LoRa SX1278 (Ra-02)** | VCC / GND | **3V3** / GND | ¡Solo 3.3 V! Nunca transmitir sin antena |
| | SCK / MISO / MOSI | **18 / 19 / 23** | Bus VSPI compartido con la microSD |
| | NSS | **5** | |
| | RST | **14** | |
| | DIO0 | **26** | |
| **microSD** | VCC / GND | 5V o 3V3 según el módulo / GND | FAT32, ≤ 32 GB |
| | SCK / MISO / MOSI | **18 / 19 / 23** | |
| | CS | **4** | |
| **Servo SG90** | Rojo / Café | 5 V (del regulador) / GND | Capacitor de 470 µF entre 5 V y GND junto al servo |
| | Naranja (señal) | **13** | |
| **GPS NEO-6M** | VCC / GND | 3V3 o 5V según módulo / GND | |
| | TX del GPS | **16** (RX2) | |
| | RX del GPS | **17** (TX2) | Opcional |
| **Batería** | Divisor 100 kΩ / 33 kΩ | **34** | Ver abajo |
| **Buzzer activo** | + / − | **25** / GND | Para encontrar el CanSat en el pasto |
| LED | integrado | 2 | Parpadeo lento en tierra, rápido en vuelo, fijo al aterrizar |

**Carga secundaria:** mismo LoRa (18/19/23/5/14/26), GPS (16/17), batería (34) y buzzer (25).
**Receptor de tierra:** solo el LoRa (18/19/23/5/14/26), alimentado por el USB de la laptop.

## Pines que NO se deben usar

El esquemático de la diapositiva 8 del CoDR usa etiquetas que **no existen** en el ESP32 o que
no se pueden usar:

- **GPIO 6, 7, 8, 9, 10, 11** ("GP6", etc.): están conectados a la memoria flash interna.
  Usarlos bloquea la placa.
- **GPIO 20, 24**: no existen en el ESP32.
- **GPIO 0, 2, 12, 15**: definen el modo de arranque; evitarlos para módulos (el 12 en alto
  al encender puede impedir que arranque).
- **GPIO 34–39**: solo entrada (sirven para medir, no para controlar).

Hay que actualizar ese esquemático con la tabla de arriba para el PDR.

## Alimentación

La Guía de Misión exige **pila cuadrada de 9 V** (ninguna otra batería). Propuesta:

```
Pila 9V ─ interruptor ─┬─> regulador step-down a 5 V (mini-buck tipo MP1584) ─┬─> VIN del ESP32
                       │                                                      ├─> servo (con 470 µF)
                       │                                                      └─> microSD / GPS (si son de 5 V)
                       └─> 100 kΩ ─┬─ GPIO34
                                   33 kΩ
                                   └─ GND
ESP32 3V3 ─> BMP280, MPU6050, LoRa
```

- Con 9.6 V (pila nueva) el GPIO34 recibe 2.38 V: dentro del rango del ADC.
- Un step-down pierde menos energía que un regulador lineal (7805/AMS1117) bajando de 9 a 5 V.
- Una pila de 9 V **de litio** pesa ~34 g (vs ~45 g alcalina) y dura mucho más con consumos
  de 100–150 mA. Sigue siendo "pila cuadrada de 9 V", pero conviene confirmarlo con los jueces.
- Si se usa otro divisor, cambiar `BATERIA_R_ARRIBA_KOHM` y `BATERIA_R_ABAJO_KOHM` en
  `firmware/primaria/include/config.h`.

## Antena

La guía exige que la antena quede **dentro** del cilindro. Un cable de 17.3 cm (¼ de onda a
433 MHz) enrollado en espiral o pegado por dentro de la pared funciona, pero hay que medir el
alcance **ya montado** con la prueba P3. Evitar que la antena toque la pila o el cableado del servo.
