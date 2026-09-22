// =============================================================================
//  CanSat Zénit — Firmware de la CARGA PRIMARIA (ESP32 DevKit V1)
//
//  Qué hace, en cada ciclo de 20 ms (50 Hz):
//    1. Lee BMP280 (presión, temperatura) y MPU6050 (aceleración, giro).
//    2. Calcula orientación (Mahony), altitud y VELOCIDAD vertical
//       (filtro complementario barómetro + acelerómetro) y altitud máxima.
//    3. Corre la máquina de estados de la misión y, a 200 m de bajada,
//       mueve el servo que suelta la carga secundaria y el autogiro.
//    4. Guarda todo en la microSD (25 Hz) y transmite por LoRa:
//       T = telemetría (4 Hz), P = posición/localización de la secundaria
//       (1 Hz), E = eventos.
//    5. Escucha la baliza de la secundaria y los comandos de tierra.
//  Después de aterrizar sigue transmitiendo (mínimo exigido: 10 s) y el
//  buzzer suena para encontrarlo.
//
//  Compilar/subir: PlatformIO -> entorno "primaria" (sensores reales)
//                  o "primaria_sim" (vuelo simulado, solo con el ESP32).
// =============================================================================
#include <Arduino.h>
#include <ESP32Servo.h>
#include <TinyGPS++.h>
#include <Wire.h>

#include "Comunicaciones.h"
#include "Sensores.h"
#include "ZenitComun.h"
#include "config.h"

using mision::Estado;

// ------------------------------------------------------------- Objetos ----
static Sensores sensores;
static filtros::FiltroVertical filtro(FILTRO_OMEGA, FILTRO_ZETA);
static filtros::Orientacion orientacion(MAHONY_KP);
static mision::MaquinaEstados maquina;
static Servo servo;
static TinyGPSPlus gps;

// ------------------------------------------------------------- Estado -----
static float presionTierra = 101325.0f;
static float biasGx = 0, biasGy = 0, biasGz = 0;
static uint32_t secuencia = 0;
static uint32_t tUltimaMuestraUs = 0;
static uint32_t tUltimaTelemetria = 0, tUltimaPosicion = 0, tUltimoRegistro = 0;
static uint32_t tApagarServo = 0;
static uint32_t tBuzzerPrueba = 0;
static bool eventoPostAterrizajeEnviado = false;

struct Posicion {
  double lat = 0, lon = 0;
  uint8_t sats = 0;
  bool fix = false;
};
static Posicion posPropia;

struct Baliza {
  double lat = 0, lon = 0;
  uint8_t sats = 0;
  bool fix = false;
  float bateria = 0;
  int16_t rssi = 0;
  uint32_t tRecibida = 0;
  bool alguna = false;
};
static Baliza baliza;

// Último resultado de cálculo (para telemetría y registro)
static DatosSensores datos;
static float alturaBaro = 0, gTotal = 1, gMaxVuelo = 0;
static float voltajeBateria = 0;
static float distanciaSec = -1, rumboSec = -1;

// --------------------------------------------------------- Utilidades -----
static inline float tiempoS() { return millis() / 1000.0f; }

static void buzzer(bool encendido) {
  digitalWrite(pines::BUZZER, (encendido == (BUZZER_ACTIVO_ALTO == 1)) ? HIGH : LOW);
}

static void pitidos(int n, int msOn = 80, int msOff = 80) {
  for (int i = 0; i < n; ++i) {
    buzzer(true);
    delay(msOn);
    buzzer(false);
    delay(msOff);
  }
}

static float leerBateria() {
#ifdef ZENIT_SIMULACION
  return 9.1f - millis() / 3.6e6f;  // descarga simulada lenta
#else
  uint32_t mv = 0;
  for (int i = 0; i < 8; ++i) mv += analogReadMilliVolts(pines::BATERIA_ADC);
  const float vPin = (mv / 8.0f) / 1000.0f;
  return vPin * (BATERIA_R_ARRIBA_KOHM + BATERIA_R_ABAJO_KOHM) / BATERIA_R_ABAJO_KOHM;
#endif
}

static bool balizaVigente() {
  return baliza.alguna && (millis() - baliza.tRecibida) < BALIZA_VIGENTE_MS;
}

