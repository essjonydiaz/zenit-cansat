// =============================================================================
//  Protocolo.h — Formato de las tramas de radio del CanSat Zénit.
//
//  Toda trama viaja como texto:   $<carga útil>*HH
//     - La carga útil son campos separados por comas; el primero es el TIPO.
//     - HH es el XOR de todos los caracteres de la carga útil, en hexadecimal
//       (igual que las tramas NMEA de un GPS). Sirve para descartar tramas
//       corruptas aunque LoRa ya tenga su propio CRC.
//
//  Tipos (detalle completo en docs/03-protocolo-telemetria.md):
//     T  telemetría rápida de la carga primaria
//     P  posición de la primaria y localización relativa de la secundaria
//     B  baliza de la carga secundaria (posición GPS)
//     E  evento (cambio de estado, desacople, respuesta a comando, error)
//     R  paquete de prueba de alcance (prueba P3)
//     C  comando desde tierra: $C,<clave>,<orden>*HH
// =============================================================================
#pragma once
#include <stddef.h>
#include <stdint.h>

namespace protocolo {

constexpr size_t TAM_MAX_TRAMA = 200;  // bytes, incluyendo $ y *HH

// XOR de los caracteres [datos, datos+n).
uint8_t checksum(const char* datos, size_t n);

// Arma "$<carga>*HH" en 'salida'. Devuelve la longitud escrita (sin el '\0')
// o 0 si no cabe.
size_t enmarcar(const char* carga, char* salida, size_t capacidad);

// Revisa una trama recibida. Si es válida devuelve true y deja en
// 'inicioCarga'/'largoCarga' la parte entre '$' y '*'.
// Tolera espacios o saltos de línea al final.
bool validar(const char* trama, size_t largo, const char** inicioCarga,
             size_t* largoCarga);

// Tipo de la trama (primer carácter de la carga) o '\0' si no aplica.
char tipo(const char* carga, size_t largoCarga);

// Copia el campo número 'indice' (0 = tipo) a 'salida'. Devuelve false si no
// existe o no cabe.
bool campo(const char* carga, size_t largoCarga, int indice, char* salida,
           size_t capacidad);

}  // namespace protocolo
