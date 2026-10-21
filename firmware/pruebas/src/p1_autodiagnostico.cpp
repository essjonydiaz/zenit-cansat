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

// Cada FALLA guarda una instrucción concreta de qué cable/pieza revisar; al
// final se imprime la lista "QUE ARREGLAR" en orden.
static char arreglos[10][150];
static int nArreglos = 0;

static void resultado(const char* nombre, bool ok, const char* detalle, const char* arreglo = "") {
  Serial.printf("  [%s] %-24s %s\n", ok ? "PASA " : "FALLA", nombre, detalle);
  if (ok) {
    pasan++;
    return;
  }
  fallan++;
  if (arreglo[0] && nArreglos < 10) {
    snprintf(arreglos[nArreglos++], sizeof(arreglos[0]), "%s: %s", nombre, arreglo);
  }
}

static bool hay(const uint8_t* dirs, int n, uint8_t d) {
  for (int i = 0; i < n; ++i)
    if (dirs[i] == d) return true;
  return false;
}

static void diagnosticar() {
  pasan = fallan = nArreglos = 0;
  Serial.println("\n========== AUTODIAGNOSTICO CANSAT ZENIT (primaria) ==========");
  char det[110];

  // --- I2C del GY-91: qué direcciones responden ---
  uint8_t dirs[16];
  const int n = zsensores::escanearI2c(Wire, dirs, 16);
  Serial.printf("  Bus I2C del GY-91 (SDA=GPIO%d, SCL=GPIO%d):", heltec::I2C_SDA, heltec::I2C_SCL);
  for (int i = 0; i < n; ++i) Serial.printf(" 0x%02X", dirs[i]);
  Serial.println(n ? "   (esperado: 0x68 IMU, 0x76 barometro, 0x0C brujula)" : " NADA RESPONDE");
  if (n == 0) {
    resultado("Cables del GY-91", false, "ningun dispositivo en el bus I2C",
              "el GY-91 no contesta nada. 1) VIN del GY-91 con 3.3 V y GND a GND (medir con "
              "multimetro). 2) SDA -> GPIO41 y SCL -> GPIO42 (no invertidos). 3) soldaduras.");
  }

  zsensores::Barometro baro;
  const bool bOk = baro.iniciar(Wire);
  float p = 0, t = 0;
  const bool lecturaOk = bOk && baro.leer(p, t);
  if (lecturaOk) {
    snprintf(det, sizeof(det), "%s 0x%02X: %.0f Pa, %.1f C", baro.modelo(), baro.direccion(), p, t);
  } else {
    snprintf(det, sizeof(det), "no responde en 0x76 ni 0x77");
  }
  resultado("Barometro BMP280", lecturaOk, det,
            n == 0 ? "" :
            hay(dirs, n, 0x68) ? "el IMU si contesta pero el barometro no: el chip BMP280 del GY-91 "
                                 "esta danado o mal soldado (cambiar el GY-91)."
                               : "revisar el pin SDO del GY-91 y las soldaduras del modulo.");

  zsensores::Imu imu;
  const bool iOk = imu.iniciar(Wire);
  zsensores::LecturaImu l;
  float g = 0;
  if (iOk && imu.leer(l)) g = sqrtf(l.ax * l.ax + l.ay * l.ay + l.az * l.az);
  if (iOk) {
    snprintf(det, sizeof(det), "%s (WHO_AM_I 0x%02X): |a| = %.2f g (quieto ~1.00)", imu.modelo(),
             imu.quienSoy(), g);
  } else {
    snprintf(det, sizeof(det), "no responde en 0x68 ni 0x69");
  }
  const bool gBien = iOk && g > 0.9f && g < 1.1f;
  resultado("IMU MPU9250", gBien, det,
            !iOk ? (n == 0 ? "" : "el barometro si contesta pero el IMU no: chip MPU del GY-91 "
                                  "danado o pin AD0 al aire (debe ir a GND).")
                 : "responde pero mide mal la gravedad: dejar el CanSat QUIETO; si sigue, IMU danado.");
  if (iOk) {
    zsensores::LecturaMag m;
    delay(20);
    const bool mOk = imu.tieneMag() && imu.leerMag(m);
    if (mOk) snprintf(det, sizeof(det), "%.0f / %.0f / %.0f uT (Tierra: 25-65 uT)", m.mx, m.my, m.mz);
    else snprintf(det, sizeof(det), "%s", imu.tieneMag() ? "no da datos" : "este GY-91 no trae brujula");
    // Sin brújula el vuelo funciona igual: se reporta pero no cuenta como falla.
    Serial.printf("  [%s] %-24s %s\n", mOk ? "PASA " : "AVISO", "Brujula AK8963", det);
  }

  // --- Radio SX1262 integrado ---
  if (!enlace.ok()) enlace.iniciarHeltec();
  snprintf(det, sizeof(det), "%s %.1f MHz, %s", enlace.chip(), radio::FRECUENCIA_MHZ,
           zradio::textoError(enlace.error()));
  resultado("Radio LoRa SX1262", enlace.ok(), det,
            "el radio va dentro de la Heltec: revisar que la antena IPEX este bien puesta y "
            "reiniciar (RST). Si sigue, la Heltec esta danada (cambiarla).");

  // --- GPS NEO-M8N: ¿llegan frases NMEA por UART1? ---
  uint32_t t0 = millis(), caracteres = 0, dolares = 0;
  while (millis() - t0 < 1500) {
    while (Serial1.available()) {
      if (Serial1.read() == '$') dolares++;
      caracteres++;
    }
  }
  snprintf(det, sizeof(det), "%lu caracteres y %lu frases en 1.5 s", (unsigned long)caracteres,
           (unsigned long)dolares);
  resultado("GPS NEO-M8N", dolares > 0, det,
            caracteres == 0
                ? "no llega nada. 1) el GPS debe tener su LED encendido/parpadeando (si no: VCC y "
                  "GND). 2) el TX del GPS va a GPIO47 (si esta en GPIO48 estan invertidos)."
                : "llegan datos basura: velocidad distinta de 9600 baudios o cable con ruido.");

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
  resultado("OpenLog (microSD)", openlogVisto,
            openlogVisto ? "respondio '<' (archivo abierto)" : "no respondio",
            "1) LED del OpenLog: si parpadea rapido, la microSD falta o no es FAT32. 2) RXI del "
            "OpenLog <- GPIO4 y TXO -> GPIO5. 3) config.txt en la microSD (115200).");

  // --- Batería ---
  uint32_t mv = 0;
  for (int i = 0; i < 16; ++i) mv += analogReadMilliVolts(heltec::BATERIA_ADC);
  const float vPin = mv / 16000.0f;
  const float vBat = vPin * (100.0f + 33.0f) / 33.0f;  // divisor 100k/33k (pila 9 V)
  snprintf(det, sizeof(det), "pin GPIO6 = %.2f V -> pila ~%.2f V", vPin, vBat);
  const char* arregloBat =
      vPin < 0.3f ? "no hay divisor: soldar 100k de la pila a GPIO6 y 33k de GPIO6 a GND."
      : vPin > 3.0f ? "PELIGRO: llega demasiado voltaje al GPIO6. Revisar que las resistencias "
                      "sean 100k (arriba) y 33k (abajo), no al reves."
                    : "pila baja: cambiarla por una nueva (minimo 8.5 V para volar).";
  resultado("Pila 9 V", vPin >= 0.3f && vPin <= 3.0f && vBat >= 8.5f, det, arregloBat);

  Serial.printf("  Resultado: %d PASAN, %d FALLAN\n", pasan, fallan);
  if (nArreglos) {
    Serial.println("  ---------------- QUE ARREGLAR (en este orden) ----------------");
    for (int i = 0; i < nArreglos; ++i) Serial.printf("  %d) %s\n", i + 1, arreglos[i]);
  } else {
    Serial.println("  Todo bien. Siguiente: env:p2_sensores y env:p6_servos.");
  }
  Serial.println("  (Los servos no se prueban aqui para no soltar nada: usar env:p6_servos.)");
  Serial.println("=============================================================");

  pantalla.renglon(0, "P1: %d pasan %d fallan", pasan, fallan);
  pantalla.renglon(1, "BARO:%s IMU:%s", lecturaOk ? "OK" : "X", gBien ? "OK" : "X");
  pantalla.renglon(2, "LoRa:%s GPS:%s", enlace.ok() ? "OK" : "X", dolares ? "OK" : "X");
  pantalla.renglon(3, "OpenLog:%s Bat:%.1fV", openlogVisto ? "OK" : "X", vBat);
  pantalla.renglon(4, "%s", nArreglos ? "Ver lista en la laptop" : "TODO BIEN");
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
