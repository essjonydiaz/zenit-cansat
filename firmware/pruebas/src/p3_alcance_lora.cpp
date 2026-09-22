// =============================================================================
//  P3 — Alcance de la comunicación LoRa (y prueba de aceptación de 250 m)
//
//  Esta placa (con la antena ya montada DENTRO del CanSat) transmite cada
//  500 ms:  $R,<seq>,<t_ms>,<potencia>*HH
//  En tierra: receptor + estación terrena. El panel "Enlace" muestra RSSI,
//  SNR y el % de paquetes perdidos (huecos en <seq>).
//
//  Procedimiento: alejarse en línea recta 50, 100, 150, 200, 250, 300 m y
//  anotar RSSI y pérdidas en cada punto (grabar video para la Etapa 5).
//  Criterio: a 250 m, pérdidas < 10 % y RSSI mejor que -115 dBm.
// =============================================================================
#include <Arduino.h>
#include <LoRa.h>
#include <SPI.h>

#include "ZenitComun.h"

static uint32_t seq = 0;
static bool ok = false;

void setup() {
  Serial.begin(115200);
  pinMode(pines::LED, OUTPUT);
  SPI.begin(pines::SPI_SCK, pines::SPI_MISO, pines::SPI_MOSI);
  pinMode(pines::SD_CS, OUTPUT);
  digitalWrite(pines::SD_CS, HIGH);
  LoRa.setPins(pines::LORA_CS, pines::LORA_RST, pines::LORA_DIO0);
  ok = LoRa.begin(radio::FRECUENCIA_HZ);
  if (ok) {
    LoRa.setSpreadingFactor(radio::SPREADING_FACTOR);
    LoRa.setSignalBandwidth(radio::ANCHO_BANDA_HZ);
    LoRa.setCodingRate4(radio::CODING_RATE_4_DE);
    LoRa.setTxPower(radio::POTENCIA_DBM);
    LoRa.setSyncWord(radio::SYNC_WORD);
    LoRa.enableCrc();
  }
  Serial.printf("P3 alcance LoRa: %s\n", ok ? "transmitiendo cada 500 ms" : "FALLA LoRa");
}

void loop() {
  if (!ok) {
    delay(1000);
    return;
  }
  char carga[48], trama[64];
  snprintf(carga, sizeof(carga), "R,%lu,%lu,%d", (unsigned long)++seq, (unsigned long)millis(),
           radio::POTENCIA_DBM);
  protocolo::enmarcar(carga, trama, sizeof(trama));
  LoRa.beginPacket();
  LoRa.print(trama);
  LoRa.endPacket();
  Serial.println(trama);
  digitalWrite(pines::LED, seq % 2);
  delay(500);
}
