#include "ZenitSensores.h"

#include <Adafruit_BMP280.h>

#include "Ubx.h"

namespace zsensores {

// ============================================================ IMU MPU9250 ===
namespace reg {
constexpr uint8_t SMPLRT_DIV = 0x19;
constexpr uint8_t CONFIG = 0x1A;
constexpr uint8_t GYRO_CONFIG = 0x1B;
constexpr uint8_t ACCEL_CONFIG = 0x1C;
constexpr uint8_t ACCEL_CONFIG2 = 0x1D;
constexpr uint8_t INT_PIN_CFG = 0x37;
constexpr uint8_t ACCEL_XOUT_H = 0x3B;
constexpr uint8_t USER_CTRL = 0x6A;
constexpr uint8_t PWR_MGMT_1 = 0x6B;
constexpr uint8_t WHO_AM_I = 0x75;
// AK8963 (magnetómetro dentro del MPU9250)
constexpr uint8_t AK_DIR = 0x0C;
constexpr uint8_t AK_WIA = 0x00;
constexpr uint8_t AK_ST1 = 0x02;
constexpr uint8_t AK_HXL = 0x03;
constexpr uint8_t AK_CNTL1 = 0x0A;
constexpr uint8_t AK_ASAX = 0x10;
}  // namespace reg

constexpr float LSB_POR_G = 2048.0f;     // ±16 g
constexpr float LSB_POR_GRADO = 16.4f;   // ±2000 °/s
constexpr float UT_POR_LSB = 0.15f;      // AK8963 en 16 bits

bool Imu::escribir(uint8_t dir, uint8_t r, uint8_t valor) {
  bus_->beginTransmission(dir);
  bus_->write(r);
  bus_->write(valor);
  return bus_->endTransmission() == 0;
}

bool Imu::leerBytes(uint8_t dir, uint8_t r, uint8_t* buf, size_t n) {
  bus_->beginTransmission(dir);
  bus_->write(r);
  if (bus_->endTransmission(false) != 0) return false;
  if (bus_->requestFrom(dir, static_cast<uint8_t>(n)) != n) return false;
  for (size_t i = 0; i < n; ++i) buf[i] = bus_->read();
  return true;
}

const char* Imu::modelo() const {
  switch (whoAmI_) {
    case 0x71: return "MPU9250";
    case 0x73: return "MPU9255";
    case 0x70: return "MPU6500";
    case 0x68: return "MPU6050";
    case 0x98: return "ICM20689";
    default: return ok_ ? "IMU?" : "ninguno";
  }
}

bool Imu::iniciar(TwoWire& bus) {
  bus_ = &bus;
  ok_ = magOk_ = false;
  for (uint8_t dir : {0x68, 0x69}) {
    uint8_t w = 0;
    if (!leerBytes(dir, reg::WHO_AM_I, &w, 1)) continue;
    if (w == 0x71 || w == 0x73 || w == 0x70 || w == 0x68 || w == 0x98) {
      dir_ = dir;
      whoAmI_ = w;
      break;
    }
  }
  if (dir_ == 0) return false;

  escribir(dir_, reg::PWR_MGMT_1, 0x80);  // reinicio
  delay(100);
  escribir(dir_, reg::PWR_MGMT_1, 0x01);  // reloj del giroscopio (más estable)
  delay(10);
  escribir(dir_, reg::SMPLRT_DIV, 0x00);
  escribir(dir_, reg::CONFIG, 0x03);       // filtro del giroscopio ~41 Hz
  escribir(dir_, reg::GYRO_CONFIG, 0x18);  // ±2000 °/s
  escribir(dir_, reg::ACCEL_CONFIG, 0x18); // ±16 g
  if (whoAmI_ != 0x68) escribir(dir_, reg::ACCEL_CONFIG2, 0x03);  // acel ~41 Hz
  ok_ = true;
  if (whoAmI_ == 0x71 || whoAmI_ == 0x73) magOk_ = iniciarMag();
  return ok_;
}

bool Imu::iniciarMag() {
  // El AK8963 cuelga del bus auxiliar del MPU9250: se activa el "bypass" para
  // verlo directamente en el bus principal (dirección 0x0C).
  escribir(dir_, reg::USER_CTRL, 0x00);
  escribir(dir_, reg::INT_PIN_CFG, 0x02);
  delay(10);
  uint8_t wia = 0;
  if (!leerBytes(reg::AK_DIR, reg::AK_WIA, &wia, 1) || wia != 0x48) return false;
  // Leer los ajustes de fábrica (Fuse ROM).
  escribir(reg::AK_DIR, reg::AK_CNTL1, 0x00);
  delay(10);
  escribir(reg::AK_DIR, reg::AK_CNTL1, 0x0F);
  delay(10);
  uint8_t asa[3] = {128, 128, 128};
  leerBytes(reg::AK_DIR, reg::AK_ASAX, asa, 3);
  for (int i = 0; i < 3; ++i) ajusteMag_[i] = (asa[i] - 128) / 256.0f + 1.0f;
  escribir(reg::AK_DIR, reg::AK_CNTL1, 0x00);
  delay(10);
  escribir(reg::AK_DIR, reg::AK_CNTL1, 0x16);  // 16 bits, continuo a 100 Hz
  delay(10);
  return true;
}

bool Imu::leer(LecturaImu& l) {
  if (!ok_) return false;
  uint8_t b[14];
  if (!leerBytes(dir_, reg::ACCEL_XOUT_H, b, 14)) return false;
  auto v = [&](int i) { return static_cast<int16_t>((b[i] << 8) | b[i + 1]); };
  l.ax = v(0) / LSB_POR_G;
  l.ay = v(2) / LSB_POR_G;
  l.az = v(4) / LSB_POR_G;
  l.tempC = (whoAmI_ == 0x68) ? v(6) / 340.0f + 36.53f : v(6) / 333.87f + 21.0f;
  l.gx = v(8) / LSB_POR_GRADO;
  l.gy = v(10) / LSB_POR_GRADO;
  l.gz = v(12) / LSB_POR_GRADO;
  return true;
}

bool Imu::leerMag(LecturaMag& m) {
  if (!magOk_) return false;
  uint8_t st1 = 0;
  if (!leerBytes(reg::AK_DIR, reg::AK_ST1, &st1, 1) || !(st1 & 0x01)) return false;
  uint8_t b[7];  // HXL..HZH + ST2 (leer ST2 libera el siguiente dato)
  if (!leerBytes(reg::AK_DIR, reg::AK_HXL, b, 7)) return false;
  if (b[6] & 0x08) return false;  // saturado
  const float hx = static_cast<int16_t>((b[1] << 8) | b[0]) * UT_POR_LSB * ajusteMag_[0];
  const float hy = static_cast<int16_t>((b[3] << 8) | b[2]) * UT_POR_LSB * ajusteMag_[1];
  const float hz = static_cast<int16_t>((b[5] << 8) | b[4]) * UT_POR_LSB * ajusteMag_[2];
  // Ejes del AK8963 -> ejes del acelerómetro (hoja de datos MPU9250, §9.1).
  m.mx = hy;
  m.my = hx;
  m.mz = -hz;
  return true;
}

// ================================================== Barómetro BMP280/BME280 ===
namespace {
Adafruit_BMP280* bmp = nullptr;
}

bool Barometro::iniciar(TwoWire& bus) {
  ok_ = false;
  if (!bmp) bmp = new Adafruit_BMP280(&bus);
  struct Opcion {
    uint8_t dir, id;
    const char* nombre;
  };
  const Opcion opciones[] = {{0x76, 0x58, "BMP280"}, {0x77, 0x58, "BMP280"},
                             {0x76, 0x60, "BME280"}, {0x77, 0x60, "BME280"}};
  for (const Opcion& o : opciones) {
    if (bmp->begin(o.dir, o.id)) {
      dir_ = o.dir;
      modelo_ = o.nombre;
      ok_ = true;
      break;
    }
  }
  if (ok_) {
    // Sobremuestreo alto en presión y filtro interno ligero: buena resolución
    // de altitud (~0.2 m) sin agregar retraso al cálculo de velocidad.
    bmp->setSampling(Adafruit_BMP280::MODE_NORMAL, Adafruit_BMP280::SAMPLING_X2,
                     Adafruit_BMP280::SAMPLING_X16, Adafruit_BMP280::FILTER_X2,
                     Adafruit_BMP280::STANDBY_MS_1);
  }
  return ok_;
}

bool Barometro::leer(float& presionPa, float& temperaturaC) {
  if (!ok_) return false;
  temperaturaC = bmp->readTemperature();
  presionPa = bmp->readPressure();
  return !isnan(presionPa) && presionPa > 30000.0f && presionPa < 110000.0f;
}

// ===================================================================== GPS ===
void configurarGpsAereo(Stream& puertoGps) {
  uint8_t msg[ubx::TAM_CFG_NAV5];
  const size_t n = ubx::mensajeModeloDinamico(ubx::MODELO_AEREO_1G, msg, sizeof(msg));
  puertoGps.write(msg, n);
  puertoGps.flush();
}

int escanearI2c(TwoWire& bus, uint8_t* dirs, int max) {
  int n = 0;
  for (uint8_t d = 1; d < 127 && n < max; ++d) {
    bus.beginTransmission(d);
    if (bus.endTransmission() == 0) dirs[n++] = d;
  }
  return n;
}

}  // namespace zsensores