static uint16_t banderas() {
  const comms::Estado& c = comms::estado();
  uint16_t f = 0;
  if (datos.baroOk) f |= 1 << 0;
  if (datos.imuOk) f |= 1 << 1;
  if (c.sdOk) f |= 1 << 2;
  if (c.loraOk) f |= 1 << 3;
  if (posPropia.fix) f |= 1 << 4;
  if (balizaVigente()) f |= 1 << 5;
  if (maquina.desacopleHecho()) f |= 1 << 6;
#ifdef ZENIT_SIMULACION
  f |= 1 << 7;
#endif
  if (voltajeBateria > 0 && voltajeBateria < BATERIA_BAJA_V) f |= 1 << 8;
  return f;
}

static void enviarEvento(const char* codigo, const char* detalle = "") {
  char carga[160];
  snprintf(carga, sizeof(carga), "E,%lu,%lu,%s,%s", (unsigned long)++secuencia,
           (unsigned long)millis(), codigo, detalle);
  comms::enviarTrama(carga);
  char linea[180];
  snprintf(linea, sizeof(linea), "# EVENTO,%lu,%s,%s", (unsigned long)millis(), codigo,
           detalle);
  comms::registrar(linea);
}

// ------------------------------------------------------------ Desacople ---
static void ejecutarDesacople(const char* origen) {
  servo.attach(pines::SERVO_DESACOPLE, 500, 2400);
  servo.write(SERVO_ANGULO_ABIERTO);
  tApagarServo = millis() + SERVO_TIEMPO_ACTIVO_MS;
  sensores.autogiroDesplegado();
  char detalle[64];
  snprintf(detalle, sizeof(detalle), "%s h=%.1f v=%.1f", origen, filtro.altura(),
           filtro.velocidad());
  enviarEvento("DESACOPLE", detalle);
}

static void cerrarServo() {
  servo.attach(pines::SERVO_DESACOPLE, 500, 2400);
  servo.write(SERVO_ANGULO_CERRADO);
  tApagarServo = millis() + SERVO_TIEMPO_ACTIVO_MS;
}

// ---------------------------------------------------------- Calibración ---
// Promedia la presión de tierra (altitud 0 = punto de lanzamiento) y el
// desvío del giroscopio. El CanSat debe estar QUIETO.
static void calibrar() {
  double sumaP = 0;
  float sgx = 0, sgy = 0, sgz = 0, sax = 0, say = 0, saz = 0;
  int nP = 0;
  DatosSensores d;
  for (int i = 0; i < MUESTRAS_CALIBRACION; ++i) {
    sensores.leer(d, PERIODO_MUESTREO_MS / 1000.0f);
    if (d.baroOk) {
      sumaP += d.presionPa;
      nP++;
    }
    sgx += d.gx; sgy += d.gy; sgz += d.gz;
    sax += d.ax; say += d.ay; saz += d.az;
    delay(PERIODO_MUESTREO_MS);
  }
  const float n = MUESTRAS_CALIBRACION;
  if (nP > 0) presionTierra = sumaP / nP;
  biasGx = sgx / n; biasGy = sgy / n; biasGz = sgz / n;
  orientacion.iniciarDesdeAcel(sax / n, say / n, saz / n);
  filtro.reiniciar(0.0f, 0.0f);
  maquina.reiniciar();
  gMaxVuelo = 0;
  char detalle[80];
  snprintf(detalle, sizeof(detalle), "p0=%.0f bias=%.2f/%.2f/%.2f", presionTierra, biasGx,
           biasGy, biasGz);
  enviarEvento("CALIBRADO", detalle);
}

// ---------------------------------------------------------- Comandos ------
static void procesarComando(const char* carga, size_t n) {
  char clave[16], orden[24];
  if (!protocolo::campo(carga, n, 1, clave, sizeof(clave)) ||
      !protocolo::campo(carga, n, 2, orden, sizeof(orden))) {
    return;
  }
  if (strcmp(clave, CLAVE_COMANDOS) != 0) {
    enviarEvento("CMD_RECHAZADO", "clave");
    return;
  }
  const bool enTierra = maquina.estado() == Estado::PREVUELO;
  if (strcmp(orden, "DESACOPLAR") == 0) {
    // Respaldo manual: funciona en cualquier estado (útil si falla el automático).
    if (!maquina.desacopleHecho()) {
      maquina.desacopleManual(tiempoS());
      ejecutarDesacople("MANUAL");
    } else {
      ejecutarDesacople("REPETIDO");
    }
  } else if (strcmp(orden, "CERRAR") == 0 && enTierra) {
    cerrarServo();
    enviarEvento("CMD_OK", orden);
  } else if (strcmp(orden, "CALIBRAR") == 0 && enTierra) {
    calibrar();
  } else if (strcmp(orden, "PING") == 0) {
    enviarEvento("PONG", mision::nombre(maquina.estado()));
  } else if (strcmp(orden, "BUZZER") == 0) {
    tBuzzerPrueba = millis() + 2000;
    enviarEvento("CMD_OK", orden);
  } else {
    enviarEvento("CMD_RECHAZADO", orden);
  }
}

