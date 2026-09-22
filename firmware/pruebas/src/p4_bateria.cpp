// =============================================================================
//  P4 — Autonomía de batería
//  Enciende la carga "como en vuelo" (LoRa transmitiendo 4 veces por segundo)
//  y registra cada 10 s:  minutos, voltaje. Dejarlo hasta que el voltaje
//  caiga bajo el mínimo del regulador.
//  Criterio: autonomía >= 60 min (espera en la mesa de lanzamiento + subida
//  del dron + vuelo + recuperación, con margen).
// =============================================================================
#include <Arduino.h>
#include <LoRa.h>
#include <SPI.h>

#include "ZenitComun.h"

// Ajustar igual que en firmware/primaria/include/config.h
constexpr float R_ARRIBA = 100.0f, R_ABAJO = 33.0f;

static bool loraOk = false;

void setup() {
  Serial.begin(115200);
  analogSetPinAttenuation(pines::BATERIA_ADC, ADC_11db);
  SPI.begin(pines::SPI_SCK, pines::SPI_MISO, pines::SPI_MOSI);
  LoRa.setPins(pines::LORA_CS, pines::LORA_RST, pines::LORA_DIO0);
  loraOk = LoRa.begin(radio::FRECUENCIA_HZ);
  if (loraOk) {
    LoRa.setSpreadingFactor(radio::SPREADING_FACTOR);
    LoRa.setSignalBandwidth(radio::ANCHO_BANDA_HZ);
    LoRa.setSyncWord(radio::SYNC_WORD);
    LoRa.setTxPower(radio::POTENCIA_DBM);
  }
  Serial.println("minutos,voltaje_v");
}

void loop() {
  static uint32_t tRegistro = 0;
  if (loraOk) {  // carga de trabajo parecida al vuelo
    LoRa.beginPacket();
    LoRa.print("$R,0,0,carga_de_prueba_de_bateria_de_100_bytes_aprox_para_simular_telemetria*00");
    LoRa.endPacket();
  }
  if (millis() - tRegistro >= 10000) {
    tRegistro = millis();
    uint32_t mv = 0;
    for (int i = 0; i < 16; ++i) mv += analogReadMilliVolts(pines::BATERIA_ADC);
    const float v = (mv / 16000.0f) * (R_ARRIBA + R_ABAJO) / R_ABAJO;
    Serial.printf("%.1f,%.2f\n", millis() / 60000.0f, v);
  }
  delay(250);
}
