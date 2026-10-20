#include "Sensores.h"

#include <Wire.h>

#include "ZenitComun.h"
#include "config.h"

#ifdef ZENIT_SIMULACION
// ============================== MODO SIMULACIÓN ==============================
static sim::SimuladorVuelo simulador;

bool Sensores::iniciar() {
  baroOk_ = imuOk_ = true;
  magOk_ = false;
  dirBaro_ = 0;
  modeloBaro_ = "simulado";
  modeloImu_ = "simulado";
  return true;
}

void Sensores::autogiroDesplegado() { autogiro_ = true; }
void Sensores::desacopleAbierto() { tJalon_ = millis(); }

void Sensores::leer(DatosSensores& d, float dt) {
  sim::Lectura l = simulador.paso(dt, autogiro_);
  // Al soltar la secundaria el resorte/pasador da un jalón corto (~1.5 g, 60 ms).
  if (tJalon_ && millis() - tJalon_ < 60) l.az += 1.5f;
  d.baroOk = d.imuOk = true;
  d.magNuevo = false;
  d.presionPa = l.presionPa;
  d.temperaturaC = l.temperaturaC;
  d.ax = l.ax;
  d.ay = l.ay;
  d.az = l.az;
  d.gx = l.gx;
  d.gy = l.gy;
  d.gz = l.gz;
  d.gpsSimulado = true;
  d.lat = l.lat;
  d.lon = l.lon;
  d.latSec = l.latSec;
  d.lonSec = l.lonSec;
  d.secundariaSuelta = l.secundariaSuelta;
}

#else
// ============================== SENSORES REALES ==============================
#include <ZenitSensores.h>

static zsensores::Imu imu;
static zsensores::Barometro baro;

bool Sensores::iniciar() {
  // GY-91 en el bus Wire (GPIO 41/42). 400 kHz: leer IMU + barómetro tarda <1 ms.
  baroOk_ = baro.iniciar(Wire);
  dirBaro_ = baro.direccion();
  modeloBaro_ = baro.modelo();
  imuOk_ = imu.iniciar(Wire);
  modeloImu_ = imu.modelo();
  magOk_ = USAR_MAGNETOMETRO && imu.tieneMag();
  return baroOk_;
}

void Sensores::autogiroDesplegado() { autogiro_ = true; }
void Sensores::desacopleAbierto() {}

void Sensores::leer(DatosSensores& d, float /*dt*/) {
  d.gpsSimulado = false;
  d.magNuevo = false;
  d.baroOk = baroOk_ && baro.leer(d.presionPa, d.temperaturaC);
  if (imuOk_) {
    zsensores::LecturaImu l;
    d.imuOk = imu.leer(l);
    if (d.imuOk) {
      d.ax = l.ax;
      d.ay = l.ay;
      d.az = l.az;
      d.gx = l.gx;
      d.gy = l.gy;
      d.gz = l.gz;
    }
  } else {
    d.imuOk = false;
  }
  if (magOk_ && millis() - tUltimoMag_ >= PERIODO_MAG_MS) {
    tUltimoMag_ = millis();
    zsensores::LecturaMag m;
    if (imu.leerMag(m)) {
      d.mx = m.mx - MAG_CENTRO_X_UT;
      d.my = m.my - MAG_CENTRO_Y_UT;
      d.mz = m.mz - MAG_CENTRO_Z_UT;
      d.magNuevo = true;
    }
  }
}
#endif
