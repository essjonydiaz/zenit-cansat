#include "ZenitRadio.h"

#include <RadioLib.h>

#include "Pines.h"
#include "RadioConfig.h"

namespace zradio {

namespace {

volatile bool hayPaquete = false;

#if defined(ESP32)
void IRAM_ATTR alRecibir() { hayPaquete = true; }
#else
void alRecibir() { hayPaquete = true; }
#endif

}  // namespace

int16_t Enlace::iniciarHeltec() {
  spi_ = new SPIClass(FSPI);
  spi_->begin(heltec::LORA_SCK, heltec::LORA_MISO, heltec::LORA_MOSI, heltec::LORA_NSS);
  Module* m = new Module(heltec::LORA_NSS, heltec::LORA_DIO1, heltec::LORA_RST,
                         heltec::LORA_BUSY, *spi_);
  SX1262* r = new SX1262(m);
  radio_ = r;
  chip_ = "SX1262";
  int16_t e = r->begin(radio::FRECUENCIA_MHZ, radio::ANCHO_BANDA_KHZ, radio::SPREADING_FACTOR,
                       radio::CODING_RATE_4_DE, radio::SYNC_WORD, radio::POTENCIA_DBM,
                       radio::PREAMBULO, radio::TCXO_HELTEC_V, false);
  if (e == RADIOLIB_ERR_NONE) e = r->setCurrentLimit(radio::LIMITE_CORRIENTE_MA);
  if (e == RADIOLIB_ERR_NONE) e = r->setDio2AsRfSwitch(true);
  if (e == RADIOLIB_ERR_NONE) e = r->setCRC(2);
  return terminarInicio(e);
}

int16_t Enlace::iniciarRfm95(int8_t sck, int8_t miso, int8_t mosi, int8_t nss, int8_t rst,
                             int8_t dio0, int8_t potenciaDbm) {
#if defined(CONFIG_IDF_TARGET_ESP32C3) || defined(CONFIG_IDF_TARGET_ESP32S3)
  spi_ = new SPIClass(FSPI);
#else
  spi_ = new SPIClass(VSPI);
#endif
  spi_->begin(sck, miso, mosi, nss);
  Module* m = new Module(nss, dio0, rst, RADIOLIB_NC, *spi_);
  SX1276* r = new SX1276(m);
  radio_ = r;
  chip_ = "SX1276";
  int16_t e = r->begin(radio::FRECUENCIA_MHZ, radio::ANCHO_BANDA_KHZ, radio::SPREADING_FACTOR,
                       radio::CODING_RATE_4_DE, radio::SYNC_WORD,
                       potenciaDbm > 0 ? potenciaDbm : radio::POTENCIA_DBM, radio::PREAMBULO, 0);
  if (e == RADIOLIB_ERR_NONE) e = r->setCurrentLimit(radio::LIMITE_CORRIENTE_MA);
  if (e == RADIOLIB_ERR_NONE) e = r->setCRC(true);
  return terminarInicio(e);
}

int16_t Enlace::terminarInicio(int16_t estado) {
  error_ = estado;
  ok_ = estado == RADIOLIB_ERR_NONE;
  if (!ok_) return estado;
  radio_->setPacketReceivedAction(alRecibir);
  hayPaquete = false;
  error_ = radio_->startReceive();
  ok_ = error_ == RADIOLIB_ERR_NONE;
  return error_;
}

bool Enlace::enviar(const char* texto) {
  if (!ok_) return false;
  const int16_t e = radio_->transmit(reinterpret_cast<const uint8_t*>(texto), strlen(texto));
  // El fin de la transmisión también levanta la interrupción: se limpia antes
  // de volver a escuchar para no leer un "paquete" vacío.
  hayPaquete = false;
  radio_->startReceive();
  if (e != RADIOLIB_ERR_NONE) {
    error_ = e;
    return false;
  }
  enviados_++;
  return true;
}

bool Enlace::recibir(Paquete& p) {
  if (!ok_ || !hayPaquete) return false;
  hayPaquete = false;
  size_t largo = radio_->getPacketLength();
  if (largo == 0) {
    radio_->startReceive();
    return false;
  }
  if (largo > TAM_PAQUETE - 1) largo = TAM_PAQUETE - 1;
  const int16_t e = radio_->readData(reinterpret_cast<uint8_t*>(p.texto), largo);
  p.texto[largo] = '\0';
  p.rssi = static_cast<int16_t>(radio_->getRSSI());
  p.snr = radio_->getSNR();
  radio_->startReceive();
  if (e == RADIOLIB_ERR_CRC_MISMATCH) {
    crcMalos_++;
    return false;
  }
  if (e != RADIOLIB_ERR_NONE) return false;
  recibidos_++;
  return true;
}

const char* textoError(int16_t codigo) {
  switch (codigo) {
    case RADIOLIB_ERR_NONE: return "ok";
    case RADIOLIB_ERR_CHIP_NOT_FOUND: return "no se encontro el chip (revisar SPI/NSS/alimentacion)";
    case RADIOLIB_ERR_SPI_CMD_TIMEOUT: return "el chip no responde (BUSY/TCXO)";
    case RADIOLIB_ERR_INVALID_FREQUENCY: return "frecuencia invalida para este chip";
    case RADIOLIB_ERR_INVALID_OUTPUT_POWER: return "potencia invalida";
    case RADIOLIB_ERR_TX_TIMEOUT: return "tiempo de transmision agotado";
    case RADIOLIB_ERR_PACKET_TOO_LONG: return "paquete demasiado largo";
    default: return "error de RadioLib (ver codigo)";
  }
}

}  // namespace zradio
