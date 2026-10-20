// =============================================================================
//  CanSat Zénit — Firmware del RECEPTOR de la estación terrena
//  (Heltec WiFi LoRa 32 V3 conectado por USB a la laptop + antena SMA 915 MHz)
//
//  Es un "puente" transparente:
//    Aire -> PC :  por cada paquete LoRa imprime   RX,<rssi>,<snr>,<trama>
//    PC -> Aire :  si la PC manda una línea          TX,<trama>
//                  la transmite tal cual (comandos $C,...*HH para la primaria)
//    Estado     :  INFO,... (arranque, latido cada 5 s, confirmaciones)
//  La estación terrena (Node.js) es la que interpreta las tramas.
//
//  La pantalla OLED muestra paquetes recibidos, RSSI/SNR del último y hace
//  cuánto llegó: sirve para apuntar la antena sin mirar la laptop.
// =============================================================================
#include <Arduino.h>
#include <ZenitPantalla.h>
#include <ZenitRadio.h>

#include "ZenitComun.h"
#include "config.h"

static zradio::Enlace enlace;
static zpantalla::Pantalla pantalla;
static uint32_t tLatido = 0, tPantalla = 0, tUltimoRx = 0;
static int16_t ultimoRssi = 0;
static float ultimoSnr = 0;
static char ultimoTipo = '-';
static char linea[protocolo::TAM_MAX_TRAMA + 8];
static size_t largoLinea = 0;

static void procesarLineaPc() {
  linea[largoLinea] = '\0';
  if (strncmp(linea, "TX,", 3) == 0) {
    if (!enlace.ok()) {
      Serial.println("INFO,TX_ERROR,sin_radio");
      return;
    }
    if (enlace.enviar(linea + 3)) {
      Serial.printf("INFO,TX_OK,%s\n", linea + 3);
    } else {
      Serial.printf("INFO,TX_ERROR,%d\n", enlace.error());
    }
  } else if (strcmp(linea, "PING") == 0) {
    Serial.printf("INFO,PONG,lora=%d\n", enlace.ok());
  }
}

static void actualizarPantalla() {
  if (!pantalla.ok()) return;
  pantalla.renglon(0, "ZENIT receptor %s", enlace.ok() ? "" : "SIN RADIO");
  pantalla.renglon(1, "%.1f MHz SF%u BW%.0f", radio::FRECUENCIA_MHZ, radio::SPREADING_FACTOR,
                   radio::ANCHO_BANDA_KHZ);
  pantalla.renglon(2, "RX:%lu TX:%lu CRC:%lu", (unsigned long)enlace.recibidos(),
                   (unsigned long)enlace.enviados(), (unsigned long)enlace.crcMalos());
  if (tUltimoRx) {
    pantalla.renglon(3, "Ult:%c RSSI %d SNR %.1f", ultimoTipo, ultimoRssi, ultimoSnr);
    pantalla.renglon(4, "hace %.1f s", (millis() - tUltimoRx) / 1000.0f);
  } else {
    pantalla.renglon(3, "Esperando paquetes...");
    pantalla.renglon(4, "%s", "");
  }
  pantalla.mostrar();
}

void setup() {
  Serial.begin(BAUDIOS_USB);
  pinMode(heltec::LED, OUTPUT);
  pantalla.iniciar();
  delay(200);
  enlace.iniciarHeltec();
  Serial.printf("INFO,RECEPTOR_LISTO,lora=%d,chip=%s,freq=%.1f,sf=%u,bw=%.0f,sync=0x%02X,err=%d\n",
                enlace.ok(), enlace.chip(), radio::FRECUENCIA_MHZ, radio::SPREADING_FACTOR,
                radio::ANCHO_BANDA_KHZ, radio::SYNC_WORD, enlace.error());
  if (!enlace.ok()) {
    Serial.printf("INFO,LORA_ERROR,%d,%s\n", enlace.error(), zradio::textoError(enlace.error()));
  }
}

void loop() {
  // Aire -> PC
  zradio::Paquete p;
  if (enlace.recibir(p)) {
    Serial.printf("RX,%d,%.1f,%s\n", p.rssi, p.snr, p.texto);
    ultimoRssi = p.rssi;
    ultimoSnr = p.snr;
    ultimoTipo = p.texto[0] == '$' ? p.texto[1] : '?';
    tUltimoRx = millis();
    digitalWrite(heltec::LED, !digitalRead(heltec::LED));
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
    Serial.printf("INFO,VIVO,lora=%d,rx=%lu,tx=%lu,crc=%lu\n", enlace.ok(),
                  (unsigned long)enlace.recibidos(), (unsigned long)enlace.enviados(),
                  (unsigned long)enlace.crcMalos());
  }
  if (millis() - tPantalla >= PERIODO_PANTALLA_MS) {
    tPantalla = millis();
    actualizarPantalla();
  }
}