static void procesarTrama(const char* texto, size_t largo, int16_t rssi) {
  const char* carga;
  size_t n;
  if (!protocolo::validar(texto, largo, &carga, &n)) return;
  const char t = protocolo::tipo(carga, n);
  if (t == 'C') {
    procesarComando(carga, n);
  } else if (t == 'B') {
    // Baliza: B,seq,t_ms,lat,lon,sats,fix,bat
    char c[24];
    if (protocolo::campo(carga, n, 3, c, sizeof(c))) baliza.lat = atof(c);
    if (protocolo::campo(carga, n, 4, c, sizeof(c))) baliza.lon = atof(c);
    if (protocolo::campo(carga, n, 5, c, sizeof(c))) baliza.sats = atoi(c);
    if (protocolo::campo(carga, n, 6, c, sizeof(c))) baliza.fix = atoi(c) == 1;
    if (protocolo::campo(carga, n, 7, c, sizeof(c))) baliza.bateria = atof(c);
    baliza.rssi = rssi;
    baliza.tRecibida = millis();
    baliza.alguna = true;
  }
}

static void procesarEntradas() {
  // Por radio
  comms::Recibido r;
  while (comms::recibir(r)) procesarTrama(r.texto, strlen(r.texto), r.rssi);

  // Por USB (pruebas en banco): acepta "$C,...*HH" o "TX,$C,...*HH"
  static char linea[comms::TAM_MENSAJE];
  static size_t n = 0;
  while (Serial.available()) {
    const char c = Serial.read();
    if (c == '\n' || c == '\r') {
      if (n > 0) {
        linea[n] = '\0';
        const char* inicio = strncmp(linea, "TX,", 3) == 0 ? linea + 3 : linea;
        procesarTrama(inicio, strlen(inicio), 0);
        n = 0;
      }
    } else if (n < sizeof(linea) - 1) {
      linea[n++] = c;
    }
  }
}

// ---------------------------------------------------------------- GPS -----
static void actualizarGps() {
#if USAR_GPS_PRIMARIA && !defined(ZENIT_SIMULACION)
  while (Serial2.available()) gps.encode(Serial2.read());
  posPropia.fix = gps.location.isValid() && gps.location.age() < 3000;
  if (posPropia.fix) {
    posPropia.lat = gps.location.lat();
    posPropia.lon = gps.location.lng();
  }
  posPropia.sats = gps.satellites.isValid() ? gps.satellites.value() : 0;
#endif
}

static void actualizarLocalizacionRelativa() {
#ifdef ZENIT_SIMULACION
  // En simulación la baliza también es simulada (1 vez por segundo).
  static uint32_t tBalizaSim = 0;
  if (millis() - tBalizaSim >= 1000) {
    tBalizaSim = millis();
    baliza.lat = datos.latSec;
    baliza.lon = datos.lonSec;
    baliza.sats = 9;
    baliza.fix = true;
    baliza.bateria = 8.9f;
    baliza.rssi = -60;
    baliza.tRecibida = millis();
    baliza.alguna = true;
  }
#endif
  if (posPropia.fix && balizaVigente() && baliza.fix) {
    distanciaSec = geo::distanciaMetros(posPropia.lat, posPropia.lon, baliza.lat, baliza.lon);
    rumboSec = geo::rumboGrados(posPropia.lat, posPropia.lon, baliza.lat, baliza.lon);
  } else {
    distanciaSec = rumboSec = -1;
  }
}

// ------------------------------------------------------ Tramas de salida --
static void enviarTelemetria() {
  char carga[180];
  snprintf(carga, sizeof(carga),
           "T,%lu,%lu,%u,%.2f,%.2f,%.2f,%.0f,%.1f,%.2f,%.2f,%.2f,%.0f,%.0f,%.0f,%.1f,%.1f,%.1f,%.2f,%.2f,%u",
           (unsigned long)++secuencia, (unsigned long)millis(),
           (unsigned)maquina.estado(), filtro.altura(), filtro.velocidad(),
           maquina.alturaMaxima(), datos.presionPa, datos.temperaturaC, datos.ax, datos.ay,
           datos.az, datos.gx - biasGx, datos.gy - biasGy, datos.gz - biasGz,
           orientacion.roll(), orientacion.pitch(), orientacion.yaw(), gMaxVuelo,
           voltajeBateria, banderas());
  comms::enviarTrama(carga);
}

