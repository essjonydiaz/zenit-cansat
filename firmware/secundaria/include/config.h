// =============================================================================
//  config.h — CARGA SECUNDARIA (baliza de localización)
//  ESP32-C3 SuperMini + RFM95W (915 MHz) + GPS NEO-6M + pila 9 V (MP1584EN a 3.3 V)
//  Radio: firmware/comun/ZenitComun/src/RadioConfig.h  ·  Pines: Pines.h (namespace c3)
// =============================================================================
#pragma once

// PDR: "cada carga transmite su posición por LoRa cada 2 segundos durante al
// menos 10 minutos". El ± aleatorio evita chocar siempre con la primaria.
#define PERIODO_BALIZA_MS      2000
#define VARIACION_BALIZA_MS    300
#define GPS_BAUDIOS            9600
#define GPS_MODO_AEREO         1     // UBX-CFG-NAV5 "aerotransportado < 1 g"

// Potencia de la radio. A 20 dBm (la de la torre) el RFM95W pide ~120 mA al
// transmitir y con la pila se congelaba después de la primera baliza
// (2026-11-24). A 14 dBm pide ~45 mA y sigue alcanzando cientos de metros.
#define POTENCIA_SECUNDARIA_DBM 14

// Batería (opcional; mismo divisor que la primaria: 100k / 33k hacia GPIO1).
// Sin divisor se reporta 0.00 V y el panel lo muestra como "sin medir".
#define USAR_MEDICION_BATERIA  1
#define BATERIA_R_ARRIBA_KOHM  100.0f
#define BATERIA_R_ABAJO_KOHM   33.0f
#define BATERIA_MINIMA_REAL_V  3.0f

// Baliza sonora/luminosa de respaldo (riesgo 2 del PDR: pérdida de GPS).
// Empieza este tiempo después de encender: la secundaria no tiene barómetro
// para saber cuándo aterrizó.
#define BALIZA_SONORA_DESPUES_DE_MIN 8
#define BUZZER_ACTIVO_ALTO     1
