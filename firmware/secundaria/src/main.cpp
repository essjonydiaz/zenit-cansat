// =============================================================================
//  CanSat Zénit — Firmware de la CARGA SECUNDARIA (baliza de localización)
//
//  La secundaria cae en caída libre después del desacople. Su única tarea
//  electrónica es decir DÓNDE está:
//    - lee el GPS (NEO-6M) y
//    - transmite cada segundo:  $B,seq,t_ms,lat,lon,sats,fix,bat*HH
//  La primaria recibe esta trama y calcula distancia y dirección hacia la
//  secundaria (Haversine). El receptor de tierra también la escucha.
//
//  Si no cabe/pesa demasiado (7 cm de alto máximo), la alternativa es una
//  baliza sin GPS: la primaria usaría solo la intensidad de señal (RSSI).
// =============================================================================
#include <Arduino.h>
#include <LoRa.h>
#include <SPI.h>
#include <TinyGPS++.h>

#include "ZenitComun.h"
#include "config.h"

static TinyGPSPlus gps;
static uint32_t secuencia = 0;
static uint32_t tProximaBaliza = 0;
static bool loraOk = false;

static void buzzer(bool on) {
  digitalWrite(pines::BUZZER, (on == (BUZZER_ACTIVO_ALTO == 1)) ? HIGH : LOW);
}

static float leerBateria() {
  uint32_t mv = 0;
  for (int i = 0; i < 8; ++i) mv += analogReadMilliVolts(pines::BATERIA_ADC);
  return (mv / 8000.0f) * (BATERIA_R_ARRIBA_KOHM + BATERIA_R_ABAJO_KOHM) / BATERIA_R_ABAJO_KOHM;
}

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

static void enviarBaliza() {
  const bool fix = gps.location.isValid() && gps.location.age() < 3000;
  char carga[120];
  snprintf(carga, sizeof(carga), "B,%lu,%lu,%.6f,%.6f,%u,%d,%.2f", (unsigned long)++secuencia,
           (unsigned long)millis(), fix ? gps.location.lat() : 0.0,
           fix ? gps.location.lng() : 0.0,
           gps.satellites.isValid() ? (unsigned)gps.satellites.value() : 0u, fix ? 1 : 0,
           leerBateria());
  char trama[protocolo::TAM_MAX_TRAMA];
  if (protocolo::enmarcar(carga, trama, sizeof(trama)) == 0) return;
  Serial.print("USB,");
  Serial.println(trama);
  if (loraOk) {
    LoRa.beginPacket();
    LoRa.print(trama);
    LoRa.endPacket();
  }
  digitalWrite(pines::LED, !digitalRead(pines::LED));
}

void setup() {
  Serial.begin(115200);
  pinMode(pines::LED, OUTPUT);
  pinMode(pines::BUZZER, OUTPUT);
  buzzer(false);
  analogSetPinAttenuation(pines::BATERIA_ADC, ADC_11db);
  Serial2.begin(GPS_BAUDIOS, SERIAL_8N1, pines::GPS_RX, pines::GPS_TX);
  loraOk = iniciarLora();
  Serial.printf("INFO,ZENIT_SECUNDARIA,lora=%d\n", loraOk);
  // 2 pitidos = listo; 1 largo = falla la radio
  for (int i = 0; i < (loraOk ? 2 : 1); ++i) {
    buzzer(true);
    delay(loraOk ? 80 : 800);
    buzzer(false);
    delay(80);
  }
  randomSeed(esp_random());
}

void loop() {
  while (Serial2.available()) gps.encode(Serial2.read());

  const uint32_t ahora = millis();
  if ((int32_t)(ahora - tProximaBaliza) >= 0) {
    enviarBaliza();
    tProximaBaliza = ahora + PERIODO_BALIZA_MS +
                     random(-VARIACION_BALIZA_MS, VARIACION_BALIZA_MS + 1);
  }

  // Buzzer de localización: 150 ms cada 2 s después de N minutos encendida.
  const bool localizar = ahora > BUZZER_DESPUES_DE_MIN * 60000UL && (ahora % 2000) < 150;
  buzzer(localizar);
}
