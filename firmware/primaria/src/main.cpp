// =============================================================================
//  CanSat Zénit — Firmware de la CARGA PRIMARIA (Heltec WiFi LoRa 32 V3)
//
//  Hardware (PDR, etapa 3): Heltec V3 (ESP32-S3 + LoRa SX1262 915 MHz + OLED),
//  GY-91 (MPU9250 + BMP280), GPS NEO-M8N, OpenLog con microSD, 2 servos SG90
//  (desacople y autogiro), pila de 9 V -> MP1584EN (5 V) -> AMS1117 (3.3 V).
//
//  Qué hace, en cada ciclo de 20 ms (50 Hz):
//    1. Lee el GY-91: presión y temperatura (BMP280), aceleración, giro y
//       campo magnético (MPU9250).
//    2. Calcula orientación (Mahony + brújula), altitud y VELOCIDAD vertical
//       (filtro complementario barómetro + acelerómetro) y altitud máxima.
//    3. Corre la máquina de estados de la misión. A 200 m de bajada arranca la
//       secuencia de separación: servo de desacople (suelta la secundaria),
//       confirmación con el IMU y, 400 ms después, servo del autogiro.
//    4. Guarda todo en la microSD (25 Hz) y transmite por LoRa:
//       T = telemetría (2 Hz), P = posición/localización de la secundaria
//       (1 Hz), E = eventos.
//    5. Escucha la baliza de la secundaria y los comandos de tierra.
//  En tierra muestra el estado en la pantalla OLED; en vuelo la apaga.
//  Después de aterrizar sigue transmitiendo (mínimo exigido: 10 s) y el
//  buzzer suena para encontrarlo.
//
//  Compilar/subir: PlatformIO -> entorno "primaria" (sensores reales)
//                  o "primaria_sim" (vuelo simulado, solo con la placa).
// =============================================================================
#include <Arduino.h>
#include <ESP32Servo.h>
#include <Preferences.h>
#include <mbedtls/md.h>
#include <TinyGPS++.h>
#include <Wire.h>
#include <ZenitPantalla.h>
#include <ZenitRadio.h>
#include <ZenitSensores.h>

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
static separacion::Parametros parametrosSeparacion() {
  separacion::Parametros p;
  p.retardoAutogiroMs = AUTOGIRO_RETARDO_MS;
  p.cambioMinimoG = SEPARACION_CAMBIO_MIN_G;
  return p;
}
static separacion::Secuencia secuencia(parametrosSeparacion());
// Parámetros de la misión (o del modo prueba de techo). Se aplican en setup().
static mision::Parametros parametrosMision() {
  mision::Parametros p;
  p.alturaDesacople = ALTURA_DESACOPLE_M;
  p.alturaArmado = ALTURA_ARMADO_M;
#if MODO_PRUEBA_CAIDA
  p.alturaDeteccionAscenso = PRUEBA_ALTURA_ASCENSO_M;
  p.alturaArmado = PRUEBA_ALTURA_ARMADO_M;
  p.caidaDesacople = PRUEBA_CAIDA_DESACOPLE_M;
  p.alturaMaxAterrizaje = PRUEBA_ALTURA_ATERRIZAJE_M;
#endif
  return p;
}
static Servo servoDesacople, servoAutogiro;
static TinyGPSPlus gps;
static zpantalla::Pantalla pantalla;
static HardwareSerial& puertoGps = Serial1;

// ------------------------------------------------------------- Estado -----
static float presionTierra = 101325.0f;
static float biasGx = 0, biasGy = 0, biasGz = 0;
static uint32_t numSecuencia = 0;
static uint32_t tUltimaMuestraUs = 0;
static uint32_t tUltimaTelemetria = 0, tUltimaPosicion = 0, tUltimoRegistro = 0;
#if USAR_PANTALLA
static uint32_t tUltimaPantalla = 0;
#endif
static uint32_t tApagarDesacople = 0, tApagarAutogiro = 0;
static uint32_t tBuzzerPrueba = 0;
static bool eventoPostAterrizajeEnviado = false;
static bool enAhorro = false;

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
static float rumboBrujula = -1;

// --------------------------------------------------------- Utilidades -----
static inline float tiempoS() { return millis() / 1000.0f; }

