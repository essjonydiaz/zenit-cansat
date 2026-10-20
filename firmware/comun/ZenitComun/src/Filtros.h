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
//     MPU9250 del GY-91). Da roll, pitch y yaw, y permite pasar la aceleración
//     medida por el sensor al eje vertical del mundo. Roll y pitch se corrigen
//     con la gravedad. El yaw del giroscopio se deriva con el tiempo; si el
//     magnetómetro (AK8963) responde, fusionarRumbo() lo corrige poco a poco
//     hacia el rumbo magnético (brújula compensada por inclinación).
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
  // constexpr: los objetos globales se construyen al compilar. En el ESP32-S3
  // NO se puede hacer aritmética de punto flotante en constructores globales
  // (la FPU todavía no está habilitada y el chip se reinicia en bucle).
  constexpr explicit FiltroVertical(float omega = 1.0f, float zeta = 0.7f)
      : k1_(2.0f * zeta * omega), k2_(omega * omega) {}
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
  constexpr explicit Orientacion(float kp = 1.0f, float ki = 0.0f) : kp_(kp), ki_(ki) {}
  // Inicializa roll/pitch a partir de un vector de aceleración en reposo.
  void iniciarDesdeAcel(float ax, float ay, float az);
  // g en rad/s, a en cualquier unidad (se normaliza). dt en segundos.
  // La corrección con el acelerómetro solo se aplica cuando |a| está cerca de
  // 1 g (en caída libre o en impactos se usa solo el giroscopio).
  void actualizar(float gx, float gy, float gz, float ax, float ay, float az,
                  float dt);
  // Componente vertical (hacia arriba) de un vector medido por el sensor.
  float verticalDelMundo(float x, float y, float z) const;
  // Dirección "arriba" del mundo expresada en los ejes del sensor (unitaria).
  void arriba(float& x, float& y, float& z) const;
  float roll() const;   // grados
  float pitch() const;  // grados
  // Yaw en grados, -180..180, positivo girando en sentido ANTIHORARIO visto
  // desde arriba (convención matemática, eje z hacia arriba).
  float yaw() const;
  // El mismo ángulo como brújula: 0..360, positivo en sentido HORARIO
  // (0 = norte, 90 = este) una vez que fusionarRumbo() lo alineó.
  float rumbo() const;
  // Corrige el yaw hacia 'rumboGrados' (0..360, de la brújula). 'tau' en s:
  // cuanto más grande, más confía en el giroscopio y menos en la brújula.
  void fusionarRumbo(float rumboGrados, float dt, float tau = 2.0f);

 private:
  float yawGiro() const;
  float kp_, ki_;
  float desfaseYaw_ = 0.0f;  // grados que se suman al yaw del giroscopio
  bool conRumbo_ = false;
  float q0_ = 1, q1_ = 0, q2_ = 0, q3_ = 0;
  float ix_ = 0, iy_ = 0, iz_ = 0;
};

// Rumbo magnético (0..360°, 0 = norte magnético, 90 = este) del eje X del
// sensor ("el frente" del CanSat), con compensación de inclinación.
//   mx,my,mz: campo magnético en los MISMOS ejes que el acelerómetro.
//   ux,uy,uz: dirección "arriba" vista desde el sensor (Orientacion::arriba(),
//             o el acelerómetro normalizado si el CanSat está quieto).
// Funciona con cualquier orientación de montaje: proyecta el campo sobre el
// plano horizontal (este = m × arriba, norte = arriba × este).
float rumboMagnetico(float mx, float my, float mz, float ux, float uy, float uz);

// Diferencia angular b - a en grados, en el rango -180..180.
float diferenciaAngular(float a, float b);

}  // namespace filtros
