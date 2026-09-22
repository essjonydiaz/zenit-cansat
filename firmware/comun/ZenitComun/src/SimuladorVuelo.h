// =============================================================================
//  SimuladorVuelo.h — Perfil de vuelo sintético de la misión.
//
//  Permite probar TODO el firmware (filtros, máquina de estados, desacople,
//  radio, microSD) y la estación terrena con solo un ESP32 en la mesa, sin
//  sensores ni dron. Reproduce:
//    tierra (10 s) -> subida con el dron hasta 450 m -> espera -> liberación
//    -> caída libre con arrastre (v terminal ≈ 37 m/s, igual que el CoDR)
//    -> desacople a 200 m (lo decide el FIRMWARE, no el simulador)
//    -> descenso con autogiro (~10 m/s) -> impacto -> suelo.
//  La carga secundaria sigue en caída libre después del desacople.
//
//  Se activa compilando el entorno "primaria_sim" de PlatformIO.
// =============================================================================
#pragma once
#include <stdint.h>

namespace sim {

enum class Fase : uint8_t { TIERRA, SUBIDA, ESPERA, CAIDA, AUTOGIRO, SUELO };

struct ParametrosSim {
  float tEsperaInicial = 10.0f;     // s en tierra antes de subir
  float velocidadSubida = 15.0f;    // m/s (acelerado para demos; el dron real sube más lento)
  float alturaLiberacion = 450.0f;  // m (requisito de la misión)
  float tEsperaArriba = 5.0f;       // s de espera antes de soltar
  float vTerminalCaida = 37.0f;     // m/s (cálculo de la pregunta 9 del CoDR)
  float vTerminalAutogiro = 10.0f;  // m/s (meta 8–12 m/s)
  float presionTierraPa = 96300.0f; // Pa aprox. a ~430 m s.n.m. (Montemorelos)
  float latInicial = 25.1936;       // aprox. Universidad de Montemorelos
  float lonInicial = -99.8416;
  float vientoEsteMs = 2.0f;        // deriva por viento
  float ruidoPresionPa = 3.0f;      // ≈ 0.25 m de ruido de altitud
  float ruidoAcelG = 0.02f;
  float giroAutogiroDps = 600.0f;   // rotación de la carga con autogiro
};

struct Lectura {
  float presionPa;
  float temperaturaC;
  float ax, ay, az;  // g, marco del sensor (z hacia arriba del CanSat)
  float gx, gy, gz;  // °/s
  double lat, lon;   // primaria
  double latSec, lonSec;  // secundaria
  bool secundariaSuelta;
  // "verdad" del simulador, para comparar en pruebas
  float alturaReal, velocidadReal;
  Fase fase;
};

class SimuladorVuelo {
 public:
  explicit SimuladorVuelo(const ParametrosSim& p = ParametrosSim(), uint32_t semilla = 12345);
  // Avanza dt segundos. autogiroDesplegado = el firmware ya movió el servo.
  Lectura paso(float dt, bool autogiroDesplegado);
  Fase fase() const { return fase_; }
  const ParametrosSim& parametros() const { return p_; }

 private:
  float aleatorio();  // uniforme en [-1, 1]
  float gauss();      // ≈ normal(0, 1)

  ParametrosSim p_;
  uint32_t semilla_;
  Fase fase_ = Fase::TIERRA;
  float t_ = 0.0f, tFase_ = 0.0f;
  float h_ = 0.0f, v_ = 0.0f;
  float hSec_ = 0.0f, vSec_ = 0.0f;
  bool secSuelta_ = false;
  double este_ = 0.0, esteSec_ = 0.0;  // desplazamiento hacia el Este (m)
  float gImpacto_ = 0.0f;
};

}  // namespace sim
