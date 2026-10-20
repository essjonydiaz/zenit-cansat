// =============================================================================
//  Comunicaciones.h — Radio LoRa (SX1262 del Heltec V3) + registro en microSD
//  (OpenLog por puerto serie, o lector SPI si así se configura).
//
//  Enviar una trama LoRa tarda ~0.1 s. Para que eso NO frene la lectura de
//  sensores (50 Hz), la radio y el registro corren en una tarea aparte en el
//  núcleo 0 del ESP32-S3. El programa principal (núcleo 1) solo deja mensajes
//  en colas:
//
//      loop() ──colaTx──> [tarea núcleo 0] ──> LoRa (aire)
//      loop() ──colaSd──> [tarea núcleo 0] ──> OpenLog / microSD
//      loop() <─colaRx─── [tarea núcleo 0] <── LoRa (baliza secundaria, comandos)
// =============================================================================
#pragma once
#include <Arduino.h>

namespace comms {

constexpr size_t TAM_MENSAJE = 220;
// errorLora cuando el radio ni siquiera terminó de iniciar en 12 s.
constexpr int16_t ERROR_RADIO_SIN_RESPUESTA = -999;

struct Recibido {
  char texto[TAM_MENSAJE];
  int16_t rssi;
  float snr;
};

struct Estado {
  bool loraOk = false;
  int16_t errorLora = 0;   // código de RadioLib si loraOk es false
  bool sdOk = false;       // OpenLog respondió / archivo abierto
  bool sdConfirmada = false;  // false = OpenLog sin cable de regreso: no se sabe
  char archivo[24] = "";
  uint32_t tramasEnviadas = 0;
  uint32_t tramasRecibidas = 0;
  uint32_t crcMalos = 0;
  uint32_t lineasSd = 0;
  uint32_t descartadas = 0;  // mensajes que no cupieron en las colas
};

// Arranca radio, registro y la tarea. 'encabezadoSd' es la primera línea
// del archivo CSV. Espera hasta 12 s a que termine la inicialización.
void iniciar(const char* encabezadoSd);

// Enmarca ($...*HH) y encola una trama para la radio. No bloquea.
bool enviarTrama(const char* carga);

// Encola una línea para la microSD. No bloquea.
bool registrar(const char* linea);

// Saca una trama recibida por radio (si hay). No bloquea.
bool recibir(Recibido& r);

const Estado& estado();

}  // namespace comms
