// =============================================================================
//  registro.js — Guarda TODO lo que llega durante una sesión en logs/
//     sesion_AAAAMMDD_HHMMSS.txt            líneas crudas (sirve para "replay")
//     sesion_AAAAMMDD_HHMMSS_telemetria.csv tramas T (para el análisis del RAM)
//     ..._posicion.csv / _baliza.csv / _eventos.csv
//  Si la laptop se apaga, lo registrado hasta ese momento ya está en disco.
// =============================================================================
'use strict';

const fs = require('fs');
const path = require('path');
const { CAMPOS } = require('./protocolo');

function marcaTiempo(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

class Registro {
  constructor(carpeta) {
    this.carpeta = carpeta;
    fs.mkdirSync(carpeta, { recursive: true });
    this.base = path.join(carpeta, `sesion_${marcaTiempo()}`);
    this.crudo = fs.createWriteStream(`${this.base}.txt`, { flags: 'a' });
    this.csv = {};
  }

  _csv(tipo) {
    if (!this.csv[tipo]) {
      const nombre = { T: 'telemetria', P: 'posicion', B: 'baliza', E: 'eventos', R: 'alcance' }[tipo];
      if (!nombre) return null;
      const s = fs.createWriteStream(`${this.base}_${nombre}.csv`, { flags: 'a' });
      s.write(['pc_iso', 'origen', 'rssi', 'snr', ...CAMPOS[tipo].slice(1)].join(',') + '\n');
      this.csv[tipo] = s;
    }
    return this.csv[tipo];
  }

  guardar(linea, msg) {
    const ahora = new Date().toISOString();
    this.crudo.write(`${ahora}\t${linea}\n`);
    if (!msg || !msg.valida || !msg.datos) return;
    const d = msg.datos;
    const s = this._csv(d.tipo);
    if (!s) return;
    const valores = CAMPOS[d.tipo].slice(1).map((c) => {
      const v = d[c];
      if (v === undefined || v === null) return '';
      const t = String(v);
      return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
    });
    s.write([ahora, msg.origen, msg.rssi ?? '', msg.snr ?? '', ...valores].join(',') + '\n');
  }

  cerrar() {
    this.crudo.end();
    Object.values(this.csv).forEach((s) => s.end());
  }
}

module.exports = { Registro, marcaTiempo };
