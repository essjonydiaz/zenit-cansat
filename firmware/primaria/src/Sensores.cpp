#include "Sensores.h"

#include <Wire.h>

#include "ZenitComun.h"

#ifdef ZENIT_SIMULACION
// ============================== MODO SIMULACIÓN ==============================
static sim::SimuladorVuelo simulador;

bool Sensores::iniciar() {
  baroOk_ = imuOk_ = true;
  dirBaro_ = 0;
  return true;
}

void Sensores::autogiroDesplegado() { autogiro_ = true; }

void Sensores::leer(DatosSensores& d, float dt) {
  const sim::Lectura l = simulador.paso(dt, autogiro_);
  d.baroOk = d.imuOk = true;
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
#include <Adafruit_BMP280.h>
#include <Adafruit_MPU6050.h>

static Adafruit_BMP280 bmp(&Wire);
static Adafruit_MPU6050 mpu;

bool Sensores::iniciar() {
  // BMP280: según el módulo, la dirección es 0x76 (SDO a GND) o 0x77.
  if (bmp.begin(0x76)) {
    dirBaro_ = 0x76;
  } else if (bmp.begin(0x77)) {
    dirBaro_ = 0x77;
  }
  baroOk_ = dirBaro_ != 0;
  if (baroOk_) {
    // Sobremuestreo alto en presión y filtro interno ligero: buena resolución
    // de altitud sin agregar retraso que afecte el cálculo de velocidad.
    bmp.setSampling(Adafruit_BMP280::MODE_NORMAL, Adafruit_BMP280::SAMPLING_X2,
                    Adafruit_BMP280::SAMPLING_X16, Adafruit_BMP280::FILTER_X2,
                    Adafruit_BMP280::STANDBY_MS_1);
  }

  imuOk_ = mpu.begin(0x68, &Wire);
  if (imuOk_) {
    // Rangos máximos: el impacto supera 16 g y el autogiro gira rápido.
    mpu.setAccelerometerRange(MPU6050_RANGE_16_G);
    mpu.setGyroRange(MPU6050_RANGE_2000_DEG);
    mpu.setFilterBandwidth(MPU6050_BAND_44_HZ);
  }
  return baroOk_;
}

void Sensores::autogiroDesplegado() { autogiro_ = true; }

void Sensores::leer(DatosSensores& d, float /*dt*/) {
  d.baroOk = baroOk_;
  d.imuOk = imuOk_;
  d.gpsSimulado = false;
  if (baroOk_) {
    d.presionPa = bmp.readPressure();
    d.temperaturaC = bmp.readTemperature();
    if (isnan(d.presionPa) || d.presionPa < 30000.0f) d.baroOk = false;
  }
  if (imuOk_) {
    sensors_event_t a, g, t;
    mpu.getEvent(&a, &g, &t);
    constexpr float RAD_A_GRAD = 57.2957795f;
    d.ax = a.acceleration.x / filtros::G;
    d.ay = a.acceleration.y / filtros::G;
    d.az = a.acceleration.z / filtros::G;
    d.gx = g.gyro.x * RAD_A_GRAD;
    d.gy = g.gyro.y * RAD_A_GRAD;
    d.gz = g.gyro.z * RAD_A_GRAD;
  }
}
#endif
