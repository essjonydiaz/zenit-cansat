// =============================================================================
//  CanSat Zénit — Firmware del RECEPTOR de la estación terrena
//  (ESP32 DevKit V1 + LoRa SX1278 conectado por USB a la laptop)
//
//  Es un "puente" transparente:
//    Aire -> PC :  por cada paquete LoRa imprime   RX,<rssi>,<snr>,<trama>
//    PC -> Aire :  si la PC manda una línea          TX,<trama>
//                  la transmite tal cual (comandos $C,...*HH para la primaria)
//    Estado     :  INFO,... (arranque, latido cada 5 s, confirmaciones)
//  La estación terrena (Node.js) es la que interpreta las tramas.
// =============================================================================
#include <Arduino.h>
#include <LoRa.h>
#include <SPI.h>

#include "ZenitComun.h"
#include "config.h"

static bool loraOk = false;
static uint32_t recibidos = 0, enviados = 0;
static uint32_t tLatido = 0;
static char linea[protocolo::TAM_MAX_TRAMA + 8];
static size_t largoLinea = 0;

static bool iniciarLora() {
  SPI.begin(pines::SPI_SCK, pines::SPI_MISO, pines::SPI_MOSI);
  LoRa.setPins(pines::LORA_CS, pines::LORA_RST, pines::LORA_DIO0);
  if (!LoRa.begin(radio::FRECUENCIA_HZ)) return false;
  LoRa.setSpreadingFactor(radio::SPREADING_FACTOR);
  LoRa.setSignalBandwidth(radio::ANCHO_BANDA_HZ);
  LoRa.setCodingRate4(radio::CODING_RATE_4_DE);
  LoRa.setTxPower(radio::POTENCIA_DBM);
  LoRa.setSyncWord(radio::SYNC_WORD);
  LoRa.enableCrc();
  return true;
}

static void procesarLineaPc() {
  linea[largoLinea] = '\0';
  if (strncmp(linea, "TX,", 3) == 0) {
    if (!loraOk) {
      Serial.println("INFO,TX_ERROR,sin_radio");
      return;
    }
    LoRa.beginPacket();
    LoRa.print(linea + 3);
    LoRa.endPacket();
    enviados++;
    Serial.printf("INFO,TX_OK,%s\n", linea + 3);
  } else if (strcmp(linea, "PING") == 0) {
    Serial.printf("INFO,PONG,lora=%d\n", loraOk);
  }
}

void setup() {
  Serial.begin(BAUDIOS_USB);
  pinMode(pines::LED, OUTPUT);
  delay(200);
  loraOk = iniciarLora();
  Serial.printf("INFO,RECEPTOR_LISTO,lora=%d,freq=%ld,sf=%d,bw=%ld,sync=0x%02X\n", loraOk,
                radio::FRECUENCIA_HZ, radio::SPREADING_FACTOR, radio::ANCHO_BANDA_HZ,
                radio::SYNC_WORD);
}

void loop() {
  // Aire -> PC
  if (loraOk) {
    const int n = LoRa.parsePacket();
    if (n > 0) {
      char buf[protocolo::TAM_MAX_TRAMA + 1];
      int i = 0;
      while (LoRa.available() && i < (int)protocolo::TAM_MAX_TRAMA) buf[i++] = (char)LoRa.read();
      while (LoRa.available()) LoRa.read();
      buf[i] = '\0';
      recibidos++;
      Serial.printf("RX,%d,%.1f,%s\n", LoRa.packetRssi(), LoRa.packetSnr(), buf);
      digitalWrite(pines::LED, !digitalRead(pines::LED));
    }
  }

  // PC -> Aire
  while (Serial.available()) {
    const char c = Serial.read();
    if (c == '\n' || c == '\r') {
      if (largoLinea > 0) procesarLineaPc();
      largoLinea = 0;
    } else if (largoLinea < sizeof(linea) - 1) {
      linea[largoLinea++] = c;
    }
  }

  if (millis() - tLatido >= PERIODO_LATIDO_MS) {
    tLatido = millis();
    Serial.printf("INFO,VIVO,lora=%d,rx=%lu,tx=%lu\n", loraOk, (unsigned long)recibidos,
                  (unsigned long)enviados);
  }
}
