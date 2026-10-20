// =============================================================================
//  P2 — Calibración de sensores del GY-91 (BMP280 + MPU9250 + AK8963)
//  1) Deja el CanSat QUIETO: mide 10 s y reporta promedio y ruido (desviación
//     estándar) de altitud, aceleración y giroscopio.
//  2) Calibración del magnetómetro (si hay): durante 30 s gira el CanSat en
//     TODAS las direcciones (como "dibujando un 8" en el aire). Al final
//     imprime los centros MAG_CENTRO_X/Y/Z para copiar a primaria/config.h.
//  3) Luego imprime lecturas continuas a 10 Hz en CSV (Serial Plotter / Excel),
//     incluido el rumbo de la brújula: girar el CanSat a mano frente a una
//     brújula de celular y comprobar que coincide (norte = 0, este = 90).
//
//  Criterios sugeridos (docs/05-plan-de-pruebas.md):
//    ruido de altitud < 0.5 m · |a| en reposo = 1.00 ± 0.05 g · giro < 2 °/s
//    Prueba de altura: subir el CanSat 1 piso (~3 m) y ver que la altitud cambie ~3 m.
// =============================================================================
#include <Arduino.h>
#include <Wire.h>
#include <ZenitSensores.h>

#include "ZenitComun.h"

static zsensores::Imu imu;
static zsensores::Barometro baro;
static float presionTierra = 0;
static float centro[3] = {0, 0, 0};

struct Estadistica {
  double suma = 0, suma2 = 0;
  int n = 0;
  void agregar(double x) { suma += x; suma2 += x * x; n++; }
  double media() const { return n ? suma / n : 0; }
  double desv() const { return n > 1 ? sqrt((suma2 - suma * suma / n) / (n - 1)) : 0; }
};

static void calibrarMagnetometro() {
  if (!imu.tieneMag()) {
    Serial.println("Sin magnetometro (GY-91 con MPU6500?): se omite la calibracion de brujula.");
    return;
  }
  Serial.println("\nCALIBRACION DE BRUJULA: gira el CanSat en todas direcciones durante 30 s...");
  float mn[3] = {1e9, 1e9, 1e9}, mx[3] = {-1e9, -1e9, -1e9};
  const uint32_t t0 = millis();
  while (millis() - t0 < 30000) {
    zsensores::LecturaMag m;
    if (imu.leerMag(m)) {
      const float v[3] = {m.mx, m.my, m.mz};
      for (int i = 0; i < 3; ++i) {
        mn[i] = min(mn[i], v[i]);
        mx[i] = max(mx[i], v[i]);
      }
    }
    delay(20);
  }
  for (int i = 0; i < 3; ++i) centro[i] = (mn[i] + mx[i]) / 2.0f;
  Serial.println("Copiar a firmware/primaria/include/config.h:");
  Serial.printf("  #define MAG_CENTRO_X_UT  %.1ff\n", centro[0]);
  Serial.printf("  #define MAG_CENTRO_Y_UT  %.1ff\n", centro[1]);
  Serial.printf("  #define MAG_CENTRO_Z_UT  %.1ff\n", centro[2]);
  Serial.printf("  (rango X %.0f..%.0f, Y %.0f..%.0f, Z %.0f..%.0f uT)\n", mn[0], mx[0], mn[1],
                mx[1], mn[2], mx[2]);
}

void setup() {
  Serial.begin(115200);
  delay(500);
  Wire.begin(heltec::I2C_SDA, heltec::I2C_SCL, 400000);
  const bool bOk = baro.iniciar(Wire);
  const bool iOk = imu.iniciar(Wire);
  Serial.printf("Barometro=%s  IMU=%s  Magnetometro=%s\n", bOk ? baro.modelo() : "NO",
                iOk ? imu.modelo() : "NO", imu.tieneMag() ? "SI" : "NO");
  if (!bOk || !iOk) {
    Serial.println("Corre primero env:p1_autodiagnostico.");
    while (true) delay(1000);
  }

  Serial.println("Midiendo 10 s en reposo... NO mover el CanSat.");
  Estadistica p, alt, a, gx, gy, gz;
  float pr, t;
  for (int i = 0; i < 500; ++i) {  // 50 Hz x 10 s
    if (baro.leer(pr, t)) p.agregar(pr);
    delay(20);
  }
  presionTierra = p.media();
  for (int i = 0; i < 500; ++i) {
    if (baro.leer(pr, t)) alt.agregar(filtros::alturaDesdePresion(pr, presionTierra));
    zsensores::LecturaImu l;
    if (imu.leer(l)) {
      a.agregar(sqrtf(l.ax * l.ax + l.ay * l.ay + l.az * l.az));
      gx.agregar(l.gx);
      gy.agregar(l.gy);
      gz.agregar(l.gz);
    }
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
  calibrarMagnetometro();
  Serial.println("alt_m,temp_c,ax_g,ay_g,az_g,gx_dps,gy_dps,gz_dps,rumbo_deg");
}

void loop() {
  zsensores::LecturaImu l;
  zsensores::LecturaMag m;
  float pr = 0, t = 0;
  baro.leer(pr, t);
  imu.leer(l);
  float rumbo = -1;
  if (imu.leerMag(m)) {
    // "Arriba" = acelerómetro (vale si el CanSat se mueve despacio). El rumbo es
    // hacia dónde apunta el eje X del GY-91 (marcarlo en la carcasa).
    rumbo = filtros::rumboMagnetico(m.mx - centro[0], m.my - centro[1], m.mz - centro[2], l.ax,
                                    l.ay, l.az);
  }
  Serial.printf("%.2f,%.2f,%.3f,%.3f,%.3f,%.1f,%.1f,%.1f,%.0f\n",
                filtros::alturaDesdePresion(pr, presionTierra), t, l.ax, l.ay, l.az, l.gx, l.gy,
                l.gz, rumbo);
  delay(100);
}
