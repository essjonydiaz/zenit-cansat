#!/usr/bin/env node
// =============================================================================
//  Estación terrena del CanSat Zénit
//
//  receptor LoRa ──USB──> este servidor (Node.js) ──WebSocket──> navegador
//                                  │
//                                  └──> logs/ (sesión completa en disco)
//
//  Uso:
//    npm start                       abre el panel; el puerto se elige ahí
//    npm start -- --puerto COM5      conecta directo al receptor en COM5
//    npm run simular                 vuelo simulado (sin hardware)
//    npm run replay -- logs/sesion_X.txt   repite una sesión guardada
//    ... -- --red [--pin 1234]       deja ver el panel desde otros aparatos
//                                    de la red; sus comandos piden el PIN
//  Luego abrir http://localhost:3000
// =============================================================================
'use strict';

const path = require('path');
const fs = require('fs');
const http = require('http');
const os = require('os');
const net = require('net');
const crypto = require('crypto');
const { parseArgs } = require('util');
const express = require('express');
const { WebSocketServer } = require('ws');

const { procesarLinea, enmarcar } = require('./src/protocolo');
const { Registro } = require('./src/registro');
const { PuertoSerie, Reproduccion } = require('./src/fuentes');
const { Simulador } = require('./src/simulador');

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    puerto: { type: 'string' },
    baudios: { type: 'string', default: '115200' },
    sim: { type: 'boolean', default: false },
    replay: { type: 'string' },
    velocidad: { type: 'string', default: '1' },
    http: { type: 'string', default: '3000' },
    clave: { type: 'string', default: process.env.ZENIT_CLAVE || 'ZENIT' },
    red: { type: 'boolean', default: false },
    pin: { type: 'string', default: process.env.ZENIT_PIN },
  },
});
if (!args.replay && positionals[0]) args.replay = positionals[0];
// Sin --red el servidor solo escucha en esta compu: nadie del WiFi de la cancha
// puede abrir el panel ni mandar comandos. Con --red, los otros aparatos ven el
// panel, pero para mandar comandos necesitan el PIN que se muestra al arrancar.
const PIN = args.red ? (args.pin || String(crypto.randomInt(100000, 1000000))) : null;

const ORDENES_PERMITIDAS = ['PING', 'BUZZER', 'CALIBRAR', 'CERRAR', 'DESACOPLAR'];
const CARPETA_LOGS = path.join(__dirname, 'logs');

// ------------------------------------------------------------- Servidor --
const app = express();
// Sin --red solo se acepta el nombre "localhost": así una página de internet
// abierta en esta compu no puede hacerse pasar por el panel (DNS rebinding).
const NOMBRES_LOCALES = ['localhost', '127.0.0.1', '[::1]'];
app.use((req, res, next) => {
  if (args.red || NOMBRES_LOCALES.includes(String(req.hostname).toLowerCase())) return next();
  res.status(403).send('Abre el panel en http://localhost');
});
app.use(express.json());
// Una URL copiada de un texto o de la terminal a veces trae el punto o la coma
// de la oración ("…/v3."): se redirige a la ruta sin esa puntuación.
app.use((req, res, next) => {
  const limpia = req.path.replace(/[.,;:)]+$/, '');
  if (limpia && limpia !== req.path) return res.redirect(302, limpia);
  next();
});
// En / se ve primero el prototipo 3D; sus botones «Abrir panel» llevan al
// panel «modo misión» (v3.html), que también está en /panel y /v3. La 1.ª y la
// 2.ª edición se quitaron: sus direcciones viejas llevan al panel.
const pagina = (archivo) => (req, res) => res.sendFile(path.join(__dirname, 'public', archivo));
app.get('/', pagina('prototipo.html'));
app.get(['/panel', '/v3'], pagina('v3.html'));
app.get(['/v1', '/v2', '/index.html', '/v2.html'], (req, res) => res.redirect(302, '/panel'));
app.use(express.static(path.join(__dirname, 'public')));
// Chart.js servido localmente: en la cancha NO hay internet.
app.use('/vendor', express.static(path.join(__dirname, 'node_modules', 'chart.js', 'dist')));
// Lo mismo para el modelo 3D (three.js) y las tipografías del panel.
app.use('/vendor/three', express.static(path.join(__dirname, 'node_modules', 'three')));
app.use('/vendor/fuentes/archivo', express.static(path.join(__dirname, 'node_modules', '@fontsource-variable', 'archivo')));
app.use('/vendor/fuentes/mono', express.static(path.join(__dirname, 'node_modules', '@fontsource-variable', 'jetbrains-mono')));
app.use('/logs', express.static(CARPETA_LOGS));

