// =============================================================================
//  P3 — Alcance de la comunicación LoRa (requisito 4 del PDR: >= 1 km)
//
//  Esta placa (Heltec V3 de la primaria, con la antena ya montada DENTRO del
//  CanSat) transmite cada 500 ms:  $R,<seq>,<t_ms>,<potencia>*HH
//  En tierra: receptor + estación terrena. El panel muestra RSSI, SNR y el %
//  de paquetes perdidos (huecos en <seq>). La OLED muestra cuántos van.
//
//  Procedimiento: alejarse en línea recta 100, 250, 500, 750 y 1000 m (y más
//  si se puede) y anotar RSSI y pérdidas en cada punto (grabar video).
//  Criterio: a 1 km, pérdidas < 10 % y RSSI mejor que -115 dBm.
//
//  Para probar también la secundaria: subir su firmware normal; su baliza B
//  aparece en el mismo panel (prueba SX1262 <-> RFM95W).
// =============================================================================
#include <Arduino.h>
#include <ZenitPantalla.h>
#include <ZenitRadio.h>

#include "ZenitComun.h"

static uint32_t seq = 0;
static zradio::Enlace enlace;
static zpantalla::Pantalla pantalla;

void setup() {
  Serial.begin(115200);
  pinMode(heltec::LED, OUTPUT);
  pantalla.iniciar();
  enlace.iniciarHeltec();
  Serial.printf("P3 alcance LoRa: %s (%s)\n",
                enlace.ok() ? "transmitiendo cada 500 ms" : "FALLA LoRa",
                zradio::textoError(enlace.error()));
}

void loop() {
  if (!enlace.ok()) {
    pantalla.renglon(0, "P3: FALLA LoRa");
    pantalla.renglon(1, "%d %s", enlace.error(), zradio::textoError(enlace.error()));
    pantalla.mostrar();
    delay(1000);
    return;
  }
  char carga[48], trama[64];
  snprintf(carga, sizeof(carga), "R,%lu,%lu,%d", (unsigned long)++seq, (unsigned long)millis(),
           radio::POTENCIA_DBM);
  protocolo::enmarcar(carga, trama, sizeof(trama));
  enlace.enviar(trama);
  Serial.println(trama);
  digitalWrite(heltec::LED, seq % 2);
  pantalla.renglon(0, "P3 alcance LoRa");
  pantalla.renglon(1, "%.1f MHz %d dBm", radio::FRECUENCIA_MHZ, radio::POTENCIA_DBM);
  pantalla.renglon(2, "Enviados: %lu", (unsigned long)seq);
  pantalla.mostrar();
  delay(500);
}
