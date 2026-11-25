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

// Modo prueba: se enciende en el suelo, lo suben 8 m por la escalera, lo
// sueltan desde el techo y cae libre. Debe desacoplar ~1.5 m abajo del techo.
void test_modo_prueba_techo() {
  mision::Parametros p;
  p.alturaDeteccionAscenso = 3.0f;
  p.alturaArmado = 4.0f;
  p.caidaDesacople = 1.5f;
  p.alturaMaxAterrizaje = 2.5f;
  mision::MaquinaEstados m;
  m.configurar(p);
  TEST_ASSERT_TRUE(m.modoPrueba());
  const float dt = 0.02f;
  float t = 0, h = 0, v = 0;
  uint8_t todos = 0;
  float hDesacople = -1;
  for (int i = 0; i < 100; ++i, t += dt) todos |= m.actualizar({t, 0.0f, 0.0f, 1.0f});   // 2 s en el suelo
  for (; h < 8.0f; t += dt) { h += 0.5f * dt; todos |= m.actualizar({t, h, 0.5f, 1.0f}); }  // escalera
  TEST_ASSERT_TRUE(todos & mision::EV_ASCENSO);
  for (int i = 0; i < 250; ++i, t += dt) {           // 5 s en el techo, se mueve un poco
    const float bajada = (i > 100 && i < 150) ? -0.6f : 0.0f;   // baja medio escalón
    h += bajada * dt;
    const uint8_t ev = m.actualizar({t, h, bajada, 1.0f});
    TEST_ASSERT_FALSE(ev & mision::EV_DESACOPLE);    // caminar NO desacopla
    TEST_ASSERT_FALSE(ev & mision::EV_ATERRIZAJE);   // esperar en el techo NO es aterrizar
  }
  const float techo = h;
  while (h > 0) {                                    // caída libre
    v -= 9.81f * dt; h += v * dt;
    const uint8_t ev = m.actualizar({t, h > 0 ? h : 0.0f, v, 0.05f});
    if (ev & mision::EV_DESACOPLE) hDesacople = h;
    todos |= ev; t += dt;
  }
  for (int i = 0; i < 250; ++i, t += dt) todos |= m.actualizar({t, 0.0f, 0.0f, 1.0f});   // en el pasto
  TEST_ASSERT_TRUE(todos & mision::EV_LIBERACION);
  TEST_ASSERT_TRUE(todos & mision::EV_DESACOPLE);
  TEST_ASSERT_FLOAT_WITHIN(0.6f, techo - 1.5f, hDesacople);
  TEST_ASSERT_TRUE(m.estado() == mision::Estado::ATERRIZADO);
}

// Con los parámetros normales, la misma prueba del techo NO desacopla.
void test_sin_modo_prueba_el_techo_no_desacopla() {
  mision::MaquinaEstados m;
  TEST_ASSERT_FALSE(m.modoPrueba());
  const float dt = 0.02f;
  float t = 0, h = 8.0f, v = 0;
  for (int i = 0; i < 100; ++i, t += dt) m.actualizar({t, h, 0.0f, 1.0f});
  while (h > 0) {
    v -= 9.81f * dt; h += v * dt;
    TEST_ASSERT_FALSE(m.actualizar({t, h > 0 ? h : 0.0f, v, 0.05f}) & mision::EV_DESACOPLE);
    t += dt;
  }
}

// Vuelo completo simulado: sensores sintéticos -> filtros -> máquina de estados.
void test_vuelo_simulado_completo() {
  sim::SimuladorVuelo s;
  filtros::FiltroVertical f;
  filtros::Orientacion o;
  mision::MaquinaEstados m;
  // Misión del 2026-11-24: el dron sube a 100 m y el desacople es a 80 m
  // (los mismos valores que config.h).
  mision::Parametros pm;
  pm.alturaArmado = 90.0f;
  pm.alturaDesacople = 80.0f;
  m.configurar(pm);
  separacion::Secuencia sep;
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
    if (ev & mision::EV_DESACOPLE) {
      sep.iniciar(static_cast<uint32_t>(i * dt * 1000), g);
      hDesacopleReal = l.alturaReal;
    }
    // El autogiro se abre 400 ms después del desacople (Separacion.h).
    if (sep.actualizar(static_cast<uint32_t>(i * dt * 1000), g) & separacion::ABRIR_AUTOGIRO) {
      servo = true;
    }
    if (l.fase == sim::Fase::AUTOGIRO && l.alturaReal < 50 && l.alturaReal > 10) {
      sumaV += f.velocidad();
      nV++;
    }
  }
  TEST_ASSERT_TRUE(m.desacopleHecho());
  TEST_ASSERT_FLOAT_WITHIN(8.0, 80.0, hDesacopleReal);    // desacople ~80 m
  TEST_ASSERT_FLOAT_WITHIN(8.0, 100.0, m.alturaMaxima());   // altura máxima ~100 m
  TEST_ASSERT_TRUE(nV > 0);
  TEST_ASSERT_FLOAT_WITHIN(1.0, -10.0, sumaV / nV);        // velocidad con autogiro
  TEST_ASSERT_TRUE(m.estado() == mision::Estado::ATERRIZADO);
  TEST_ASSERT_TRUE(sep.autogiroAbierto());
}

