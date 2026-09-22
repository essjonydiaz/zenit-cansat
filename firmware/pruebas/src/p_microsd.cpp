// =============================================================================
//  Prueba de microSD: escribe 2000 líneas como las del vuelo, mide cuánto
//  tarda, las vuelve a leer y compara.
//  Criterio: escritura > 25 líneas/s (lo que registra la primaria) y 0 errores.
//  La tarjeta debe estar en FAT32 (hasta 32 GB).
// =============================================================================
#include <Arduino.h>
#include <SD.h>
#include <SPI.h>

#include "ZenitComun.h"

void setup() {
  Serial.begin(115200);
  delay(500);
  SPI.begin(pines::SPI_SCK, pines::SPI_MISO, pines::SPI_MOSI);
  pinMode(pines::LORA_CS, OUTPUT);
  digitalWrite(pines::LORA_CS, HIGH);  // LoRa fuera del bus
  if (!SD.begin(pines::SD_CS, SPI, 4000000)) {
    Serial.println("FALLA: no se detecta la microSD (CS=4, FAT32, 3.3V)");
    return;
  }
  const char* ruta = "/PRUEBA.CSV";
  SD.remove(ruta);
  File f = SD.open(ruta, FILE_WRITE);
  const uint32_t t0 = millis();
  for (int i = 0; i < 2000; ++i) {
    f.printf("%d,1234567,3,199.52,-10.12,451.30,94012,25.1,0.012,-0.020,1.003,12.0,-3.0,600.1\n", i);
    if (i % 25 == 0) f.flush();
  }
  f.close();
  const uint32_t ms = millis() - t0;
  Serial.printf("Escritura: 2000 lineas en %lu ms -> %.0f lineas/s (%s)\n", (unsigned long)ms,
                2000000.0f / ms, 2000000.0f / ms > 25 ? "PASA" : "FALLA");

  f = SD.open(ruta);
  int leidas = 0, errores = 0;
  while (f.available()) {
    String l = f.readStringUntil('\n');
    if (l.toInt() != leidas) errores++;
    leidas++;
  }
  f.close();
  Serial.printf("Lectura: %d lineas, %d errores (%s)\n", leidas, errores,
                (leidas == 2000 && errores == 0) ? "PASA" : "FALLA");
}

void loop() {}