static void buzzer(bool encendido) {
  digitalWrite(heltec::BUZZER, (encendido == (BUZZER_ACTIVO_ALTO == 1)) ? HIGH : LOW);
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
  for (int i = 0; i < 8; ++i) mv += analogReadMilliVolts(heltec::BATERIA_ADC);
  const float vPin = (mv / 8.0f) / 1000.0f;
  return vPin * (BATERIA_R_ARRIBA_KOHM + BATERIA_R_ABAJO_KOHM) / BATERIA_R_ABAJO_KOHM;
#endif
}

// Bajo consumo: ya aterrizó hace más de AHORRO_TRAS_ATERRIZAR_S.
static bool modoAhorro() {
  return maquina.estado() == Estado::ATERRIZADO &&
         tiempoS() - maquina.tAterrizaje() >= AHORRO_TRAS_ATERRIZAR_S;
}

static bool bateriaMedida() { return voltajeBateria >= BATERIA_MINIMA_REAL_V; }

static bool balizaVigente() {
  return baliza.alguna && (millis() - baliza.tRecibida) < BALIZA_VIGENTE_MS;
}

// Bits del campo "flags" de la trama T (docs/03-protocolo-telemetria.md).
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
  if (bateriaMedida() && voltajeBateria < BATERIA_BAJA_V) f |= 1 << 8;
  if (secuencia.autogiroAbierto()) f |= 1 << 9;
  if (secuencia.confirmada()) f |= 1 << 10;
  if (sensores.magOk()) f |= 1 << 11;
  if (!bateriaMedida()) f |= 1 << 12;
  if (c.sdOk && !c.sdConfirmada) f |= 1 << 13;
  return f;
}

static void enviarEvento(const char* codigo, const char* detalle = "") {
  char carga[160];
  snprintf(carga, sizeof(carga), "E,%lu,%lu,%s,%s", (unsigned long)++numSecuencia,
           (unsigned long)millis(), codigo, detalle);
  comms::enviarTrama(carga);
  char linea[180];
  snprintf(linea, sizeof(linea), "# EVENTO,%lu,%s,%s", (unsigned long)millis(), codigo,
           detalle);
  comms::registrar(linea);
}

// -------------------------------------------------------------- Servos ----
// La señal se desconecta después de SERVO_TIEMPO_ACTIVO_MS: el mecanismo se
// queda donde está y el servo deja de gastar batería (y de zumbar).
static void moverServo(Servo& s, int8_t pin, int angulo, uint32_t& tApagar) {
  if (!s.attached()) s.attach(pin, 500, 2400);
  s.write(angulo);
  tApagar = millis() + SERVO_TIEMPO_ACTIVO_MS;
}

static void abrirDesacople() {
  moverServo(servoDesacople, heltec::SERVO_DESACOPLE, DESACOPLE_ANGULO_ABIERTO, tApagarDesacople);
  sensores.desacopleAbierto();
}
static void cerrarDesacople() {
  moverServo(servoDesacople, heltec::SERVO_DESACOPLE, DESACOPLE_ANGULO_CERRADO, tApagarDesacople);
}
static void abrirAutogiro() {
  moverServo(servoAutogiro, heltec::SERVO_AUTOGIRO, AUTOGIRO_ANGULO_ABIERTO, tApagarAutogiro);
  sensores.autogiroDesplegado();
}
static void cerrarServos() {
  cerrarDesacople();
  moverServo(servoAutogiro, heltec::SERVO_AUTOGIRO, AUTOGIRO_ANGULO_CERRADO, tApagarAutogiro);
}

// Arranca la secuencia de separación (automática a 200 m o por comando).
static void iniciarSeparacion(const char* origen) {
  char detalle[64];
  snprintf(detalle, sizeof(detalle), "%s h=%.1f v=%.1f", origen, filtro.altura(),
           filtro.velocidad());
  if (secuencia.iniciar(millis(), gTotal) & separacion::ABRIR_DESACOPLE) {
    abrirDesacople();
    enviarEvento("DESACOPLE", detalle);
  } else {
    // Ya se había hecho: por comando se vuelve a abrir todo (respaldo manual).
    abrirDesacople();
    abrirAutogiro();
    enviarEvento("DESACOPLE", "REPETIDO");
  }
}

static void actualizarSeparacion() {
  const uint8_t a = secuencia.actualizar(millis(), gTotal);
  char detalle[48];
  if (a & separacion::CONFIRMADA) {
    snprintf(detalle, sizeof(detalle), "cambio=%.2f g", secuencia.cambioMaximoG());
    enviarEvento("SEPARACION", detalle);
  }
  if (a & separacion::NO_CONFIRMADA) {
    snprintf(detalle, sizeof(detalle), "cambio=%.2f g reintento", secuencia.cambioMaximoG());
    enviarEvento("SEPARACION_NO_CONFIRMADA", detalle);
  }
  if (a & separacion::CERRAR_DESACOPLE) cerrarDesacople();
  if (a & separacion::ABRIR_DESACOPLE) abrirDesacople();
  if (a & separacion::ABRIR_AUTOGIRO) {
    abrirAutogiro();
    snprintf(detalle, sizeof(detalle), "h=%.1f", filtro.altura());
    enviarEvento("AUTOGIRO", detalle);
  }
}

