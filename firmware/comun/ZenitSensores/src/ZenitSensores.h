// =============================================================================
//  ZenitSensores.h — Drivers de los sensores del PDR para placas ESP32.
//
//  GY-91 = MPU9250 (acelerómetro + giroscopio + magnetómetro AK8963) + BMP280.
//   * El driver del IMU acepta también las variantes que se venden como
//     "GY-91": MPU6500 (sin magnetómetro) y MPU6050. Se identifican por el
//     registro WHO_AM_I. OJO: la librería Adafruit_MPU6050 NO sirve para el
//     MPU9250 (rechaza su WHO_AM_I = 0x71), por eso este driver propio.
//   * El barómetro acepta BMP280 (id 0x58) y BME280 (id 0x60) en 0x76 o 0x77
//     (el PDR menciona ambos; para presión y temperatura son iguales).
//
//  Unidades: aceleración en g, giro en °/s, campo magnético en µT, presión en
//  Pa, temperatura en °C. Los ejes del magnetómetro se entregan ya alineados
//  con los del acelerómetro.
// =============================================================================
#pragma once
#include <Arduino.h>
#include <Wire.h>

namespace zsensores {

// ------------------------------------------------------------------ IMU ----
struct LecturaImu {
  float ax = 0, ay = 0, az = 0;  // g
  float gx = 0, gy = 0, gz = 0;  // °/s
  float tempC = 0;
};

struct LecturaMag {
  float mx = 0, my = 0, mz = 0;  // µT, ejes del acelerómetro
};

class Imu {
 public:
  // Busca el IMU en 0x68 (AD0 a GND) y luego 0x69. Configura ±16 g y
  // ±2000 °/s (el impacto supera 16 g y el autogiro gira rápido).
  bool iniciar(TwoWire& bus = Wire);
  bool leer(LecturaImu& l);
  // Magnetómetro (solo MPU9250): devuelve false si no hay dato nuevo.
  bool leerMag(LecturaMag& m);

  bool ok() const { return ok_; }
  bool tieneMag() const { return magOk_; }
  uint8_t quienSoy() const { return whoAmI_; }
  uint8_t direccion() const { return dir_; }
  const char* modelo() const;

 private:
  bool escribir(uint8_t dir, uint8_t reg, uint8_t valor);
  bool leerBytes(uint8_t dir, uint8_t reg, uint8_t* buf, size_t n);
  bool iniciarMag();
  TwoWire* bus_ = nullptr;
  bool ok_ = false, magOk_ = false;
  uint8_t dir_ = 0, whoAmI_ = 0;
  float ajusteMag_[3] = {1, 1, 1};
};

// ----------------------------------------------------------- Barómetro ----
class Barometro {
 public:
  bool iniciar(TwoWire& bus = Wire);
  // Devuelve false si la lectura no es creíble (sensor desconectado, NaN).
  bool leer(float& presionPa, float& temperaturaC);
  bool ok() const { return ok_; }
  uint8_t direccion() const { return dir_; }
  const char* modelo() const { return modelo_; }

 private:
  bool ok_ = false;
  uint8_t dir_ = 0;
  const char* modelo_ = "ninguno";
};

// ----------------------------------------------------------------- GPS ----
// Envía al GPS u-blox el modelo dinámico "aerotransportado < 1 g".
void configurarGpsAereo(Stream& puertoGps);

// Revisa qué hay en el bus I2C. Escribe las direcciones encontradas en
// 'dirs' (hasta 'max') y devuelve cuántas hay.
int escanearI2c(TwoWire& bus, uint8_t* dirs, int max);

}  // namespace zsensores
