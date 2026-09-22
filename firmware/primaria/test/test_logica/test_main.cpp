// =============================================================================
//  Pruebas de la lógica del CanSat en la PC (sin ESP32):
//      pio test -e native            (desde firmware/primaria)
//  Se corren solas en GitHub Actions en cada push.
// =============================================================================
#include <math.h>
#include <string.h>
#include <unity.h>

#include "ZenitComun.h"

void setUp() {}
void tearDown() {}

// ------------------------------------------------------------ Protocolo ---
void test_checksum_y_enmarcado() {
  char trama[64];
  const size_t n = protocolo::enmarcar("T,1,2,3", trama, sizeof(trama));
  TEST_ASSERT_EQUAL(strlen(trama), n);
  TEST_ASSERT_EQUAL_CHAR('$', trama[0]);
  TEST_ASSERT_EQUAL_CHAR('*', trama[n - 3]);
  const char* carga;
  size_t largo;
  TEST_ASSERT_TRUE(protocolo::validar(trama, n, &carga, &largo));
  TEST_ASSERT_EQUAL(7, largo);
  TEST_ASSERT_EQUAL_CHAR('T', protocolo::tipo(carga, largo));
}

void test_trama_corrupta_se_rechaza() {
  char trama[64];
  const size_t n = protocolo::enmarcar("B,10,5000,25.1,-99.8,7,1,8.9", trama, sizeof(trama));
  trama[5] = 'X';  // un bit cambiado en el aire
  TEST_ASSERT_FALSE(protocolo::validar(trama, n, nullptr, nullptr));
}

void test_campos() {
  const char* carga = "C,ZENIT,DESACOPLAR";
  char c[16];
  TEST_ASSERT_TRUE(protocolo::campo(carga, strlen(carga), 1, c, sizeof(c)));
  TEST_ASSERT_EQUAL_STRING("ZENIT", c);
  TEST_ASSERT_TRUE(protocolo::campo(carga, strlen(carga), 2, c, sizeof(c)));
  TEST_ASSERT_EQUAL_STRING("DESACOPLAR", c);
  TEST_ASSERT_FALSE(protocolo::campo(carga, strlen(carga), 3, c, sizeof(c)));
}

// ------------------------------------------------------------------ Geo ---
void test_distancia_y_rumbo() {
  // 0.001° de latitud ≈ 111.2 m hacia el norte
  const double d = geo::distanciaMetros(25.0, -99.0, 25.001, -99.0);
  TEST_ASSERT_FLOAT_WITHIN(0.5, 111.2, d);
  TEST_ASSERT_FLOAT_WITHIN(0.5, 0.0, geo::rumboGrados(25.0, -99.0, 25.001, -99.0));
  TEST_ASSERT_FLOAT_WITHIN(0.5, 90.0, geo::rumboGrados(25.0, -99.0, 25.0, -98.999));
  TEST_ASSERT_EQUAL_STRING("E", geo::puntoCardinal(92.0));
  TEST_ASSERT_EQUAL_STRING("N", geo::puntoCardinal(355.0));
}

// -------------------------------------------------------------- Filtros ---
void test_altura_barometrica_ida_y_vuelta() {
  const float p0 = 96300.0f;
  const float p = filtros::presionDesdeAltura(200.0f, p0);
  TEST_ASSERT_FLOAT_WITHIN(0.05, 200.0, filtros::alturaDesdePresion(p, p0));
  TEST_ASSERT_FLOAT_WITHIN(0.01, 0.0, filtros::alturaDesdePresion(p0, p0));
}

void test_filtro_sigue_bajada_constante() {
  filtros::FiltroVertical f;
  f.reiniciar(300.0f, -10.0f);
  float h = 300.0f;
  for (int i = 0; i < 500; ++i) {  // 10 s a -10 m/s
    h -= 10.0f * 0.02f;
    f.actualizar(h, 0.0f, 0.02f);
  }
  TEST_ASSERT_FLOAT_WITHIN(0.2, -10.0, f.velocidad());
  TEST_ASSERT_FLOAT_WITHIN(0.5, h, f.altura());
}

