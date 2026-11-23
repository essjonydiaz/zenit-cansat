# 3. Protocolo de telemetría

Todas las placas hablan el mismo formato de texto:

```
$<TIPO>,<campo1>,<campo2>,...*HH
```

`HH` = XOR de todos los caracteres entre `$` y `*`, en hexadecimal (igual que el NMEA de los
GPS). Una trama con el checksum mal se descarta. Implementado en C++
(`firmware/comun/ZenitComun/src/Protocolo.cpp`) y en JavaScript
(`estacion-terrena/src/protocolo.js`); una prueba automática verifica que ambos coincidan.

## Tramas

### `T` — Telemetría de la primaria (2 por segundo)

| # | Campo | Unidad | Ejemplo |
|---|---|---|---|
| 1 | seq | contador de la primaria | 215 |
| 2 | t_ms | ms desde que se encendió | 47451 |
| 3 | estado | 0 prevuelo · 1 ascenso · 2 caída libre · 3 descenso con autogiro · 4 aterrizado | 2 |
| 4 | alt | m sobre el punto de lanzamiento (filtrada) | 431.20 |
| 5 | vel | m/s (+ sube, − baja) | -18.42 |
| 6 | alt_max | m | 450.13 |
| 7 | pres | Pa | 91355 |
| 8 | temp | °C (resolución 0.01, como pide el PDR) | 25.21 |
| 9–11 | ax, ay, az | g | 0.01, -0.02, 0.35 |
| 12–14 | gx, gy, gz | °/s | 1, -2, 0 |
| 15–17 | roll, pitch, yaw | ° | 0.4, -1.1, 12.0 |
| 18 | g_max | g máx. desde el despegue (satura en 16) | 1.06 |
| 19 | bat | V (0 = sin divisor, no se pudo medir) | 9.10 |
| 20 | flags | bits: 0 baro · 1 imu · 2 sd · 3 lora · 4 gps · 5 baliza vigente · 6 desacoplado · 7 simulación · 8 batería baja · 9 autogiro desplegado · 10 separación confirmada por el IMU · 11 magnetómetro · 12 batería sin medir · 13 OpenLog sin confirmar | 3647 |

### `P` — Posición y localización de la secundaria (1 por segundo)

`P,seq,t_ms,lat,lon,sats,fix,sec_lat,sec_lon,sec_edad_s,dist_sec,rumbo_sec,sec_rssi,sec_bat`

`dist_sec` (m) y `rumbo_sec` (°, 0 = Norte, 90 = Este) valen `-1` si falta el GPS de alguna carga.

### `B` — Baliza de la secundaria (cada 2 s ± 300 ms, como pide el PDR)

`B,seq,t_ms,lat,lon,sats,fix,bat`

### `E` — Eventos

`E,seq,t_ms,codigo,detalle`

| Código | Cuándo |
|---|---|
| `ARRANQUE` | Al encender: qué sensores respondieron (modelo y dirección), magnetómetro, radio y OpenLog (`sd=1?` = sin confirmar) |
| `LORA_ERROR` | La radio no inició: código de RadioLib y pista (solo llega por USB) |
| `CALIBRADO` | Presión de tierra y desvío del giroscopio medidos |
| `ASCENSO` | Pasó 15 m subiendo |
| `LIBERACION` | El dron lo soltó (caída libre detectada) |
| `DESACOPLE` | Servo de desacople abierto. Detalle: `AUTO`/`MANUAL`, altura y velocidad |
| `SEPARACION` | El IMU sintió el jalón de la separación (detalle: cambio en g) |
| `SEPARACION_NO_CONFIRMADA` | No se sintió: el firmware cerró y reabrió el desacople una vez |
| `AUTOGIRO` | Servo del autogiro abierto (400 ms después del desacople), con la altura |
| `ATERRIZAJE` | Quieto en el suelo 3 s. Detalle: altura y aceleración máximas |
| `POST_ATERRIZAJE_OK` | Ya transmitió 10 s después de aterrizar |
| `AHORRO` | 60 s después de aterrizar: modo de bajo consumo (T y P cada 2 s, pantalla apagada, CPU a 80 MHz) |
| `PONG`, `CMD_OK`, `CMD_RECHAZADO` | Respuestas a comandos |

### `C` — Comandos desde tierra

`$C,<contador>,<orden>,<firma>*HH` — la clave **no viaja por radio**:

- `firma`: los primeros 16 dígitos hexadecimales del HMAC-SHA256 de `C,<contador>,<orden>` hecho con
  la clave `CLAVE_COMANDOS`. Quien escuche la radio ve la firma, pero no puede sacar la clave de ella
  ni firmar otra orden.
- `contador`: la hora de la laptop en milisegundos. La primaria solo acepta un contador mayor que el
  último que aceptó y lo guarda en su memoria flash, así que un comando grabado y vuelto a mandar se
  rechaza (`CMD_RECHAZADO,repetido`), aunque la primaria se haya reiniciado.

Ejemplo: `$C,1764000000000,PING,<16 dígitos hex>*HH`. La clave es `ZENIT` por defecto. Para usar una
privada (opcional), se crea `firmware/primaria/include/clave_local.h` (no se sube; ver
`clave_local.ejemplo.h`), que también lee la estación. Se puede forzar con `--clave` o `ZENIT_CLAVE`.
Órdenes: `PING`, `BUZZER`, `CALIBRAR` (solo en tierra), `CERRAR` (solo en tierra), `DESACOPLAR`
(respaldo manual, en cualquier momento).

Como el contador es la hora de la laptop, la fecha y hora de la laptop deben estar bien. Si una laptop
con la hora adelantada manda un comando, las demás quedan rechazadas hasta alcanzar esa hora.

### `R` — Prueba de alcance (programa `p3_alcance_lora`)

`R,seq,t_ms,potencia_dbm`

## Líneas del receptor por USB

| Línea | Significado |
|---|---|
| `RX,<rssi>,<snr>,<trama>` | Paquete recibido por radio |
| `INFO,<código>,...` | Estado del receptor (`RECEPTOR_LISTO`, `VIVO`, `TX_OK`, …) |
| `USB,<trama>` | Trama impresa por una placa de vuelo conectada directo por USB (pruebas en banco) |

La PC manda `TX,<trama>` y el receptor la transmite.

## Radio

915 MHz · SF7 · 250 kHz · CR 4/5 · preámbulo 8 · 20 dBm · CRC activado · palabra de
sincronía `0x5A` (en el SX1262 RadioLib la escribe como `0x54A4`, que es la misma).

| Trama | Tamaño típico | Tiempo en el aire | Cada | Uso del canal |
|---|---|---|---|---|
| T | ~110 bytes | ~92 ms | 0.5 s | 18 % |
| P | ~90 bytes | ~77 ms | 1 s | 8 % |
| B | ~60 bytes | ~60 ms | 2 s | 3 % |

Total ≈ 30 % del canal: queda tiempo para escuchar comandos y para que la baliza no choque
siempre con la primaria. Lo comprueba la prueba `test_tiempo_en_aire` (`aire::tiempoEnAireMs`).
En `RadioConfig.h` se cambian los parámetros **para las tres placas a la vez** (hay que
recompilar las tres).
