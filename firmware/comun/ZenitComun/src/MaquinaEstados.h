// =============================================================================
//  MaquinaEstados.h — Lógica de la misión de la carga primaria.
//
//     PREVUELO ──(sube > 15 m)──> ASCENSO ──(liberación del dron)──> CAIDA_LIBRE
//                                                                      │
//                     (armado: ya pasó de 250 m, bajando y h ≤ 200 m)  ▼
//                                          DESCENSO_AUTOGIRO <── DESACOPLE
//                                                  │
//                        (después de la liberación: quieto y cerca del suelo 3 s)
//                                                  ▼
//                                             ATERRIZADO  (sigue transmitiendo)
//
//  Protecciones contra disparos falsos del desacople:
//   - Solo se "arma" cuando la altitud máxima ya superó alturaArmado (250 m),
//     así nunca se dispara en la mesa, en la subida ni en pruebas en tierra.
//   - Exige velocidad de bajada y varias lecturas seguidas bajo 200 m.
//   - Respaldo: si por alguna razón no se detectó la liberación pero ya está
//     armado y bajando, también dispara.
//  La lógica es C++ puro: se prueba en la PC (test/test_logica) y con el
//  simulador de vuelo.
// =============================================================================
#pragma once
#include <stdint.h>

namespace mision {

enum class Estado : uint8_t {
  PREVUELO = 0,
  ASCENSO = 1,
  CAIDA_LIBRE = 2,
  DESCENSO_AUTOGIRO = 3,
  ATERRIZADO = 4,
};

const char* nombre(Estado e);

// Bits de eventos que devuelve actualizar() (pueden venir varios a la vez).
enum Evento : uint8_t {
  EV_NINGUNO = 0,
  EV_ASCENSO = 1 << 0,
  EV_LIBERACION = 1 << 1,
  EV_DESACOPLE = 1 << 2,   // <- mover el servo AHORA
  EV_ATERRIZAJE = 1 << 3,
};

struct Parametros {
  float alturaDeteccionAscenso = 15.0f;  // m sobre tierra
  float tiempoConfirmacionAscenso = 1.0f;  // s
  float velocidadLiberacion = -6.0f;       // m/s (negativa = bajando)
  float tiempoConfirmacionLiberacion = 0.4f;  // s
  float gCaidaLibre = 0.35f;               // |a| < 0.35 g => caída libre
  float alturaArmado = 250.0f;             // m: debe superarse para armar
  float alturaDesacople = 200.0f;          // m: requisito de la misión
  float velocidadMinDesacople = -3.0f;     // m/s: debe ir bajando
  uint8_t lecturasDesacople = 3;           // lecturas seguidas bajo 200 m
  float alturaMaxAterrizaje = 30.0f;       // m (margen por deriva del barómetro)
  float velocidadAterrizaje = 0.7f;        // |v| menor a esto = quieto
  float tiempoConfirmacionAterrizaje = 3.0f;  // s
};

struct Entrada {
  float t;        // s desde el arranque
  float altura;   // m sobre tierra (filtrada)
  float velocidad;  // m/s, positiva hacia arriba
  float gTotal;   // magnitud de la aceleración medida, en g
};

class MaquinaEstados {
 public:
  explicit MaquinaEstados(const Parametros& p = Parametros());
  uint8_t actualizar(const Entrada& e);  // devuelve bits Evento
  // Desacople manual (comando desde tierra): marca el desacople como hecho.
  void desacopleManual(float t);
  void reiniciar();

  Estado estado() const { return estado_; }
  float alturaMaxima() const { return alturaMax_; }
  bool armado() const { return alturaMax_ >= p_.alturaArmado; }
  bool desacopleHecho() const { return desacopleHecho_; }
  float tDesacople() const { return tDesacople_; }
  float tAterrizaje() const { return tAterrizaje_; }
  const Parametros& parametros() const { return p_; }

 private:
  Parametros p_;
  Estado estado_ = Estado::PREVUELO;
  float alturaMax_ = 0.0f;
  bool desacopleHecho_ = false;
  float tDesacople_ = -1.0f;
  float tAterrizaje_ = -1.0f;
  float tInicioCondicion_ = -1.0f;  // cronómetro de confirmación
  float tInicioQuieto_ = -1.0f;
  uint8_t cuentaDesacople_ = 0;
};

}  // namespace mision