// ----------------------------------------------- Separación (2 servos) ---
void test_separacion_confirmada() {
  separacion::Secuencia s;
  TEST_ASSERT_EQUAL_UINT8(separacion::ABRIR_DESACOPLE, s.iniciar(1000, 1.0f));
  TEST_ASSERT_EQUAL_UINT8(separacion::NINGUNA, s.iniciar(1001, 1.0f));  // no se repite
  TEST_ASSERT_EQUAL_UINT8(separacion::NINGUNA, s.actualizar(1100, 1.1f));
  // Jalón de la separación a los 200 ms
  TEST_ASSERT_EQUAL_UINT8(separacion::CONFIRMADA, s.actualizar(1200, 2.0f));
  TEST_ASSERT_FALSE(s.autogiroAbierto());
  TEST_ASSERT_EQUAL_UINT8(separacion::NINGUNA, s.actualizar(1399, 1.0f));
  TEST_ASSERT_EQUAL_UINT8(separacion::ABRIR_AUTOGIRO, s.actualizar(1400, 1.0f));
  TEST_ASSERT_TRUE(s.terminada());
  TEST_ASSERT_TRUE(s.confirmada());
}

void test_separacion_sin_jalon_reintenta_y_abre_autogiro() {
  separacion::Secuencia s;
  s.iniciar(0, 1.0f);
  uint8_t todo = 0;
  bool cerrado = false, reabierto = false;
  for (uint32_t t = 20; t <= 1000; t += 20) {
    const uint8_t a = s.actualizar(t, 1.1f);  // nunca hay jalón
    todo |= a;
    if (a & separacion::CERRAR_DESACOPLE) cerrado = true;
    if ((a & separacion::ABRIR_DESACOPLE) && cerrado) reabierto = true;
    if (a & separacion::ABRIR_AUTOGIRO) TEST_ASSERT_EQUAL_UINT32(400, t);
  }
  TEST_ASSERT_TRUE(todo & separacion::NO_CONFIRMADA);
  TEST_ASSERT_TRUE(cerrado && reabierto);
  TEST_ASSERT_TRUE(s.autogiroAbierto());  // el autogiro se abre SIEMPRE
  TEST_ASSERT_FALSE(s.confirmada());
  TEST_ASSERT_TRUE(s.terminada());
}

void test_frenon_del_autogiro_no_confirma_separacion() {
  separacion::Secuencia s;
  s.iniciar(0, 1.0f);
  uint8_t todo = 0;
  for (uint32_t t = 20; t <= 1000; t += 20) todo |= s.actualizar(t, t >= 400 ? 3.0f : 1.0f);
  TEST_ASSERT_FALSE(todo & separacion::CONFIRMADA);
}

// ------------------------------------------------- Brújula y orientación ---
void test_rumbo_magnetico_nivelado() {
  // Sensor horizontal (arriba = +z). El campo de la Tierra apunta al norte y
  // hacia abajo (en México la inclinación es de ~50°).
  // Mirando al norte: el campo va por +x.
  TEST_ASSERT_FLOAT_WITHIN(0.5, 0.0, filtros::rumboMagnetico(28, 0, -33, 0, 0, 1));
  // Mirando al este: el norte queda a la izquierda (+y en ejes x adelante, z arriba).
  TEST_ASSERT_FLOAT_WITHIN(0.5, 90.0, filtros::rumboMagnetico(0, 28, -33, 0, 0, 1));
  TEST_ASSERT_FLOAT_WITHIN(0.5, 180.0, filtros::rumboMagnetico(-28, 0, -33, 0, 0, 1));
  TEST_ASSERT_FLOAT_WITHIN(0.5, 270.0, filtros::rumboMagnetico(0, -28, -33, 0, 0, 1));
  // Inclinado 30° hacia adelante mirando al norte: el rumbo no debe cambiar.
  const float a = 30.0f * 0.0174533f;
  // Arriba y campo (norte 28 µT, vertical -33 µT) expresados en los ejes del
  // sensor inclinado (nariz arriba).
  const float ux = sinf(a), uz = cosf(a);
  const float mxs = 28 * cosf(a) + (-33) * sinf(a);
  const float mzs = -28 * sinf(a) + (-33) * cosf(a);
  TEST_ASSERT_FLOAT_WITHIN(0.5, 0.0, filtros::rumboMagnetico(mxs, 0, mzs, ux, 0, uz));
  TEST_ASSERT_FLOAT_WITHIN(0.01, -20.0, filtros::diferenciaAngular(10, 350));
  TEST_ASSERT_FLOAT_WITHIN(0.01, 20.0, filtros::diferenciaAngular(350, 10));
}

