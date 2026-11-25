// =============================================================================
//  config.h — Parámetros de la CARGA PRIMARIA del CanSat Zénit
//  (Heltec WiFi LoRa 32 V3 + GY-91 + NEO-M8N + OpenLog + 2 servos SG90).
//  Todo lo que se puede ajustar sin tocar la lógica está aquí.
//  Los pines están en firmware/comun/ZenitComun/src/Pines.h (namespace heltec).
// =============================================================================
#pragma once
#include <stdint.h>

// ---------------------------------------------------------------- Misión ----
// 2026-11-24: el dron sube a 100 m y suelta; el desacople es a 80 m.
// (Antes: liberación a 450 m y desacople a 200 m, según la guía CASAT-FIT2026.)
// Si cambia, actualizar también MISION en estacion-terrena/public/app.js.
#define ALTURA_DESACOPLE_M        80.0f   // desacople + despliegue del autogiro
#define ALTURA_ARMADO_M           90.0f   // debe superarse antes de poder desacoplar
#define TRANSMISION_POST_ATERRIZAJE_S 10  // mínimo exigido (seguimos transmitiendo después)

// ---------------------------------------------------------- Modo prueba ----
// Para soltarlo desde un techo (2–3 pisos = 6–10 m). Se activa subiendo
// env:primaria_prueba (no hay que tocar este archivo). NUNCA para el concurso:
// el evento ARRANQUE dice "PRUEBA" y la estación terrena muestra un aviso.
//   1. Encender abajo, en el suelo (ahí queda el 0 m).
//   2. Subirlo al techo: al pasar de 3 m entra en ASCENSO; al pasar de 4 m se arma.
//   3. Puede esperar en el techo lo que sea (arriba de 2.5 m no cuenta como aterrizado).
//   4. Soltarlo: al caer 1.5 m desacopla y 0.4 s después abre el autogiro.
#ifndef MODO_PRUEBA_CAIDA
#define MODO_PRUEBA_CAIDA 0
#endif
#define PRUEBA_ALTURA_ASCENSO_M   3.0f
#define PRUEBA_ALTURA_ARMADO_M    4.0f
#define PRUEBA_CAIDA_DESACOPLE_M  1.5f
#define PRUEBA_ALTURA_ATERRIZAJE_M 2.5f  // en el techo NO cuenta como aterrizado

// -------------------------------------------------------------- Muestreo ----
#define PERIODO_MUESTREO_MS   20   // 50 Hz: sensores + filtros + máquina de estados
#define PERIODO_TELEMETRIA_MS 500  // 2 Hz: trama T por radio (el PDR pide >= 1 Hz)
#define PERIODO_POSICION_MS   1000 // 1 Hz: trama P (GPS + localización de la secundaria)
#define PERIODO_REGISTRO_MS   40   // 25 Hz: línea en la microSD
#define PERIODO_MAG_MS        100  // 10 Hz: magnetómetro
#define MUESTRAS_CALIBRACION  100  // lecturas para presión de tierra y bias del giroscopio
// Modo de bajo consumo tras aterrizar (riesgo 5 del PDR: que la pila dure hasta
// que llegue el equipo de recuperación). Pasado este tiempo en el suelo: T y P
// cada 2 s (como pide el PDR para la posición), pantalla apagada y CPU a 80 MHz.
#define AHORRO_TRAS_ATERRIZAR_S      60
#define PERIODO_TELEMETRIA_AHORRO_MS 2000
#define PERIODO_POSICION_AHORRO_MS   2000
// Uso del canal LoRa con estos periodos (SF7, 250 kHz): T (~110 bytes) ~92 ms
// cada 0.5 s, P (~90 bytes) ~77 ms cada 1 s y la baliza (~60 bytes) ~60 ms
// cada 2 s -> ~30 % del tiempo (lo comprueba test_tiempo_en_aire). Queda
// espacio para escuchar la baliza y los comandos. NO subir la telemetría a
// más de 4 Hz sin recalcular (aire::tiempoEnAireMs).

// ----------------------------------------------------------------- Radio ----
// Frecuencia (915 MHz), SF, ancho de banda y palabra de sincronía están en
// firmware/comun/ZenitComun/src/RadioConfig.h (compartidos con las otras placas).

// Clave con la que se firman los comandos desde tierra
// ($C,<contador>,<orden>,<firma>*HH; ver procesarComando en main.cpp). La clave
// no viaja por radio. Por defecto es "ZENIT". Opcional: para una clave privada,
// crear include/clave_local.h (copiar clave_local.ejemplo.h); no se sube a
// GitHub y la estación terrena lee el mismo archivo.
#if defined(__has_include)
#if __has_include("clave_local.h")
#include "clave_local.h"
#endif
#endif
#ifndef CLAVE_COMANDOS
#define CLAVE_COMANDOS       "ZENIT"
#endif