const servidor = http.createServer(app);
const wss = new WebSocketServer({ server: servidor, path: '/ws' });

let fuente = null;
let infoFuente = { modo: 'ninguna', ruta: null, conectado: false };
let registro = null;
const historial = [];  // para que un navegador recién abierto vea lo anterior
const MAX_HISTORIAL = 4000;

function difundir(obj) {
  const texto = JSON.stringify(obj);
  wss.clients.forEach((c) => { if (c.readyState === 1) c.send(texto); });
}

// Si alguien cambia el código del servidor (git pull, una ruta nueva) y no lo
// reinicia, las páginas nuevas darían "Cannot GET". El panel avisa en vez de eso.
const ARRANQUE_MS = Date.now();
function desactualizado() {
  const carpetaSrc = path.join(__dirname, 'src');
  const archivos = [__filename, ...fs.readdirSync(carpetaSrc).map((f) => path.join(carpetaSrc, f))];
  return archivos.some((f) => { try { return fs.statSync(f).mtimeMs > ARRANQUE_MS; } catch { return false; } });
}
const mensajeEstado = () => ({ tipo: 'estado', fuente: infoFuente, desactualizado: desactualizado() });

function avisarEstado(extra = {}) {
  infoFuente = { ...infoFuente, ...extra };
  difundir(mensajeEstado());
}

function alRecibirLinea(linea) {
  const msg = procesarLinea(linea);
  if (!msg) return;
  msg.pc_ms = Date.now();
  if (registro) registro.guardar(linea, msg);
  historial.push(msg);
  if (historial.length > MAX_HISTORIAL) historial.shift();
  difundir({ tipo: 'linea', msg });
}

async function usarFuente(nueva, info) {
  if (fuente) fuente.detener();
  if (registro) registro.cerrar();
  historial.length = 0;
  // Los navegadores abiertos borran lo anterior ANTES de que llegue lo nuevo: el
  // simulador manda ARRANQUE y CALIBRADO en cuanto inicia, y si el aviso llegara
  // después se perderían (el reloj T+ se quedaba en --:--).
  difundir({ tipo: 'reinicio' });
  fuente = nueva;
  registro = new Registro(CARPETA_LOGS);
  fuente.on('linea', alRecibirLinea);
  fuente.on('cerrado', () => avisarEstado({ conectado: false }));
  fuente.on('error', (e) => avisarEstado({ conectado: false, error: e.message }));
  await fuente.iniciar();
  avisarEstado({ ...info, conectado: true, error: null, archivoLog: path.basename(registro.base) });
  console.log(`[fuente] ${info.modo}${info.ruta ? ' ' + info.ruta : ''} -> registro ${registro.base}.txt`);
}

wss.on('connection', (ws) => {
  ws.send(JSON.stringify(mensajeEstado()));
  ws.send(JSON.stringify({ tipo: 'historial', mensajes: historial }));
});

// ------------------------------------------------------------------ API --
const esEstaCompu = (req) => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
// Lo que cambia algo (conectar, desconectar, comandos) solo entra como JSON, que
// es como lo manda el panel: un formulario de otra página no puede mandarlo así.
// Desde otro aparato de la red (--red) además se pide el PIN.
app.post('/api/*', (req, res, next) => {
  if (!req.is('application/json')) {
    res.status(415).json({ ok: false, error: 'Solo se aceptan órdenes del panel' });
  } else if (PIN && !esEstaCompu(req) && req.get('X-Zenit-Pin') !== PIN) {
    res.status(401).json({ ok: false, pin: true, error: 'Falta el PIN de la estación (se ve en la terminal del servidor)' });
  } else next();
});

