#include "Protocolo.h"

#include <stdio.h>
#include <string.h>

namespace protocolo {

uint8_t checksum(const char* datos, size_t n) {
  uint8_t x = 0;
  for (size_t i = 0; i < n; ++i) x ^= static_cast<uint8_t>(datos[i]);
  return x;
}

size_t enmarcar(const char* carga, char* salida, size_t capacidad) {
  const size_t n = strlen(carga);
  const size_t total = n + 4;  // '$' + carga + '*' + 2 hex
  if (total + 1 > capacidad) return 0;
  salida[0] = '$';
  memcpy(salida + 1, carga, n);
  snprintf(salida + 1 + n, 4, "*%02X", checksum(carga, n));
  return total;
}

static int valorHex(char c) {
  if (c >= '0' && c <= '9') return c - '0';
  if (c >= 'A' && c <= 'F') return c - 'A' + 10;
  if (c >= 'a' && c <= 'f') return c - 'a' + 10;
  return -1;
}

bool validar(const char* trama, size_t largo, const char** inicioCarga,
             size_t* largoCarga) {
  // Quitar espacios / fin de línea al final.
  while (largo > 0 && (trama[largo - 1] == '\r' || trama[largo - 1] == '\n' ||
                       trama[largo - 1] == ' ')) {
    --largo;
  }
  if (largo < 5 || trama[0] != '$' || trama[largo - 3] != '*') return false;
  const int alto = valorHex(trama[largo - 2]);
  const int bajo = valorHex(trama[largo - 1]);
  if (alto < 0 || bajo < 0) return false;
  const char* carga = trama + 1;
  const size_t n = largo - 4;
  if (checksum(carga, n) != static_cast<uint8_t>(alto * 16 + bajo)) return false;
  if (inicioCarga) *inicioCarga = carga;
  if (largoCarga) *largoCarga = n;
  return true;
}

char tipo(const char* carga, size_t largoCarga) {
  if (largoCarga == 0) return '\0';
  if (largoCarga > 1 && carga[1] != ',') return '\0';
  return carga[0];
}

bool campo(const char* carga, size_t largoCarga, int indice, char* salida,
           size_t capacidad) {
  int actual = 0;
  size_t inicio = 0;
  for (size_t i = 0; i <= largoCarga; ++i) {
    if (i == largoCarga || carga[i] == ',') {
      if (actual == indice) {
        const size_t n = i - inicio;
        if (n + 1 > capacidad) return false;
        memcpy(salida, carga + inicio, n);
        salida[n] = '\0';
        return true;
      }
      ++actual;
      inicio = i + 1;
    }
  }
  return false;
}

}  // namespace protocolo