// ---------------------------------------------------------- Calibración ---
// Promedia la presión de tierra (altitud 0 = punto de lanzamiento) y el
// desvío del giroscopio. El CanSat debe estar QUIETO.
static void calibrar() {
  double sumaP = 0;
  float sgx = 0, sgy = 0, sgz = 0, sax = 0, say = 0, saz = 0;
  int nP = 0, nI = 0;
  DatosSensores d;
  for (int i = 0; i < MUESTRAS_CALIBRACION; ++i) {
    sensores.leer(d, PERIODO_MUESTREO_MS / 1000.0f);
    if (d.baroOk) {
      sumaP += d.presionPa;
      nP++;
    }
    if (d.imuOk) {
      sgx += d.gx; sgy += d.gy; sgz += d.gz;
      sax += d.ax; say += d.ay; saz += d.az;
      nI++;
    }
    delay(PERIODO_MUESTREO_MS);
  }
  if (nP > 0) presionTierra = sumaP / nP;
  if (nI > 0) {
    biasGx = sgx / nI; biasGy = sgy / nI; biasGz = sgz / nI;
    orientacion.iniciarDesdeAcel(sax / nI, say / nI, saz / nI);
  }
  filtro.reiniciar(0.0f, 0.0f);
  maquina.reiniciar();
  secuencia.reiniciar();
  gMaxVuelo = 0;
  char detalle[80];
  snprintf(detalle, sizeof(detalle), "p0=%.0f bias=%.2f/%.2f/%.2f", presionTierra, biasGx,
           biasGy, biasGz);
  enviarEvento("CALIBRADO", detalle);
}

// ---------------------------------------------------------- Comandos ------
// $C,<contador>,<orden>,<firma>*HH. La firma son los primeros 16 dígitos hex del
// HMAC-SHA256 de "C,<contador>,<orden>" con CLAVE_COMANDOS: la clave no viaja por
// radio. El contador (hora de la laptop en ms) debe ser mayor que el último
// aceptado, que se guarda en la memoria flash: un comando grabado y repetido se
// rechaza aunque la primaria se haya reiniciado.
static Preferences memoriaComandos;
static uint64_t ultimoContador = 0;

static bool firmaValida(const char* contador, const char* orden, const char* firma) {
  if (strlen(firma) != 16) return false;
  char mensaje[64];
  const int largo = snprintf(mensaje, sizeof(mensaje), "C,%s,%s", contador, orden);
  if (largo <= 0 || largo >= (int)sizeof(mensaje)) return false;
  uint8_t hmac[32];
  if (mbedtls_md_hmac(mbedtls_md_info_from_type(MBEDTLS_MD_SHA256),
                      (const uint8_t*)CLAVE_COMANDOS, strlen(CLAVE_COMANDOS),
                      (const uint8_t*)mensaje, largo, hmac) != 0) {
    return false;
  }
  static const char HEXA[] = "0123456789ABCDEF";
  uint8_t diferencia = 0;  // se comparan todos los dígitos (sin salir antes)
  for (int i = 0; i < 8; ++i) {
    diferencia |= HEXA[hmac[i] >> 4] ^ toupper((unsigned char)firma[2 * i]);
    diferencia |= HEXA[hmac[i] & 0x0F] ^ toupper((unsigned char)firma[2 * i + 1]);
  }
  return diferencia == 0;
}

static bool leerContador(const char* texto, uint64_t* valor) {
  const size_t largo = strlen(texto);
  if (largo == 0 || largo > 19) return false;
  for (size_t i = 0; i < largo; ++i) {
    if (!isdigit((unsigned char)texto[i])) return false;
  }
  *valor = strtoull(texto, nullptr, 10);
  return true;
}

static void ejecutarOrden(const char* orden);

