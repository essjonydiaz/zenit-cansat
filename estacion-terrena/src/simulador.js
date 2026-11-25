// =============================================================================
//  simulador.js — Genera un vuelo completo como si llegara del receptor LoRa.
//  Sirve para desarrollar y ensayar la estación terrena SIN hardware:
//      npm run simular
//  Produce las mismas líneas que el receptor real (RX,<rssi>,<snr>,$T...*HH)
//  y responde a los comandos (PING, DESACOPLAR, ...), así que el equipo puede
//  practicar la operación del día del lanzamiento.
//  La física es la misma del simulador del firmware (SimuladorVuelo.cpp).
// =============================================================================
'use strict';

const { EventEmitter } = require('events');
const { enmarcar, validar, parsearCarga, firmaValida } = require('./protocolo');

const G = 9.80665;
const M_POR_GRADO = 111320;

class Simulador extends EventEmitter {
  constructor({ velocidad = 1, repetir = true, perdidas = 0.03, clave = 'ZENIT' } = {}) {
    super();
    this.velocidad = velocidad;   // 2 = el doble de rápido
    this.repetir = repetir;       // al terminar, vuelve a empezar
    this.perdidas = perdidas;     // fracción de paquetes perdidos
    this.clave = clave;
    this.ultimoContador = 0;
    this.p = {
      tEsperaInicial: 10, velocidadSubida: 15, alturaLiberacion: 100, tEsperaArriba: 5,
      vTerminalCaida: 37, vTerminalAutogiro: 10, presionTierra: 96300,
      lat: 25.1936, lon: -99.8416, viento: 2.0,
    };
    this.timer = null;
  }

  iniciar() {
    this._reiniciar();
    const pasoMs = 50;
    this.timer = setInterval(() => this._paso((pasoMs / 1000) * this.velocidad), pasoMs);
    this._emitir('INFO,RECEPTOR_LISTO,lora=1,chip=SX1262,freq=915.0,sf=7,bw=250,sync=0x5A,err=0,SIMULADO');
  }

  detener() {
    clearInterval(this.timer);
    this.timer = null;
  }

  // La estación manda "TX,$C,...*HH" igual que al receptor real.
  escribir(linea) {
    if (!linea.startsWith('TX,')) return;
    const carga = validar(linea.slice(3));
    this._emitir(`INFO,TX_OK,${linea.slice(3)}`);
    if (!carga) return;
    const c = parsearCarga(carga);
    if (c.tipo !== 'C') return;
    setTimeout(() => this._comando(c), 300);
  }

  // ------------------------------------------------------------ interno --
  _reiniciar() {
    Object.assign(this, {
      t: 0, fase: 'TIERRA', tFase: 0, h: 0, v: 0, a: 0, seq: 0, secSeq: 0,
      estado: 0, altMax: 0, gMax: 0, desacople: false, este: 0, esteSec: 0,
      hSec: 0, vSec: 0, secSuelta: false, tAterrizaje: null, postOk: false,
      tUltT: 0, tUltP: 0, tUltB: 0.4, tUltInfo: 0, yaw: 0, bat: 9.1,
      tDesacople: null, separacionEv: false, autogiro: false,
    });
    this._evento('ARRANQUE', 'baro=1(BMP280 0x76) imu=1(MPU9250) mag=1 lora=1 sd=1 OPENLOG');
    this._evento('CALIBRADO', 'p0=96300 bias=0.03/-0.02/0.10');
  }

  _arrastre(v, vt) {
    const d = G * (v / vt) * (v / vt);
    return -G + (v < 0 ? d : -d);
  }

