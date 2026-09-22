#include "Geo.h"

#include <math.h>

namespace geo {

static constexpr double PI_D = 3.14159265358979323846;
static inline double rad(double g) { return g * PI_D / 180.0; }
static inline double grad(double r) { return r * 180.0 / PI_D; }

double distanciaMetros(double lat1, double lon1, double lat2, double lon2) {
  const double dLat = rad(lat2 - lat1);
  const double dLon = rad(lon2 - lon1);
  const double a = sin(dLat / 2) * sin(dLat / 2) +
                   cos(rad(lat1)) * cos(rad(lat2)) * sin(dLon / 2) * sin(dLon / 2);
  const double c = 2 * atan2(sqrt(a), sqrt(1 - a));
  return RADIO_TIERRA_M * c;
}

double rumboGrados(double lat1, double lon1, double lat2, double lon2) {
  const double p1 = rad(lat1), p2 = rad(lat2);
  const double dLon = rad(lon2 - lon1);
  const double y = sin(dLon) * cos(p2);
  const double x = cos(p1) * sin(p2) - sin(p1) * cos(p2) * cos(dLon);
  double r = grad(atan2(y, x));
  if (r < 0) r += 360.0;
  return r;
}

const char* puntoCardinal(double rumbo) {
  static const char* const nombres[] = {"N", "NE", "E", "SE", "S", "SO", "O", "NO"};
  double r = fmod(rumbo, 360.0);
  if (r < 0) r += 360.0;
  const int i = static_cast<int>((r + 22.5) / 45.0) % 8;
  return nombres[i];
}

}  // namespace geo
