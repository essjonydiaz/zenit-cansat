// =============================================================================
//  fuentes.js — De dónde vienen las líneas de datos:
//     PuertoSerie : el receptor LoRa (o una placa de vuelo) conectado por USB
//     Reproduccion: vuelve a "transmitir" una sesión guardada (logs/*.txt)
//  (El simulador está en simulador.js.) Todas emiten el evento 'linea'.
// =============================================================================
'use strict';

const { EventEmitter } = require('events');
const fs = require('fs');
const readline = require('readline');

class PuertoSerie extends EventEmitter {
  constructor(ruta, baudios = 115200) {
    super();
    this.ruta = ruta;
    this.baudios = baudios;
    this.puerto = null;
  }

  static async listar() {
    const { SerialPort } = require('serialport');
    let puertos = [];
    try {
      puertos = await SerialPort.list();
    } catch (e) {
      console.warn(`[puertos] no se pudieron listar: ${e.message}`);
      throw e;
    }
    return puertos.map((p) => ({
      ruta: p.path,
      descripcion: [p.manufacturer, p.friendlyName].filter(Boolean).join(' ') || p.path,
      // CP210x (Silicon Labs) y CH340 son los chips USB típicos del ESP32
      esEsp32: /10c4|1a86|silicon|ch34|cp210/i.test(`${p.vendorId} ${p.manufacturer} ${p.friendlyName}`),
    }));
  }

  iniciar() {
    const { SerialPort } = require('serialport');
    const { ReadlineParser } = require('@serialport/parser-readline');
    return new Promise((resolve, reject) => {
      this.puerto = new SerialPort({ path: this.ruta, baudRate: this.baudios }, (err) => {
        if (err) { reject(err); return; }
        const lector = this.puerto.pipe(new ReadlineParser({ delimiter: '\n' }));
        lector.on('data', (l) => this.emit('linea', l.replace(/\r$/, '')));
        this.puerto.on('close', () => this.emit('cerrado'));
        this.puerto.on('error', (e) => this.emit('error', e));
        resolve();
      });
    });
  }

  escribir(linea) {
    if (this.puerto && this.puerto.isOpen) this.puerto.write(`${linea}\n`);
  }

  detener() {
    if (this.puerto && this.puerto.isOpen) this.puerto.close();
  }
}

class Reproduccion extends EventEmitter {
  constructor(archivo, velocidad = 1) {
    super();
    this.archivo = archivo;
    this.velocidad = velocidad;
    this.timers = [];
  }

  async iniciar() {
    const lineas = [];
    const rl = readline.createInterface({ input: fs.createReadStream(this.archivo) });
    for await (const l of rl) {
      const tab = l.indexOf('\t');
      if (tab > 0) lineas.push({ t: Date.parse(l.slice(0, tab)), linea: l.slice(tab + 1) });
      else if (l.trim()) lineas.push({ t: null, linea: l });  // log sin marca de tiempo
    }
    if (!lineas.length) throw new Error(`El archivo ${this.archivo} está vacío`);
    const t0 = lineas.find((x) => x.t)?.t;
    lineas.forEach((x, i) => {
      const retraso = x.t && t0 ? (x.t - t0) / this.velocidad : i * (250 / this.velocidad);
      this.timers.push(setTimeout(() => this.emit('linea', x.linea), retraso));
    });
  }

  escribir() {}

  detener() {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }
}

module.exports = { PuertoSerie, Reproduccion };
