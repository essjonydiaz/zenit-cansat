// =============================================================================
//  TiempoAire.h — Cuánto tarda una trama LoRa en el aire (fórmula de Semtech,
//  hoja de datos SX1276 §4.1.1.7 / AN1200.13). Sirve para comprobar que las
//  tramas de la primaria y la baliza de la secundaria caben en el canal sin
//  saturarlo (ver docs/03-protocolo-telemetria.md y la prueba en test_logica).
// =============================================================================
#pragma once
#include <stddef.h>
#include <stdint.h>

namespace aire {

// Milisegundos en el aire de un paquete de 'bytes' bytes de carga útil, con
// encabezado explícito y CRC activado.
float tiempoEnAireMs(size_t bytes, uint8_t sf, float anchoBandaKhz, uint8_t codingRate4de,
                     uint16_t preambulo);

}  // namespace aire
