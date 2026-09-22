#include "Filtros.h"

#include <math.h>

namespace filtros {

static constexpr float EXPONENTE = 0.190263f;  // 1 / 5.25588

float alturaDesdePresion(float presionPa, float presionTierraPa) {
  if (presionPa <= 0.0f || presionTierraPa <= 0.0f) return 0.0f;
  return 44330.0f * (1.0f - powf(presionPa / presionTierraPa, EXPONENTE));
}

float presionDesdeAltura(float alturaM, float presionTierraPa) {
  return presionTierraPa * powf(1.0f - alturaM / 44330.0f, 5.25588f);
}

// ---------------------------------------------------------------------------
FiltroVertical::FiltroVertical(float omega, float zeta)
    : k1_(2.0f * zeta * omega), k2_(omega * omega) {}

void FiltroVertical::reiniciar(float altura, float velocidad) {
  h_ = altura;
  v_ = velocidad;
  iniciado_ = true;
}

void FiltroVertical::actualizar(float hBaro, float aVertical, float dt,
                                bool usarAcel) {
  if (!iniciado_) {
    reiniciar(hBaro);
    return;
  }
  if (dt <= 0.0f || dt > 0.5f) {  // hueco raro en el muestreo: re-sincronizar
    h_ = hBaro;
    return;
  }
  const float error = hBaro - h_;
  const float a = usarAcel ? aVertical : 0.0f;
  h_ += (v_ + k1_ * error) * dt;
  v_ += (a + k2_ * error) * dt;
}

// ---------------------------------------------------------------------------
static inline float invSqrt(float x) { return 1.0f / sqrtf(x); }
static constexpr float RAD_A_GRAD = 57.2957795f;

Orientacion::Orientacion(float kp, float ki) : kp_(kp), ki_(ki) {}

void Orientacion::iniciarDesdeAcel(float ax, float ay, float az) {
  const float roll = atan2f(ay, az);
  const float pitch = atan2f(-ax, sqrtf(ay * ay + az * az));
  const float cr = cosf(roll * 0.5f), sr = sinf(roll * 0.5f);
  const float cp = cosf(pitch * 0.5f), sp = sinf(pitch * 0.5f);
  // yaw = 0
  q0_ = cr * cp;
  q1_ = sr * cp;
  q2_ = cr * sp;
  q3_ = -sr * sp;
  ix_ = iy_ = iz_ = 0;
}

void Orientacion::actualizar(float gx, float gy, float gz, float ax, float ay,
                             float az, float dt) {
  const float norma = sqrtf(ax * ax + ay * ay + az * az);
  // Solo corregimos con la gravedad si el sensor mide ~1 g (±25 %).
  // Como no conocemos la unidad, comparamos contra la norma esperada en g o
  // en m/s².
  const float normaG = (norma > 3.0f) ? norma / G : norma;
  if (norma > 0.0f && normaG > 0.75f && normaG < 1.25f) {
    const float r = invSqrt(ax * ax + ay * ay + az * az);
    ax *= r;
    ay *= r;
    az *= r;
    // Dirección estimada de la gravedad en el marco del sensor.
    const float vx = 2.0f * (q1_ * q3_ - q0_ * q2_);
    const float vy = 2.0f * (q0_ * q1_ + q2_ * q3_);
    const float vz = q0_ * q0_ - q1_ * q1_ - q2_ * q2_ + q3_ * q3_;
    // Error = medida × estimada
    const float ex = ay * vz - az * vy;
    const float ey = az * vx - ax * vz;
    const float ez = ax * vy - ay * vx;
    if (ki_ > 0.0f) {
      ix_ += ki_ * ex * dt;
      iy_ += ki_ * ey * dt;
      iz_ += ki_ * ez * dt;
      gx += ix_;
      gy += iy_;
      gz += iz_;
    }
    gx += kp_ * ex;
    gy += kp_ * ey;
    gz += kp_ * ez;
  }
  // Integrar la rotación del cuaternión.
  const float hdt = 0.5f * dt;
  const float qa = q0_, qb = q1_, qc = q2_;
  q0_ += (-qb * gx - qc * gy - q3_ * gz) * hdt;
  q1_ += (qa * gx + qc * gz - q3_ * gy) * hdt;
  q2_ += (qa * gy - qb * gz + q3_ * gx) * hdt;
  q3_ += (qa * gz + qb * gy - qc * gx) * hdt;
  const float r = invSqrt(q0_ * q0_ + q1_ * q1_ + q2_ * q2_ + q3_ * q3_);
  q0_ *= r;
  q1_ *= r;
  q2_ *= r;
  q3_ *= r;
}

float Orientacion::verticalDelMundo(float x, float y, float z) const {
  const float vx = 2.0f * (q1_ * q3_ - q0_ * q2_);
  const float vy = 2.0f * (q0_ * q1_ + q2_ * q3_);
  const float vz = q0_ * q0_ - q1_ * q1_ - q2_ * q2_ + q3_ * q3_;
  return vx * x + vy * y + vz * z;
}

float Orientacion::roll() const {
  return atan2f(2.0f * (q0_ * q1_ + q2_ * q3_),
                1.0f - 2.0f * (q1_ * q1_ + q2_ * q2_)) *
         RAD_A_GRAD;
}

float Orientacion::pitch() const {
  float s = 2.0f * (q0_ * q2_ - q3_ * q1_);
  if (s > 1.0f) s = 1.0f;
  if (s < -1.0f) s = -1.0f;
  return asinf(s) * RAD_A_GRAD;
}

float Orientacion::yaw() const {
  return atan2f(2.0f * (q0_ * q3_ + q1_ * q2_),
                1.0f - 2.0f * (q2_ * q2_ + q3_ * q3_)) *
         RAD_A_GRAD;
}

}  // namespace filtros
