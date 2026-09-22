// =============================================================================
//  Filtros.h — Cálculos de vuelo: altitud, velocidad vertical y orientación.
//
//  1) alturaDesdePresion(): ecuación barométrica estándar (altitud sobre el
//     punto de despegue, usando la presión de tierra medida antes del vuelo).
//
//  2) FiltroVertical: filtro complementario de 2º orden que combina
//       - la altitud del barómetro (estable, pero ruidosa y lenta), y
//       - la aceleración vertical del IMU (rápida, pero con deriva).
//     Resultado: altitud filtrada + VELOCIDAD vertical en todo el trayecto
//     (requisito de la misión). Ecuaciones:
//        h' = v + K1·(hBaro - h)
//        v' = a + K2·(hBaro - h)        con K1 = 2ζω, K2 = ω²
//
//  3) Orientacion: filtro de Mahony de 6 ejes (acelerómetro + giroscopio del
//     MPU6050). Da roll, pitch y yaw, y permite pasar la aceleración medida
//     por el sensor al eje vertical del mundo. El MPU6050 no tiene
//     magnetómetro, así que el yaw (rumbo) se deriva con el tiempo; roll y
//     pitch sí quedan corregidos por la gravedad.
// =============================================================================
#pragma once

namespace filtros {

constexpr float G = 9.80665f;  // m/s²

// Altitud (m) sobre el punto donde se midió presionTierraPa.
float alturaDesdePresion(float presionPa, float presionTierraPa);

// Presión (Pa) que corresponde a una altitud sobre tierra (inversa de la
// anterior). Útil para el simulador y las pruebas.
float presionDesdeAltura(float alturaM, float presionTierraPa);

class FiltroVertical {
 public:
  // omega: rapidez de corrección con el barómetro (rad/s). zeta: amortiguamiento.
  explicit FiltroVertical(float omega = 1.0f, float zeta = 0.7f);
  void reiniciar(float altura, float velocidad = 0.0f);
  // hBaro: altitud del barómetro (m). aVertical: aceleración vertical del
  // mundo SIN gravedad (m/s², positiva hacia arriba). dt en segundos.
  // Si usarAcel es false se ignora aVertical (modo solo barómetro).
  void actualizar(float hBaro, float aVertical, float dt, bool usarAcel = true);
  float altura() const { return h_; }
  float velocidad() const { return v_; }

 private:
  float k1_, k2_;
  float h_ = 0.0f, v_ = 0.0f;
  bool iniciado_ = false;
};

class Orientacion {
 public:
  explicit Orientacion(float kp = 1.0f, float ki = 0.0f);
  // Inicializa roll/pitch a partir de un vector de aceleración en reposo.
  void iniciarDesdeAcel(float ax, float ay, float az);
  // g en rad/s, a en cualquier unidad (se normaliza). dt en segundos.
  // La corrección con el acelerómetro solo se aplica cuando |a| está cerca de
  // 1 g (en caída libre o en impactos se usa solo el giroscopio).
  void actualizar(float gx, float gy, float gz, float ax, float ay, float az,
                  float dt);
  // Componente vertical (hacia arriba) de un vector medido por el sensor.
  float verticalDelMundo(float x, float y, float z) const;
  float roll() const;   // grados
  float pitch() const;  // grados
  float yaw() const;    // grados (deriva, no hay magnetómetro)

 private:
  float kp_, ki_;
  float q0_ = 1, q1_ = 0, q2_ = 0, q3_ = 0;
  float ix_ = 0, iy_ = 0, iz_ = 0;
};

}  // namespace filtros
