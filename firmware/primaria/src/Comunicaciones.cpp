#include "Comunicaciones.h"

#include <FS.h>
#include <LoRa.h>
#include <SD.h>
#include <SPI.h>

#include "ZenitComun.h"
#include "config.h"

namespace comms {

namespace {

struct Mensaje {
  char texto[TAM_MENSAJE];
};

QueueHandle_t colaTx = nullptr;
QueueHandle_t colaSd = nullptr;
QueueHandle_t colaRx = nullptr;
volatile bool listo = false;
Estado est;
char encabezado[TAM_MENSAJE * 2] = "";
File archivo;

bool iniciarLora() {
  LoRa.setPins(pines::LORA_CS, pines::LORA_RST, pines::LORA_DIO0);
  if (!LoRa.begin(radio::FRECUENCIA_HZ)) return false;
  LoRa.setSpreadingFactor(radio::SPREADING_FACTOR);
  LoRa.setSignalBandwidth(radio::ANCHO_BANDA_HZ);
  LoRa.setCodingRate4(radio::CODING_RATE_4_DE);
  LoRa.setTxPower(radio::POTENCIA_DBM);
  LoRa.setSyncWord(radio::SYNC_WORD);
  LoRa.enableCrc();
  return true;
}

bool iniciarSd() {
  if (!SD.begin(pines::SD_CS, SPI, 4000000)) return false;
  // Nombre libre: /VUELO_000.CSV, /VUELO_001.CSV, ...
  for (int i = 0; i < 1000; ++i) {
    snprintf(est.archivo, sizeof(est.archivo), "/VUELO_%03d.CSV", i);
    if (!SD.exists(est.archivo)) break;
  }
  archivo = SD.open(est.archivo, FILE_WRITE);
  if (!archivo) return false;
  archivo.println(encabezado);
  archivo.flush();
  return true;
}

void tarea(void*) {
  SPI.begin(pines::SPI_SCK, pines::SPI_MISO, pines::SPI_MOSI);
  pinMode(pines::SD_CS, OUTPUT);
  digitalWrite(pines::SD_CS, HIGH);  // que la SD no interfiera al iniciar LoRa
  est.loraOk = iniciarLora();
  est.sdOk = iniciarSd();
  listo = true;

  Mensaje m;
  Recibido r;
  uint32_t ultimoFlush = millis();
  bool pendienteFlush = false;

  for (;;) {
    // 1) Enviar una trama (bloquea ~50-90 ms, pero solo esta tarea).
    if (est.loraOk && xQueueReceive(colaTx, &m, 0) == pdTRUE) {
      LoRa.beginPacket();
      LoRa.print(m.texto);
      LoRa.endPacket();
      est.tramasEnviadas++;
    }
    // 2) Escribir en la microSD todo lo pendiente.
    while (xQueueReceive(colaSd, &m, 0) == pdTRUE) {
      if (est.sdOk) {
        archivo.println(m.texto);
        est.lineasSd++;
        pendienteFlush = true;
      }
    }
    // Guardar físicamente cada segundo: si el CanSat se apaga en el impacto se
    // pierde como máximo el último segundo.
    if (pendienteFlush && millis() - ultimoFlush >= 1000) {
      archivo.flush();
      ultimoFlush = millis();
      pendienteFlush = false;
    }
    // 3) Escuchar la radio (baliza de la secundaria y comandos de tierra).
    if (est.loraOk) {
      const int n = LoRa.parsePacket();
      if (n > 0) {
        int i = 0;
        while (LoRa.available() && i < static_cast<int>(TAM_MENSAJE) - 1) {
          r.texto[i++] = static_cast<char>(LoRa.read());
        }
        while (LoRa.available()) LoRa.read();
        r.texto[i] = '\0';
        r.rssi = static_cast<int16_t>(LoRa.packetRssi());
        r.snr = LoRa.packetSnr();
        est.tramasRecibidas++;
        if (xQueueSend(colaRx, &r, 0) != pdTRUE) est.descartadas++;
      }
    }
    vTaskDelay(1);
  }
}

bool encolar(QueueHandle_t cola, const char* texto) {
  if (!cola) return false;
  Mensaje m;
  strncpy(m.texto, texto, TAM_MENSAJE - 1);
  m.texto[TAM_MENSAJE - 1] = '\0';
  if (xQueueSend(cola, &m, 0) != pdTRUE) {
    est.descartadas++;
    return false;
  }
  return true;
}

}  // namespace

void iniciar(const char* encabezadoSd) {
  strncpy(encabezado, encabezadoSd, sizeof(encabezado) - 1);
  colaTx = xQueueCreate(8, sizeof(Mensaje));
  colaSd = xQueueCreate(64, sizeof(Mensaje));
  colaRx = xQueueCreate(8, sizeof(Recibido));
  // Núcleo 0, prioridad 2. El loop() de Arduino corre en el núcleo 1.
  xTaskCreatePinnedToCore(tarea, "comms", 8192, nullptr, 2, nullptr, 0);
  const uint32_t inicio = millis();
  while (!listo && millis() - inicio < 3000) delay(10);
}

bool enviarTrama(const char* carga) {
  char trama[TAM_MENSAJE];
  if (protocolo::enmarcar(carga, trama, sizeof(trama)) == 0) return false;
  // Copia por USB para pruebas en banco (la estación terrena la entiende).
  Serial.print("USB,");
  Serial.println(trama);
  if (!est.loraOk) return false;  // sin radio: solo queda la copia USB y la SD
  return encolar(colaTx, trama);
}

bool registrar(const char* linea) {
  if (!est.sdOk) return false;
  return encolar(colaSd, linea);
}

bool recibir(Recibido& r) {
  if (!colaRx) return false;
  return xQueueReceive(colaRx, &r, 0) == pdTRUE;
}

const Estado& estado() { return est; }

}  // namespace comms
