// =============================================================================
//  P5 — Registro en microSD con el OpenLog
//  1) Comprueba que el OpenLog responde (imprime '<' al arrancar).
//  2) Escribe 1000 líneas como las del vuelo (25 por segundo) y mide si el
//     puerto alcanza. Luego, en la PC, abrir el archivo LOGxxxxx.TXT de la
//     microSD y verificar que están las 1000 líneas, numeradas sin huecos.
//
//  IMPORTANTE: el OpenLog viene a 9600 baudios. Copiar a la microSD el archivo
//  documentos/openlog/config.txt (115200 baudios) ANTES de esta prueba.
//  Conexión: GPIO4 -> RXI del OpenLog, TXO del OpenLog -> GPIO41, VCC 3.3 V, GND.
//  Criterio: 1000 de 1000 líneas en el archivo.
// =============================================================================
#include <Arduino.h>

#include "ZenitComun.h"

static HardwareSerial& openlog = Serial2;

void setup() {
  Serial.begin(115200);
  delay(500);
  openlog.setTxBufferSize(4096);
  openlog.begin(115200, SERIAL_8N1, heltec::OPENLOG_RX, heltec::OPENLOG_TX);
  Serial.println("P5 OpenLog: esperando su '<' (2.5 s)...");
  bool visto = false;
  const uint32_t t0 = millis();
  while (millis() - t0 < 2500 && !visto) {
    while (openlog.available()) {
      const char c = openlog.read();
      Serial.write(c);
      if (c == '<') visto = true;
    }
  }
  Serial.printf("\nOpenLog %s\n", visto ? "RESPONDIO (archivo abierto)"
                                        : "NO respondio: revisar cables, microSD y config.txt");

  Serial.println("Escribiendo 1000 lineas a 25 por segundo...");
  uint32_t maxMs = 0;
  for (int i = 1; i <= 1000; ++i) {
    const uint32_t a = micros();
    openlog.printf("%d,%lu,123.45,-9.87,101325,25.3,0.012,-0.034,0.998,1.2,-0.4,0.1,"
                   "12.3,-4.5,170.0,1.02,3.10,9.10,25.193600,-99.841241,10,8.1,286.0,127\n",
                   i, (unsigned long)millis());
    maxMs = max(maxMs, (uint32_t)((micros() - a) / 1000));
    delay(40);
  }
  openlog.flush();
  Serial.printf("Listo. Peor tiempo de escritura: %lu ms (debe ser < 5 ms)\n",
                (unsigned long)maxMs);
  Serial.println("Apaga, saca la microSD y cuenta las lineas del ultimo LOGxxxxx.TXT");
}

void loop() {}
