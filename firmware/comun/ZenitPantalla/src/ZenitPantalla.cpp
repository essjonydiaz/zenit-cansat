#include "ZenitPantalla.h"

#include <SSD1306Wire.h>
#include <Wire.h>
#include <stdarg.h>

#include "Pines.h"

namespace zpantalla {

namespace {
SSD1306Wire* oled = nullptr;
}

bool Pantalla::iniciar() {
  pinMode(heltec::VEXT, OUTPUT);
  digitalWrite(heltec::VEXT, LOW);  // LOW = encendido
  delay(20);
  pinMode(heltec::OLED_RST, OUTPUT);
  digitalWrite(heltec::OLED_RST, LOW);
  delay(20);
  digitalWrite(heltec::OLED_RST, HIGH);
  delay(20);
  if (!oled) {
    oled = new SSD1306Wire(0x3C, heltec::OLED_SDA, heltec::OLED_SCL, GEOMETRY_128_64, I2C_TWO,
                           400000);
  }
  ok_ = oled->init();
  if (ok_) {
    oled->setFont(ArialMT_Plain_10);
    oled->setTextAlignment(TEXT_ALIGN_LEFT);
    oled->clear();
    oled->display();
  }
  encendida_ = ok_;
  return ok_;
}

void Pantalla::apagar() {
  if (oled && ok_) {
    oled->clear();
    oled->display();
    oled->displayOff();
  }
  digitalWrite(heltec::VEXT, HIGH);
  encendida_ = false;
}

void Pantalla::renglon(int i, const char* formato, ...) {
  if (i < 0 || i >= RENGLONES) return;
  va_list args;
  va_start(args, formato);
  vsnprintf(texto_[i], sizeof(texto_[i]), formato, args);
  va_end(args);
}

void Pantalla::mostrar() {
  if (!ok_ || !encendida_) return;
  oled->clear();
  for (int i = 0; i < RENGLONES; ++i) oled->drawString(0, i * 12, texto_[i]);
  oled->display();
}

}  // namespace zpantalla