  _paso(dt) {
    this.t += dt;
    this.tFase += dt;
    let a = 0;
    switch (this.fase) {
      case 'TIERRA':
        if (this.tFase >= this.p.tEsperaInicial) this._fase('SUBIDA');
        break;
      case 'SUBIDA': {
        const frenado = (this.v * this.v) / 6;
        a = this.p.alturaLiberacion - this.h <= frenado ? -3 : (this.v < this.p.velocidadSubida ? 3 : 0);
        this.v = Math.min(this.v + a * dt, this.p.velocidadSubida);
        this.h += this.v * dt;
        if (this.v <= 0 || this.h >= this.p.alturaLiberacion) {
          this.v = 0; a = 0;
          this._fase('ESPERA');
        }
        if (this.estado === 0 && this.h > 15) { this.estado = 1; this._evento('ASCENSO', ''); }
        break;
      }
      case 'ESPERA':
        if (this.tFase >= this.p.tEsperaArriba) {
          this._fase('CAIDA');
          this.estado = 2;
          this._evento('LIBERACION', `h=${this.h.toFixed(1)}`);
        }
        break;
      case 'CAIDA':
        a = this._arrastre(this.v, this.p.vTerminalCaida);
        this.v += a * dt;
        this.h += this.v * dt;
        if (!this.desacople && this.h <= 80 && this.altMax >= 90) this._desacoplar('AUTO');
        break;
      case 'AUTOGIRO':
        a = this._arrastre(this.v, this.p.vTerminalAutogiro);
        this.v += a * dt;
        this.h += this.v * dt;
        this.yaw = (this.yaw + 600 * dt) % 360;
        break;
      default:
        break;
    }
    // Secuencia de separación del firmware (Separacion.h): el IMU ve el jalón
    // enseguida y el servo del autogiro abre 400 ms después del desacople.
    if (this.tDesacople !== null) {
      if (!this.separacionEv && this.t - this.tDesacople >= 0.02) {
        this.separacionEv = true;
        this._evento('SEPARACION', 'cambio=1.49 g');
      }
      if (!this.autogiro && this.t - this.tDesacople >= 0.4) {
        this.autogiro = true;
        if (this.fase === 'CAIDA') this._fase('AUTOGIRO');
        this._evento('AUTOGIRO', `h=${this.h.toFixed(1)}`);
      }
    }
    if ((this.fase === 'CAIDA' || this.fase === 'AUTOGIRO') && this.h <= 0) {
      const gImpacto = Math.min((this.v * this.v) / (2 * 0.05) / G, 16);
      this.gMax = Math.max(this.gMax, gImpacto);
      this.h = 0; this.v = 0;
      this._fase('SUELO');
    }
    if (this.fase === 'SUELO' && this.estado !== 4 && this.tFase >= 3) {
      this.estado = 4;
      this.tAterrizaje = this.t;
      this._evento('ATERRIZAJE', `alt_max=${this.altMax.toFixed(1)} g_max=${this.gMax.toFixed(1)}`);
    }
    if (this.estado === 4 && !this.postOk && this.t - this.tAterrizaje >= 10) {
      this.postOk = true;
      this._evento('POST_ATERRIZAJE_OK', '10 s transmitiendo tras aterrizar');
    }
    if (this.estado === 4 && this.repetir && this.t - this.tAterrizaje >= 40) {
      this._reiniciar();
      return;
    }

    // Secundaria (caída libre tras el desacople)
    if (this.secSuelta && this.hSec > 0) {
      const aS = this._arrastre(this.vSec, this.p.vTerminalCaida);
      this.vSec += aS * dt;
      this.hSec = Math.max(0, this.hSec + this.vSec * dt);
      this.esteSec += this.p.viento * 0.3 * dt;
      if (this.hSec === 0) this.vSec = 0;
    } else if (!this.secSuelta) {
      this.hSec = this.h;
      this.esteSec = this.este;
    }
    if (this.h > 0) this.este += this.p.viento * dt;

    this.a = a;
    this.altMax = Math.max(this.altMax, this.h);
    let fz = ['TIERRA', 'ESPERA', 'SUELO'].includes(this.fase) ? 1 : (a + G) / G;
    fz = Math.min(fz, 16);
    if (this.estado > 0) this.gMax = Math.max(this.gMax, fz);
    this.bat -= 0.00002 * dt;

    // Mismos periodos que el firmware: T 2 Hz, P 1 Hz, baliza B cada 2 s.
    if (this.t - this.tUltT >= 0.5) { this.tUltT = this.t; this._tramaT(fz); }
    if (this.t - this.tUltP >= 1) { this.tUltP = this.t; this._tramaP(); }
    if (this.t - this.tUltB >= 2) { this.tUltB = this.t; this._tramaB(); }
    if (this.t - this.tUltInfo >= 5) {
      this.tUltInfo = this.t;
      this._emitir(`INFO,VIVO,lora=1,rx=${this.seq + this.secSeq},tx=0`);
    }
  }

  _fase(f) { this.fase = f; this.tFase = 0; }

  _desacoplar(origen) {
    if (this.desacople) return;
    this.desacople = true;
    this.tDesacople = this.t;
    this.secSuelta = true;
    this.hSec = this.h; this.vSec = this.v; this.esteSec = this.este;
    if (this.estado >= 1 && this.estado < 4) this.estado = 3;
    this._evento('DESACOPLE', `${origen} h=${this.h.toFixed(1)} v=${this.v.toFixed(1)}`);
  }

