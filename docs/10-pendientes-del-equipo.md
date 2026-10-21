# 10. Pendientes del equipo antes de la primera prueba

Este documento es para Electrónica y Mecánica. Trae todo lo necesario para armar y probar el
CanSat sin abrir otros archivos: componentes, conexiones, tareas de cada área, orden de la
primera prueba, pruebas de campo y las preguntas que deben contestar a Control y programación.

Está basado en el PDR (etapa 3) y en el software que ya está listo. El software ya compila
para las 3 placas; lo único que falta es probarlo con el hardware real.

## 1. Componentes del sistema

| Carga | Placa | Radio | Sensores y módulos | Energía |
|---|---|---|---|---|
| Primaria | Heltec WiFi LoRa 32 V3 (ESP32-S3) | SX1262 integrado, 915 MHz | GY-91 (MPU9250 + BMP280), GPS NEO-M8N, OpenLog con microSD, 2 servos SG90 | Pila 9 V, interruptor, MP1584EN (5 V), AMS1117 (3.3 V) |
| Secundaria | ESP32-C3 SuperMini | RFM95W (SX1276), 915 MHz | GPS NEO-6M, buzzer de baliza | Pila 9 V, reed switch, MP1584EN (3.3 V) |
| Receptor de tierra | Heltec WiFi LoRa 32 V3 | SX1262 integrado, antena SMA 915 MHz | Ninguno | USB de la laptop |

Parámetros del radio (deben ser iguales en las 3 placas, ya están en el software):
915.0 MHz, ancho de banda 250 kHz, SF7, CR 4/5, potencia 20 dBm.

## 2. Conexiones de la carga primaria (Heltec WiFi LoRa 32 V3)

| Módulo | Pin del módulo | Pin de la Heltec | Notas |
|---|---|---|---|
| GY-91 | VIN / GND | 3.3 V del AMS1117 / GND | El GY-91 acepta de 3.3 a 5 V |
| GY-91 | SDA / SCL | GPIO41 / GPIO42 | IMU en 0x68, barómetro en 0x76, brújula en 0x0C |
| GPS NEO-M8N | VCC / GND | 3.3 V o 5 V según el módulo / GND | Antena del GPS mirando hacia arriba |
| GPS NEO-M8N | TX del GPS | GPIO47 | La placa recibe aquí |
| GPS NEO-M8N | RX del GPS | GPIO48 | La placa manda aquí la configuración de vuelo |
| OpenLog | VCC / GND | 3.3 V / GND | microSD en FAT32 |
| OpenLog | RXI | GPIO4 | La placa escribe aquí los datos |
| OpenLog | TXO | GPIO5 | Para saber si el OpenLog está vivo |
| Servo de desacople (SG90) | Rojo / Café | 5 V del MP1584EN / GND | Nunca del 3.3 V de la placa |
| Servo de desacople (SG90) | Naranja (señal) | GPIO2 | |
| Servo del autogiro (SG90) | Rojo / Café | 5 V del MP1584EN / GND | |
| Servo del autogiro (SG90) | Naranja (señal) | GPIO3 | |
| Pila 9 V (medición) | Divisor 100 kΩ / 33 kΩ | GPIO6 | No aparece en el PDR; ver sección 4 |
| Buzzer activo (opcional) | + / - | GPIO7 / GND | Para encontrar el CanSat en el pasto |
| Radio SX1262 | Interno | GPIO 8 a 14 | Ya viene conectado. Antena IPEX de 915 MHz |
| Pantalla OLED | Interno | GPIO 17, 18, 21 y 36 | Muestra el estado en tierra; se apaga en vuelo |
| LED blanco | Interno | GPIO35 | Lento en tierra, rápido en vuelo, fijo al aterrizar |

Capacitor de 470 µF entre 5 V y GND junto a los servos.

### Alimentación de la primaria

```
Pila 9V -- interruptor --+--> MP1584EN ajustado a 5.0 V --+--> pin 5V de la Heltec
                         |                                +--> servo de desacople
                         |                                +--> servo del autogiro (470 uF junto)
                         |                                +--> AMS1117-3.3 --> GY-91, NEO-M8N, OpenLog
                         +--> 100 kOhm --+-- GPIO6
                                       33 kOhm
                                         +-- GND
```

## 3. Conexiones de la carga secundaria (ESP32-C3 SuperMini)

