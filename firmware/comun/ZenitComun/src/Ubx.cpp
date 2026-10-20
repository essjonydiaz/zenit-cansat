#include "Ubx.h"

#include <string.h>

namespace ubx {

void checksum(const uint8_t* datos, size_t n, uint8_t& a, uint8_t& b) {
  a = b = 0;
  for (size_t i = 0; i < n; ++i) {
    a = static_cast<uint8_t>(a + datos[i]);
    b = static_cast<uint8_t>(b + a);
  }
}

size_t mensajeModeloDinamico(uint8_t modelo, uint8_t* salida, size_t capacidad) {
  if (capacidad < TAM_CFG_NAV5) return 0;
  memset(salida, 0, TAM_CFG_NAV5);
  salida[0] = 0xB5;  // sincronía
  salida[1] = 0x62;
  salida[2] = 0x06;  // clase CFG
  salida[3] = 0x24;  // id NAV5
  salida[4] = 36;    // largo (little endian)
  salida[5] = 0;
  salida[6] = 0x01;  // máscara: solo aplicar el modelo dinámico
  salida[7] = 0x00;
  salida[8] = modelo;
  uint8_t a, b;
  checksum(salida + 2, 4 + 36, a, b);  // clase, id, largo y datos
  salida[42] = a;
  salida[43] = b;
  return TAM_CFG_NAV5;
}

}  // namespace ubx