// ---------------------------------------------------------------- Servos ----
// Ajustar con la prueba P6 (firmware/pruebas, entorno p6_servos) según los
// mecanismos que diseñe mecánica. Los SG90 se alimentan con 5 V del MP1584EN.
#define DESACOPLE_ANGULO_CERRADO 10   // sostiene a la carga secundaria
#define DESACOPLE_ANGULO_ABIERTO 100  // libera la carga secundaria
#define AUTOGIRO_ANGULO_CERRADO  10   // palas plegadas contra la pared
#define AUTOGIRO_ANGULO_ABIERTO  100  // libera las palas (despliegue pasivo)
#define SERVO_TIEMPO_ACTIVO_MS   1500 // luego se desconecta la señal para ahorrar batería
// Secuencia a 200 m (ver Separacion.h): desacople, 400 ms después el autogiro.
#define AUTOGIRO_RETARDO_MS      400
#define SEPARACION_CAMBIO_MIN_G  0.6f // "jalón" mínimo para confirmar con el IMU

// --------------------------------------------------------------- Registro ---
// El equipo decidió volar SIN microSD (no se compró el OpenLog): los datos
// quedan solo en la laptop, con lo que llega por radio. Si algún día se pone
// un OpenLog o un lector microSD SPI, cambiar REGISTRO_TIPO y volver a mostrar
// la microSD en el panel (app.js y diagnostico.js).
#define REGISTRO_NINGUNO 0
#define REGISTRO_OPENLOG 1
#define REGISTRO_SD_SPI  2
#define REGISTRO_TIPO    REGISTRO_NINGUNO
// El OpenLog trae 9600 baudios de fábrica: es MUY lento para 25 líneas/s.
// Copiar documentos/openlog/config.txt a la microSD (pone 115200).
#define OPENLOG_BAUDIOS  115200

// --------------------------------------------------------------- Batería ----
// Divisor resistivo hacia GPIO7: V_bat -> R_ARRIBA -> GPIO7 -> R_ABAJO -> GND
// Pila 9 V : R_ARRIBA = 100k, R_ABAJO = 33k  -> 9.6 V entran como 2.38 V
// (el diagrama del PDR no trae divisor: hay que agregar estas 2 resistencias;
//  sin ellas el panel muestra "sin medir" y NO da falsa alarma).
#define BATERIA_R_ARRIBA_KOHM 100.0f
#define BATERIA_R_ABAJO_KOHM  33.0f
#define BATERIA_BAJA_V        7.0f   // aviso en la estación terrena
#define BATERIA_MINIMA_REAL_V 3.0f   // por debajo: divisor no conectado

// ------------------------------------------------------------------- GPS ----
#define USAR_GPS_PRIMARIA 1     // NEO-M8N
#define GPS_BAUDIOS       9600  // de fábrica en NEO-M8N y NEO-6M
#define GPS_MODO_AEREO    1     // manda UBX-CFG-NAV5 "aerotransportado < 1 g"
#define BALIZA_VIGENTE_MS 6000  // la secundaria transmite cada 2 s: 3 perdidas = vieja

// --------------------------------------------------------------- Filtros ----
#define FILTRO_OMEGA   1.0f   // rad/s: qué tan rápido corrige con el barómetro
#define FILTRO_ZETA    0.7f
#define USAR_ACEL_EN_FILTRO 1 // 0 = velocidad solo con barómetro
#define MAHONY_KP      1.0f

// ---------------------------------------------------------- Magnetómetro ----
// Solo si el GY-91 trae MPU9250 (con AK8963). Calibrar con la prueba P2:
// girar el CanSat en todas direcciones y copiar aquí los centros que imprime.
#define USAR_MAGNETOMETRO   1
#define MAG_CENTRO_X_UT     0.0f
#define MAG_CENTRO_Y_UT     0.0f
#define MAG_CENTRO_Z_UT     0.0f
#define MAG_TAU_S           2.0f  // qué tan rápido corrige el yaw hacia la brújula

// -------------------------------------------------------------- Pantalla ----
#ifndef USAR_PANTALLA
#define USAR_PANTALLA   1     // OLED del Heltec: solo en tierra (se apaga al despegar)
#endif
#define PERIODO_PANTALLA_MS 500

// --------------------------------------------------------------- Buzzer -----
#define BUZZER_ACTIVO_ALTO 1  // 1 si el buzzer suena con HIGH
