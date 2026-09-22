// =============================================================================
//  P2 — Calibración de sensores (BMP280 + MPU6050)
//  1) Deja el CanSat QUIETO: mide 10 s y reporta promedio y ruido (desviación
//     estándar) de altitud, aceleración y giroscopio.
//  2) Luego imprime lecturas continuas a 10 Hz en formato CSV (se pueden
//     graficar con el Serial Plotter o copiar a Excel).
//
//  Criterios sugeridos (docs/05-plan-de-pruebas.md):
//    ruido de altitud < 0.5 m · |a| en reposo = 1.00 ± 0.05 g · giro < 2 °/s
//    Prueba de altura: subir el CanSat 1 piso (~3 m) y ver que la altitud cambie ~3 m.
// =============================================================================
#include <Adafruit_BMP280.h>
#include <Adafruit_MPU6050.h>
#include <Arduino.h>
#include <Wire.h>

#include "ZenitComun.h"

static Adafruit_BMP280 bmp(&Wire);
static Adafruit_MPU6050 mpu;
static float presionTierra = 0;

struct Estadistica {
  double suma = 0, suma2 = 0;
  int n = 0;
  void agregar(double x) { suma += x; suma2 += x * x; n++; }
  double media() const { return n ? suma / n : 0; }
  double desv() const { return n > 1 ? sqrt((suma2 - suma * suma / n) / (n - 1)) : 0; }
};

void setup() {
  Serial.begin(115200);
  delay(500);
  Wire.begin(pines::I2C_SDA, pines::I2C_SCL, 400000);
  const bool bOk = bmp.begin(0x76) || bmp.begin(0x77);
  const bool mOk = mpu.begin(0x68, &Wire);
  Serial.printf("BMP280=%s  MPU6050=%s\n", bOk ? "OK" : "NO", mOk ? "OK" : "NO");
  if (!bOk || !mOk) {
    Serial.println("Corre primero env:p1_autodiagnostico.");
    while (true) delay(1000);
  }
  bmp.setSampling(Adafruit_BMP280::MODE_NORMAL, Adafruit_BMP280::SAMPLING_X2,
                  Adafruit_BMP280::SAMPLING_X16, Adafruit_BMP280::FILTER_X2,
                  Adafruit_BMP280::STANDBY_MS_1);
  mpu.setAccelerometerRange(MPU6050_RANGE_16_G);
  mpu.setGyroRange(MPU6050_RANGE_2000_DEG);
  mpu.setFilterBandwidth(MPU6050_BAND_44_HZ);

  Serial.println("Midiendo 10 s en reposo... NO mover el CanSat.");
  Estadistica p, alt, a, gx, gy, gz;
  for (int i = 0; i < 500; ++i) {  // 50 Hz x 10 s
    p.agregar(bmp.readPressure());
    delay(20);
  }
  presionTierra = p.media();
  for (int i = 0; i < 500; ++i) {
    alt.agregar(filtros::alturaDesdePresion(bmp.readPressure(), presionTierra));
    sensors_event_t ea, eg, et;
    mpu.getEvent(&ea, &eg, &et);
    a.agregar(sqrtf(ea.acceleration.x * ea.acceleration.x + ea.acceleration.y * ea.acceleration.y +
                    ea.acceleration.z * ea.acceleration.z) / filtros::G);
    gx.agregar(eg.gyro.x * 57.2958);
    gy.agregar(eg.gyro.y * 57.2958);
    gz.agregar(eg.gyro.z * 57.2958);
    delay(20);
  }
  Serial.println("\n----------- RESULTADO EN REPOSO -----------");
  Serial.printf("Presion de tierra : %.1f Pa\n", presionTierra);
  Serial.printf("Ruido de altitud  : %.2f m  (%s)\n", alt.desv(), alt.desv() < 0.5 ? "PASA" : "REVISAR");
  Serial.printf("|a| promedio      : %.3f g (ruido %.3f)  (%s)\n", a.media(), a.desv(),
                fabs(a.media() - 1.0) < 0.05 ? "PASA" : "REVISAR");
  Serial.printf("Bias giroscopio   : %.2f / %.2f / %.2f deg/s  (%s)\n", gx.media(), gy.media(), gz.media(),
                (fabs(gx.media()) < 2 && fabs(gy.media()) < 2 && fabs(gz.media()) < 2) ? "PASA" : "REVISAR");
  Serial.println("-------------------------------------------");
  Serial.println("alt_m,temp_c,ax_g,ay_g,az_g,gx_dps,gy_dps,gz_dps");
}

void loop() {
  sensors_event_t a, g, t;
  mpu.getEvent(&a, &g, &t);
  Serial.printf("%.2f,%.2f,%.3f,%.3f,%.3f,%.1f,%.1f,%.1f\n",
                filtros::alturaDesdePresion(bmp.readPressure(), presionTierra), bmp.readTemperature(),
                a.acceleration.x / filtros::G, a.acceleration.y / filtros::G,
                a.acceleration.z / filtros::G, g.gyro.x * 57.2958, g.gyro.y * 57.2958,
                g.gyro.z * 57.2958);
  delay(100);
}
