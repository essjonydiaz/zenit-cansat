// =============================================================================
//  Comunicaciones.h — Radio LoRa + registro en microSD.
//
//  LoRa y microSD comparten el bus SPI, y enviar una trama LoRa tarda ~50-90 ms.
//  Para que eso NO frene la lectura de sensores (50 Hz), todo lo del bus SPI
//  corre en una tarea aparte en el núcleo 0 del ESP32. El programa principal
//  (núcleo 1) solo deja mensajes en colas:
//
//      loop() ──colaTx──> [tarea núcleo 0] ──> LoRa (aire)
//      loop() ──colaSd──> [tarea núcleo 0] ──> microSD
//      loop() <─colaRx─── [tarea núcleo 0] <── LoRa (baliza secundaria, comandos)
// =============================================================================
#pragma once
#include <Arduino.h>

namespace comms {

constexpr size_t TAM_MENSAJE = 200;

struct Recibido {
  char texto[TAM_MENSAJE];
  int16_t rssi;
  float snr;
};

struct Estado {
  bool loraOk = false;
  bool sdOk = false;
  char archivo[24] = "";
  uint32_t tramasEnviadas = 0;
  uint32_t tramasRecibidas = 0;
  uint32_t lineasSd = 0;
  uint32_t descartadas = 0;  // mensajes que no cupieron en las colas
};

// Arranca SPI, LoRa, microSD y la tarea. 'encabezadoSd' es la primera línea
// del archivo CSV. Espera hasta 3 s a que termine la inicialización.
void iniciar(const char* encabezadoSd);

// Enmarca ($...*HH) y encola una trama para la radio. No bloquea.
bool enviarTrama(const char* carga);

// Encola una línea para la microSD. No bloquea.
bool registrar(const char* linea);

// Saca una trama recibida por radio (si hay). No bloquea.
bool recibir(Recibido& r);

const Estado& estado();

}  // namespace comms
