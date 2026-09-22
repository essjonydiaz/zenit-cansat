// =============================================================================
//  config.h — CARGA SECUNDARIA (baliza de localización)
//  Radio: firmware/comun/ZenitComun/src/RadioConfig.h  ·  Pines: Pines.h
// =============================================================================
#pragma once

#define PERIODO_BALIZA_MS      1000  // una trama B por segundo
#define VARIACION_BALIZA_MS    200   // ± aleatorio para no chocar siempre con la primaria
#define GPS_BAUDIOS            9600

// Batería (mismo divisor que la primaria; ver docs/02-conexiones.md)
#define BATERIA_R_ARRIBA_KOHM  100.0f
#define BATERIA_R_ABAJO_KOHM   33.0f

// Buzzer de localización: empieza a sonar este tiempo después de encender
// (la secundaria no tiene barómetro para saber cuándo aterrizó).
#define BUZZER_DESPUES_DE_MIN  8
#define BUZZER_ACTIVO_ALTO     1