static void procesarComando(const char* carga, size_t n) {
  char contador[24], orden[24], firma[24];
  uint64_t numero = 0;
  if (!protocolo::campo(carga, n, 1, contador, sizeof(contador)) ||
      !protocolo::campo(carga, n, 2, orden, sizeof(orden)) ||
      !protocolo::campo(carga, n, 3, firma, sizeof(firma)) ||
      !leerContador(contador, &numero) || !firmaValida(contador, orden, firma)) {
    enviarEvento("CMD_RECHAZADO", "clave");
    return;
  }
  if (numero <= ultimoContador) {
    enviarEvento("CMD_RECHAZADO", "repetido");
    return;
  }
  ultimoContador = numero;
  ejecutarOrden(orden);
  memoriaComandos.putULong64("contador", numero);  // después de actuar: tarda unos ms
}

static void ejecutarOrden(const char* orden) {
  const bool enTierra = maquina.estado() == Estado::PREVUELO;
  if (strcmp(orden, "DESACOPLAR") == 0) {
    // Respaldo manual: funciona en cualquier estado (útil si falla el automático).
    if (!maquina.desacopleHecho()) maquina.desacopleManual(tiempoS());
    iniciarSeparacion("MANUAL");
  } else if (strcmp(orden, "CERRAR") == 0 && enTierra) {
    cerrarServos();
    secuencia.reiniciar();
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
  while (puertoGps.available()) gps.encode(puertoGps.read());
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
  // En simulación la baliza también es simulada (cada 2 s, como la real).
  static uint32_t tBalizaSim = 0;
  if (millis() - tBalizaSim >= 2000) {
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
  char carga[200];
  snprintf(carga, sizeof(carga),
           "T,%lu,%lu,%u,%.2f,%.2f,%.2f,%.0f,%.2f,%.2f,%.2f,%.2f,%.0f,%.0f,%.0f,%.1f,%.1f,%.1f,%.2f,%.2f,%u",
           (unsigned long)++numSecuencia, (unsigned long)millis(),
           (unsigned)maquina.estado(), filtro.altura(), filtro.velocidad(),
           maquina.alturaMaxima(), datos.presionPa, datos.temperaturaC, datos.ax, datos.ay,
           datos.az, datos.gx - biasGx, datos.gy - biasGy, datos.gz - biasGz,
           orientacion.roll(), orientacion.pitch(), orientacion.yaw(), gMaxVuelo,
           bateriaMedida() ? voltajeBateria : 0.0f, banderas());
  comms::enviarTrama(carga);
}

static void enviarPosicion() {
  const float edadBaliza = baliza.alguna ? (millis() - baliza.tRecibida) / 1000.0f : -1;
  char carga[200];
  snprintf(carga, sizeof(carga),
           "P,%lu,%lu,%.6f,%.6f,%u,%d,%.6f,%.6f,%.1f,%.1f,%.1f,%d,%.2f",
           (unsigned long)++numSecuencia, (unsigned long)millis(), posPropia.lat, posPropia.lon,
           posPropia.sats, posPropia.fix ? 1 : 0, baliza.lat, baliza.lon, edadBaliza,
           distanciaSec, rumboSec, baliza.rssi, baliza.bateria);
  comms::enviarTrama(carga);
}

static const char* ENCABEZADO_SD =
    "t_ms,estado,alt_baro,alt,vel,alt_max,pres,temp,ax,ay,az,gx,gy,gz,roll,pitch,yaw,"
    "g,g_max,bat,lat,lon,sats,dist_sec,rumbo_sec,flags,mx,my,mz,brujula";

static void registrarMuestra() {
  char linea[comms::TAM_MENSAJE];
  snprintf(linea, sizeof(linea),
           "%lu,%u,%.2f,%.2f,%.2f,%.2f,%.0f,%.2f,%.3f,%.3f,%.3f,%.1f,%.1f,%.1f,%.1f,%.1f,%.1f,"
           "%.2f,%.2f,%.2f,%.6f,%.6f,%u,%.1f,%.1f,%u,%.1f,%.1f,%.1f,%.0f",
           (unsigned long)millis(), (unsigned)maquina.estado(), alturaBaro, filtro.altura(),
           filtro.velocidad(), maquina.alturaMaxima(), datos.presionPa, datos.temperaturaC,
           datos.ax, datos.ay, datos.az, datos.gx - biasGx, datos.gy - biasGy,
           datos.gz - biasGz, orientacion.roll(), orientacion.pitch(), orientacion.yaw(),
           gTotal, gMaxVuelo, voltajeBateria, posPropia.lat, posPropia.lon, posPropia.sats,
           distanciaSec, rumboSec, banderas(), datos.mx, datos.my, datos.mz, rumboBrujula);
  comms::registrar(linea);
}

// ------------------------------------------------------- Indicadores ------
static void apagarServosInactivos(uint32_t ahora) {
  if (tApagarDesacople && (int32_t)(ahora - tApagarDesacople) >= 0) {
    servoDesacople.detach();
    tApagarDesacople = 0;
  }
  if (tApagarAutogiro && (int32_t)(ahora - tApagarAutogiro) >= 0) {
    servoAutogiro.detach();
    tApagarAutogiro = 0;
  }
}

static void actualizarPantalla(uint32_t ahora) {
#if USAR_PANTALLA
  const Estado e = maquina.estado();
  // Se muestra en la mesa y el primer minuto tras aterrizar (para la
  // recuperación); en vuelo y en modo de ahorro se apaga.
  const bool enTierra = e == Estado::PREVUELO || (e == Estado::ATERRIZADO && !modoAhorro());
  if (!enTierra) {
    if (pantalla.encendida()) pantalla.apagar();  // en vuelo: ahorrar batería
    return;
  }
  if (!pantalla.ok() || ahora - tUltimaPantalla < PERIODO_PANTALLA_MS) return;
  tUltimaPantalla = ahora;
  const comms::Estado& c = comms::estado();
  pantalla.renglon(0, "ZENIT %s", mision::nombre(e));
  pantalla.renglon(1, "LoRa:%s SD:%s Bat:%s", c.loraOk ? "OK" : "X",
                   c.sdOk ? (c.sdConfirmada ? "OK" : "?") : "X",
                   bateriaMedida() ? String(voltajeBateria, 1).c_str() : "--");
  pantalla.renglon(2, "Alt:%.1fm Vel:%.1f", filtro.altura(), filtro.velocidad());
  pantalla.renglon(3, "GPS:%s sat:%u Bal:%s", posPropia.fix ? "fix" : "--", posPropia.sats,
                   balizaVigente() ? "OK" : "--");
  if (distanciaSec >= 0) {
    pantalla.renglon(4, "Sec: %.0fm %s", distanciaSec, geo::puntoCardinal(rumboSec));
  } else {
    pantalla.renglon(4, "BARO:%s IMU:%s MAG:%s", datos.baroOk ? "OK" : "X",
                     datos.imuOk ? "OK" : "X", sensores.magOk() ? "OK" : "-");
  }
  pantalla.mostrar();
#else
  (void)ahora;
#endif
}

static void actualizarIndicadores() {
  const uint32_t ahora = millis();
  apagarServosInactivos(ahora);
  // LED: parpadeo lento en tierra, rápido en vuelo, fijo al aterrizar.
  const Estado e = maquina.estado();
  const uint32_t periodo = e == Estado::PREVUELO ? 1000 : 200;
  digitalWrite(heltec::LED, e == Estado::ATERRIZADO ? HIGH : ((ahora / periodo) % 2));
  // Buzzer de localización después de aterrizar (o prueba por comando).
  const bool localizar = e == Estado::ATERRIZADO && (ahora % 1000) < 200;
  const bool prueba = tBuzzerPrueba && (int32_t)(tBuzzerPrueba - ahora) > 0;
  buzzer(localizar || prueba);
  actualizarPantalla(ahora);
}

// ================================================================ setup ===
void setup() {
  Serial.begin(115200);
  pinMode(heltec::LED, OUTPUT);
  pinMode(heltec::BUZZER, OUTPUT);
  buzzer(false);
  delay(300);
  Serial.println("INFO,ZENIT_PRIMARIA,iniciando");
  maquina.configurar(parametrosMision());
#if MODO_PRUEBA_CAIDA
  Serial.println("INFO,MODO_PRUEBA,desacopla al caer 1.5 m (solo para pruebas desde un techo)");
#endif

  // Los dos servos empiezan CERRADOS: sostienen a la secundaria y a las palas.
  ESP32PWM::allocateTimer(0);
  ESP32PWM::allocateTimer(1);
  servoDesacople.setPeriodHertz(50);
  servoAutogiro.setPeriodHertz(50);
  cerrarServos();

#if USAR_PANTALLA
  pantalla.iniciar();
  pantalla.renglon(0, "ZENIT primaria");
  pantalla.renglon(1, "iniciando...");
  pantalla.mostrar();
#endif

  Wire.begin(heltec::I2C_SDA, heltec::I2C_SCL, 400000);
  const bool baro = sensores.iniciar();
#if USAR_GPS_PRIMARIA && !defined(ZENIT_SIMULACION)
  puertoGps.begin(GPS_BAUDIOS, SERIAL_8N1, heltec::GPS_RX, heltec::GPS_TX);
#if GPS_MODO_AEREO
  zsensores::configurarGpsAereo(puertoGps);
#endif
#endif
  analogSetPinAttenuation(heltec::BATERIA_ADC, ADC_11db);
  voltajeBateria = leerBateria();

  comms::iniciar(ENCABEZADO_SD);
  memoriaComandos.begin("zenit", false);
  ultimoContador = memoriaComandos.getULong64("contador", 0);
  const comms::Estado& c = comms::estado();

  char detalle[140];
  snprintf(detalle, sizeof(detalle),
           "baro=%d(%s 0x%02X) imu=%d(%s) mag=%d lora=%d sd=%d%s %s%s", baro,
           sensores.modeloBaro(), sensores.direccionBaro(), sensores.imuOk(),
           sensores.modeloImu(), sensores.magOk(), c.loraOk, c.sdOk,
           c.sdOk && !c.sdConfirmada ? "?" : "", c.archivo,
           maquina.modoPrueba() ? " PRUEBA" : "");
  enviarEvento("ARRANQUE", detalle);
  if (!c.loraOk) {
    snprintf(detalle, sizeof(detalle), "%d %s", c.errorLora,
             c.errorLora == comms::ERROR_RADIO_SIN_RESPUESTA
                 ? "el SX1262 no responde (revisar antena/placa)"
                 : zradio::textoError(c.errorLora));
    enviarEvento("LORA_ERROR", detalle);
  }
#ifdef ZENIT_SIMULACION
  enviarEvento("SIMULACION", "vuelo simulado activo");
#endif

  calibrar();
  // 3 pitidos = listo. 1 pitido largo = falta algún sensor crítico.
  if (baro && sensores.imuOk() && c.loraOk) {
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
  if (datos.magNuevo) {
    float ux, uy, uz;
    orientacion.arriba(ux, uy, uz);
    rumboBrujula = filtros::rumboMagnetico(datos.mx, datos.my, datos.mz, ux, uy, uz);
    orientacion.fusionarRumbo(rumboBrujula, PERIODO_MAG_MS / 1000.0f, MAG_TAU_S);
  }
  gTotal = sqrtf(datos.ax * datos.ax + datos.ay * datos.ay + datos.az * datos.az);
  const float aVertical =
      orientacion.verticalDelMundo(datos.ax, datos.ay, datos.az) * filtros::G - filtros::G;
  if (datos.baroOk) alturaBaro = filtros::alturaDesdePresion(datos.presionPa, presionTierra);
  filtro.actualizar(datos.baroOk ? alturaBaro : filtro.altura(), aVertical, dt,
                    USAR_ACEL_EN_FILTRO && datos.imuOk);

  // 3) Máquina de estados de la misión y secuencia de separación
  if (maquina.estado() != Estado::PREVUELO && gTotal > gMaxVuelo) gMaxVuelo = gTotal;
  const uint8_t ev = maquina.actualizar(
      {tiempoS(), filtro.altura(), filtro.velocidad(), datos.imuOk ? gTotal : 1.0f});
  char detalle[64];
  if (ev & mision::EV_ASCENSO) enviarEvento("ASCENSO");
  if (ev & mision::EV_LIBERACION) {
    snprintf(detalle, sizeof(detalle), "h=%.1f", filtro.altura());
    enviarEvento("LIBERACION", detalle);
  }
  if (ev & mision::EV_DESACOPLE) iniciarSeparacion("AUTO");
  actualizarSeparacion();
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
  if (!enAhorro && modoAhorro()) {
    enAhorro = true;
    setCpuFrequencyMhz(80);  // el UART y el SPI siguen funcionando igual a 80 MHz
    enviarEvento("AHORRO", "T y P cada 2 s, pantalla apagada");
  }
  const uint32_t periodoT = enAhorro ? PERIODO_TELEMETRIA_AHORRO_MS : PERIODO_TELEMETRIA_MS;
  const uint32_t periodoP = enAhorro ? PERIODO_POSICION_AHORRO_MS : PERIODO_POSICION_MS;
  if (ahora - tUltimaTelemetria >= periodoT) {
    tUltimaTelemetria = ahora;
    voltajeBateria = leerBateria();
    enviarTelemetria();
  }
  if (ahora - tUltimaPosicion >= periodoP) {
    tUltimaPosicion = ahora;
    actualizarLocalizacionRelativa();
    enviarPosicion();
  }
}
