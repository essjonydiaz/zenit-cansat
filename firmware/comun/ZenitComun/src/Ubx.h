// =============================================================================
//  Ubx.h — Mensajes de configuración para los GPS u-blox (NEO-M8N y NEO-6M).
//
//  Por defecto el GPS usa el modelo "portátil", que filtra los movimientos
//  verticales rápidos. Para un CanSat que cae a 10-40 m/s conviene el modelo
//  "aerotransportado < 1 g" (dynModel = 6): la posición no se queda "pegada".
//  Si el GPS no entiende el mensaje simplemente lo ignora: no hay riesgo.
//
//  C++ puro: solo arma los bytes (con su checksum); el firmware los envía por
//  el puerto serie del GPS.
// =============================================================================
#pragma once
#include <stddef.h>
#include <stdint.h>

namespace ubx {

constexpr uint8_t MODELO_PORTATIL = 0;
constexpr uint8_t MODELO_AEREO_1G = 6;
constexpr size_t TAM_CFG_NAV5 = 44;  // 6 encabezado + 36 datos + 2 checksum

// Checksum Fletcher-8 de u-blox sobre [datos, datos+n).
void checksum(const uint8_t* datos, size_t n, uint8_t& a, uint8_t& b);

// Escribe en 'salida' (mínimo TAM_CFG_NAV5 bytes) el mensaje UBX-CFG-NAV5
// que solo cambia el modelo dinámico. Devuelve los bytes escritos.
size_t mensajeModeloDinamico(uint8_t modelo, uint8_t* salida, size_t capacidad);

}  // namespace ubx
