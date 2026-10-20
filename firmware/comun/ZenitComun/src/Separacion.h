// =============================================================================
//  Separacion.h — Secuencia de los DOS servos a 200 m (algoritmo del PDR, p. 21-22)
//
//   t = 0 ms     servo de DESACOPLE abre    -> se suelta la carga secundaria
//   0..350 ms    el IMU busca el "jalón" de la separación (cambio brusco de |a|)
//                  -> sí lo ve:  evento SEPARACION ok
//   t = 350 ms   si NO lo vio:  reintento (cierra el desacople 300 ms y lo
//                vuelve a abrir, por si el pasador se atoró) y evento
//                SEPARACION_NO_CONFIRMADA
//   t = 400 ms   servo del AUTOGIRO abre    -> se despliegan las palas
//  La ventana termina ANTES de abrir el autogiro, porque el frenón de las palas
//  también cambia |a| y se confundiría con la separación.
//
//  El autogiro se despliega SIEMPRE, se confirme o no la separación: sin
//  autogiro el huevo de la primaria no sobrevive. El orden (primero desacople,
//  luego autogiro) evita que las palas abiertas frenen a la primaria mientras
//  la secundaria todavía está enganchada.
//
//  C++ puro (sin Arduino): main.cpp solo ejecuta las acciones que devuelve
//  actualizar(). Se prueba en la PC con test/test_logica.
// =============================================================================
#pragma once
#include <stdint.h>

namespace separacion {

struct Parametros {
  uint32_t retardoAutogiroMs = 400;      // entre abrir desacople y abrir autogiro
  uint32_t ventanaConfirmacionMs = 350;  // tiempo para ver el jalón (antes del autogiro)
  float cambioMinimoG = 0.6f;            // |a| debe alejarse esto de la referencia
  uint32_t duracionReintentoMs = 300;    // cuánto tiempo queda cerrado en el reintento
};

// Acciones que debe ejecutar main.cpp (bits, pueden venir varias juntas).
enum Accion : uint8_t {
  NINGUNA = 0,
  ABRIR_DESACOPLE = 1 << 0,
  ABRIR_AUTOGIRO = 1 << 1,
  CERRAR_DESACOPLE = 1 << 2,  // solo durante el reintento
  CONFIRMADA = 1 << 3,        // el IMU vio la separación
  NO_CONFIRMADA = 1 << 4,     // no se vio: se hizo el reintento
};

class Secuencia {
 public:
  explicit Secuencia(const Parametros& p = Parametros()) : p_(p) {}
  // Arranca la secuencia. gReferencia = |a| (en g) justo antes de soltar.
  // Devuelve ABRIR_DESACOPLE (o NINGUNA si ya estaba en curso).
  uint8_t iniciar(uint32_t tMs, float gReferencia);
  // Llamar en cada ciclo con la aceleración total medida (g).
  uint8_t actualizar(uint32_t tMs, float gTotal);
  void reiniciar() { *this = Secuencia(p_); }

  bool activa() const { return activa_; }
  bool autogiroAbierto() const { return autogiro_; }
  bool confirmada() const { return confirmada_; }
  bool terminada() const { return terminada_; }
  float cambioMaximoG() const { return cambioMax_; }

 private:
  Parametros p_;
  bool activa_ = false, autogiro_ = false, confirmada_ = false;
  bool terminada_ = false, reintentando_ = false;
  uint32_t t0_ = 0;
  float gRef_ = 1.0f, cambioMax_ = 0.0f;
};

}  // namespace separacion