static void enviarPosicion() {
  const float edadBaliza = baliza.alguna ? (millis() - baliza.tRecibida) / 1000.0f : -1;
  char carga[180];
  snprintf(carga, sizeof(carga),
           "P,%lu,%lu,%.6f,%.6f,%u,%d,%.6f,%.6f,%.1f,%.1f,%.1f,%d,%.2f",
           (unsigned long)++secuencia, (unsigned long)millis(), posPropia.lat, posPropia.lon,
           posPropia.sats, posPropia.fix ? 1 : 0, baliza.lat, baliza.lon, edadBaliza,
           distanciaSec, rumboSec, baliza.rssi, baliza.bateria);
  comms::enviarTrama(carga);
}

static const char* ENCABEZADO_SD =
    "t_ms,estado,alt_baro,alt,vel,alt_max,pres,temp,ax,ay,az,gx,gy,gz,roll,pitch,yaw,"
    "g,g_max,bat,lat,lon,sats,dist_sec,rumbo_sec,flags";

static void registrarMuestra() {
  char linea[comms::TAM_MENSAJE];
  snprintf(linea, sizeof(linea),
           "%lu,%u,%.2f,%.2f,%.2f,%.2f,%.0f,%.1f,%.3f,%.3f,%.3f,%.1f,%.1f,%.1f,%.1f,%.1f,%.1f,"
           "%.2f,%.2f,%.2f,%.6f,%.6f,%u,%.1f,%.1f,%u",
           (unsigned long)millis(), (unsigned)maquina.estado(), alturaBaro, filtro.altura(),
           filtro.velocidad(), maquina.alturaMaxima(), datos.presionPa, datos.temperaturaC,
           datos.ax, datos.ay, datos.az, datos.gx - biasGx, datos.gy - biasGy,
           datos.gz - biasGz, orientacion.roll(), orientacion.pitch(), orientacion.yaw(),
           gTotal, gMaxVuelo, voltajeBateria, posPropia.lat, posPropia.lon, posPropia.sats,
           distanciaSec, rumboSec, banderas());
  comms::registrar(linea);
}

// ------------------------------------------------------- Indicadores ------
static void actualizarIndicadores() {
  const uint32_t ahora = millis();
  if (tApagarServo && (int32_t)(ahora - tApagarServo) >= 0) {
    servo.detach();  // ahorra batería; el mecanismo queda en su posición
    tApagarServo = 0;
  }
  // LED: parpadeo lento en tierra, rápido en vuelo, fijo al aterrizar.
  const Estado e = maquina.estado();
  const uint32_t periodo = e == Estado::PREVUELO ? 1000 : 200;
  digitalWrite(pines::LED, e == Estado::ATERRIZADO ? HIGH : ((ahora / periodo) % 2));
  // Buzzer de localización después de aterrizar (o prueba por comando).
  const bool localizar = e == Estado::ATERRIZADO && (ahora % 1000) < 200;
  const bool prueba = tBuzzerPrueba && (int32_t)(tBuzzerPrueba - ahora) > 0;
  buzzer(localizar || prueba);
}

// ================================================================ setup ===
void setup() {
  Serial.begin(115200);
  pinMode(pines::LED, OUTPUT);
  pinMode(pines::BUZZER, OUTPUT);
  buzzer(false);
  delay(300);
  Serial.println("INFO,ZENIT_PRIMARIA,iniciando");

  // El servo empieza CERRADO: sostiene a la carga secundaria.
  ESP32PWM::allocateTimer(0);
  servo.setPeriodHertz(50);
  cerrarServo();

  Wire.begin(pines::I2C_SDA, pines::I2C_SCL, 400000);
  const bool baro = sensores.iniciar();
#if USAR_GPS_PRIMARIA && !defined(ZENIT_SIMULACION)
  Serial2.begin(GPS_BAUDIOS, SERIAL_8N1, pines::GPS_RX, pines::GPS_TX);
#endif
  analogSetPinAttenuation(pines::BATERIA_ADC, ADC_11db);

  comms::iniciar(ENCABEZADO_SD);
  const comms::Estado& c = comms::estado();

  char detalle[96];
  snprintf(detalle, sizeof(detalle), "baro=%d(0x%02X) imu=%d lora=%d sd=%d %s", baro,
           sensores.direccionBaro(), sensores.imuOk(), c.loraOk, c.sdOk, c.archivo);
  enviarEvento("ARRANQUE", detalle);
#ifdef ZENIT_SIMULACION
  enviarEvento("SIMULACION", "vuelo simulado activo");
#endif

  calibrar();
  // 3 pitidos = listo. 1 pitido largo = falta algún sensor crítico.
  if (baro && sensores.imuOk()) {
    pitidos(3);
  } else {
    pitidos(1, 800);
  }
  tUltimaMuestraUs = micros();
}

