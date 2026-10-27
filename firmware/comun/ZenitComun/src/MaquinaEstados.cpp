#include "MaquinaEstados.h"

#include <math.h>

namespace mision {

const char* nombre(Estado e) {
  switch (e) {
    case Estado::PREVUELO: return "PREVUELO";
    case Estado::ASCENSO: return "ASCENSO";
    case Estado::CAIDA_LIBRE: return "CAIDA_LIBRE";
    case Estado::DESCENSO_AUTOGIRO: return "DESCENSO_AUTOGIRO";
    case Estado::ATERRIZADO: return "ATERRIZADO";
  }
  return "?";
}

MaquinaEstados::MaquinaEstados(const Parametros& p) : p_(p) {}

void MaquinaEstados::reiniciar() {
  estado_ = Estado::PREVUELO;
  alturaMax_ = 0.0f;
  desacopleHecho_ = false;
  tDesacople_ = tAterrizaje_ = tInicioCondicion_ = tInicioQuieto_ = -1.0f;
  cuentaDesacople_ = 0;
}

void MaquinaEstados::desacopleManual(float t) {
  if (desacopleHecho_) return;
  desacopleHecho_ = true;
  tDesacople_ = t;
  if (estado_ != Estado::ATERRIZADO && estado_ != Estado::PREVUELO) {
    estado_ = Estado::DESCENSO_AUTOGIRO;
  }
}

uint8_t MaquinaEstados::actualizar(const Entrada& e) {
  uint8_t ev = EV_NINGUNO;
  if (e.altura > alturaMax_) alturaMax_ = e.altura;

  // --- Desacople: se evalúa en cualquier estado de vuelo ---
  const bool enVuelo = estado_ == Estado::ASCENSO || estado_ == Estado::CAIDA_LIBRE;
  if (!desacopleHecho_ && enVuelo && armado()) {
    if (e.altura <= alturaDesacopleEfectiva() && e.velocidad <= p_.velocidadMinDesacople) {
      if (++cuentaDesacople_ >= p_.lecturasDesacople) {
        desacopleHecho_ = true;
        tDesacople_ = e.t;
        if (estado_ == Estado::ASCENSO) ev |= EV_LIBERACION;  // respaldo
        estado_ = Estado::DESCENSO_AUTOGIRO;
        ev |= EV_DESACOPLE;
        return ev;
      }
    } else {
      cuentaDesacople_ = 0;
    }
  }

  switch (estado_) {
    case Estado::PREVUELO: {
      if (e.altura > p_.alturaDeteccionAscenso) {
        if (tInicioCondicion_ < 0) tInicioCondicion_ = e.t;
        if (e.t - tInicioCondicion_ >= p_.tiempoConfirmacionAscenso) {
          estado_ = Estado::ASCENSO;
          tInicioCondicion_ = -1.0f;
          ev |= EV_ASCENSO;
        }
      } else {
        tInicioCondicion_ = -1.0f;
      }
      break;
    }
    case Estado::ASCENSO: {
      // Liberación del dron: caída libre (casi 0 g) o bajada rápida sostenida.
      const bool caida = e.gTotal < p_.gCaidaLibre || e.velocidad < p_.velocidadLiberacion;
      if (caida && e.altura > alturaDesacopleEfectiva()) {
        if (tInicioCondicion_ < 0) tInicioCondicion_ = e.t;
        if (e.t - tInicioCondicion_ >= p_.tiempoConfirmacionLiberacion) {
          estado_ = Estado::CAIDA_LIBRE;
          tInicioCondicion_ = -1.0f;
          ev |= EV_LIBERACION;
        }
      } else {
        tInicioCondicion_ = -1.0f;
      }
      break;
    }
    case Estado::CAIDA_LIBRE:
    case Estado::DESCENSO_AUTOGIRO:
      break;
    case Estado::ATERRIZADO:
      return ev;
  }

  // --- Aterrizaje ---
  // Solo después de la liberación, o si ya subió por encima de la altura de
  // armado y volvió (p. ej. el dron bajó sin soltarlo). Así una pausa del dron
  // a poca altura durante la subida NO se confunde con un aterrizaje.
  const bool puedeAterrizar = estado_ == Estado::CAIDA_LIBRE ||
                              estado_ == Estado::DESCENSO_AUTOGIRO ||
                              (estado_ == Estado::ASCENSO && armado());
  if (puedeAterrizar) {
    const bool quieto = fabsf(e.velocidad) < p_.velocidadAterrizaje &&
                        e.altura < p_.alturaMaxAterrizaje;
    if (quieto) {
      if (tInicioQuieto_ < 0) tInicioQuieto_ = e.t;
      if (e.t - tInicioQuieto_ >= p_.tiempoConfirmacionAterrizaje) {
        estado_ = Estado::ATERRIZADO;
        tAterrizaje_ = e.t;
        ev |= EV_ATERRIZAJE;
      }
    } else {
      tInicioQuieto_ = -1.0f;
    }
  }
  return ev;
}

}  // namespace mision
