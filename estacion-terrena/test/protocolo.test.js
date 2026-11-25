// Pruebas del protocolo:  npm test
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { enmarcar, validar, procesarLinea, parsearCarga, comandoFirmado, firmaValida } = require('../src/protocolo');
const { Simulador } = require('../src/simulador');

test('enmarcar y validar son inversos', () => {
  const trama = enmarcar('C,ZENIT,PING');
  assert.match(trama, /^\$C,ZENIT,PING\*[0-9A-F]{2}$/);
  assert.strictEqual(validar(trama), 'C,ZENIT,PING');
});

test('una trama alterada se rechaza', () => {
  const trama = enmarcar('T,1,2,3').replace('T,1', 'T,7');
  assert.strictEqual(validar(trama), null);
});

test('interpreta la línea RX del receptor', () => {
  const m = procesarLinea(`RX,-71,8.5,${enmarcar('B,4,5000,25.193600,-99.841600,9,1,8.90')}`);
  assert.strictEqual(m.origen, 'RX');
  assert.strictEqual(m.rssi, -71);
  assert.strictEqual(m.datos.tipo, 'B');
  assert.strictEqual(m.datos.fuente, 'secundaria');
  assert.strictEqual(m.datos.lat, 25.1936);
});

test('el detalle de un evento puede traer comas', () => {
  const d = parsearCarga('E,9,1000,ARRANQUE,baro=1,imu=1');
  assert.strictEqual(d.codigo, 'ARRANQUE');
  assert.strictEqual(d.detalle, 'baro=1,imu=1');
});

// Tramas producidas por el firmware REAL de la primaria (compilado y
// ejecutado en un ESP32-S3 emulado con QEMU, entorno primaria_sim). Si alguien cambia el formato en C++ y no
// en JavaScript, esta prueba falla.
test('entiende las tramas del firmware de la primaria', () => {
  const lineas = fs.readFileSync(path.join(__dirname, 'datos', 'salida_firmware_sim.txt'), 'utf8')
    .split('\n').filter(Boolean);
  assert.ok(lineas.length > 10);
  const tipos = new Set();
  const eventos = [];
  let autogiroEnBanderas = false;
  for (const l of lineas) {
    const m = procesarLinea(l);
    assert.ok(m.valida, `trama inválida: ${l}`);
    tipos.add(m.datos.tipo);
    if (m.datos.tipo === 'E') eventos.push(m.datos.codigo);
    if (m.datos.tipo === 'T' && m.datos.banderas.autogiro) autogiroEnBanderas = true;
    if (m.datos.tipo === 'T') {
      assert.ok(Number.isFinite(m.datos.alt));
      assert.ok(Number.isFinite(m.datos.vel));
      assert.ok(m.datos.estado_nombre);
      assert.strictEqual(typeof m.datos.banderas.baro, 'boolean');
    }
  }
  assert.ok(tipos.has('T') && tipos.has('P') && tipos.has('E'));
  // Secuencia de los 2 servos a 80 m: desacople -> separación -> autogiro.
  const orden = ['DESACOPLE', 'SEPARACION', 'AUTOGIRO', 'ATERRIZAJE'].map((c) => eventos.indexOf(c));
  assert.ok(orden.every((i) => i >= 0), `faltan eventos: ${eventos.join(' ')}`);
  assert.deepStrictEqual([...orden].sort((a, b) => a - b), orden);
  assert.ok(autogiroEnBanderas, 'la bandera de autogiro desplegado nunca se encendió');
});

test('el simulador produce un vuelo completo con desacople', async () => {
  const sim = new Simulador({ velocidad: 1, repetir: false, perdidas: 0 });
  const eventos = [];
  sim.on('linea', (l) => {
    const m = procesarLinea(l);
    if (m && m.datos && m.datos.tipo === 'E') eventos.push(m.datos);
  });
  sim._reiniciar();
  for (let i = 0; i < 2400; i++) sim._paso(0.05);  // 120 s de vuelo
  const codigos = eventos.map((e) => e.codigo);
  for (const c of ['ASCENSO', 'LIBERACION', 'DESACOPLE', 'SEPARACION', 'AUTOGIRO', 'ATERRIZAJE', 'POST_ATERRIZAJE_OK']) {
    assert.ok(codigos.includes(c), `falta el evento ${c}`);
  }
  const des = eventos.find((e) => e.codigo === 'DESACOPLE');
  const h = Number(/h=([\d.]+)/.exec(des.detalle)[1]);
  assert.ok(Math.abs(h - 80) < 5, `desacople a ${h} m`);  // misión 2026-11-24: 80 m
});

test('el comando va firmado y no lleva la clave', () => {
  const trama = comandoFirmado('ZENIT', 'PING', 1764000000000);
  assert.match(trama, /^\$C,1764000000000,PING,[0-9A-F]{16}\*[0-9A-F]{2}$/);
  assert.ok(!trama.includes('ZENIT'));
  const c = parsearCarga(validar(trama));
  assert.ok(firmaValida('ZENIT', c));
  assert.ok(!firmaValida('OTRA', c));
  assert.ok(!firmaValida('ZENIT', { ...c, orden: 'DESACOPLAR' }));
});

test('el simulador rechaza comandos sin firma o repetidos', async () => {
  const sim = new Simulador({ clave: 'ZENIT' });
  sim._reiniciar();
  const eventos = [];
  sim._evento = (codigo, detalle) => eventos.push(`${codigo}:${detalle}`);
  const bueno = comandoFirmado('ZENIT', 'PING', 1000);
  sim._comando(parsearCarga(validar(bueno)));
  sim._comando(parsearCarga(validar(bueno)));
  sim._comando(parsearCarga(validar(comandoFirmado('OTRA', 'PING', 2000))));
  sim._comando(parsearCarga('C,ZENIT,PING'));
  assert.deepStrictEqual(eventos, ['PONG:PREVUELO', 'CMD_RECHAZADO:repetido', 'CMD_RECHAZADO:clave', 'CMD_RECHAZADO:clave']);
});
