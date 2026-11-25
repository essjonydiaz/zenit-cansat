// =============================================================================
//  CanSat Zénit — Firmware de la CARGA SECUNDARIA (baliza de localización)
//  ESP32-C3 SuperMini + RFM95W/SX1276 (915 MHz) + GPS NEO-6M
//
//  La secundaria cae en caída libre después del desacople. Su única tarea
//  electrónica es decir DÓNDE está:
//    - lee el GPS (NEO-6M) y
//    - transmite cada 2 s:  $B,seq,t_ms,lat,lon,sats,fix,bat*HH
//  La primaria recibe esta trama y calcula distancia y dirección hacia la
//  secundaria (Haversine). El receptor de tierra también la escucha.
//  Respaldo si no hay GPS (árboles): LED y buzzer de búsqueda a corta distancia.
//
//  Monitor serie: va por el USB nativo del C3 (USB CDC). Se ven las mismas
//  tramas que salen por radio, con el prefijo "USB,".
// =============================================================================
#include <Arduino.h>
#include <TinyGPS++.h>
#include <esp_task_wdt.h>
#include <ZenitRadio.h>

#include "ZenitComun.h"
#include "config.h"

static TinyGPSPlus gps;
static zradio::Enlace enlace;
static HardwareSerial& puertoGps = Serial1;
static uint32_t secuencia = 0;
static uint32_t tProximaBaliza = 0;

static void buzzer(bool on) {
  digitalWrite(c3::BUZZER, (on == (BUZZER_ACTIVO_ALTO == 1)) ? HIGH : LOW);
}

static void led(bool on) { digitalWrite(c3::LED, on ? LOW : HIGH); }  // activo en LOW

static float leerBateria() {
#if USAR_MEDICION_BATERIA
  uint32_t mv = 0;
  for (int i = 0; i < 8; ++i) mv += analogReadMilliVolts(c3::BATERIA_ADC);
  const float v =
      (mv / 8000.0f) * (BATERIA_R_ARRIBA_KOHM + BATERIA_R_ABAJO_KOHM) / BATERIA_R_ABAJO_KOHM;
  return v >= BATERIA_MINIMA_REAL_V ? v : 0.0f;
#else
  return 0.0f;
#endif
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
  // Sin este flush el USB nativo del C3 deja de mandar texto después de la
  // primera baliza (la radio sí seguía transmitiendo). Probado el 2026-11-24.
  Serial.flush();
  led(true);
  enlace.enviar(trama);  // ~60 ms en el aire
  led(false);
}

void setup() {
  Serial.begin(115200);
  pinMode(c3::LED, OUTPUT);
  pinMode(c3::BUZZER, OUTPUT);
  led(false);
  buzzer(false);
#if USAR_MEDICION_BATERIA
  analogSetPinAttenuation(c3::BATERIA_ADC, ADC_11db);
#endif
  puertoGps.begin(GPS_BAUDIOS, SERIAL_8N1, c3::GPS_RX, c3::GPS_TX);
#if GPS_MODO_AEREO
  uint8_t ubxMsg[ubx::TAM_CFG_NAV5];
  puertoGps.write(ubxMsg, ubx::mensajeModeloDinamico(ubx::MODELO_AEREO_1G, ubxMsg, sizeof(ubxMsg)));
#endif
  enlace.iniciarRfm95(c3::LORA_SCK, c3::LORA_MISO, c3::LORA_MOSI, c3::LORA_NSS, c3::LORA_RST,
                      c3::LORA_DIO0, POTENCIA_SECUNDARIA_DBM);
  delay(500);  // dar tiempo a que abra el monitor serie USB
  Serial.printf("INFO,ZENIT_SECUNDARIA,lora=%d,chip=%s,err=%d(%s),freq=%.1f\n", enlace.ok(),
                enlace.chip(), enlace.error(), zradio::textoError(enlace.error()),
                radio::FRECUENCIA_MHZ);
  Serial.flush();
  // 2 pitidos = listo; 1 largo = falla la radio
  for (int i = 0; i < (enlace.ok() ? 2 : 1); ++i) {
    buzzer(true);
    led(true);
    delay(enlace.ok() ? 80 : 800);
    buzzer(false);
    led(false);
    delay(80);
  }
  randomSeed(esp_random());
  // Perro guardián: si el programa se traba más de 5 s (por ejemplo por una
  // caída de voltaje al transmitir), el chip se reinicia solo y sigue mandando
  // la baliza. No arregla la alimentación, pero evita que quede muda en vuelo.
  esp_task_wdt_init(5, true);
  esp_task_wdt_add(NULL);
}

void loop() {
  esp_task_wdt_reset();
  while (puertoGps.available()) gps.encode(puertoGps.read());

  const uint32_t ahora = millis();
  if ((int32_t)(ahora - tProximaBaliza) >= 0) {
    enviarBaliza();
    tProximaBaliza = ahora + PERIODO_BALIZA_MS +
                     random(-VARIACION_BALIZA_MS, VARIACION_BALIZA_MS + 1);
  }

  // Baliza sonora/luminosa de búsqueda: 150 ms cada 2 s después de N minutos.
  const bool localizar = ahora > BALIZA_SONORA_DESPUES_DE_MIN * 60000UL && (ahora % 2000) < 150;
  buzzer(localizar);
  if (localizar) led(true);
  else if ((ahora % 2000) >= 150 && (ahora % 2000) < 160) led(false);
}
