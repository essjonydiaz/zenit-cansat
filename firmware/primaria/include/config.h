// =============================================================================
//  config.h — Parámetros de la CARGA PRIMARIA del CanSat Zénit.
//  Todo lo que se puede ajustar sin tocar la lógica está aquí.
//  Los pines están en firmware/comun/ZenitComun/src/Pines.h
// =============================================================================
#pragma once
#include <stdint.h>

// ---------------------------------------------------------------- Misión ----
// (valores de la Guía de Misión CASAT-FIT2026)
#define ALTURA_DESACOPLE_M        200.0f  // desacople + despliegue del autogiro
#define ALTURA_ARMADO_M           250.0f  // debe superarse antes de poder desacoplar
#define TRANSMISION_POST_ATERRIZAJE_S 10  // mínimo exigido (seguimos transmitiendo después)

// -------------------------------------------------------------- Muestreo ----
#define PERIODO_MUESTREO_MS   20   // 50 Hz: sensores + filtros + máquina de estados
#define PERIODO_TELEMETRIA_MS 250  // 4 Hz: trama T por radio
#define PERIODO_POSICION_MS   1000 // 1 Hz: trama P (GPS + localización de la secundaria)
#define PERIODO_REGISTRO_MS   40   // 25 Hz: línea en la microSD
#define MUESTRAS_CALIBRACION  100  // lecturas para presión de tierra y bias del giroscopio

// ----------------------------------------------------------------- Radio ----
// Frecuencia, SF, ancho de banda y palabra de sincronía están en
// firmware/comun/ZenitComun/src/RadioConfig.h (compartidos con las otras placas).

// Clave que deben traer los comandos desde tierra ($C,<clave>,<orden>*HH).
#define CLAVE_COMANDOS       "ZENIT"

// ----------------------------------------------------------------- Servo ----
// Ajustar con la prueba P6 (firmware/pruebas, entorno p6_servo) según el
// mecanismo de gancho/pasador que diseñe mecánica.
#define SERVO_ANGULO_CERRADO  10   // sostiene a la carga secundaria
#define SERVO_ANGULO_ABIERTO  100  // libera secundaria + autogiro
#define SERVO_TIEMPO_ACTIVO_MS 1500  // luego se desconecta para ahorrar batería

// --------------------------------------------------------------- Batería ----
// Divisor resistivo hacia GPIO34: V_bat -> R_ARRIBA -> GPIO34 -> R_ABAJO -> GND
// La Guía de Misión solo permite pila cuadrada de 9 V (ver docs/07).
//   Pila 9 V : R_ARRIBA = 100k, R_ABAJO = 33k  -> 9.6 V entran como 2.38 V
//   Li-Po 1S : R_ARRIBA = 100k, R_ABAJO = 100k -> 4.2 V entran como 2.10 V
#define BATERIA_R_ARRIBA_KOHM 100.0f
#define BATERIA_R_ABAJO_KOHM  33.0f
#define BATERIA_BAJA_V        7.0f   // aviso en la estación terrena

// ------------------------------------------------------------------- GPS ----
#define USAR_GPS_PRIMARIA 1   // 0 si la primaria no lleva GPS
#define GPS_BAUDIOS       9600
#define BALIZA_VIGENTE_MS 5000  // una baliza más vieja que esto se considera perdida

// --------------------------------------------------------------- Filtros ----
#define FILTRO_OMEGA   1.0f   // rad/s: qué tan rápido corrige con el barómetro
#define FILTRO_ZETA    0.7f
#define USAR_ACEL_EN_FILTRO 1 // 0 = velocidad solo con barómetro
#define MAHONY_KP      1.0f

// --------------------------------------------------------------- Buzzer -----
#define BUZZER_ACTIVO_ALTO 1  // 1 si el buzzer suena con HIGH
