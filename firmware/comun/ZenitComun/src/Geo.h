// =============================================================================
//  Geo.h — Distancia y dirección entre dos coordenadas GPS.
//  Se usa para cumplir el requisito de la misión: "la carga primaria debe
//  detectar la distancia y dirección en la que se encuentra la secundaria".
// =============================================================================
#pragma once

namespace geo {

constexpr double RADIO_TIERRA_M = 6371000.0;

// Distancia sobre la superficie (fórmula de Haversine), en metros.
double distanciaMetros(double lat1, double lon1, double lat2, double lon2);

// Rumbo inicial desde el punto 1 hacia el punto 2, en grados
// (0 = Norte, 90 = Este, 180 = Sur, 270 = Oeste).
double rumboGrados(double lat1, double lon1, double lat2, double lon2);

// Nombre corto del rumbo: "N", "NE", "E", ... (8 direcciones).
const char* puntoCardinal(double rumbo);

}  // namespace geo
