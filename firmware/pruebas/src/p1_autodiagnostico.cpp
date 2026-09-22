// =============================================================================
//  P1 — Autodiagnóstico de la electrónica (continuidad y encendido)
//  Revisa cada módulo conectado al ESP32 y muestra PASA / FALLA.
//  Uso: subir env:p1_autodiagnostico, abrir el Monitor Serial (115200).
//  Se repite cada 10 s; presiona EN (reset) para reiniciar.
// =============================================================================
#include <Adafruit_BMP280.h>
#include <Adafruit_MPU6050.h>
#include <Arduino.h>
#include <LoRa.h>
#include <SD.h>
#include <SPI.h>
#include <Wire.h>

#include "ZenitComun.h"

static void resultado(const char* nombre, bool ok, const char* detalle = "") {
  Serial.printf("  [%s] %-22s %s\n", ok ? "PASA " : "FALLA", nombre, detalle);
}

static void diagnosticar() {
  Serial.println("\n========== AUTODIAGNÓSTICO CANSAT ZÉNIT ==========");
  char det[80];

  // --- I2C: qué direcciones responden ---
  Serial.print("  Bus I2C (SDA=21, SCL=22):");
  int encontrados = 0;
  for (uint8_t dir = 1; dir < 127; ++dir) {
    Wire.beginTransmission(dir);
    if (Wire.endTransmission() == 0) {
      Serial.printf(" 0x%02X", dir);
      encontrados++;
    }
  }
  Serial.println(encontrados ? "" : " (nada)");

  Adafruit_BMP280 bmp(&Wire);
  const bool bmpOk = bmp.begin(0x76) || bmp.begin(0x77);
  if (bmpOk) snprintf(det, sizeof(det), "%.0f Pa, %.1f C", bmp.readPressure(), bmp.readTemperature());
  resultado("BMP280 (presion)", bmpOk, bmpOk ? det : "revisar SDA/SCL/3.3V; dir 0x76 o 0x77");

  Adafruit_MPU6050 mpu;
  const bool mpuOk = mpu.begin(0x68, &Wire);
  if (mpuOk) {
    sensors_event_t a, g, t;
    mpu.getEvent(&a, &g, &t);
    const float gTot = sqrtf(a.acceleration.x * a.acceleration.x + a.acceleration.y * a.acceleration.y +
                             a.acceleration.z * a.acceleration.z) / filtros::G;
    snprintf(det, sizeof(det), "|a| = %.2f g (quieto debe ser ~1.00)", gTot);
  }
  resultado("MPU6050 (IMU)", mpuOk, mpuOk ? det : "revisar SDA/SCL; dir 0x68 (AD0 a GND)");

  // --- SPI: LoRa y microSD ---
  SPI.begin(pines::SPI_SCK, pines::SPI_MISO, pines::SPI_MOSI);
  pinMode(pines::SD_CS, OUTPUT);
  digitalWrite(pines::SD_CS, HIGH);
  LoRa.setPins(pines::LORA_CS, pines::LORA_RST, pines::LORA_DIO0);
  const bool loraOk = LoRa.begin(radio::FRECUENCIA_HZ);
  resultado("LoRa SX1278", loraOk, loraOk ? "433 MHz" : "revisar NSS=5 RST=14 DIO0=26 y 3.3V");
  if (loraOk) LoRa.end();

  const bool sdOk = SD.begin(pines::SD_CS, SPI, 4000000);
  if (sdOk) snprintf(det, sizeof(det), "%llu MB", SD.cardSize() / (1024ULL * 1024ULL));
  resultado("microSD", sdOk, sdOk ? det : "¿tarjeta insertada y en FAT32? CS=4");
  if (sdOk) SD.end();

  // --- GPS: ¿llegan caracteres NMEA por UART2? ---
  Serial2.begin(9600, SERIAL_8N1, pines::GPS_RX, pines::GPS_TX);
  uint32_t t0 = millis(), caracteres = 0;
  bool dolar = false;
  while (millis() - t0 < 1500) {
    while (Serial2.available()) {
      if (Serial2.read() == '$') dolar = true;
      caracteres++;
    }
  }
  snprintf(det, sizeof(det), "%lu caracteres en 1.5 s", (unsigned long)caracteres);
  resultado("GPS (UART2)", dolar, dolar ? det : "sin datos: TX del GPS -> GPIO16, 9600 baud");

  // --- Batería ---
  uint32_t mv = 0;
  for (int i = 0; i < 16; ++i) mv += analogReadMilliVolts(pines::BATERIA_ADC);
  const float vPin = mv / 16000.0f;
  const float vBat = vPin * (100.0f + 33.0f) / 33.0f;  // divisor 100k/33k (pila 9 V)
  snprintf(det, sizeof(det), "pin=%.2f V -> bateria ~%.2f V (divisor 100k/33k)", vPin, vBat);
  resultado("Bateria (GPIO34)", vPin > 0.3f, det);

  Serial.println("==================================================");
}

void setup() {
  Serial.begin(115200);
  delay(500);
  Wire.begin(pines::I2C_SDA, pines::I2C_SCL, 400000);
  analogSetPinAttenuation(pines::BATERIA_ADC, ADC_11db);
}

void loop() {
  diagnosticar();
  delay(10000);
}
