// =============================================================================
//  P6 — Mecanismos de desacople y autogiro (2 servos SG90)
//  Comandos por el Monitor Serial (escribir y Enter):
//     d          -> elegir el servo de DESACOPLE (GPIO2)
//     g          -> elegir el servo del AUTOGIRO (GPIO4)
//     c          -> posición CERRADO del servo elegido
//     a          -> posición ABIERTO del servo elegido
//     0..180     -> ir a ese ángulo (para encontrar los valores correctos)
//     ciclo      -> 20 ciclos cerrar/abrir del servo elegido (confiabilidad)
//     secuencia  -> lo mismo que en vuelo: desacople, 400 ms después autogiro
//  Cuando encuentren los ángulos buenos, copiarlos a
//  firmware/primaria/include/config.h (DESACOPLE_ANGULO_* y AUTOGIRO_ANGULO_*).
//  Criterio: 20 de 20 liberaciones correctas con la secundaria colgando.
//  Los servos se alimentan con 5 V del MP1584EN (nunca del 3.3 V de la placa).
// =============================================================================
#include <Arduino.h>
#include <ESP32Servo.h>

#include "ZenitComun.h"

struct Mecanismo {
  const char* nombre;
  int8_t pin;
  int cerrado, abierto;
  Servo servo;
};

static Mecanismo desacople{"DESACOPLE", heltec::SERVO_DESACOPLE, 10, 100, Servo()};
static Mecanismo autogiro{"AUTOGIRO", heltec::SERVO_AUTOGIRO, 10, 100, Servo()};
static Mecanismo* elegido = &desacople;

static void mover(Mecanismo& m, int angulo) {
  m.servo.write(angulo);
  Serial.printf("%s -> %d grados\n", m.nombre, angulo);
}

void setup() {
  Serial.begin(115200);
  ESP32PWM::allocateTimer(0);
  ESP32PWM::allocateTimer(1);
  for (Mecanismo* m : {&desacople, &autogiro}) {
    m->servo.setPeriodHertz(50);
    m->servo.attach(m->pin, 500, 2400);
    mover(*m, m->cerrado);
  }
  Serial.println("P6 servos: d/g elige servo; c, a, angulo 0-180, ciclo, secuencia");
}

void loop() {
  if (!Serial.available()) return;
  String s = Serial.readStringUntil('\n');
  s.trim();
  if (s == "d") {
    elegido = &desacople;
    Serial.println("Servo elegido: DESACOPLE");
  } else if (s == "g") {
    elegido = &autogiro;
    Serial.println("Servo elegido: AUTOGIRO");
  } else if (s == "c") {
    mover(*elegido, elegido->cerrado);
  } else if (s == "a") {
    mover(*elegido, elegido->abierto);
  } else if (s == "ciclo") {
    for (int i = 1; i <= 20; ++i) {
      Serial.printf("ciclo %d/20\n", i);
      mover(*elegido, elegido->cerrado);
      delay(1500);
      mover(*elegido, elegido->abierto);
      delay(1500);
    }
    mover(*elegido, elegido->cerrado);
  } else if (s == "secuencia") {
    mover(desacople, desacople.abierto);
    delay(400);
    mover(autogiro, autogiro.abierto);
    Serial.println("Secuencia de vuelo hecha. Escribe c en cada servo para volver a cerrar.");
  } else if (s.length() > 0 && isDigit(s[0])) {
    const int ang = constrain(s.toInt(), 0, 180);
    mover(*elegido, ang);
  }
}
