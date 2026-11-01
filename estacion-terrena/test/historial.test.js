'use strict';

// Al cambiar de fuente (botón «Simulación» o «Conectar») el panel abierto borra
// lo anterior. Ese aviso debe llegar ANTES que las primeras tramas de la fuente
// nueva: si no, el panel pierde ARRANQUE y CALIBRADO y el reloj T+ no arranca.
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const path = require('node:path');
const WebSocket = require('ws');

test('al cambiar a simulación, el panel abierto recibe ARRANQUE después de borrar', { timeout: 15000 }, async (t) => {
  const reserva = http.createServer();
  reserva.listen(0, '127.0.0.1');
  await once(reserva, 'listening');
  const puerto = reserva.address().port;
  await new Promise((resolve) => reserva.close(resolve));

  const proceso = spawn(process.execPath, ['server.js', '--sim', '--http', String(puerto)], {
    cwd: path.join(__dirname, '..'), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(() => { if (proceso.exitCode === null) proceso.kill(); });
  const base = `http://127.0.0.1:${puerto}`;
  for (let intento = 0; intento < 60; intento++) {
    try { await fetch(`${base}/api/puertos`); break; }
    catch { await new Promise((resolve) => setTimeout(resolve, 50)); }
  }

  const ws = new WebSocket(`ws://127.0.0.1:${puerto}/ws`);
  t.after(() => ws.close());
  await once(ws, 'open');
  const mensajes = [];
  ws.on('message', (datos) => mensajes.push(JSON.parse(datos)));
  await new Promise((resolve) => setTimeout(resolve, 200));

  const r = await fetch(`${base}/api/conectar`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ modo: 'sim' }),
  });
  assert.equal(r.status, 200);
  await new Promise((resolve) => setTimeout(resolve, 300));

  const ultimoReinicio = mensajes.map((m) => m.tipo).lastIndexOf('reinicio');
  assert.ok(ultimoReinicio >= 0, 'no llegó el aviso de reinicio');
  const codigos = mensajes.slice(ultimoReinicio + 1)
    .filter((m) => m.tipo === 'linea' && m.msg.datos && m.msg.datos.tipo === 'E')
    .map((m) => m.msg.datos.codigo);
  assert.ok(codigos.includes('ARRANQUE'), `después de borrar no llegó ARRANQUE (llegó: ${codigos.join(', ') || 'nada'})`);
  assert.ok(codigos.includes('CALIBRADO'), 'después de borrar no llegó CALIBRADO');
});
