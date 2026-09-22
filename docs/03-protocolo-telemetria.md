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

### `T` — Telemetría de la primaria (4 por segundo)

| # | Campo | Unidad | Ejemplo |
|---|---|---|---|
| 1 | seq | contador de la primaria | 215 |
| 2 | t_ms | ms desde que se encendió | 47451 |
| 3 | estado | 0 prevuelo · 1 ascenso · 2 caída libre · 3 descenso con autogiro · 4 aterrizado | 2 |
| 4 | alt | m sobre el punto de lanzamiento (filtrada) | 431.20 |
| 5 | vel | m/s (+ sube, − baja) | -18.42 |
| 6 | alt_max | m | 450.13 |
| 7 | pres | Pa | 91355 |
| 8 | temp | °C | 25.2 |
| 9–11 | ax, ay, az | g | 0.01, -0.02, 0.35 |
| 12–14 | gx, gy, gz | °/s | 1, -2, 0 |
| 15–17 | roll, pitch, yaw | ° | 0.4, -1.1, 12.0 |
| 18 | g_max | g máx. desde el despegue (satura en 16) | 1.06 |
| 19 | bat | V | 9.10 |
| 20 | flags | bits: 0 baro · 1 imu · 2 sd · 3 lora · 4 gps · 5 baliza vigente · 6 desacoplado · 7 simulación · 8 batería baja | 63 |

### `P` — Posición y localización de la secundaria (1 por segundo)

`P,seq,t_ms,lat,lon,sats,fix,sec_lat,sec_lon,sec_edad_s,dist_sec,rumbo_sec,sec_rssi,sec_bat`

`dist_sec` (m) y `rumbo_sec` (°, 0 = Norte, 90 = Este) valen `-1` si falta el GPS de alguna carga.

### `B` — Baliza de la secundaria (1 por segundo ± 200 ms)

`B,seq,t_ms,lat,lon,sats,fix,bat`

### `E` — Eventos

`E,seq,t_ms,codigo,detalle`

| Código | Cuándo |
|---|---|
| `ARRANQUE` | Al encender: qué sensores respondieron y archivo de la microSD |
| `CALIBRADO` | Presión de tierra y desvío del giroscopio medidos |
| `ASCENSO` | Pasó 15 m subiendo |
| `LIBERACION` | El dron lo soltó (caída libre detectada) |
| `DESACOPLE` | Servo movido. Detalle: `AUTO`/`MANUAL`, altura y velocidad |
| `ATERRIZAJE` | Quieto en el suelo 3 s. Detalle: altura y aceleración máximas |
| `POST_ATERRIZAJE_OK` | Ya transmitió 10 s después de aterrizar |
| `PONG`, `CMD_OK`, `CMD_RECHAZADO` | Respuestas a comandos |

### `C` — Comandos desde tierra

`$C,<clave>,<orden>*HH` — la clave está en `CLAVE_COMANDOS` (`config.h`) y en la estación
(`--clave`). Órdenes: `PING`, `BUZZER`, `CALIBRAR` (solo en tierra), `CERRAR` (solo en tierra),
`DESACOPLAR` (respaldo manual, en cualquier momento).

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

433 MHz · SF7 · 250 kHz · CR 4/5 · 17 dBm · CRC activado · palabra de sincronía `0x5A`.
Una trama `T` (~110 bytes) tarda ≈ 90 ms en el aire. En `RadioConfig.h` se cambian los
parámetros **para las tres placas a la vez** (hay que recompilar las tres).
