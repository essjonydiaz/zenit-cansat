'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const path = require('node:path');

test('conectar, enviar un comando y desconectar en simulación', { timeout: 15000 }, async (t) => {
  const reserva = http.createServer();
  reserva.listen(0, '127.0.0.1');
  await once(reserva, 'listening');
  const puerto = reserva.address().port;
  await new Promise((resolve) => reserva.close(resolve));

  const proceso = spawn(process.execPath, ['server.js', '--http', String(puerto)], {
    cwd: path.join(__dirname, '..'), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(() => { if (proceso.exitCode === null) proceso.kill(); });
  let errores = '';
  proceso.stderr.on('data', (datos) => { errores += datos; });

  const base = `http://127.0.0.1:${puerto}`;
  let lista;
  for (let intento = 0; intento < 60; intento++) {
    try { lista = await fetch(`${base}/api/puertos`); break; }
    catch { await new Promise((resolve) => setTimeout(resolve, 50)); }
  }
  assert.ok(lista, `El servidor no inició: ${errores}`);
  assert.equal(lista.status, 200);
  assert.ok(Array.isArray(await lista.json()));

  const post = (ruta, datos = {}) => fetch(`${base}${ruta}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos),
  });
  const sinPuerto = await post('/api/conectar', { modo: 'serie' });
  assert.equal(sinPuerto.status, 400);
  assert.match((await sinPuerto.json()).error, /Falta elegir el puerto/);

  const conexion = await post('/api/conectar', { modo: 'sim' });
  assert.equal(conexion.status, 200);
  const estado = await conexion.json();
  assert.equal(estado.fuente.conectado, true);
  assert.equal(estado.fuente.modo, 'simulacion');

  const ping = await post('/api/comando', { orden: 'PING' });
  assert.equal(ping.status, 200);
  assert.equal((await ping.json()).ok, true);

  const desconexion = await post('/api/desconectar');
  assert.equal(desconexion.status, 200);
  assert.equal((await desconexion.json()).ok, true);
  const sinReceptor = await post('/api/comando', { orden: 'PING' });
  assert.equal(sinReceptor.status, 400);
  assert.match((await sinReceptor.json()).error, /No hay receptor conectado/);
});