// ================================================================= loop ===
void loop() {
  actualizarGps();
  procesarEntradas();
  actualizarIndicadores();

  const uint32_t ahoraUs = micros();
  if (ahoraUs - tUltimaMuestraUs < PERIODO_MUESTREO_MS * 1000UL) return;
  const float dt = (ahoraUs - tUltimaMuestraUs) / 1e6f;
  tUltimaMuestraUs = ahoraUs;

  // 1) Sensores
  sensores.leer(datos, dt);
  if (datos.gpsSimulado) {
    posPropia.lat = datos.lat;
    posPropia.lon = datos.lon;
    posPropia.sats = 10;
    posPropia.fix = true;
  }

  // 2) Orientación, altitud y velocidad
  constexpr float GRAD_A_RAD = 0.0174532925f;
  const float gx = datos.gx - biasGx, gy = datos.gy - biasGy, gz = datos.gz - biasGz;
  if (datos.imuOk) {
    orientacion.actualizar(gx * GRAD_A_RAD, gy * GRAD_A_RAD, gz * GRAD_A_RAD, datos.ax,
                           datos.ay, datos.az, dt);
  }
  gTotal = sqrtf(datos.ax * datos.ax + datos.ay * datos.ay + datos.az * datos.az);
  const float aVertical =
      orientacion.verticalDelMundo(datos.ax, datos.ay, datos.az) * filtros::G - filtros::G;
  if (datos.baroOk) alturaBaro = filtros::alturaDesdePresion(datos.presionPa, presionTierra);
  filtro.actualizar(datos.baroOk ? alturaBaro : filtro.altura(), aVertical, dt,
                    USAR_ACEL_EN_FILTRO && datos.imuOk);

  // 3) Máquina de estados de la misión
  if (maquina.estado() != Estado::PREVUELO && gTotal > gMaxVuelo) gMaxVuelo = gTotal;
  const uint8_t ev = maquina.actualizar(
      {tiempoS(), filtro.altura(), filtro.velocidad(), datos.imuOk ? gTotal : 1.0f});
  char detalle[64];
  if (ev & mision::EV_ASCENSO) enviarEvento("ASCENSO");
  if (ev & mision::EV_LIBERACION) {
    snprintf(detalle, sizeof(detalle), "h=%.1f", filtro.altura());
    enviarEvento("LIBERACION", detalle);
  }
  if (ev & mision::EV_DESACOPLE) ejecutarDesacople("AUTO");
  if (ev & mision::EV_ATERRIZAJE) {
    snprintf(detalle, sizeof(detalle), "alt_max=%.1f g_max=%.1f", maquina.alturaMaxima(),
             gMaxVuelo);
    enviarEvento("ATERRIZAJE", detalle);
  }
  if (maquina.estado() == Estado::ATERRIZADO && !eventoPostAterrizajeEnviado &&
      tiempoS() - maquina.tAterrizaje() >= TRANSMISION_POST_ATERRIZAJE_S) {
    eventoPostAterrizajeEnviado = true;
    enviarEvento("POST_ATERRIZAJE_OK", "10 s transmitiendo tras aterrizar");
  }

  // 4) Salidas periódicas
  const uint32_t ahora = millis();
  if (ahora - tUltimoRegistro >= PERIODO_REGISTRO_MS) {
    tUltimoRegistro = ahora;
    registrarMuestra();
  }
  if (ahora - tUltimaTelemetria >= PERIODO_TELEMETRIA_MS) {
    tUltimaTelemetria = ahora;
    voltajeBateria = leerBateria();
    enviarTelemetria();
  }
  if (ahora - tUltimaPosicion >= PERIODO_POSICION_MS) {
    tUltimaPosicion = ahora;
    actualizarLocalizacionRelativa();
    enviarPosicion();
  }
}
