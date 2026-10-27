'use strict';

// En la cancha la laptop comparte WiFi con otros equipos. Nadie de fuera debe
// poder mandar comandos (desacople, desconectar, calibrar) a la estación.
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const os = require('node:os');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const path = require('node:path');

async function puertoLibre() {
  const reserva = http.createServer();
  reserva.listen(0, '127.0.0.1');
  await once(reserva, 'listening');
  const puerto = reserva.address().port;
  await new Promise((resolve) => reserva.close(resolve));
  return puerto;
}

async function arrancar(t, extra) {
  const puerto = await puertoLibre();
  const proceso = spawn(process.execPath, ['server.js', '--sim', '--http', String(puerto), ...extra], {
    cwd: path.join(__dirname, '..'), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(() => { if (proceso.exitCode === null) proceso.kill(); });
  let errores = '';
  proceso.stderr.on('data', (datos) => { errores += datos; });
  for (let intento = 0; intento < 60; intento++) {
    try { await fetch(`http://127.0.0.1:${puerto}/api/puertos`); return puerto; }
    catch { await new Promise((resolve) => setTimeout(resolve, 50)); }
  }
  throw new Error(`El servidor no inició: ${errores}`);
}

// Petición con el encabezado Host que se quiera (fetch no deja cambiarlo).
function pedir(host, puerto, { metodo = 'GET', ruta = '/', encabezados = {}, cuerpo } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host, port: puerto, method: metodo, path: ruta, headers: encabezados }, (res) => {
      let texto = '';
      res.on('data', (d) => { texto += d; });
      res.on('end', () => resolve({ status: res.statusCode, texto }));
    });
    req.on('error', reject);
    if (cuerpo) req.write(cuerpo);
    req.end();
  });
}

const ipDeRed = Object.values(os.networkInterfaces()).flat().find((d) => d && d.family === 'IPv4' && !d.internal);
const json = (pin) => ({ 'Content-Type': 'application/json', ...(pin ? { 'X-Zenit-Pin': pin } : {}) });
const PING = JSON.stringify({ orden: 'PING' });

test('sin --red solo responde en esta compu y solo a órdenes del panel', { timeout: 15000 }, async (t) => {
  const puerto = await arrancar(t, []);

  // Un formulario de otra página manda texto, no JSON: se rechaza.
  const formulario = await pedir('127.0.0.1', puerto, { metodo: 'POST', ruta: '/api/desconectar', encabezados: { 'Content-Type': 'text/plain' }, cuerpo: 'x' });
  assert.equal(formulario.status, 415);

  // Una página que se hace pasar por localhost (DNS rebinding) trae otro nombre.
  const ajeno = await pedir('127.0.0.1', puerto, { encabezados: { Host: `evil.example:${puerto}` } });
  assert.equal(ajeno.status, 403);

  const panel = await pedir('127.0.0.1', puerto, { metodo: 'POST', ruta: '/api/comando', encabezados: json(), cuerpo: PING });
  assert.equal(panel.status, 200);

  if (ipDeRed) {
    await assert.rejects(pedir(ipDeRed.address, puerto), 'Sin --red no debe escuchar en la red');
  }
});

test('con --red los comandos desde otro aparato piden el PIN', { timeout: 15000, skip: !ipDeRed && 'esta compu no tiene red' }, async (t) => {
  const puerto = await arrancar(t, ['--red', '--pin', '4321']);
  const ip = ipDeRed.address;

  const sinPin = await pedir(ip, puerto, { metodo: 'POST', ruta: '/api/comando', encabezados: json(), cuerpo: PING });
  assert.equal(sinPin.status, 401);
  const pinMalo = await pedir(ip, puerto, { metodo: 'POST', ruta: '/api/comando', encabezados: json('0000'), cuerpo: PING });
  assert.equal(pinMalo.status, 401);
  const conPin = await pedir(ip, puerto, { metodo: 'POST', ruta: '/api/comando', encabezados: json('4321'), cuerpo: PING });
  assert.equal(conPin.status, 200);

  // Ver el panel desde la red sí se puede, sin PIN.
  assert.equal((await pedir(ip, puerto)).status, 200);
  // Desde la compu del servidor no se pide.
  const local = await pedir('127.0.0.1', puerto, { metodo: 'POST', ruta: '/api/comando', encabezados: json(), cuerpo: PING });
  assert.equal(local.status, 200);
});