  _comando(c) {
    if (!firmaValida(this.clave, c)) { this._evento('CMD_RECHAZADO', 'clave'); return; }
    if (Number(c.contador) <= this.ultimoContador) { this._evento('CMD_RECHAZADO', 'repetido'); return; }
    this.ultimoContador = Number(c.contador);
    switch (c.orden) {
      case 'PING': this._evento('PONG', ['PREVUELO', 'ASCENSO', 'CAIDA_LIBRE', 'DESCENSO_AUTOGIRO', 'ATERRIZADO'][this.estado]); break;
      case 'DESACOPLAR': this._desacoplar(this.desacople ? 'REPETIDO' : 'MANUAL'); break;
      case 'BUZZER': case 'CERRAR': this._evento('CMD_OK', c.orden); break;
      case 'CALIBRAR':
        if (this.estado === 0) this._evento('CALIBRADO', 'p0=96300 bias=0.03/-0.02/0.10');
        else this._evento('CMD_RECHAZADO', c.orden);
        break;
      default: this._evento('CMD_RECHAZADO', c.orden);
    }
  }

  _ruido(s) { return (Math.random() + Math.random() + Math.random() - 1.5) * s; }

  _rssi(hRelativa) {
    const d = Math.max(5, Math.hypot(hRelativa, 100 + this.este));
    return Math.round(-40 - 20 * Math.log10(d) + this._ruido(3));
  }

  _tms() { return Math.round(this.t * 1000) + 3500; }

  _tramaT(fz) {
    const pres = this.p.presionTierra * Math.pow(1 - this.h / 44330, 5.25588);
    const flags = 0b1111 | (1 << 4) | (1 << 5) | (this.desacople ? 1 << 6 : 0)
      | (this.autogiro ? 1 << 9 : 0) | (this.separacionEv ? 1 << 10 : 0) | (1 << 11);
    const giro = this.fase === 'AUTOGIRO' ? 600 : 0;
    const campos = [
      'T', ++this.seq, this._tms(), this.estado,
      (this.h + this._ruido(0.15)).toFixed(2), (this.v + this._ruido(0.1)).toFixed(2),
      this.altMax.toFixed(2), (pres + this._ruido(3)).toFixed(0), (28 - 0.0065 * this.h).toFixed(1),
      this._ruido(0.03).toFixed(2), this._ruido(0.03).toFixed(2), (fz + this._ruido(0.03)).toFixed(2),
      this._ruido(1).toFixed(0), this._ruido(1).toFixed(0), (giro + this._ruido(2)).toFixed(0),
      this._ruido(2).toFixed(1), this._ruido(2).toFixed(1), (this.yaw > 180 ? this.yaw - 360 : this.yaw).toFixed(1),
      this.gMax.toFixed(2), this.bat.toFixed(2), flags,
    ];
    this._radio(campos.join(','), this.h);
  }

  _coords(este) {
    const mLon = M_POR_GRADO * Math.cos((this.p.lat * Math.PI) / 180);
    return { lat: this.p.lat, lon: this.p.lon + este / mLon };
  }

  _tramaP() {
    const yo = this._coords(this.este);
    const sec = this._coords(this.esteSec);
    sec.lat += 0.00002;
    const dN = (sec.lat - yo.lat) * M_POR_GRADO;
    const dE = (sec.lon - yo.lon) * M_POR_GRADO * Math.cos((this.p.lat * Math.PI) / 180);
    const dist = Math.hypot(dN, dE);
    const rumbo = ((Math.atan2(dE, dN) * 180) / Math.PI + 360) % 360;
    const campos = [
      'P', ++this.seq, this._tms(), yo.lat.toFixed(6), yo.lon.toFixed(6), 10, 1,
      sec.lat.toFixed(6), sec.lon.toFixed(6), '0.6', dist.toFixed(1), rumbo.toFixed(1),
      this._rssi(this.h - this.hSec), '8.90',
    ];
    this._radio(campos.join(','), this.h);
  }

  _tramaB() {
    const sec = this._coords(this.esteSec);
    const campos = ['B', ++this.secSeq, this._tms() - 1200, (sec.lat + 0.00002).toFixed(6),
      sec.lon.toFixed(6), 9, 1, '8.90'];
    this._radio(campos.join(','), this.hSec);
  }

  _evento(codigo, detalle) {
    this._radio(`E,${++this.seq},${this._tms()},${codigo},${detalle}`, this.h, true);
  }

  _radio(carga, altura, seguro = false) {
    if (!seguro && Math.random() < this.perdidas) return;  // paquete perdido
    const snr = (9 - altura / 80 + this._ruido(1)).toFixed(1);
    this._emitir(`RX,${this._rssi(altura)},${snr},${enmarcar(carga)}`);
  }

  _emitir(linea) { this.emit('linea', linea); }
}

module.exports = { Simulador };
