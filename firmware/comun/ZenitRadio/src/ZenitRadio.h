// =============================================================================
//  ZenitRadio.h — Enlace LoRa del CanSat Zénit (sobre la librería RadioLib).
//
//  Una sola interfaz para los dos radios del PDR:
//    - SX1262 integrado en el Heltec WiFi LoRa 32 V3 (primaria y receptor)
//    - RFM95W / SX1276 externo (carga secundaria, ESP32-C3)
//  Los dos se configuran con los MISMOS parámetros de RadioConfig.h, así que
//  se escuchan entre sí.
//
//  Uso:
//    zradio::Enlace enlace;
//    enlace.iniciarHeltec();                 // o iniciarRfm95(...)
//    enlace.enviar("$T,...*HH");             // bloquea ~0.1 s y vuelve a escuchar
//    zradio::Paquete p;
//    if (enlace.recibir(p)) { ... p.texto, p.rssi, p.snr ... }
// =============================================================================
#pragma once
#include <Arduino.h>
#include <SPI.h>

class PhysicalLayer;
class Module;

namespace zradio {

constexpr size_t TAM_PAQUETE = 256;

struct Paquete {
  char texto[TAM_PAQUETE];
  int16_t rssi;  // dBm
  float snr;     // dB
};

class Enlace {
 public:
  // SX1262 del Heltec V3 (pines fijos de la placa). Devuelve 0 si todo bien,
  // o el código de error de RadioLib (ver textoError()).
  int16_t iniciarHeltec();
  // RFM95W/SX1276 externo con sus pines SPI.
  // potenciaDbm: 0 = la de RadioConfig.h. La secundaria usa menos para no
  // hundir su pila al transmitir (ver secundaria/include/config.h).
  int16_t iniciarRfm95(int8_t sck, int8_t miso, int8_t mosi, int8_t nss, int8_t rst,
                       int8_t dio0, int8_t potenciaDbm = 0);

  bool ok() const { return ok_; }
  int16_t error() const { return error_; }
  const char* chip() const { return chip_; }

  // Transmite el texto (bloquea mientras está en el aire) y vuelve a escuchar.
  bool enviar(const char* texto);
  // Si llegó un paquete válido lo copia en 'p' y devuelve true.
  bool recibir(Paquete& p);

  uint32_t enviados() const { return enviados_; }
  uint32_t recibidos() const { return recibidos_; }
  uint32_t crcMalos() const { return crcMalos_; }

 private:
  int16_t terminarInicio(int16_t estado);
  PhysicalLayer* radio_ = nullptr;
  SPIClass* spi_ = nullptr;
  bool ok_ = false;
  int16_t error_ = 0;
  const char* chip_ = "ninguno";
  uint32_t enviados_ = 0, recibidos_ = 0, crcMalos_ = 0;
};

// Texto corto en español para los errores más comunes de RadioLib.
const char* textoError(int16_t codigo);

}  // namespace zradio
