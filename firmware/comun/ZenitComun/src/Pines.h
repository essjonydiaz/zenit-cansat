// =============================================================================
//  Pines.h — Mapa ÚNICO de conexiones del CanSat Zénit (según el PDR, etapa 3).
//
//    Carga primaria  -> Heltec WiFi LoRa 32 V3  (ESP32-S3 + SX1262 + OLED)
//    Receptor tierra -> Heltec WiFi LoRa 32 V3  (misma placa, solo radio + OLED)
//    Carga secundaria-> ESP32-C3 SuperMini + RFM95W (SX1276) + GPS NEO-6M
//
//  Si electrónica cambia un cable, se cambia AQUÍ y en docs/02-conexiones.md.
//  Antes de cambiar un pin, revisar las reglas de cada placa (abajo).
// =============================================================================
#pragma once
#include <stdint.h>

// -----------------------------------------------------------------------------
//  Heltec WiFi LoRa 32 V3 (ESP32-S3FN8)
//  Reglas de esta placa:
//   - GPIO 8-14 van al radio SX1262 por dentro: NO se pueden usar.
//   - GPIO 17/18 (I2C del OLED) y 21 (reset del OLED) son internos.
//   - GPIO 19/20 = USB, 43/44 = puerto serie USB (CP2102): no usar.
//   - GPIO 26, 33-34, 37-38: no usar (memoria / control interno).
//   - GPIO 0, 45, 46: afectan el arranque. 35 = LED blanco. 36 = Vext.
//   - GPIO 22-25 NO EXISTEN en el ESP32-S3 (el diagrama del PDR usa 25/26).
//   - Libres en los pines de la placa: 2-7 (con ADC), 39-42, 47, 48.
//   - Entradas analógicas: usar ADC1 = GPIO 1-10 (aquí: 7).
// -----------------------------------------------------------------------------
namespace heltec {

// Radio SX1262 integrado (fijo en la placa)
constexpr int8_t LORA_NSS  = 8;
constexpr int8_t LORA_SCK  = 9;
constexpr int8_t LORA_MOSI = 10;
constexpr int8_t LORA_MISO = 11;
constexpr int8_t LORA_RST  = 12;
constexpr int8_t LORA_BUSY = 13;
constexpr int8_t LORA_DIO1 = 14;

// Pantalla OLED SSD1306 integrada (bus I2C propio, fijo en la placa)
constexpr int8_t OLED_SDA = 17;
constexpr int8_t OLED_SCL = 18;
constexpr int8_t OLED_RST = 21;
constexpr int8_t VEXT     = 36;  // LOW = enciende la pantalla y los pines "Ve"

constexpr int8_t LED   = 35;  // LED blanco integrado
constexpr int8_t BOTON = 0;   // botón PRG

// ---- Conexiones externas de la CARGA PRIMARIA ----
// GY-91 (MPU9250 en 0x68 + BMP280 en 0x76) por I2C (bus "Wire")
constexpr int8_t I2C_SDA = 47;
constexpr int8_t I2C_SCL = 48;

// GPS NEO-M8N por UART1  (TX del GPS -> GPS_RX de la placa)
constexpr int8_t GPS_RX = 5;   // la placa RECIBE aquí  <- TX del GPS
constexpr int8_t GPS_TX = 6;   // la placa ENVÍA aquí   -> RX del GPS

// OpenLog (registro en microSD) por UART2. NO SE USA: se vuela sin microSD
// (REGISTRO_NINGUNO en config.h) y GPIO4 ahora es del servo del autogiro.
// Si algún día se agrega un OpenLog o lector SPI, moverlo a otros pines.
constexpr int8_t OPENLOG_TX = 4;  // la placa ENVÍA aquí  -> RXI del OpenLog
constexpr int8_t OPENLOG_RX = 41; // la placa RECIBE aquí <- TXO del OpenLog (para saber si está vivo)

// Alternativa si se usa un lector microSD SPI en lugar del OpenLog
// (bus SPI propio, separado del radio). Ver REGISTRO_TIPO en config.h.
constexpr int8_t SD_CS   = 4;
constexpr int8_t SD_SCK  = 41;
constexpr int8_t SD_MISO = 39;
constexpr int8_t SD_MOSI = 40;

// Servos SG90 (señal PWM; alimentación 5 V del MP1584EN, NO de la placa)
constexpr int8_t SERVO_DESACOPLE = 2;  // suelta la carga secundaria
constexpr int8_t SERVO_AUTOGIRO  = 4;  // libera las palas del autogiro (Diego lo soldó en GPIO4)

// Voltaje de la pila de 9 V: divisor 100k / 33k hacia este pin (ADC1_CH6)
constexpr int8_t BATERIA_ADC = 7;

// Buzzer de localización (opcional; si no se instala, no pasa nada)
constexpr int8_t BUZZER = 42;

}  // namespace heltec

// -----------------------------------------------------------------------------
//  ESP32-C3 SuperMini (carga secundaria)
//  Reglas de esta placa:
//   - Solo existen GPIO 0-10, 20 y 21.
//   - GPIO 2, 8 y 9 afectan el arranque (8 = LED azul, activo en LOW; 9 = BOOT).
//   - El USB es nativo: el monitor serie va por USB (USB CDC), así que los
//     pines 20/21 quedan libres para el GPS.
//   - Entradas analógicas: GPIO 0-4.
// -----------------------------------------------------------------------------
namespace c3 {

// RFM95W / SX1276 (915 MHz) — según el diagrama de la carga secundaria del PDR
constexpr int8_t LORA_SCK  = 4;
constexpr int8_t LORA_MISO = 5;
constexpr int8_t LORA_MOSI = 6;
constexpr int8_t LORA_NSS  = 7;   // con resistencia de 10k a 3.3 V (como en el PDR)
constexpr int8_t LORA_RST  = 3;
constexpr int8_t LORA_DIO0 = 10;

// GPS NEO-6M por UART1 (TX del GPS -> GPIO20)
constexpr int8_t GPS_RX = 20;
constexpr int8_t GPS_TX = 21;

// Voltaje de la pila de 9 V (opcional): divisor 100k / 33k hacia GPIO1
constexpr int8_t BATERIA_ADC = 1;

// Baliza sonora (opcional) y LED integrado
constexpr int8_t BUZZER = 0;
constexpr int8_t LED = 8;  // activo en LOW

}  // namespace c3
