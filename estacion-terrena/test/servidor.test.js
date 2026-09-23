'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');

test('un puerto ocupado muestra instrucciones sin un error no controlado', { timeout: 10000 }, async (t) => {
  const ocupado = http.createServer();
  t.after(() => new Promise((resolve) => ocupado.close(resolve)));
  ocupado.listen(0);
  await once(ocupado, 'listening');
  const puerto = ocupado.address().port;
  const proceso = spawn(process.execPath, ['server.js', '--sim', '--http', String(puerto)], {
    cwd: path.join(__dirname, '..'),
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(() => { if (proceso.exitCode === null) proceso.kill(); });
  let salida = '';
  proceso.stdout.on('data', (datos) => { salida += datos; });
  proceso.stderr.on('data', (datos) => { salida += datos; });
  const [codigo] = await once(proceso, 'close');
  assert.equal(codigo, 1);
  assert.ok(salida.includes(`El puerto ${puerto} ya está ocupado`));
  assert.match(salida, /Ctrl\+C/);
  assert.match(salida, /npm run simular -- --http 3001/);
  assert.doesNotMatch(salida, /Unhandled|throw er;|node:events/);
});