| Módulo | Pin del módulo | Pin del C3 | Notas |
|---|---|---|---|
| RFM95W | 3.3 V / GND | 3.3 V del MP1584EN / GND | Capacitor de 100 nF junto al módulo |
| RFM95W | SCK / MISO / MOSI | GPIO4 / GPIO5 / GPIO6 | |
| RFM95W | NSS | GPIO7 | Con resistencia de 10 kΩ a 3.3 V |
| RFM95W | RESET | GPIO3 | |
| RFM95W | DIO0 | GPIO10 | Avisa cuando terminó de transmitir |
| RFM95W | ANT | Antena de 915 MHz (8.2 cm) | |
| GPS NEO-6M | VCC / GND | 3.3 V / GND | |
| GPS NEO-6M | TX del GPS | GPIO20 | |
| GPS NEO-6M | RX del GPS | GPIO21 | |
| Pila 9 V (opcional) | Divisor 100 kΩ / 33 kΩ | GPIO1 | Para reportar el voltaje en la baliza |
| Buzzer (opcional) | + / - | GPIO0 / GND | Suena 8 minutos después de encender |
| LED azul | Interno | GPIO8 | Parpadea con cada transmisión |

La secundaria transmite su posición cada 2 segundos. El C3 se programa por su USB-C.

## 4. Electrónica (Araceli, Diego)

1. Ajustar el regulador MP1584EN a 5.0 V con el multímetro antes de conectar la Heltec. De
   fábrica puede entregar más de 10 V y quemar la placa. El de la secundaria va a 3.3 V.
2. Medir con el multímetro que no haya corto entre 5 V y GND ni entre 3.3 V y GND.
3. Alimentar la Heltec V3 por su pin 5V, no por el pin 3V3. Así no se pelea con el AMS1117
   cuando se conecta el USB para programar.
4. No alimentar sensores desde los pines "Ve" de la Heltec: el software los apaga en vuelo
   para ahorrar pila.
5. Agregar el divisor para medir la pila, que no aparece en el PDR: 100 kΩ de la pila a GPIO6
   y 33 kΩ de GPIO6 a GND en la primaria; lo mismo hacia GPIO1 en la secundaria. Con una pila
   nueva de 9.6 V el pin recibe 2.38 V, que es seguro. Si no se pone, todo funciona pero la
   estación terrena dice "batería sin medir".
6. Conectar con los pines de las tablas de las secciones 2 y 3, no con los del diagrama de la
   diapositiva 11 del PDR. Ese diagrama usa GPIO 22 a 25, que no existen en el ESP32-S3, y
   pines que la Heltec ya usa por dentro para el radio y la pantalla.
7. Usar pila cuadrada de 9 V en las dos cargas. El PDR todavía dice Li-Po en las diapositivas
   9 y 27, y la Guía de Misión solo permite pila de 9 V.
8. Antes de cerrar la carcasa, avisar a Control y programación para correr juntos la prueba
   de autodiagnóstico con la laptop.
9. Dejar el puerto USB-C de la Heltec y del ESP32-C3 accesibles sin desarmar: por ahí se
   suben los programas y se ajustan los parámetros.
10. Antenas de 915 MHz: IPEX en la primaria, SMA en el receptor y la del RFM95W en la
    secundaria. Nunca encender una placa LoRa sin su antena: se puede dañar el radio.
11. La antena debe quedar dentro del cilindro, vertical, lejos de la pila y de los cables de
    los servos.
12. Entregar la segunda Heltec V3 (receptor de la estación terrena) a Control y programación.
13. Preparar la microSD del OpenLog: formatearla en FAT32 y crear en la raíz un archivo
    llamado `config.txt` con este contenido exacto (deja el OpenLog a 115200 baudios):

```
115200,26,3,0,1,1,0
baud,escape,esc#,mode,verb,echo,ignoreRX
```

## 5. Mecánica (Diego, Esli)

Cómo funciona la separación en el software, para que los mecanismos coincidan:

- El desacople solo puede activarse después de que el CanSat pasó de 250 m de altura (así
  nunca se dispara en la mesa ni al cargar los huevos).
- Al bajar a 200 m se abre el servo de desacople y se libera la carga secundaria.
- 400 milisegundos después se abre el servo del autogiro y se liberan las palas. El autogiro
  se abre siempre, aunque el software no confirme la separación.
- Si el acelerómetro no detecta el jalón de la separación, el servo de desacople se cierra
  300 ms y se vuelve a abrir (un reintento).
- Ángulos que trae el software por defecto: cerrado 10 grados, abierto 100 grados, en los dos
  servos. Se ajustan con el programa de prueba de servos y se cambian en el software.
- Los servos reciben señal solo 1.5 segundos y luego se sueltan para ahorrar pila.

