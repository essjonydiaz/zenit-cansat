'use strict';

// Las ediciones del panel se abren por su ruta corta (/v2, /v3). Si alguien quita
// una ruta de server.js, o el enlace se copia con el punto de la oración ("/v3."),
// el navegador mostraría "Cannot GET". Esta prueba lo detecta antes.
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const path = require('node:path');

test('las ediciones del panel responden, también con un punto al final', { timeout: 15000 }, async (t) => {
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
  let inicio;
  for (let intento = 0; intento < 60; intento++) {
    try { inicio = await fetch(`${base}/`); break; }
    catch { await new Promise((resolve) => setTimeout(resolve, 50)); }
  }
  assert.ok(inicio, `El servidor no inició: ${errores}`);
  assert.equal(inicio.status, 200);

  for (const ruta of ['/v2', '/v3', '/prototipo.html', '/v3.', '/v2,']) {
    const r = await fetch(`${base}${ruta}`);
    assert.equal(r.status, 200, `${ruta} respondió ${r.status}`);
    assert.match(await r.text(), /<!doctype html>/i, `${ruta} no devolvió una página`);
  }
});
