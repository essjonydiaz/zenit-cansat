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
//  Luego abrir http://localhost:3000
// =============================================================================
'use strict';

const path = require('path');
const fs = require('fs');
const http = require('http');
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
  },
});
if (!args.replay && positionals[0]) args.replay = positionals[0];

const ORDENES_PERMITIDAS = ['PING', 'BUZZER', 'CALIBRAR', 'CERRAR', 'DESACOPLAR'];
const CARPETA_LOGS = path.join(__dirname, 'logs');

// ------------------------------------------------------------- Servidor --
const app = express();
app.use(express.json());
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

function avisarEstado(extra = {}) {
  infoFuente = { ...infoFuente, ...extra };
  difundir({ tipo: 'estado', fuente: infoFuente });
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
  fuente = nueva;
  registro = new Registro(CARPETA_LOGS);
  fuente.on('linea', alRecibirLinea);
  fuente.on('cerrado', () => avisarEstado({ conectado: false }));
  fuente.on('error', (e) => avisarEstado({ conectado: false, error: e.message }));
  await fuente.iniciar();
  avisarEstado({ ...info, conectado: true, error: null, archivoLog: path.basename(registro.base) });
  difundir({ tipo: 'reinicio' });
  console.log(`[fuente] ${info.modo}${info.ruta ? ' ' + info.ruta : ''} -> registro ${registro.base}.txt`);
}

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ tipo: 'estado', fuente: infoFuente }));
  ws.send(JSON.stringify({ tipo: 'historial', mensajes: historial }));
});

// ------------------------------------------------------------------ API --
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

servidor.listen(Number(args.http), async () => {
  console.log('==================================================');
  console.log('  ZÉNIT · Estación terrena');
  console.log(`  Abrir en el navegador:  http://localhost:${args.http}`);
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
});

process.on('SIGINT', () => {
  if (fuente) fuente.detener();
  if (registro) registro.cerrar();
  process.exit(0);
});