void test_yaw_converge_a_la_brujula() {
  filtros::Orientacion o;
  o.iniciarDesdeAcel(0, 0, 1);
  o.fusionarRumbo(90.0f, 0.1f);  // primera lectura: se alinea de golpe
  TEST_ASSERT_FLOAT_WITHIN(0.5, 90.0, o.rumbo());
  TEST_ASSERT_FLOAT_WITHIN(0.5, -90.0, o.yaw());  // este = -90° en sentido matemático
  for (int i = 0; i < 100; ++i) o.fusionarRumbo(120.0f, 0.1f, 2.0f);  // 10 s
  TEST_ASSERT_FLOAT_WITHIN(1.0, 120.0, o.rumbo());
  // Girar en sentido horario con el giroscopio (z arriba => gz negativo)
  // hace crecer el rumbo, igual que la brújula.
  const float antes = o.rumbo();
  for (int i = 0; i < 50; ++i) o.actualizar(0, 0, -0.349f, 0, 0, 1, 0.02f);  // -20°/s por 1 s
  TEST_ASSERT_FLOAT_WITHIN(1.0, antes + 20.0f, o.rumbo());
}

// --------------------------------------------------------- GPS u-blox ---
void test_mensaje_ubx_modelo_aereo() {
  uint8_t m[ubx::TAM_CFG_NAV5];
  TEST_ASSERT_EQUAL(44, ubx::mensajeModeloDinamico(ubx::MODELO_AEREO_1G, m, sizeof(m)));
  TEST_ASSERT_EQUAL_HEX8(0xB5, m[0]);
  TEST_ASSERT_EQUAL_HEX8(0x62, m[1]);
  TEST_ASSERT_EQUAL_HEX8(0x24, m[3]);
  TEST_ASSERT_EQUAL_HEX8(6, m[8]);
  // Checksum calculado aparte (Fletcher-8 sobre clase..datos).
  TEST_ASSERT_EQUAL_HEX8(0x55, m[42]);
  TEST_ASSERT_EQUAL_HEX8(0xB4, m[43]);
  TEST_ASSERT_EQUAL(0, ubx::mensajeModeloDinamico(6, m, 10));  // no cabe
}

// ------------------------------------------------ Tiempo en el aire LoRa ---
void test_tiempo_en_aire() {
  // Valores de referencia de la calculadora de Semtech (10 bytes, CR 4/5, CRC).
  TEST_ASSERT_FLOAT_WITHIN(0.1, 41.22, aire::tiempoEnAireMs(10, 7, 125, 5, 8));
  TEST_ASSERT_FLOAT_WITHIN(0.1, 20.61, aire::tiempoEnAireMs(10, 7, 250, 5, 8));
  // Presupuesto del canal con la configuración real (RadioConfig.h):
  // Peor caso: T (150 B) cada 0.5 s + P (110 B) cada 1 s + baliza B (70 B) cada 2 s
  // (en el simulador las tramas reales miden ~110, ~90 y ~60 bytes).
  const float t = aire::tiempoEnAireMs(150, radio::SPREADING_FACTOR, radio::ANCHO_BANDA_KHZ,
                                       radio::CODING_RATE_4_DE, radio::PREAMBULO);
  const float p = aire::tiempoEnAireMs(110, radio::SPREADING_FACTOR, radio::ANCHO_BANDA_KHZ,
                                       radio::CODING_RATE_4_DE, radio::PREAMBULO);
  const float b = aire::tiempoEnAireMs(70, radio::SPREADING_FACTOR, radio::ANCHO_BANDA_KHZ,
                                       radio::CODING_RATE_4_DE, radio::PREAMBULO);
  TEST_ASSERT_TRUE(t < 130.0f);
  const float ocupacion = (2 * t + p + b / 2) / 1000.0f;  // fracción de cada segundo
  TEST_ASSERT_TRUE(ocupacion < 0.45f);
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
  RUN_TEST(test_modo_prueba_techo);
  RUN_TEST(test_sin_modo_prueba_el_techo_no_desacopla);
  RUN_TEST(test_vuelo_simulado_completo);
  RUN_TEST(test_separacion_confirmada);
  RUN_TEST(test_separacion_sin_jalon_reintenta_y_abre_autogiro);
  RUN_TEST(test_frenon_del_autogiro_no_confirma_separacion);
  RUN_TEST(test_rumbo_magnetico_nivelado);
  RUN_TEST(test_yaw_converge_a_la_brujula);
  RUN_TEST(test_mensaje_ubx_modelo_aereo);
  RUN_TEST(test_tiempo_en_aire);
  return UNITY_END();
}
