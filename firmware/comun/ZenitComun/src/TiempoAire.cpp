#include "TiempoAire.h"

#include <math.h>

namespace aire {

float tiempoEnAireMs(size_t bytes, uint8_t sf, float anchoBandaKhz, uint8_t codingRate4de,
                     uint16_t preambulo) {
  const float tSimbolo = static_cast<float>(1u << sf) / anchoBandaKhz;  // ms
  // Optimización de baja tasa: obligatoria cuando el símbolo dura > 16 ms.
  const int de = tSimbolo > 16.0f ? 1 : 0;
  const int cr = codingRate4de - 4;  // 4/5 -> 1 ... 4/8 -> 4
  const float numerador = 8.0f * bytes - 4.0f * sf + 28.0f + 16.0f;  // CRC sí, encabezado explícito
  const float denominador = 4.0f * (sf - 2 * de);
  float simbolosCarga = ceilf(numerador / denominador) * (cr + 4);
  if (simbolosCarga < 0) simbolosCarga = 0;
  simbolosCarga += 8.0f;
  return (preambulo + 4.25f + simbolosCarga) * tSimbolo;
}

}  // namespace aire
