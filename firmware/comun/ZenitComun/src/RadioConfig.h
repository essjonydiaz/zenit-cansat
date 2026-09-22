// =============================================================================
//  RadioConfig.h — Parámetros LoRa ÚNICOS para primaria, secundaria y receptor.
//  Si no coinciden en las tres placas, no se escuchan entre sí. Por eso viven
//  en un solo lugar.
// =============================================================================
#pragma once
#include <stdint.h>

namespace radio {

// SX1278 / Ra-02 = 433 MHz. Banda ISM permitida en México: 433.05–434.79 MHz.
// Si el día del lanzamiento hay interferencia de otros equipos, cambiar a
// 433.5E6 o 434.0E6 (en las tres placas a la vez: recompilar las tres).
constexpr long FRECUENCIA_HZ = 433000000L;
constexpr int SPREADING_FACTOR = 7;      // SF7: tramas cortas; alcance >> 250 m
constexpr long ANCHO_BANDA_HZ = 250000L; // 250 kHz
constexpr int CODING_RATE_4_DE = 5;      // 4/5
constexpr int POTENCIA_DBM = 17;
// Palabra de sincronía propia del equipo: ignora tramas de otros equipos que
// usen la palabra por defecto (0x12).
constexpr uint8_t SYNC_WORD = 0x5A;

}  // namespace radio
