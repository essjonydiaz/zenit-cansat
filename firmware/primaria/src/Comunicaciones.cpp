#include "Comunicaciones.h"

#include <ZenitRadio.h>

#include "ZenitComun.h"
#include "config.h"

#if REGISTRO_TIPO == REGISTRO_SD_SPI
#include <FS.h>
#include <SD.h>
#include <SPI.h>
#endif

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
zradio::Enlace enlace;

// ------------------------------------------------------------ Registro -----
#if REGISTRO_TIPO == REGISTRO_NINGUNO
// Sin microSD: no se usa GPIO4 ni GPIO41.
bool iniciarRegistro() {
  strncpy(est.archivo, "SIN_SD", sizeof(est.archivo) - 1);
  return false;
}
void escribirLinea(const char*) {}
void guardarFisicamente() {}

#elif REGISTRO_TIPO == REGISTRO_OPENLOG
HardwareSerial& openlog = Serial2;

bool iniciarRegistro() {
  openlog.setTxBufferSize(4096);  // 25 líneas/s sin bloquear
  openlog.begin(OPENLOG_BAUDIOS, SERIAL_8N1, heltec::OPENLOG_RX, heltec::OPENLOG_TX);
  // El OpenLog, al encender, imprime "12<" cuando ya abrió su archivo. Si el
  // cable TXO -> GPIO41 está conectado lo vemos; si no, se escribe "a ciegas".
  const uint32_t inicio = millis();
  while (millis() - inicio < 2500) {
    while (openlog.available()) {
      if (openlog.read() == '<') est.sdConfirmada = true;
    }
    if (est.sdConfirmada) break;
    delay(10);
  }
  strncpy(est.archivo, est.sdConfirmada ? "OPENLOG" : "OPENLOG?", sizeof(est.archivo) - 1);
  openlog.println(encabezado);
  // Se considera disponible aunque no haya confirmación: escribir de más no
  // daña nada, y el panel muestra "sin confirmar" para que se revise.
  return true;
}

void escribirLinea(const char* linea) { openlog.println(linea); }
void guardarFisicamente() {}  // el OpenLog guarda solo cada ~0.5 s

#else  // REGISTRO_SD_SPI
SPIClass spiSd(HSPI);
File archivo;

bool iniciarRegistro() {
  spiSd.begin(heltec::SD_SCK, heltec::SD_MISO, heltec::SD_MOSI, heltec::SD_CS);
  if (!SD.begin(heltec::SD_CS, spiSd, 4000000)) return false;
  // Nombre libre: /VUELO_000.CSV, /VUELO_001.CSV, ...
  for (int i = 0; i < 1000; ++i) {
    snprintf(est.archivo, sizeof(est.archivo), "/VUELO_%03d.CSV", i);
    if (!SD.exists(est.archivo)) break;
  }
  archivo = SD.open(est.archivo, FILE_WRITE);
  if (!archivo) return false;
  est.sdConfirmada = true;
  archivo.println(encabezado);
  archivo.flush();
  return true;
}

void escribirLinea(const char* linea) { archivo.println(linea); }
// Guardar físicamente cada segundo: si el CanSat se apaga en el impacto se
// pierde como máximo el último segundo.
void guardarFisicamente() { archivo.flush(); }
#endif

void tarea(void*) {
  // Primero el registro (rápido), luego la radio: si falta el chip, RadioLib
  // tarda varios segundos en rendirse y el estado de la SD ya queda listo.
  est.sdOk = iniciarRegistro();
  est.errorLora = enlace.iniciarHeltec();
  est.loraOk = enlace.ok();
  listo = true;

  Mensaje m;
  Recibido r;
  zradio::Paquete p;
  uint32_t ultimoFlush = millis();
  bool pendienteFlush = false;

  for (;;) {
    // 1) Enviar una trama (bloquea ~0.1 s, pero solo esta tarea).
    if (est.loraOk && xQueueReceive(colaTx, &m, 0) == pdTRUE) {
      if (enlace.enviar(m.texto)) est.tramasEnviadas++;
    }
    // 2) Escribir en la microSD todo lo pendiente.
    while (xQueueReceive(colaSd, &m, 0) == pdTRUE) {
      if (est.sdOk) {
        escribirLinea(m.texto);
        est.lineasSd++;
        pendienteFlush = true;
      }
    }
    if (pendienteFlush && millis() - ultimoFlush >= 1000) {
      guardarFisicamente();
      ultimoFlush = millis();
      pendienteFlush = false;
    }
    // 3) Escuchar la radio (baliza de la secundaria y comandos de tierra).
    if (est.loraOk && enlace.recibir(p)) {
      strncpy(r.texto, p.texto, TAM_MENSAJE - 1);
      r.texto[TAM_MENSAJE - 1] = '\0';
      r.rssi = p.rssi;
      r.snr = p.snr;
      est.tramasRecibidas++;
      if (xQueueSend(colaRx, &r, 0) != pdTRUE) est.descartadas++;
    }
    est.crcMalos = enlace.crcMalos();
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
  colaTx = xQueueCreate(6, sizeof(Mensaje));
  colaSd = xQueueCreate(64, sizeof(Mensaje));
  colaRx = xQueueCreate(8, sizeof(Recibido));
  // Núcleo 0, prioridad 2. El loop() de Arduino corre en el núcleo 1.
  xTaskCreatePinnedToCore(tarea, "comms", 8192, nullptr, 2, nullptr, 0);
  // Con todo conectado tarda ~2.6 s (radio 0.1 s + espera del OpenLog 2.5 s).
  // Si falta el radio, RadioLib reintenta varios segundos antes de rendirse.
  const uint32_t inicio = millis();
  while (!listo && millis() - inicio < 12000) delay(10);
  if (!listo) est.errorLora = ERROR_RADIO_SIN_RESPUESTA;  // la tarea sigue intentando
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