Tareas:

1. Hacer las caídas de prueba del autogiro junto con Control y programación. La velocidad de
   descenso con el autogiro abierto debe quedar entre 8 y 12 m/s. Si sale más rápida, se
   corrige con el tamaño o el ángulo de las palas (el software solo la mide).
2. Verificar que un SG90 mueva sin atorarse el pasador de desacople y el seguro de las palas
   del autogiro. Se prueba con el programa de servos: 20 de 20 liberaciones de cada uno.
3. Peso total con los 2 huevos de 65 g: máximo 600 g. Diámetro de 9 a 10 cm y alto de 20 a
   23 cm.
4. Dejar el orificio de la tapa superior (diámetro 9 mm) libre para el pasador del dron.
5. Dejar espacio para que la antena quede vertical dentro del cilindro y acceso al USB-C de
   las dos placas.

## 6. Todo el equipo: primera prueba en la mesa

Una sola reunión con el CanSat abierto, en este orden:

1. Electrónica mide voltajes (pila, 5 V, 3.3 V) y que no haya cortos.
2. Control y programación prueba que las dos Heltec se comuniquen (receptor y primaria).
3. Control y programación corre el autodiagnóstico. El programa revisa cada módulo (GY-91,
   barómetro, IMU, brújula, radio, GPS, OpenLog, pila) y al final imprime la lista "QUE
   ARREGLAR" con la pieza y el cable exactos. Electrónica corrige y la prueba se repite sola
   cada 10 segundos. El resumen también sale en la pantalla de la Heltec.
4. Se prueba la secundaria: su baliza debe aparecer en el panel de la estación terrena.
5. Calibración de la brújula: girar el CanSat en todas direcciones durante 30 segundos.
6. Prueba de servos: ajustar los ángulos de los dos servos, con Mecánica revisando los
   mecanismos.
7. Se carga el programa de vuelo y se revisa que el panel muestre todo en verde.

## 7. Pruebas de campo después de la primera prueba

| Prueba | Cómo se hace | Se aprueba si |
|---|---|---|
| P1 Encendido | Multímetro y autodiagnóstico | Todos los módulos en PASA |
| P2 Sensores | Quieto 10 s, luego girarlo 30 s, luego subirlo un piso | Altitud con ruido menor a 0.5 m, aceleración 1.00 ± 0.05 g, subir 3 m se ve como 3 m, rumbo ± 15 grados |
| P3 Alcance LoRa | CanSat cerrado, alejarse 100, 250, 500, 750 y 1000 m | A 1 km: menos de 10 % de paquetes perdidos y señal mejor que -115 dBm. Grabar video |
| P4 Autonomía | Pila nueva transmitiendo sin parar | 60 minutos o más (el PDR pide 30 min) |
| P4b Registro | Escribir 1000 líneas en el OpenLog | 1000 de 1000 líneas en el archivo |
| P5 Autogiro | Soltarlo desde un edificio o puente con permiso | Velocidad estable entre 8 y 12 m/s |
| P6 Desacople y autogiro | Programa de servos con la secundaria colgando | 20 de 20 liberaciones de cada mecanismo |
| P7 Impacto | Soltar la carga a unos 10 m/s (desde unos 5 m) con huevo | Huevo intacto en 5 de 5 caídas |
| P8 Estructura | Sacudir, dejar caer 1 m sobre pasto, transportar | Nada suelto y el autodiagnóstico sigue en PASA |
| P9 Ensayo general | CanSat final pesado y medido con la estación terrena | 600 g o menos, medidas correctas, todo en verde |
| GPS | Las dos cargas a cielo abierto 5 min, luego separarlas 30 m medidos con cinta | Las dos con señal en menos de 2 min y distancia correcta ± 5 m |

Anotar fecha, responsable, resultado y evidencia (foto, video o archivo) de cada prueba: eso
va directo al CDR.

## 8. Lo que necesitamos que nos digan

Control y programación ya dejó el software listo con los datos del PDR. Estas son las cosas
que el PDR no dice o que pueden haber cambiado al comprar. Si algo es distinto a lo que el
software supone, hay que avisar antes de la primera prueba para cambiarlo.

### Electrónica