app.get('/api/puertos', async (_req, res) => {
  try {
    res.json(await PuertoSerie.listar());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/conectar', async (req, res) => {
  const { modo, ruta, baudios } = req.body || {};
  try {
    if (modo === 'sim') {
      await usarFuente(new Simulador({ velocidad: Number(args.velocidad), clave: args.clave }), { modo: 'simulacion', ruta: null });
    } else {
      if (!ruta) throw new Error('Falta elegir el puerto');
      await usarFuente(new PuertoSerie(ruta, Number(baudios) || 115200), { modo: 'serie', ruta });
    }
    res.json({ ok: true, fuente: infoFuente });
  } catch (e) {
    avisarEstado({ conectado: false, error: e.message });
    res.status(400).json({ ok: false, error: e.message });
  }
});

app.post('/api/desconectar', (_req, res) => {
  if (fuente) fuente.detener();
  fuente = null;
  avisarEstado({ conectado: false, modo: 'ninguna', ruta: null });
  res.json({ ok: true });
});

app.post('/api/comando', (req, res) => {
  const orden = String((req.body || {}).orden || '').toUpperCase();
  if (!ORDENES_PERMITIDAS.includes(orden)) {
    res.status(400).json({ ok: false, error: `Orden no permitida: ${orden}` });
    return;
  }
  if (!fuente || !infoFuente.conectado) {
    res.status(400).json({ ok: false, error: 'No hay receptor conectado' });
    return;
  }
  const trama = enmarcar(`C,${args.clave},${orden}`);
  fuente.escribir(`TX,${trama}`);
  alRecibirLinea(`INFO,COMANDO_ENVIADO,${orden}`);
  res.json({ ok: true, trama });
});

app.get('/api/logs', (_req, res) => {
  const archivos = fs.existsSync(CARPETA_LOGS)
    ? fs.readdirSync(CARPETA_LOGS).filter((f) => /\.(txt|csv)$/.test(f)).sort().reverse()
    : [];
  res.json(archivos);
});

// ------------------------------------------------------------ Arranque --
function errorServidor(error) {
  if (error.code === 'EADDRINUSE') {
    console.error(`[error] El puerto ${args.http} ya está ocupado. Puede haber otra estación terrena abierta.`);
    console.error(`Si ya está funcionando, abre http://localhost:${args.http} y recarga con Ctrl+F5.`);
    console.error('Para reiniciarla, detén la instancia anterior con Ctrl+C en su terminal.');
    console.error(`Para usar otro puerto: npm ${args.sim ? 'run simular' : 'start'} -- --http ${Number(args.http) === 3001 ? 3002 : 3001}`);
  } else {
    console.error(`[error] No se pudo iniciar el servidor: ${error.message}`);
  }
  process.exit(1);
}

// ws también propaga los errores del servidor HTTP, incluido el puerto ocupado.
servidor.on('error', errorServidor);
wss.on('error', errorServidor);

function direccionesDeRed() {
  return Object.values(os.networkInterfaces()).flat()
    .filter((d) => d && d.family === 'IPv4' && !d.internal).map((d) => d.address);
}

// Un servidor viejo que escuchaba en toda la red puede seguir prendido en el
// mismo puerto por IPv6 sin chocar con este: el navegador abriría ese y no este.
function contestaEnIpv6(puerto) {
  return new Promise((resolve) => {
    const s = net.connect({ host: '::1', port: puerto });
    s.once('connect', () => { s.destroy(); resolve(true); });
    s.once('error', () => resolve(false));
  });
}

contestaEnIpv6(Number(args.http)).then((ocupado) => {
  if (ocupado) errorServidor({ code: 'EADDRINUSE' });
  else servidor.listen(Number(args.http), args.red ? '0.0.0.0' : '127.0.0.1', alEscuchar);
});

async function alEscuchar() {
  console.log('==================================================');
  console.log('  ZÉNIT · Estación terrena');
  console.log(`  Abrir en el navegador:  http://localhost:${args.http}`);
  console.log(`  Panel directo:          http://localhost:${args.http}/panel`);
  if (args.red) {
    direccionesDeRed().forEach((ip) => console.log(`  Desde otro aparato:     http://${ip}:${args.http}`));
    console.log(`  PIN para comandos desde otro aparato: ${PIN}`);
  } else {
    console.log('  Solo en esta compu (para verlo en celulares: --red)');
  }
  console.log('==================================================');
  try {
    if (args.sim) {
      await usarFuente(new Simulador({ velocidad: Number(args.velocidad), clave: args.clave }), { modo: 'simulacion', ruta: null });
    } else if (args.replay) {
      await usarFuente(new Reproduccion(args.replay, Number(args.velocidad)), { modo: 'replay', ruta: args.replay });
    } else if (args.puerto) {
      await usarFuente(new PuertoSerie(args.puerto, Number(args.baudios)), { modo: 'serie', ruta: args.puerto });
    } else {
      console.log('  Elige el puerto del receptor en el panel (o usa --puerto COMx).');
    }
  } catch (e) {
    console.error(`[error] ${e.message}`);
    avisarEstado({ conectado: false, error: e.message });
  }
}

process.on('SIGINT', () => {
  if (fuente) fuente.detener();
  if (registro) registro.cerrar();
  process.exit(0);
});
