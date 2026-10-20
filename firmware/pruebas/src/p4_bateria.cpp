// =============================================================================
//  P4 — Autonomía de la pila de 9 V (requisito 6 del PDR: >= 30 min de vuelo)
//  Enciende la primaria "como en vuelo" (LoRa transmitiendo 2 veces por
//  segundo, como la telemetría real) y registra cada 10 s:  minutos, voltaje.
//  Dejarlo hasta que el voltaje caiga bajo ~6.5 V (el MP1584EN ya no da 5 V
//  estables a los servos).
//  Criterio: autonomía >= 60 min (espera en la mesa de lanzamiento + subida
//  del dron + vuelo + 10 min de transmisión en tierra, con margen).
//  Requiere el divisor 100k/33k hacia GPIO6.
// =============================================================================
#include <Arduino.h>
#include <ZenitRadio.h>

#include "ZenitComun.h"

// Ajustar igual que en firmware/primaria/include/config.h
constexpr float R_ARRIBA = 100.0f, R_ABAJO = 33.0f;

static zradio::Enlace enlace;

void setup() {
  Serial.begin(115200);
  analogSetPinAttenuation(heltec::BATERIA_ADC, ADC_11db);
  enlace.iniciarHeltec();
  Serial.printf("# LoRa=%s\n", enlace.ok() ? "OK" : "FALLA");
  Serial.println("minutos,voltaje_v");
}

void loop() {
  static uint32_t tRegistro = 0;
  // Carga de trabajo parecida al vuelo: una trama de ~150 bytes cada 0.5 s.
  enlace.enviar(
      "$R,0,0,carga_de_prueba_de_bateria_de_150_bytes_aprox_para_simular_la_trama_T_de_"
      "telemetria_del_cansat_zenit_durante_todo_el_vuelo_xxxxxxxxxxxxxxxxxxxxx*00");
  if (millis() - tRegistro >= 10000) {
    tRegistro = millis();
    uint32_t mv = 0;
    for (int i = 0; i < 16; ++i) mv += analogReadMilliVolts(heltec::BATERIA_ADC);
    const float v = (mv / 16000.0f) * (R_ARRIBA + R_ABAJO) / R_ABAJO;
    Serial.printf("%.1f,%.2f\n", millis() / 60000.0f, v);
  }
  delay(500);
}
