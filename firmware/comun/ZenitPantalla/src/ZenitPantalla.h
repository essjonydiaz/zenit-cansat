// =============================================================================
//  ZenitPantalla.h — OLED 0.96" (SSD1306, 128x64) integrada en el Heltec V3.
//
//  Usa su propio bus I2C (Wire1, GPIO 17/18), así que NO interfiere con el
//  GY-91 (Wire, GPIO 47/48). La pantalla se alimenta por "Vext" (GPIO 36):
//  apagarla en vuelo ahorra unos 10-20 mA de la pila de 9 V.
//
//  Muestra hasta 5 renglones de texto (≈21 caracteres cada uno).
// =============================================================================
#pragma once
#include <Arduino.h>

namespace zpantalla {

constexpr int RENGLONES = 5;

class Pantalla {
 public:
  bool iniciar();          // enciende Vext, reinicia y prueba la OLED
  void apagar();           // corta Vext (pantalla negra, menos consumo)
  bool ok() const { return ok_; }
  bool encendida() const { return encendida_; }
  // Cambia un renglón (0..4). Se dibuja al llamar mostrar().
  void renglon(int i, const char* formato, ...) __attribute__((format(printf, 3, 4)));
  void mostrar();

 private:
  bool ok_ = false;
  bool encendida_ = false;
  char texto_[RENGLONES][24] = {};
};

}  // namespace zpantalla
