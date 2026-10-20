// =============================================================================
//  Sensores.h — GY-91: BMP280 (presión/temperatura) + MPU9250 (acelerómetro,
//  giroscopio y magnetómetro). Drivers en firmware/comun/ZenitSensores.
//
//  Con la bandera ZENIT_SIMULACION (entorno "primaria_sim") las lecturas salen
//  del simulador de vuelo en lugar de los sensores reales, para probar todo el
//  sistema con solo la placa Heltec.
// =============================================================================
#pragma once
#include <Arduino.h>

struct DatosSensores {
  bool baroOk = false;
  bool imuOk = false;
  bool magNuevo = false;         // true solo en el ciclo en que llegó dato del magnetómetro
  float presionPa = 0;
  float temperaturaC = 0;
  float ax = 0, ay = 0, az = 0;  // g
  float gx = 0, gy = 0, gz = 0;  // °/s
  float mx = 0, my = 0, mz = 0;  // µT (ejes del acelerómetro)
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
  // Avisan al simulador que los servos ya se movieron (en vuelo real no hacen nada).
  void autogiroDesplegado();
  void desacopleAbierto();
  bool baroOk() const { return baroOk_; }
  bool imuOk() const { return imuOk_; }
  bool magOk() const { return magOk_; }
  uint8_t direccionBaro() const { return dirBaro_; }
  const char* modeloBaro() const { return modeloBaro_; }
  const char* modeloImu() const { return modeloImu_; }

 private:
  bool baroOk_ = false;
  bool imuOk_ = false;
  bool magOk_ = false;
  uint8_t dirBaro_ = 0;
  const char* modeloBaro_ = "ninguno";
  const char* modeloImu_ = "ninguno";
  bool autogiro_ = false;
  uint32_t tJalon_ = 0;  // simulación: momento del "jalón" de la separación
  uint32_t tUltimoMag_ = 0;
};
