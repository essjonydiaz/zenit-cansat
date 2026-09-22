#include "SimuladorVuelo.h"

#include <math.h>

#include "Filtros.h"

namespace sim {

static constexpr float G = filtros::G;
static constexpr double M_POR_GRADO_LAT = 111320.0;

SimuladorVuelo::SimuladorVuelo(const ParametrosSim& p, uint32_t semilla)
    : p_(p), semilla_(semilla ? semilla : 1) {}

float SimuladorVuelo::aleatorio() {
  // xorshift32: rápido y determinista (mismo vuelo en cada corrida).
  semilla_ ^= semilla_ << 13;
  semilla_ ^= semilla_ >> 17;
  semilla_ ^= semilla_ << 5;
  return (semilla_ / 4294967295.0f) * 2.0f - 1.0f;
}

float SimuladorVuelo::gauss() {
  // Suma de 4 uniformes: aproximación suficiente de una normal.
  return (aleatorio() + aleatorio() + aleatorio() + aleatorio()) * 0.866f;
}

// Aceleración con arrastre cuadrático para una velocidad terminal dada.
static float aceleracionConArrastre(float v, float vTerminal) {
  const float arrastre = G * (v / vTerminal) * (v / vTerminal);
  return -G + (v < 0 ? arrastre : -arrastre);
}

Lectura SimuladorVuelo::paso(float dt, bool autogiroDesplegado) {
  t_ += dt;
  tFase_ += dt;
  float a = 0.0f;  // aceleración real (m/s², + arriba)
  gImpacto_ = 0.0f;

  switch (fase_) {
    case Fase::TIERRA:
      h_ = v_ = 0.0f;
      if (tFase_ >= p_.tEsperaInicial) { fase_ = Fase::SUBIDA; tFase_ = 0; }
      break;
    case Fase::SUBIDA: {
      // Arranca y frena suavemente (3 m/s²), como un dron real.
      constexpr float ACEL_DRON = 3.0f;
      const float faltante = p_.alturaLiberacion - h_;
      const float distanciaFrenado = v_ * v_ / (2.0f * ACEL_DRON);
      if (faltante <= distanciaFrenado) {
        a = -ACEL_DRON;
      } else if (v_ < p_.velocidadSubida) {
        a = ACEL_DRON;
      }
      v_ += a * dt;
      if (v_ > p_.velocidadSubida) v_ = p_.velocidadSubida;
      h_ += v_ * dt;
      if (v_ <= 0.0f || h_ >= p_.alturaLiberacion) {
        h_ = h_ > p_.alturaLiberacion ? p_.alturaLiberacion : h_;
        v_ = 0.0f;
        a = 0.0f;
        fase_ = Fase::ESPERA;
        tFase_ = 0;
      }
      break;
    }
    case Fase::ESPERA:
      v_ = 0.0f;
      if (tFase_ >= p_.tEsperaArriba) { fase_ = Fase::CAIDA; tFase_ = 0; }
      break;
    case Fase::CAIDA:
      if (autogiroDesplegado) {
        fase_ = Fase::AUTOGIRO;
        tFase_ = 0;
        secSuelta_ = true;
        hSec_ = h_;
        vSec_ = v_;
        esteSec_ = este_;
      }
      a = aceleracionConArrastre(v_, p_.vTerminalCaida);
      v_ += a * dt;
      h_ += v_ * dt;
      break;
    case Fase::AUTOGIRO:
      a = aceleracionConArrastre(v_, p_.vTerminalAutogiro);
      v_ += a * dt;
      h_ += v_ * dt;
      break;
    case Fase::SUELO:
      h_ = v_ = 0.0f;
      break;
  }

  if ((fase_ == Fase::CAIDA || fase_ == Fase::AUTOGIRO) && h_ <= 0.0f) {
    // Impacto: frenado en ~5 cm (espuma EVA) => a = v² / (2 d)
    gImpacto_ = (v_ * v_) / (2.0f * 0.05f) / G;
    h_ = v_ = 0.0f;
    fase_ = Fase::SUELO;
    tFase_ = 0;
  }

  // Carga secundaria: caída libre después del desacople.
  if (secSuelta_) {
    if (hSec_ > 0.0f) {
      const float aSec = aceleracionConArrastre(vSec_, p_.vTerminalCaida);
      vSec_ += aSec * dt;
      hSec_ += vSec_ * dt;
      esteSec_ += p_.vientoEsteMs * 0.3 * dt;
      if (hSec_ < 0.0f) hSec_ = vSec_ = 0.0f;
    }
  } else {
    hSec_ = h_;
    esteSec_ = este_;
  }
  if (h_ > 0.0f) este_ += p_.vientoEsteMs * dt;

  // --- Lo que "mediría" cada sensor ---
  Lectura l{};
  // Acelerómetro = fuerza específica (a + g). En caída libre marca ~0 g.
  float fz = (a + G) / G;
  if (fase_ == Fase::TIERRA || fase_ == Fase::ESPERA || fase_ == Fase::SUELO) {
    fz = 1.0f;
  }
  if (gImpacto_ > 0.0f) fz = gImpacto_;
  if (fz > 16.0f) fz = 16.0f;  // el MPU6050 satura en ±16 g
  l.ax = p_.ruidoAcelG * gauss();
  l.ay = p_.ruidoAcelG * gauss();
  l.az = fz + p_.ruidoAcelG * gauss();
  l.gx = 0.5f * gauss();
  l.gy = 0.5f * gauss();
  l.gz = (fase_ == Fase::AUTOGIRO ? p_.giroAutogiroDps : 0.0f) + 0.5f * gauss();
  l.presionPa = filtros::presionDesdeAltura(h_, p_.presionTierraPa) +
                p_.ruidoPresionPa * gauss();
  l.temperaturaC = 28.0f - 0.0065f * h_;
  const double mPorGradoLon = M_POR_GRADO_LAT * cos(p_.latInicial * 3.14159265 / 180.0);
  l.lat = p_.latInicial;
  l.lon = p_.lonInicial + este_ / mPorGradoLon;
  l.latSec = p_.latInicial + 0.00002;  // ~2 m al norte
  l.lonSec = p_.lonInicial + esteSec_ / mPorGradoLon;
  l.secundariaSuelta = secSuelta_;
  l.alturaReal = h_;
  l.velocidadReal = v_;
  l.fase = fase_;
  return l;
}

}  // namespace sim