| Pregunta | Lo que supone hoy el software |
|---|---|
| ¿El GY-91 que compraron trae brújula (chip AK8963)? Algunos traen MPU6500 sin brújula | Trae brújula. Si no la trae, el vuelo funciona igual pero sin rumbo |
| ¿El GPS NEO-M8N se alimenta a 3.3 V o a 5 V? ¿Trae antena externa? | Se alimenta del 3.3 V del AMS1117 |
| ¿Compraron OpenLog o un módulo microSD por SPI? El PDR menciona los dos | OpenLog. Si es módulo SPI, el software también lo soporta pero cambian los pines |
| ¿Tienen las resistencias de 100 kΩ y 33 kΩ para el divisor? Si usan otros valores, ¿cuáles? | 100 kΩ arriba y 33 kΩ abajo |
| ¿Va a llevar buzzer cada carga? ¿Es activo (suena solo con voltaje) o pasivo? | Buzzer activo que suena con HIGH, opcional |
| ¿La pila de 9 V es alcalina o recargable? | Alcalina: aviso de pila baja en 7.0 V, mínimo 8.5 V para volar |
| ¿La primaria se enciende con interruptor o con reed switch? ¿Dónde queda para encenderlo ya cerrado? | Interruptor en la primaria, reed switch en la secundaria |
| ¿Los servos son SG90 de plástico o MG90S de metal? | SG90 en los dos |
| ¿El regulador de la secundaria va a 3.3 V directo al C3, o a 5 V al pin 5V del C3? | 3.3 V directo |
| ¿Qué antena lleva la secundaria (alambre de 8.2 cm o resorte)? | Alambre de 8.2 cm |
| ¿Ya soldaron algo con pines distintos a las tablas de las secciones 2 y 3? ¿Cuáles? | Las tablas de este documento |
| ¿Qué día estará listo el hardware para la primera prueba? | Sin fecha |

### Mecánica

| Pregunta | Lo que supone hoy el software |
|---|---|
| ¿Cómo sostiene el servo de desacople a la carga secundaria (pasador, gancho, palanca)? ¿Qué ángulo la sostiene y cuál la suelta? | Cerrado 10 grados, abierto 100 grados |
| ¿Cómo sostiene el servo del autogiro las palas plegadas? ¿Qué ángulo las suelta? | Cerrado 10 grados, abierto 100 grados |
| ¿El orden es correcto: primero se suelta la secundaria y 0.4 s después se abre el autogiro? | Sí, en ese orden y con 400 ms entre los dos |
| ¿0.4 s es suficiente para que la secundaria se aleje antes de abrir las palas, o necesitan más tiempo? | 400 ms |
| ¿La secundaria baja con paracaídas o en caída libre? ¿A qué velocidad? | No la mide; solo transmite su posición |
| ¿Cuánto pesa cada parte ya armada (estructura, palas, secundaria, electrónica)? | Sin datos; el máximo es 600 g |
| ¿Cómo se engancha el CanSat al dron y a qué altura lo suelta? | Sube a unos 450 m y desacopla a 200 m |
| ¿Dónde va cada placa dentro del cilindro y por dónde sale el USB-C? | Sin datos |

### Todo el equipo

| Pregunta | Lo que supone hoy el software |
|---|---|
| ¿Quién se queda con la segunda Heltec (receptor de tierra) y la laptop el día del lanzamiento? | Control y programación |
| ¿Cuándo podemos hacer la reunión de la primera prueba? | Sin fecha |
| ¿Quién corrige el documento PDR con la tabla de la sección 9? | Sin asignar |

## 9. Correcciones pendientes en el documento PDR

| Diapositiva | Qué dice | Qué debe decir |
|---|---|---|
| 5 (requisito 3) | Diámetro máximo menor o igual a 600 cm | Menor o igual a 10 cm |
| 9 y 27 | Batería Li-Po | Pila cuadrada de 9 V |
| 11 | Pines GPIO 22 a 25 y pines internos de la Heltec | Pines de la tabla de la sección 2 |
| 11 | 3.3 V del AMS1117 al pin 3V3 de la Heltec | Heltec alimentada por su pin 5V |
| 13 y 24 | BME280 y MPU9250 separados | GY-91 (MPU9250 + BMP280) |
| 21 | MPU6050 | MPU9250 (GY-91) |
| 25 | Estación terrena con RFM95W y ESP32 | Heltec WiFi LoRa 32 V3 |
| 26 | Batería y TP4056 | Pila de 9 V (el TP4056 es para Li-Po) |
| 27 | GPS NEO-6M (x2) | NEO-M8N en la primaria y NEO-6M en la secundaria |
| 8, 10 y 11 | OpenLog y "Módulo MicroSD" mezclados | Definir uno (el software usa OpenLog) |
| 24 | Voltaje de batería con 0.01 V | Agregar el divisor 100k / 33k para poder medirlo |
