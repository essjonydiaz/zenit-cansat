// =============================================================================
//  Pines.h — Mapa ÚNICO de conexiones para todas las placas ESP32 DevKit V1
//  del CanSat Zénit (primaria, secundaria, receptor de tierra y pruebas).
//
//  Si electrónica cambia un cable, se cambia AQUÍ y en docs/02-conexiones.md.
//
//  Reglas del ESP32 que se respetaron:
//   - GPIO 6 a 11 están conectados a la memoria flash: NUNCA usarlos.
//   - GPIO 34, 35, 36, 39 son solo de entrada (sirven para medir batería).
//   - GPIO 20, 24, 28-31 no existen en el ESP32.
//   - GPIO 0, 2, 12, 15 afectan el arranque: se evitan para periféricos
//     (el GPIO 2 solo maneja el LED integrado).
// =============================================================================
#pragma once
#include <stdint.h>

namespace pines {

// --- Bus I2C (BMP280 en 0x76/0x77 y MPU6050 en 0x68) ---
constexpr int8_t I2C_SDA = 21;
constexpr int8_t I2C_SCL = 22;

// --- Bus SPI VSPI (compartido por LoRa y microSD, cada uno con su CS) ---
constexpr int8_t SPI_SCK  = 18;
constexpr int8_t SPI_MISO = 19;
constexpr int8_t SPI_MOSI = 23;

// --- LoRa SX1278 (Ra-02) ---
constexpr int8_t LORA_CS   = 5;   // NSS
constexpr int8_t LORA_RST  = 14;  // RESET
constexpr int8_t LORA_DIO0 = 26;  // DIO0 (interrupción TX/RX listo)

// --- microSD (lector SPI) ---
constexpr int8_t SD_CS = 4;

// --- Servo SG90 del desacople (señal PWM) ---
constexpr int8_t SERVO_DESACOPLE = 13;

// --- GPS NEO-6M por UART2 (TX del GPS -> RX2 del ESP32) ---
constexpr int8_t GPS_RX = 16;  // RX2 del ESP32  <- TX del GPS
constexpr int8_t GPS_TX = 17;  // TX2 del ESP32  -> RX del GPS

// --- Medición de batería (divisor resistivo) — pin solo de entrada ---
constexpr int8_t BATERIA_ADC = 34;

// --- Indicadores ---
constexpr int8_t BUZZER = 25;  // buzzer activo para localizar el satélite
constexpr int8_t LED    = 2;   // LED azul integrado del DevKit

}  // namespace pines
