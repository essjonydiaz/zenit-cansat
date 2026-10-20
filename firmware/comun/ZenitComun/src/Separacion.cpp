#include "Separacion.h"

#include <math.h>

namespace separacion {

uint8_t Secuencia::iniciar(uint32_t tMs, float gReferencia) {
  if (activa_ || terminada_) return NINGUNA;
  activa_ = true;
  t0_ = tMs;
  gRef_ = gReferencia;
  cambioMax_ = 0.0f;
  return ABRIR_DESACOPLE;
}

uint8_t Secuencia::actualizar(uint32_t tMs, float gTotal) {
  if (!activa_) return NINGUNA;
  uint8_t acc = NINGUNA;
  const uint32_t dt = tMs - t0_;

  // 1) Despliegue del autogiro (siempre).
  if (!autogiro_ && dt >= p_.retardoAutogiroMs) {
    autogiro_ = true;
    acc |= ABRIR_AUTOGIRO;
  }

  // 2) Confirmación con el IMU dentro de la ventana.
  if (!confirmada_ && !reintentando_ && dt <= p_.ventanaConfirmacionMs) {
    const float cambio = fabsf(gTotal - gRef_);
    if (cambio > cambioMax_) cambioMax_ = cambio;
    if (cambio >= p_.cambioMinimoG) {
      confirmada_ = true;
      acc |= CONFIRMADA;
    }
  }

  // 3) Reintento si no se confirmó: cerrar y volver a abrir el desacople.
  if (!confirmada_ && !reintentando_ && dt > p_.ventanaConfirmacionMs) {
    reintentando_ = true;
    acc |= CERRAR_DESACOPLE | NO_CONFIRMADA;
  }
  if (reintentando_ && dt > p_.ventanaConfirmacionMs + p_.duracionReintentoMs) {
    acc |= ABRIR_DESACOPLE;
    reintentando_ = false;
    activa_ = false;
    terminada_ = true;
  }

  // Terminó bien: confirmada y autogiro abierto.
  if (confirmada_ && autogiro_) {
    activa_ = false;
    terminada_ = true;
  }
  return acc;
}

}  // namespace separacion
