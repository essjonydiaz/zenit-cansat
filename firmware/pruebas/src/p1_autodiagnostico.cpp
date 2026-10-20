// =============================================================================
//  P1 — Autodiagnóstico de la electrónica de la CARGA PRIMARIA (Heltec V3)
//  Revisa cada módulo del PDR y muestra PASA / FALLA con la pista de qué
//  revisar. También lo resume en la pantalla OLED de la placa.
//  Uso: subir env:p1_autodiagnostico, abrir el Monitor Serial (115200).
//  Se repite cada 10 s; presiona RST para reiniciar.
// =============================================================================
#include <Arduino.h>
#include <Wire.h>
#include <ZenitPantalla.h>
#include <ZenitRadio.h>
#include <ZenitSensores.h>

#include "ZenitComun.h"

static zpantalla::Pantalla pantalla;
static zradio::Enlace enlace;
static int pasan = 0, fallan = 0;

static void resultado(const char* nombre, bool ok, const char* detalle = "") {
  Serial.printf("  [%s] %-26s %s\n", ok ? "PASA " : "FALLA", nombre, detalle);
  ok ? pasan++ : fallan++;
}

static void diagnosticar() {
  pasan = fallan = 0;
  Serial.println("\n========== AUTODIAGNOSTICO CANSAT ZENIT (primaria) ==========");
  char det[96];

  // --- I2C del GY-91: qué direcciones responden ---
  uint8_t dirs[16];
  const int n = zsensores::escanearI2c(Wire, dirs, 16);
  Serial.printf("  Bus I2C GY-91 (SDA=%d, SCL=%d):", heltec::I2C_SDA, heltec::I2C_SCL);
  for (int i = 0; i < n; ++i) Serial.printf(" 0x%02X", dirs[i]);
  Serial.println(n ? "   (esperado: 0x68 IMU, 0x76 barometro, 0x0C magnetometro)" : " (nada)");

  zsensores::Barometro baro;
  const bool bOk = baro.iniciar(Wire);
  float p = 0, t = 0;
  if (bOk && baro.leer(p, t)) {
    snprintf(det, sizeof(det), "%s 0x%02X: %.0f Pa, %.1f C", baro.modelo(), baro.direccion(), p, t);
  }
  resultado("Barometro BMP280/BME280", bOk, bOk ? det : "revisar SDA=41/SCL=42 y 3.3V");

  zsensores::Imu imu;
  const bool iOk = imu.iniciar(Wire);
  zsensores::LecturaImu l;
  if (iOk && imu.leer(l)) {
    const float g = sqrtf(l.ax * l.ax + l.ay * l.ay + l.az * l.az);
    snprintf(det, sizeof(det), "%s (WHO_AM_I 0x%02X): |a| = %.2f g (quieto ~1.00)", imu.modelo(),
             imu.quienSoy(), g);
  }
  resultado("IMU MPU9250", iOk, iOk ? det : "revisar SDA/SCL; dir 0x68 (AD0 a GND)");
  if (iOk) {
    zsensores::LecturaMag m;
    delay(20);
    const bool mOk = imu.tieneMag() && imu.leerMag(m);
    if (mOk) snprintf(det, sizeof(det), "%.0f / %.0f / %.0f uT (Tierra: 25-65 uT)", m.mx, m.my, m.mz);
    resultado("Magnetometro AK8963", mOk,
              mOk ? det : "no hay (si el GY-91 trae MPU6500 es normal: sin brujula)");
  }

  // --- Radio SX1262 integrado ---
  if (!enlace.ok()) enlace.iniciarHeltec();
  snprintf(det, sizeof(det), "%s %.1f MHz, %s", enlace.chip(), radio::FRECUENCIA_MHZ,
           zradio::textoError(enlace.error()));
  resultado("LoRa SX1262", enlace.ok(), det);

  // --- GPS NEO-M8N: ¿llegan frases NMEA por UART1? ---
  uint32_t t0 = millis(), caracteres = 0;
  bool dolar = false;
  while (millis() - t0 < 1500) {
    while (Serial1.available()) {
      if (Serial1.read() == '$') dolar = true;
      caracteres++;
    }
  }
  snprintf(det, sizeof(det), "%lu caracteres en 1.5 s", (unsigned long)caracteres);
  resultado("GPS NEO-M8N (UART1)", dolar,
            dolar ? det : "sin datos: TX del GPS -> GPIO47, 9600 baud, 3.3-5V");

  // --- OpenLog: al reiniciarse imprime '<' cuando ya abrió su archivo ---
  Serial2.println("# P1 autodiagnostico");
  bool openlog = false;
  t0 = millis();
  while (millis() - t0 < 300) {
    while (Serial2.available()) {
      if (Serial2.read() == '<') openlog = true;
    }
  }
  static bool openlogVisto = false;
  openlogVisto = openlogVisto || openlog;
  resultado("OpenLog (UART2)", openlogVisto,
            openlogVisto ? "respondio '<' (archivo abierto)"
                         : "sin respuesta: RXI<-GPIO4, TXO->GPIO5, microSD FAT32, config.txt");

  // --- Batería ---
  uint32_t mv = 0;
  for (int i = 0; i < 16; ++i) mv += analogReadMilliVolts(heltec::BATERIA_ADC);
  const float vPin = mv / 16000.0f;
  const float vBat = vPin * (100.0f + 33.0f) / 33.0f;  // divisor 100k/33k (pila 9 V)
  snprintf(det, sizeof(det), "pin=%.2f V -> pila ~%.2f V (divisor 100k/33k a GPIO6)", vPin, vBat);
  resultado("Pila 9 V", vBat > 7.0f, vPin > 0.3f ? det : "sin divisor en GPIO6 (no se puede medir)");

  Serial.printf("  Resultado: %d PASAN, %d FALLAN\n", pasan, fallan);
  Serial.println("=============================================================");

  pantalla.renglon(0, "P1 autodiagnostico");
  pantalla.renglon(1, "BARO:%s IMU:%s", bOk ? "OK" : "X", iOk ? "OK" : "X");
  pantalla.renglon(2, "LoRa:%s GPS:%s", enlace.ok() ? "OK" : "X", dolar ? "OK" : "X");
  pantalla.renglon(3, "OpenLog:%s Bat:%.1fV", openlogVisto ? "OK" : "?", vBat);
  pantalla.renglon(4, "%d pasan / %d fallan", pasan, fallan);
  pantalla.mostrar();
}

void setup() {
  Serial.begin(115200);
  delay(500);
  pantalla.iniciar();
  Wire.begin(heltec::I2C_SDA, heltec::I2C_SCL, 400000);
  Serial1.begin(9600, SERIAL_8N1, heltec::GPS_RX, heltec::GPS_TX);
  Serial2.begin(115200, SERIAL_8N1, heltec::OPENLOG_RX, heltec::OPENLOG_TX);
  analogSetPinAttenuation(heltec::BATERIA_ADC, ADC_11db);
  delay(2000);  // dar tiempo al OpenLog de arrancar
}

void loop() {
  diagnosticar();
  delay(10000);
}
