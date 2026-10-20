// =============================================================================
//  RadioConfig.h — Parámetros LoRa ÚNICOS para primaria, secundaria y receptor.
//  Si no coinciden en las tres placas, no se escuchan entre sí. Por eso viven
//  en un solo lugar.
//
//  Radios del PDR: SX1262 (Heltec V3, primaria y receptor) y RFM95W/SX1276
//  (secundaria). Son chips distintos pero hablan LoRa entre sí si TODO esto
//  es igual: frecuencia, SF, ancho de banda, coding rate, preámbulo, palabra
//  de sincronía, CRC y encabezado explícito. RadioLib traduce la palabra de
//  sincronía de 1 byte al formato del SX1262 (0x5A -> 0x54A4) automáticamente.
// =============================================================================
#pragma once
#include <stdint.h>

namespace radio {

// Banda ISM 902–928 MHz (antenas de 915 MHz del PDR). Si el día del
// lanzamiento hay interferencia de otros equipos, cambiar a 914.0 o 916.0
// (en las tres placas a la vez: recompilar las tres).
constexpr float FRECUENCIA_MHZ = 915.0f;
constexpr uint8_t SPREADING_FACTOR = 7;    // SF7: tramas cortas
constexpr float ANCHO_BANDA_KHZ = 250.0f;  // 250 kHz: una trama T tarda ~0.12 s
constexpr uint8_t CODING_RATE_4_DE = 5;    // 4/5
constexpr uint16_t PREAMBULO = 8;
// 20 dBm = 100 mW. El SX1262 llega a 22 y el RFM95W a 20: se usa el mismo
// valor en las tres para que el enlace sea parejo. Alcance esperado en campo
// abierto con antenas verticales: varios km (requisito del PDR: >= 1 km).
constexpr int8_t POTENCIA_DBM = 20;
// Palabra de sincronía propia del equipo: ignora tramas de otros equipos que
// usen la palabra por defecto (0x12) o LoRaWAN (0x34).
constexpr uint8_t SYNC_WORD = 0x5A;
// El SX1262 del Heltec V3 usa un oscilador TCXO alimentado a 1.8 V por DIO3.
constexpr float TCXO_HELTEC_V = 1.8f;
// Límite de corriente del amplificador (mA). 140 mA permite los 20 dBm.
constexpr float LIMITE_CORRIENTE_MA = 140.0f;

}  // namespace radio
