// =============================================================================
//  P6 — Mecanismo de desacople (servo SG90)
//  Comandos por el Monitor Serial (escribir y Enter):
//     c        -> posición CERRADO (sostiene la secundaria)
//     a        -> posición ABIERTO (libera secundaria + autogiro)
//     0..180   -> ir a ese ángulo (para encontrar los valores correctos)
//     ciclo    -> 20 ciclos cerrar/abrir (prueba de confiabilidad)
//  Cuando encuentren los ángulos buenos, copiarlos a
//  firmware/primaria/include/config.h (SERVO_ANGULO_CERRADO / ABIERTO).
//  Criterio: 20 de 20 liberaciones correctas con la secundaria colgando.
// =============================================================================
#include <Arduino.h>
#include <ESP32Servo.h>

#include "ZenitComun.h"

static int anguloCerrado = 10;
static int anguloAbierto = 100;
static Servo servo;

static void mover(int angulo) {
  servo.write(angulo);
  Serial.printf("-> %d grados\n", angulo);
}

void setup() {
  Serial.begin(115200);
  ESP32PWM::allocateTimer(0);
  servo.setPeriodHertz(50);
  servo.attach(pines::SERVO_DESACOPLE, 500, 2400);
  mover(anguloCerrado);
  Serial.println("P6 servo: escribe c, a, un angulo 0-180, o ciclo");
}

void loop() {
  if (!Serial.available()) return;
  String s = Serial.readStringUntil('\n');
  s.trim();
  if (s == "c") {
    mover(anguloCerrado);
  } else if (s == "a") {
    mover(anguloAbierto);
  } else if (s == "ciclo") {
    for (int i = 1; i <= 20; ++i) {
      Serial.printf("ciclo %d/20\n", i);
      mover(anguloCerrado);
      delay(1500);
      mover(anguloAbierto);
      delay(1500);
    }
    mover(anguloCerrado);
  } else if (s.length() > 0 && isDigit(s[0])) {
    const int ang = constrain(s.toInt(), 0, 180);
    mover(ang);
  }
}
