// =============================================================================
//  protocolo.js — Interpreta las líneas que llegan del receptor LoRa.
//  Es el espejo en JavaScript de firmware/comun/ZenitComun/src/Protocolo.h
//  Formato completo: docs/03-protocolo-telemetria.md
// =============================================================================
'use strict';

const crypto = require('crypto');

// Nombres de los campos de cada tipo de trama (el índice 0 es el tipo).
const CAMPOS = {
  T: ['tipo', 'seq', 't_ms', 'estado', 'alt', 'vel', 'alt_max', 'pres', 'temp',
      'ax', 'ay', 'az', 'gx', 'gy', 'gz', 'roll', 'pitch', 'yaw', 'g_max', 'bat', 'flags'],
  P: ['tipo', 'seq', 't_ms', 'lat', 'lon', 'sats', 'fix', 'sec_lat', 'sec_lon',
      'sec_edad_s', 'dist_sec', 'rumbo_sec', 'sec_rssi', 'sec_bat'],
  B: ['tipo', 'seq', 't_ms', 'lat', 'lon', 'sats', 'fix', 'bat'],
  E: ['tipo', 'seq', 't_ms', 'codigo', 'detalle'],
  R: ['tipo', 'seq', 't_ms', 'potencia'],
  C: ['tipo', 'contador', 'orden', 'firma'],
};

// Campos que se dejan como texto (el resto se convierte a número).
const TEXTO = new Set(['tipo', 'codigo', 'detalle', 'contador', 'orden', 'firma']);

const ESTADOS = ['PREVUELO', 'ASCENSO', 'CAIDA_LIBRE', 'DESCENSO_AUTOGIRO', 'ATERRIZADO'];

// Bits del campo "flags" de la trama T (mismo orden que banderas() en
// firmware/primaria/src/main.cpp).
const BANDERAS = ['baro', 'imu', 'sd', 'lora', 'gps', 'baliza', 'desacople', 'simulacion',
  'bateria_baja', 'autogiro', 'separacion', 'magnetometro', 'bateria_sin_medir', 'sd_sin_confirmar'];

// Qué placa manda cada tipo (para contar paquetes perdidos por fuente).
const FUENTE = { T: 'primaria', P: 'primaria', E: 'primaria', B: 'secundaria', R: 'prueba' };

function checksum(texto) {
  let x = 0;
  for (let i = 0; i < texto.length; i++) x ^= texto.charCodeAt(i);
  return x;
}

function enmarcar(carga) {
  return `$${carga}*${checksum(carga).toString(16).toUpperCase().padStart(2, '0')}`;
}

// Comandos firmados: $C,<contador>,<orden>,<firma>*HH
//  - firma: los primeros 16 dígitos hex del HMAC-SHA256 de "C,<contador>,<orden>"
//    hecho con la clave. La clave nunca viaja por radio, así que escuchar no la revela.
//  - contador: la hora de la laptop en ms. La primaria solo acepta un contador mayor
//    que el último que aceptó (lo guarda aunque se apague), así que un comando
//    grabado y vuelto a mandar se rechaza.
function firmaComando(clave, contador, orden) {
  return crypto.createHmac('sha256', clave).update(`C,${contador},${orden}`)
    .digest('hex').slice(0, 16).toUpperCase();
}

function comandoFirmado(clave, orden, contador = Date.now()) {
  return enmarcar(`C,${contador},${orden},${firmaComando(clave, contador, orden)}`);
}

// true si la firma de un comando ya interpretado (parsearCarga) es correcta.
function firmaValida(clave, c) {
  if (!/^\d{1,19}$/.test(c.contador || '') || !/^[0-9A-Fa-f]{16}$/.test(c.firma || '')) return false;
  const esperada = Buffer.from(firmaComando(clave, c.contador, c.orden));
  return crypto.timingSafeEqual(esperada, Buffer.from(c.firma.toUpperCase()));
}

// Devuelve la carga útil (entre $ y *) o null si la trama es inválida.
function validar(trama) {
  const t = trama.trim();
  const m = /^\$(.+)\*([0-9A-Fa-f]{2})$/.exec(t);
  if (!m) return null;
  return checksum(m[1]) === parseInt(m[2], 16) ? m[1] : null;
}

function decodificarBanderas(flags) {
  const r = {};
  BANDERAS.forEach((nombre, i) => { r[nombre] = Boolean(flags & (1 << i)); });
  return r;
}

function parsearCarga(carga) {
  const partes = carga.split(',');
  const tipo = partes[0];
  const nombres = CAMPOS[tipo];
  if (!nombres) return { tipo, crudo: carga };
  const datos = { tipo };
  nombres.forEach((nombre, i) => {
    if (i === 0) return;
    let valor = partes[i];
    // El detalle de un evento puede contener comas: se une el resto.
    if (nombre === 'detalle') valor = partes.slice(i).join(',');
    if (valor === undefined) return;
    datos[nombre] = TEXTO.has(nombre) ? valor : Number(valor);
  });
  if (tipo === 'T') {
    datos.estado_nombre = ESTADOS[datos.estado] || '?';
    datos.banderas = decodificarBanderas(datos.flags || 0);
  }
  datos.fuente = FUENTE[tipo] || 'desconocida';
  return datos;
}

// Procesa una línea del puerto serie. Formatos posibles:
//   RX,<rssi>,<snr>,$...*HH   trama recibida por el receptor LoRa
//   USB,$...*HH               trama copiada por USB (placa de vuelo conectada directo)
//   INFO,...                  mensajes de estado del receptor
//   $...*HH                   trama sola
function procesarLinea(linea) {
  const l = String(linea).replace(/[\r\n]+$/, '');
  if (!l) return null;
  let origen = 'TEXTO', rssi = null, snr = null, trama = null;

  if (l.startsWith('RX,')) {
    const p = l.split(',');
    origen = 'RX';
    rssi = Number(p[1]);
    snr = Number(p[2]);
    trama = p.slice(3).join(',');
  } else if (l.startsWith('USB,')) {
    origen = 'USB';
    trama = l.slice(4);
  } else if (l.startsWith('INFO,')) {
    const p = l.split(',');
    return { origen: 'INFO', codigo: p[1], detalle: p.slice(2).join(','), linea: l };
  } else if (l.startsWith('$')) {
    origen = 'DIRECTO';
    trama = l;
  } else {
    return { origen: 'TEXTO', linea: l };
  }

  const carga = validar(trama);
  if (carga === null) {
    return { origen, rssi, snr, valida: false, linea: l };
  }
  return { origen, rssi, snr, valida: true, datos: parsearCarga(carga), linea: l };
}

module.exports = {
  CAMPOS, ESTADOS, BANDERAS, FUENTE,
  checksum, enmarcar, validar, parsearCarga, procesarLinea, decodificarBanderas,
  firmaComando, comandoFirmado, firmaValida,
};