// -------------------------------------------------- Máquina de estados ---
void test_no_desacopla_si_no_se_armo() {
  mision::MaquinaEstados m;
  // Sube solo a 220 m y baja: nunca pasó de 250 m, NO debe desacoplar.
  float t = 0;
  for (float h = 0; h < 220; h += 1.0f, t += 0.1f) m.actualizar({t, h, 10.0f, 1.0f});
  for (float h = 220; h > 150; h -= 1.0f, t += 0.1f) {
    const uint8_t ev = m.actualizar({t, h, -10.0f, 1.0f});
    TEST_ASSERT_FALSE(ev & mision::EV_DESACOPLE);
  }
  TEST_ASSERT_FALSE(m.desacopleHecho());
}

void test_pausa_del_dron_no_es_aterrizaje() {
  mision::MaquinaEstados m;
  float t = 0;
  for (float h = 0; h < 20; h += 1.0f, t += 0.1f) m.actualizar({t, h, 10.0f, 1.0f});
  for (int i = 0; i < 100; ++i, t += 0.1f) m.actualizar({t, 20.0f, 0.0f, 1.0f});  // 10 s quieto a 20 m
  TEST_ASSERT_TRUE(m.estado() == mision::Estado::ASCENSO);
}

// Vuelo completo simulado: sensores sintéticos -> filtros -> máquina de estados.
void test_vuelo_simulado_completo() {
  sim::SimuladorVuelo s;
  filtros::FiltroVertical f;
  filtros::Orientacion o;
  mision::MaquinaEstados m;
  const float dt = 0.02f;
  float p0 = 0;
  for (int i = 0; i < 50; ++i) p0 += s.paso(dt, false).presionPa;
  p0 /= 50;
  bool servo = false, inicio = false;
  float hDesacopleReal = -1, sumaV = 0;
  int nV = 0;
  for (int i = 0; i < 20000 && m.estado() != mision::Estado::ATERRIZADO; ++i) {
    const sim::Lectura l = s.paso(dt, servo);
    if (!inicio) { o.iniciarDesdeAcel(l.ax, l.ay, l.az); inicio = true; }
    const float k = 0.0174533f;
    o.actualizar(l.gx * k, l.gy * k, l.gz * k, l.ax, l.ay, l.az, dt);
    const float aV = o.verticalDelMundo(l.ax, l.ay, l.az) * filtros::G - filtros::G;
    f.actualizar(filtros::alturaDesdePresion(l.presionPa, p0), aV, dt);
    const float g = sqrtf(l.ax * l.ax + l.ay * l.ay + l.az * l.az);
    const uint8_t ev = m.actualizar({i * dt, f.altura(), f.velocidad(), g});
    if (ev & mision::EV_DESACOPLE) { servo = true; hDesacopleReal = l.alturaReal; }
    if (l.fase == sim::Fase::AUTOGIRO && l.alturaReal < 150 && l.alturaReal > 20) {
      sumaV += f.velocidad();
      nV++;
    }
  }
  TEST_ASSERT_TRUE(m.desacopleHecho());
  TEST_ASSERT_FLOAT_WITHIN(8.0, 200.0, hDesacopleReal);   // desacople ~200 m
  TEST_ASSERT_FLOAT_WITHIN(15.0, 450.0, m.alturaMaxima());  // altura máxima
  TEST_ASSERT_TRUE(nV > 0);
  TEST_ASSERT_FLOAT_WITHIN(1.0, -10.0, sumaV / nV);        // velocidad con autogiro
  TEST_ASSERT_TRUE(m.estado() == mision::Estado::ATERRIZADO);
}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_checksum_y_enmarcado);
  RUN_TEST(test_trama_corrupta_se_rechaza);
  RUN_TEST(test_campos);
  RUN_TEST(test_distancia_y_rumbo);
  RUN_TEST(test_altura_barometrica_ida_y_vuelta);
  RUN_TEST(test_filtro_sigue_bajada_constante);
  RUN_TEST(test_no_desacopla_si_no_se_armo);
  RUN_TEST(test_pausa_del_dron_no_es_aterrizaje);
  RUN_TEST(test_vuelo_simulado_completo);
  return UNITY_END();
}
