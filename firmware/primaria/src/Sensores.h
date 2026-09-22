// =============================================================================
//  Sensores.h — BMP280 (presión/temperatura) + MPU6050 (acelerómetro/giroscopio)
//
//  Con la bandera ZENIT_SIMULACION (entorno "primaria_sim") las lecturas salen
//  del simulador de vuelo en lugar de los sensores reales, para probar todo el
//  sistema con solo el ESP32.
// =============================================================================
#pragma once
#include <Arduino.h>

struct DatosSensores {
  bool baroOk = false;
  bool imuOk = false;
  float presionPa = 0;
  float temperaturaC = 0;
  float ax = 0, ay = 0, az = 0;  // g
  float gx = 0, gy = 0, gz = 0;  // °/s
  // Solo en simulación: posición simulada de primaria y secundaria
  bool gpsSimulado = false;
  double lat = 0, lon = 0, latSec = 0, lonSec = 0;
  bool secundariaSuelta = false;
};

class Sensores {
 public:
  // Devuelve true si al menos el barómetro respondió.
  bool iniciar();
  // dt: segundos desde la lectura anterior (lo usa el simulador).
  void leer(DatosSensores& d, float dt);
  // Avisa al simulador que el servo ya liberó el autogiro.
  void autogiroDesplegado();
  bool baroOk() const { return baroOk_; }
  bool imuOk() const { return imuOk_; }
  uint8_t direccionBaro() const { return dirBaro_; }

 private:
  bool baroOk_ = false;
  bool imuOk_ = false;
  uint8_t dirBaro_ = 0;
  bool autogiro_ = false;
};
