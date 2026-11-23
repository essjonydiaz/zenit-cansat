// =============================================================================
//  Panel de la estación terrena Zénit (navegador)
//
//  Recibe los mensajes ya interpretados por server.js vía WebSocket y dibuja:
//    - Cadena de conexión: dónde está la falla (servidor, receptor, radio, cargas)
//    - Estado del sistema: salud de subsistemas, batería y alertas
//    - Vuelo: perfil de misión, altímetro, velocímetro, orientación y gráficas
//    - Misión: requisitos (o verificación prevuelo), carga secundaria, comandos
//    - Eventos y consola
//  Formato de los datos: docs/03-protocolo-telemetria.md
// =============================================================================
'use strict';

// ------------------------------------------------------------ utilidades --
const $ = (id) => document.getElementById(id);
const SVG_NS = 'http://www.w3.org/2000/svg';
const ESTADOS = ['Prevuelo', 'Ascenso', 'Caída libre', 'Descenso autogiro', 'Aterrizado'];
const MAX_PUNTOS = 8000;
const MAX_CONSOLA = 400;

const fmt = (v, d = 1) => {
  if (v === null || v === undefined || !Number.isFinite(Number(v))) return '—';
  const t = Number(v).toFixed(d);
  return /^-0(\.0+)?$/.test(t) ? t.slice(1) : t; // evita "-0.0"
};
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const escapar = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const ahora = () => Date.now();
const hace = (pc) => (pc ? (ahora() - pc) / 1000 : Infinity);
const mmss = (s) => {
  if (!Number.isFinite(s)) return '--:--';
  const m = Math.floor(Math.max(0, s) / 60), r = Math.floor(Math.max(0, s) % 60);
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
};
const cardinal = (r) => ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'][Math.round((((r % 360) + 360) % 360) / 45) % 8];
const horaPc = (pc) => new Date(pc).toLocaleTimeString('es-MX', { hour12: false });
function svg(tag, attrs = {}, texto) {
  const e = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
  if (texto !== undefined) e.textContent = texto;
  return e;
}
const icono = (id) => `<svg class="ico"><use href="#${id}"/></svg>`;
// El panel se dibuja cada 250 ms: reemplazar el HTML igual reinicia las
// animaciones (el pulso de la cadena, la entrada de las alertas) y se ve
// trabado. Solo se toca el DOM cuando el contenido cambió de verdad.
const htmlPrevio = new WeakMap();
function ponerHtml(el, html) {
  if (htmlPrevio.get(el) === html) return false;
  htmlPrevio.set(el, html);
  el.innerHTML = html;
  return true;
}

// ------------------------------------------------------------------ tema --
let graficas = null;
function leerTema() { try { return localStorage.getItem('zenit-tema'); } catch { return null; } }
function guardarTema(t) { try { localStorage.setItem('zenit-tema', t); } catch { /* sin almacenamiento */ } }
function aplicarTema(tema) {
  document.documentElement.dataset.tema = tema;
  $('btnClaro').classList.toggle('activo', tema === 'claro');
  $('btnOscuro').classList.toggle('activo', tema === 'oscuro');
  if (graficas) colorearGraficas();
  S && (S.sucio = true);
}
$('btnClaro').onclick = () => { guardarTema('claro'); aplicarTema('claro'); };
$('btnOscuro').onclick = () => { guardarTema('oscuro'); aplicarTema('oscuro'); };

// ---------------------------------------------------------------- estado --
let S = null;
function estadoInicial() {
  return {
    series: { alt: [], vel: [], ax: [], ay: [], az: [] },
    perfil: [],                 // {t, alt, estado}
    T: null, P: null, B: null,
    tPriPc: null, tSecPc: null, tAnyPc: null, origenUltimo: null,
    marcas: {},                 // liberacion, desacople, aterrizaje: {t, h, ...}
    hitos: {},                  // eventos de la línea de tiempo: codigo -> t (s)
    enlace: { primaria: { ult: null, rec: 0, perd: 0 }, secundaria: { ult: null, rec: 0, perd: 0 } },
    corruptas: 0, rssi: null, snr: null,
    receptor: { pc: null, lora: null, texto: null },
    velsDescenso: [], velFueraDesde: null,
    lanzamiento: null, postOk: false, huboVuelo: false,
    consola: [],
    respuesta: null,
    sucio: true, graficasSucias: true,
  };
}
S = estadoInicial();
// El vuelo en 3D (mision3d.js, módulo aparte) lee el estado desde aquí; solo lectura.
window.zenit = { estado: () => S };
let fuente = { modo: 'ninguna', conectado: false };
let wsAbierto = false;
let comandoPendiente = null;
let erroresPanel = 0;

// ------------------------------------------------------------- alertas ----
// Cada alerta tiene un id. Las "de condición" se quitan solas cuando la
// condición deja de cumplirse; las "persistentes" esperan el botón Entendido.
const alertas = new Map();
// Todo lo que pasó en la sesión, aunque la alerta ya se haya quitado sola:
// lo usa el reporte del botón «Diagnóstico» (diagnostico.js).
const historialAlertas = [];
function alerta(id, nivel, titulo, detalle = '', persistente = false) {
  const a = alertas.get(id);
  if (a) { a.detalle = detalle; a.titulo = titulo; a.nivel = nivel; return; }
  alertas.set(id, { id, nivel, titulo, detalle, pc: ahora(), ack: false, persistente });
  historialAlertas.push({ pc: ahora(), nivel, titulo, detalle });
  if (historialAlertas.length > 300) historialAlertas.shift();
  S.sucio = true;
}
function condicion(id, activa, nivel, titulo, detalle) {
  if (activa) alerta(id, nivel, titulo, detalle);
  else if (alertas.has(id) && !alertas.get(id).persistente) { alertas.delete(id); S.sucio = true; }
}
window.addEventListener('error', (e) => {
  erroresPanel++;
  alerta(`panel-${erroresPanel}`, 'aviso', 'Error del panel', `${e.message} (${(e.filename || '').split('/').pop()}:${e.lineno})`, true);
});
window.addEventListener('unhandledrejection', (e) => {
  erroresPanel++;
  alerta(`panel-${erroresPanel}`, 'aviso', 'Error del panel', String(e.reason && e.reason.message ? e.reason.message : e.reason), true);
});

// -------------------------------------------------- procesar mensajes ----
function contarSecuencia(nombre, seq) {
  const e = S.enlace[nombre];
  if (!e || !Number.isFinite(seq)) return;
  if (e.ult !== null && seq > e.ult + 1 && seq - e.ult < 500) e.perd += seq - e.ult - 1;
  if (e.ult !== null && seq < e.ult - 50) { e.ult = null; }  // la placa se reinició
  e.ult = seq;
  e.rec++;
}
function numeroEn(texto, clave) {
  const m = new RegExp(`${clave}=(-?[\\d.]+)`).exec(texto || '');
  return m ? Number(m[1]) : null;
}
function agregar(serie, x, y) {
  serie.push({ x, y });
  if (serie.length > MAX_PUNTOS) serie.shift();
}
function reiniciarVuelo() {
  const conservar = { consola: S.consola, enlace: S.enlace, receptor: S.receptor, corruptas: S.corruptas, rssi: S.rssi, snr: S.snr };
  S = { ...estadoInicial(), ...conservar };
}

function procesar(msg) {
  try {
    procesarSinProteccion(msg);
  } catch (e) {
    erroresPanel++;
    alerta(`panel-${erroresPanel}`, 'aviso', 'Error al procesar una trama', `${e.message} — línea: ${String(msg && msg.linea).slice(0, 80)}`, true);
    console.error(e, msg);
  }
}

function procesarSinProteccion(msg) {
  let clase = '';
  if (msg.origen === 'INFO') clase = 'l-info';
  else if (msg.valida === false) clase = 'l-err';
  else if (msg.datos && msg.datos.tipo === 'E') clase = 'l-ev';
  S.consola.push({ pc: msg.pc_ms || ahora(), linea: msg.linea, clase });
  if (S.consola.length > MAX_CONSOLA) S.consola.shift();
  S.sucio = true;

  if (msg.origen === 'INFO') {
    if (['VIVO', 'RECEPTOR_LISTO', 'PONG'].includes(msg.codigo)) {
      const m = /lora=(\d)/.exec(msg.detalle || '');
      S.receptor = { pc: msg.pc_ms, lora: m ? Number(m[1]) : S.receptor.lora, texto: `${msg.codigo} ${msg.detalle}` };
    }
    if (msg.codigo === 'TX_ERROR') alerta(`txerr-${msg.pc_ms}`, 'aviso', 'El receptor no pudo transmitir el comando', msg.detalle, true);
    return;
  }
  if (msg.valida === false) { S.corruptas++; return; }
  if (!msg.datos) return;

  const d = msg.datos;
  S.tAnyPc = msg.pc_ms;
  S.origenUltimo = msg.origen;
  if (msg.origen === 'RX') { S.rssi = msg.rssi; S.snr = msg.snr; }

  if (d.tipo === 'E' && d.codigo === 'ARRANQUE') {
    if (S.T && S.T.estado >= 1 && S.T.estado <= 3) {
      alerta(`reinicio-${msg.pc_ms}`, 'critico', 'La carga primaria se reinició en pleno vuelo', 'Revisa la batería y el interruptor: pudo haber un corte de energía.', true);
    }
    reiniciarVuelo();
    // Firmware de prueba (env:primaria_prueba): desacopla al caer 1.5 m. Jamás en el concurso.
    if (/\bPRUEBA\b/.test(d.detalle || '')) {
      alerta('modo-prueba', 'aviso', 'Primaria en MODO PRUEBA (techo)',
        'Desacopla al caer 1.5 m desde lo más alto. Para el concurso sube env:primaria (no primaria_prueba).', true);
    }
  }
  if (d.fuente === 'primaria') { S.tPriPc = msg.pc_ms; contarSecuencia('primaria', d.seq); }
  if (d.fuente === 'secundaria') { S.tSecPc = msg.pc_ms; contarSecuencia('secundaria', d.seq); }

  const t = d.t_ms / 1000;
  switch (d.tipo) {
    case 'T': {
      S.T = d;
      agregar(S.series.alt, t, d.alt);
      agregar(S.series.vel, t, d.vel);
      agregar(S.series.ax, t, d.ax);
      agregar(S.series.ay, t, d.ay);
      agregar(S.series.az, t, d.az);
      S.perfil.push({ t, alt: d.alt, estado: d.estado });
      if (S.perfil.length > MAX_PUNTOS) S.perfil.shift();
      if (d.estado >= 1) S.huboVuelo = true;
      if (d.estado === 3 && d.alt > 20 && d.alt < 180) S.velsDescenso.push(d.vel);
      S.graficasSucias = true;
      break;
    }
    case 'P':
      S.P = { ...d, pc: msg.pc_ms };
      if (!S.lanzamiento && d.fix === 1) S.lanzamiento = { lat: d.lat, lon: d.lon };
      if (d.sec_edad_s >= 0 && d.sec_edad_s < 5) S.tSecVistaPc = msg.pc_ms - d.sec_edad_s * 1000;
      break;
    case 'B':
      S.B = { ...d, pc: msg.pc_ms, rssi: msg.rssi };
      break;
    case 'E': procesarEvento(d, t, msg); break;
    default: break;
  }
}

const HITOS = ['ARRANQUE', 'CALIBRADO', 'ASCENSO', 'LIBERACION', 'DESACOPLE', 'AUTOGIRO', 'ATERRIZAJE', 'POST_ATERRIZAJE_OK'];
function procesarEvento(d, t, msg) {
  if (HITOS.includes(d.codigo) && S.hitos[d.codigo] === undefined) S.hitos[d.codigo] = t;
  switch (d.codigo) {
    case 'LIBERACION': S.marcas.liberacion = { t, h: numeroEn(d.detalle, 'h') }; break;
    case 'DESACOPLE':
      if (!S.marcas.desacople) {
        const h = numeroEn(d.detalle, 'h');
        S.marcas.desacople = { t, h, v: numeroEn(d.detalle, 'v'), origen: (d.detalle || '').split(' ')[0], pc: ahora() };
        if (h !== null && Math.abs(h - 200) > 20) {
          alerta('des-altura', 'aviso', `Desacople a ${fmt(h)} m`, 'La misión pide 200 m. Revisa el barómetro o la calibración en tierra.', true);
        }
      }
      resolverComando('DESACOPLAR', d.detalle);
      break;
    case 'SEPARACION': S.marcas.separacion = { t, ok: true }; break;
    case 'SEPARACION_NO_CONFIRMADA':
      S.marcas.separacion = { t, ok: false };
      alerta('sep-noconf', 'aviso', 'Separación no confirmada por el IMU',
        'El servo abrió pero no se sintió el jalón; el firmware reintentó. Confirma con la baliza de la secundaria (distancia creciendo).', true);
      break;
    case 'AUTOGIRO': S.marcas.autogiro = { t, h: numeroEn(d.detalle, 'h') }; break;
    case 'LORA_ERROR':
      alerta('lora-error', 'critico', 'La primaria no pudo iniciar su radio', `${d.detalle}. Llegó por USB: revisa la antena y reinicia la placa.`, true);
      break;
    case 'ATERRIZAJE': S.marcas.aterrizaje = { t }; break;
    case 'POST_ATERRIZAJE_OK': S.postOk = true; break;
    case 'PONG': resolverComando('PING', `PONG · ${d.detalle}`); break;
    case 'CALIBRADO': resolverComando('CALIBRAR', d.detalle); break;
    case 'CMD_OK': resolverComando(d.detalle, 'aceptado'); break;
    case 'CMD_RECHAZADO':
      resolverComando(comandoPendiente ? comandoPendiente.orden : d.detalle, `rechazado (${d.detalle})`);
      alerta(`cmdrech-${msg.pc_ms}`, 'aviso', 'Comando rechazado por la primaria',
        d.detalle === 'clave' ? 'La firma no coincide: la clave de la estación no es la del firmware.'
          : d.detalle === 'repetido' ? 'Comando repetido o con hora vieja: revisa la fecha y hora de la laptop.'
            : `${d.detalle}: solo se permite en tierra (fase Prevuelo).`, true);
      break;
    default: break;
  }
}

function resolverComando(orden, texto) {
  if (comandoPendiente && (comandoPendiente.orden === orden || !orden)) {
    S.respuesta = `${comandoPendiente.orden} → ${texto}`;
    comandoPendiente = null;
  } else if (orden) {
    S.respuesta = `${orden} → ${texto}`;
  }
}

// ----------------------------------------------------------- diagnóstico --
// Estado de cada eslabón de la cadena: {estado: ok|aviso|critico|gris, sub, ayuda}
const ESLABONES = [
  { id: 'nav', nombre: 'Navegador', icono: 'i-laptop' },
  { id: 'srv', nombre: 'Servidor', icono: 'i-servidor' },
  { id: 'rec', nombre: 'Receptor', icono: 'i-receptor' },
  { id: 'rad', nombre: 'Radio', icono: 'i-senal' },
  { id: 'pri', nombre: 'Carga primaria', icono: 'i-cubo' },
  { id: 'sec', nombre: 'Carga secundaria', icono: 'i-baliza' },
];
let cadenaSel = null;

function perdidasPct(e) { return e.rec ? (100 * e.perd) / (e.rec + e.perd) : 0; }
function enVuelo() { return S.T && S.T.estado >= 1 && S.T.estado <= 3; }
function edadSecundaria() {
  const pcs = [S.tSecPc, S.tSecVistaPc].filter(Boolean);
  return pcs.length ? hace(Math.max(...pcs)) : Infinity;
}

function diagnosticar() {
  const c = {};
  c.nav = { estado: 'ok', sub: 'Cliente web', ayuda: 'Este panel está funcionando.' };

  c.srv = wsAbierto
    ? { estado: 'ok', sub: 'En línea', ayuda: 'El servidor Node.js responde.' }
    : { estado: 'critico', sub: 'Sin conexión', ayuda: 'El servidor se detuvo. Revisa la terminal donde corre <b>npm start</b> (o <b>npm run simular</b>) y vuelve a iniciarlo.' };

  if (c.srv.estado !== 'ok') {
    c.rec = { estado: 'gris', sub: 'Sin datos', ayuda: 'Primero hay que recuperar el servidor.' };
  } else if (!fuente.conectado) {
    c.rec = fuente.error
      ? { estado: 'critico', sub: 'Desconectado', ayuda: `Error: <b>${escapar(fuente.error)}</b>. Revisa el cable USB (de datos), el puerto COM elegido y el driver CP210x/CH340.` }
      : { estado: 'gris', sub: 'Elige un puerto', ayuda: 'Selecciona el puerto del receptor arriba y presiona <b>Conectar</b>, o usa <b>Simulación</b>.' };
  } else if (fuente.modo === 'simulacion') {
    c.rec = { estado: 'ok', sub: 'Simulado', ayuda: 'Datos del simulador (npm run simular). No hay hardware conectado.' };
  } else if (fuente.modo === 'replay') {
    c.rec = { estado: 'ok', sub: 'Reproducción', ayuda: `Repitiendo la sesión guardada ${escapar(fuente.ruta)}.` };
  } else if (S.origenUltimo === 'USB' && hace(S.tAnyPc) < 5) {
    c.rec = { estado: 'ok', sub: 'USB directo', ayuda: 'Hay una placa de vuelo conectada directo por USB (sin receptor LoRa).' };
  } else if (S.receptor.lora === 0) {
    c.rec = { estado: 'critico', sub: 'Sin módulo LoRa', ayuda: 'El receptor (Heltec V3) arrancó pero su radio SX1262 no responde. Conecta la antena SMA de 915 MHz, reinicia la placa (RST) y revisa que sea el firmware env:receptor.' };
  } else if (hace(S.receptor.pc) > 8 && hace(S.tAnyPc) > 8) {
    c.rec = { estado: 'aviso', sub: 'Sin latido', ayuda: 'El puerto está abierto pero el receptor no manda "INFO,VIVO". ¿Está cargado el firmware del receptor? Presiona EN (reset) en la placa.' };
  } else {
    c.rec = { estado: 'ok', sub: 'Datos fluyendo', ayuda: `Receptor en ${escapar(fuente.ruta)}. ${escapar(S.receptor.texto || '')}` };
  }

  const pr = S.enlace.primaria;
  if (c.rec.estado === 'critico' || c.rec.estado === 'gris') {
    c.rad = { estado: 'gris', sub: 'Sin datos', ayuda: 'Primero hay que recuperar el receptor.' };
  } else if (!S.tPriPc) {
    c.rad = { estado: 'gris', sub: 'Esperando paquetes', ayuda: 'Todavía no llega nada de la primaria. ¿Está encendida? Mismo RadioConfig.h (915 MHz, SF7, 250 kHz, sync 0x5A) en las tres placas.' };
  } else if (hace(S.tPriPc) > 3) {
    const seg = Math.round(hace(S.tPriPc));
    c.rad = { estado: enVuelo() ? 'critico' : 'aviso', sub: `Sin paquetes hace ${seg} s`, ayuda: '¿Primaria apagada, fuera de alcance, antena desconectada o frecuencia/palabra de sincronía distinta?' };
  } else if (S.origenUltimo === 'USB') {
    c.rad = { estado: 'ok', sub: 'Por USB', ayuda: 'Los datos llegan por cable, no por radio.' };
  } else if ((S.rssi !== null && S.rssi < -110) || perdidasPct(pr) > 10) {
    c.rad = { estado: 'aviso', sub: `${S.rssi ?? '—'} dBm · ${fmt(perdidasPct(pr))} %`, ayuda: 'Señal débil o muchas pérdidas. Acerca el receptor, levanta la antena de tierra o revisa la antena del CanSat.' };
  } else {
    c.rad = { estado: 'ok', sub: S.rssi !== null ? `${S.rssi} dBm` : 'Enlace estable', ayuda: `RSSI ${S.rssi ?? '—'} dBm · SNR ${S.snr ?? '—'} dB · ${fmt(perdidasPct(pr))} % perdidos.` };
  }

  const b = S.T && S.T.banderas;
  if (c.rad.estado === 'gris' || (c.rad.estado === 'critico')) {
    c.pri = { estado: 'gris', sub: 'Sin datos', ayuda: 'No hay telemetría reciente de la primaria.' };
  } else if (!b) {
    c.pri = { estado: 'gris', sub: 'Sin telemetría', ayuda: 'Aún no llega ninguna trama T.' };
  } else {
    const criticos = [!b.baro && 'BARO', !b.imu && 'IMU', !b.lora && 'LoRa'].filter(Boolean);
    const avisos = [!b.sd && 'microSD', !b.gps && 'GPS', b.bateria_baja && 'batería baja'].filter(Boolean);
    if (criticos.length) c.pri = { estado: 'critico', sub: `Falla: ${criticos.join(', ')}`, ayuda: `Sensores sin respuesta: <b>${criticos.join(', ')}</b>. Corre env:p1_autodiagnostico para ver cuál cable falla.` };
    else if (avisos.length) c.pri = { estado: 'aviso', sub: avisos.join(', '), ayuda: `Revisar: <b>${avisos.join(', ')}</b>. El vuelo funciona, pero se pierde información.` };
    else c.pri = { estado: 'ok', sub: 'Transmitiendo', ayuda: 'Todos los sensores de la primaria responden.' };
  }

  const edadSec = edadSecundaria();
  if (c.srv.estado !== 'ok' || c.rec.estado === 'critico' || c.rec.estado === 'gris') {
    c.sec = { estado: 'gris', sub: 'Sin datos', ayuda: 'Primero hay que recuperar la conexión.' };
  } else if (!Number.isFinite(edadSec)) {
    c.sec = { estado: 'gris', sub: 'Sin baliza', ayuda: 'No llega la baliza. ¿Secundaria encendida (2 pitidos)?' };
  } else if (edadSec > 15) {
    c.sec = { estado: 'critico', sub: `baliza hace ${Math.round(edadSec)} s`, ayuda: 'Se perdió la baliza de la secundaria. Si ya aterrizó, búscala con la última posición del plano.' };
  } else if (edadSec > 5) {
    c.sec = { estado: 'aviso', sub: `baliza hace ${Math.round(edadSec)} s`, ayuda: 'La baliza llega con retraso: puede estar lejos o chocando con las tramas de la primaria.' };
  } else if (S.B && S.B.fix === 0) {
    c.sec = { estado: 'aviso', sub: 'sin GPS', ayuda: 'La baliza transmite pero su GPS no tiene posición. Sácala a cielo abierto 1–2 minutos.' };
  } else {
    c.sec = { estado: 'ok', sub: `baliza hace ${fmt(edadSec)} s`, ayuda: 'La secundaria transmite su posición.' };
  }
  return c;
}

function evaluarAlertas(c) {
  condicion('ws', !wsAbierto, 'critico', 'Sin conexión con el servidor', 'Revisa la terminal donde corre npm start.');
  condicion('fuente', wsAbierto && !fuente.conectado && Boolean(fuente.error), 'critico', 'Receptor desconectado', `${fuente.error || ''} · Revisa el cable USB, el puerto COM o el driver.`);
  condicion('rx-lora', c.rec.sub === 'Sin módulo LoRa', 'critico', 'El receptor no detecta su módulo LoRa', 'Conecta la antena SMA de 915 MHz al Heltec V3 del receptor y reinícialo.');
  condicion('sin-tele', enVuelo() && hace(S.tPriPc) > 3 && fuente.conectado, 'critico',
    `Sin telemetría de la primaria hace ${Math.round(hace(S.tPriPc))} s`, 'Revisa: ¿primaria apagada, fuera de alcance o frecuencia distinta?');
  const T = S.T;
  const sinDesacople = T && (T.estado === 1 || T.estado === 2) && T.alt_max >= 250 && T.alt < 180 && !S.marcas.desacople;
  condicion('no-desacople', sinDesacople, 'critico', '¡No se desacopló a 200 m!', 'Considera el desacople manual (botón rojo, doble clic).');
  const b = T && T.banderas;
  condicion('s-baro', b && !b.baro, 'critico', 'Barómetro (BMP280) sin respuesta', 'Sin barómetro no hay altitud ni desacople automático.');
  condicion('s-imu', b && !b.imu, 'critico', 'IMU (MPU9250 del GY-91) sin respuesta', 'Sin IMU no hay orientación ni aceleración.');
  condicion('s-sd', b && !b.sd, 'aviso', 'microSD no detectada', 'No se guardará el respaldo del vuelo en la tarjeta.');
  condicion('s-sd-conf', b && b.sd && b.sd_sin_confirmar, 'aviso', 'OpenLog sin confirmar',
    'Se escribe al OpenLog pero no respondió. Revisa el cable TXO -> GPIO41, la microSD (FAT32) y config.txt a 115200.');
  condicion('bat-sin-medir', b && b.bateria_sin_medir && !b.simulacion, 'aviso', 'Voltaje de la pila sin medir',
    'Falta el divisor 100k/33k hacia GPIO7. Mide la pila con multímetro antes del vuelo (mínimo 8.5 V).');
  const sinAutogiro = S.marcas.desacople && !S.marcas.autogiro && hace(S.marcas.desacople.pc) > 2;
  condicion('no-autogiro', sinAutogiro && enVuelo(), 'critico', 'El autogiro no reportó despliegue',
    'Pasaron 2 s del desacople sin evento AUTOGIRO. Revisa la velocidad: debe bajar a 8–12 m/s.');
  condicion('s-gps', b && !b.gps, 'aviso', 'GPS de la primaria sin posición', 'No se podrá calcular la distancia a la secundaria.');
  condicion('bat', T && T.bat > 0 && T.bat < 7.5, 'aviso', `Batería baja: ${fmt(T && T.bat, 2)} V`, 'Cambia la pila de 9 V antes del vuelo.');
  const pp = perdidasPct(S.enlace.primaria);
  condicion('perdidas', S.enlace.primaria.rec > 20 && pp > 10, 'aviso', `${fmt(pp)} % de paquetes perdidos`, 'Enlace débil: revisa antenas y distancia.');
  condicion('corruptas', S.corruptas > 0, 'aviso', `${S.corruptas} tramas corruptas`, 'Llegaron tramas con checksum incorrecto (interferencia o señal débil).');
  const edadSec = edadSecundaria();
  condicion('baliza', Number.isFinite(edadSec) && edadSec > 5 && c.sec.estado !== 'gris', edadSec > 15 ? 'critico' : 'aviso',
    `Baliza de la secundaria sin datos hace ${Math.round(edadSec)} s`, 'Revisa que la secundaria siga encendida.');
  condicion('fw-sim', fuente.modo === 'serie' && b && b.simulacion, 'aviso', '¡La primaria tiene el firmware de simulación!', 'Sube env:primaria (no primaria_sim) antes del vuelo.');

  // Velocidad del autogiro fuera de 8–12 m/s por más de 3 s
  if (T && T.estado === 3 && T.alt > 20 && T.alt < 180) {
    const v = Math.abs(T.vel);
    if (v < 8 || v > 12) S.velFueraDesde = S.velFueraDesde || ahora(); else S.velFueraDesde = null;
  } else S.velFueraDesde = null;
  condicion('vel-rango', S.velFueraDesde && hace(S.velFueraDesde) > 3, 'aviso',
    `Descenso a ${fmt(T && Math.abs(T.vel))} m/s (fuera de 8–12)`, 'El autogiro no está frenando dentro del rango pedido.');

  if (comandoPendiente && hace(comandoPendiente.pc) > 5) {
    alerta(`cmd-sin-${comandoPendiente.pc}`, 'aviso', `Sin respuesta al comando ${comandoPendiente.orden}`,
      'La primaria no contestó en 5 s: ¿está encendida y al alcance?', true);
    S.respuesta = `${comandoPendiente.orden} → sin respuesta`;
    comandoPendiente = null;
  }
}

// --------------------------------------------------------------- dibujo ---
function dibujarCadena(c) {
  const ol = $('cadena');
  // Los <li> se crean una vez y se reutilizan: así el pulso que viaja entre
  // eslabones (::before) no se reinicia en cada dibujo.
  if (ol.children.length !== ESLABONES.length) {
    ol.innerHTML = ESLABONES.map((e) => `<li class="eslabon" data-id="${e.id}" role="button" tabindex="0" title="Ver diagnóstico y qué revisar"></li>`).join('');
  }
  ESLABONES.forEach((e, i) => {
    const s = c[e.id];
    const li = ol.children[i];
    const marca = { ok: '✓', aviso: '⚠', critico: '✕', gris: '' }[s.estado];
    const clase = `eslabon ${s.estado}${cadenaSel === e.id ? ' seleccionado' : ''}`;
    if (li.className !== clase) li.className = clase;
    li.setAttribute('aria-expanded', String(cadenaSel === e.id));
    ponerHtml(li, `${icono(e.icono)}<div><b>${e.nombre}<span class="marca-est">${marca}</span></b><small>${escapar(s.sub)}</small></div>`);
  });
  const det = $('cadenaDetalle');
  if (cadenaSel && c[cadenaSel]) {
    det.hidden = false;
    ponerHtml(det, `<b>${ESLABONES.find((e) => e.id === cadenaSel).nombre}:</b> ${c[cadenaSel].ayuda}`);
  } else det.hidden = true;
}
function seleccionarEslabon(li) {
  if (!li) return;
  cadenaSel = cadenaSel === li.dataset.id ? null : li.dataset.id;
  S.sucio = true;
}
$('cadena').addEventListener('click', (ev) => {
  seleccionarEslabon(ev.target.closest('.eslabon'));
});
$('cadena').addEventListener('keydown', (ev) => {
  if (ev.key !== 'Enter' && ev.key !== ' ') return;
  const li = ev.target.closest('.eslabon');
  if (!li) return;
  ev.preventDefault();
  seleccionarEslabon(li);
});

function dibujarSalud(c) {
  const b = S.T && S.T.banderas;
  const viejo = c.pri.estado === 'gris';
  const edadSec = edadSecundaria();
  const tiles = [
    ['BARO', 'i-baro', b ? (b.baro ? 'ok' : 'critico') : 'gris'],
    ['IMU', 'i-imu', b ? (b.imu ? 'ok' : 'critico') : 'gris'],
    ['microSD', 'i-sd', b ? (b.sd ? 'ok' : 'aviso') : 'gris'],
    ['LoRa', 'i-receptor', b ? (b.lora ? 'ok' : 'critico') : 'gris'],
    ['GPS', 'i-gps', b ? (b.gps ? 'ok' : 'aviso') : 'gris'],
    ['Baliza', 'i-baliza', !Number.isFinite(edadSec) ? 'gris' : (edadSec > 15 ? 'critico' : (edadSec > 5 || (S.B && S.B.fix === 0) ? 'aviso' : 'ok'))],
  ];
  const texto = { ok: '✓ OK', aviso: '⚠ AVISO', critico: '✕ FALLA', gris: '—' };
  ponerHtml($('salud'), tiles.map(([n, ic, e]) => {
    // Sin enlace, el último estado conocido ya no es confiable: se muestra en gris.
    const sinEnlace = e !== 'gris' && (n === 'Baliza' ? c.sec.estado === 'gris' : viejo);
    return `<div class="mosaico ${sinEnlace ? 'gris' : e}">${icono(ic)}<b>${n}</b><span>${sinEnlace ? 'sin datos' : texto[e]}</span></div>`;
  }).join(''));
}

function dibujarBateria() {
  const v = S.T ? S.T.bat : null;
  const nivel = $('pilaNivel');
  const sinMedir = S.T && S.T.banderas && S.T.banderas.bateria_sin_medir && !S.T.banderas.simulacion;
  if (v === null) { nivel.style.width = '0'; $('batValor').textContent = '—'; }
  else if (sinMedir) { nivel.style.width = '0'; $('batValor').textContent = 'sin medir'; }
  else {
    // Pila de 9 V: ~9.6 V nueva, ~7 V agotada para el regulador
    nivel.style.width = `${clamp((v - 7) / (9.6 - 7), 0.04, 1) * 100}%`;
    nivel.className = `pila-nivel ${v < 7.5 ? 'critico' : v < 8.2 ? 'aviso' : ''}`;
    $('batValor').textContent = `${fmt(v, 2)} V`;
  }
  $('batSec').textContent = S.B ? `Secundaria: ${fmt(S.B.bat, 2)} V` : '';
}

function dibujarAlertas() {
  const lista = [...alertas.values()].sort((a, b) => {
    const p = { critico: 0, aviso: 1, info: 2 };
    return (a.ack - b.ack) || (p[a.nivel] - p[b.nivel]) || (b.pc - a.pc);
  });
  // Cada alerta conserva su <li> mientras exista: la animación de entrada corre
  // una sola vez y los contadores ("hace N s") cambian sin que parpadee.
  const ul = $('alertas');
  const previas = new Map([...ul.children].map((li) => [li.dataset.id, li]));
  lista.forEach((a, i) => {
    let li = previas.get(a.id);
    if (li) previas.delete(a.id);
    else { li = document.createElement('li'); li.dataset.id = a.id; }
    const clase = `alerta ${a.nivel}${a.ack ? ' reconocida' : ''}`;
    if (li.className !== clase) li.className = clase;
    ponerHtml(li, `${icono('i-alerta')}
      <b><span>${escapar(a.titulo)}</span><time>${horaPc(a.pc)}</time></b>
      <p>${escapar(a.detalle)}</p>
      ${a.ack ? '' : `<button class="btn chico" data-ack="${escapar(a.id)}">Entendido</button>`}`);
    if (ul.children[i] !== li) ul.insertBefore(li, ul.children[i] || null);
  });
  previas.forEach((li) => li.remove());
  const activas = lista.filter((a) => !a.ack);
  const crit = activas.filter((a) => a.nivel === 'critico').length;
  const avi = activas.filter((a) => a.nivel === 'aviso').length;
  $('alertasVacio').hidden = lista.length > 0;
  $('alertasVacio').textContent = 'Sin alertas.';
  if (lista.length && !crit) {
    $('alertasVacio').hidden = false;
    $('alertasVacio').textContent = 'Sin alertas críticas.';
  }
  const camp = $('btnCampana');
  camp.className = `campana ${crit ? 'critico' : avi ? 'aviso' : ''}`;
  $('campanaTexto').textContent = `${crit} ${crit === 1 ? 'crítica' : 'críticas'} · ${avi} ${avi === 1 ? 'aviso' : 'avisos'}`;
  const top = activas.find((a) => a.nivel === 'critico');
  $('banner').hidden = !top;
  if (top) $('bannerTexto').textContent = `${top.titulo} — ${top.detalle}`;
}
$('alertas').addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-ack]');
  if (!b) return;
  const a = alertas.get(b.dataset.ack);
  if (a) { a.ack = true; S.sucio = true; }
});
$('btnCampana').onclick = () => $('alertasTarjeta').scrollIntoView({ behavior: 'smooth', block: 'center' });

// ------------------------------------------------ perfil de la misión ----
const COLOR_FASE = ['--f-prevuelo', '--f-ascenso', '--f-caida', '--f-autogiro', '--f-aterrizado'];
function planRestante() {
  // Continuación "pendiente" (punteada) desde el punto actual con la física esperada.
  const T = S.T;
  const ult = S.perfil[S.perfil.length - 1];
  if (!T || !ult) {
    return [[0, 0], [10, 0], [40, 450], [45, 450], [54, 200], [74, 0], [80, 0]];
  }
  let t = ult.t, h = ult.alt;
  const pts = [[t, h]];
  if (T.estado === 0) { pts.push([t + 5, 0], [t + 35, 450], [t + 40, 450], [t + 49, 200], [t + 69, 0]); return pts; }
  if (T.estado === 1) {
    const v = T.vel > 1 ? T.vel : 5;
    if (h < 445) { t += (450 - h) / v; h = 450; pts.push([t, h]); }
    t += 5; pts.push([t, 450]);
    t += 9; pts.push([t, 200]);
    t += 20; pts.push([t, 0]);
    return pts;
  }
  if (T.estado === 2) {
    if (h > 200) { t += (h - 200) / 30; pts.push([t, 200]); h = 200; }
    t += h / 10; pts.push([t, 0]);
    return pts;
  }
  if (T.estado === 3 && h > 0.5) { pts.push([t + h / 10, 0]); return pts; }
  return pts;
}

function dibujarPerfil() {
  const el = $('perfil');
  const W = Math.max(300, el.clientWidth || 800), H = 150;
  el.setAttribute('viewBox', `0 0 ${W} ${H}`);
  el.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  el.textContent = '';
  const plan = planRestante();
  const tFin = Math.max(plan[plan.length - 1][0], S.perfil.length ? S.perfil[S.perfil.length - 1].t : 0, 60);
  const hMax = Math.max(500, S.T ? S.T.alt_max * 1.1 : 0);
  const mL = 40, mR = 10, mT = 10, mB = 20;
  const x = (t) => mL + (t / tFin) * (W - mL - mR);
  const y = (h) => mT + (1 - clamp(h, -20, hMax) / hMax) * (H - mT - mB);

  [0, 200, 400].concat(hMax >= 600 ? [600] : []).forEach((h) => {
    el.append(svg('line', { class: 'rej', x1: mL, x2: W - mR, y1: y(h), y2: y(h) }));
    el.append(svg('text', { class: 'eje', x: mL - 6, y: y(h) + 4, 'text-anchor': 'end' }, String(h)));
  });
  const paso = tFin > 150 ? 50 : 20;
  for (let t = 0; t <= tFin; t += paso) {
    el.append(svg('text', { class: 'eje', x: x(t), y: H - 4, 'text-anchor': 'middle' }, `${t}s`));
  }
  el.append(svg('text', { class: 'eje', x: 4, y: mT + 6 }, 'm'));

  el.append(svg('polyline', { class: 'plan', points: plan.map(([t, h]) => `${x(t)},${y(h)}`).join(' ') }));

  // Recorrido real, un tramo por fase
  let tramo = [], estado = null;
  const cerrar = () => {
    if (tramo.length > 1) el.append(svg('polyline', { class: 'tramo', stroke: css(COLOR_FASE[estado] || '--f-prevuelo'), points: tramo.join(' ') }));
  };
  S.perfil.forEach((p, i) => {
    if (i % 2 && i !== S.perfil.length - 1) return;  // aligerar
    const pt = `${x(p.t)},${y(p.alt)}`;
    if (p.estado !== estado) { if (tramo.length) tramo.push(pt); cerrar(); tramo = tramo.length ? [tramo[tramo.length - 1]] : []; estado = p.estado; }
    tramo.push(pt);
  });
  cerrar();

  const hito = (m, color, etiqueta) => {
    if (!m) return;
    const p = S.perfil.find((q) => q.t >= m.t) || S.perfil[S.perfil.length - 1];
    if (!p) return;
    el.append(svg('circle', { cx: x(p.t), cy: y(p.alt), r: 4.5, fill: css(color), stroke: css('--fondo'), 'stroke-width': 1.5 }));
    const lx = x(p.t) + 8, ly = y(p.alt) - 14;
    el.append(svg('text', { class: 'hito', x: lx, y: ly }, etiqueta));
    el.append(svg('text', { class: 'hito-v', x: lx, y: ly + 13 }, `${fmt(m.h, 0)} m`));
  };
  hito(S.marcas.liberacion, '--azul-texto', 'Liberación');
  hito(S.marcas.desacople, '--aviso', 'Desacople');
  const u = S.perfil[S.perfil.length - 1];
  if (u) {
    el.append(svg('circle', { cx: x(u.t), cy: y(u.alt), r: 9, fill: css('--cian'), opacity: 0.25 }));
    el.append(svg('circle', { cx: x(u.t), cy: y(u.alt), r: 5, fill: css('--cian'), stroke: '#fff', 'stroke-width': 1.5 }));
  }
}

let faseDibujada = null;
function dibujarFases() {
  const e = S.T ? S.T.estado : -1;
  document.querySelectorAll('#fases li').forEach((li) => {
    const n = Number(li.dataset.e);
    li.className = n === e ? 'actual' : (n < e ? 'hecha' : '');
  });
  // La atmósfera del fondo cambia con la fase; el destello marca la transición.
  if (e !== faseDibujada) {
    document.body.dataset.fase = String(e);
    if (faseDibujada !== null && e >= 0) {
      const li = document.querySelector(`#fases li[data-e="${e}"]`);
      if (li && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        li.animate([
          { transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(143,216,255,.0)' },
          { transform: 'scale(1.06)', boxShadow: '0 0 0 6px rgba(143,216,255,.35)', offset: 0.35 },
          { transform: 'scale(1)', boxShadow: '0 0 0 14px rgba(143,216,255,0)' },
        ], { duration: 900, easing: 'cubic-bezier(.16,1,.3,1)' });
      }
    }
    faseDibujada = e;
  }
}

// ------------------------------------------------------ instrumentos -----
function dibujarCinta() {
  const el = $('cinta');
  el.textContent = '';
  const y = (h) => 178 - (clamp(h, 0, 500) / 500) * 166;
  for (let h = 0; h <= 500; h += 100) {
    el.append(svg('text', { class: 'c-eje', x: 24, y: y(h) + 4, 'text-anchor': 'end' }, String(h)));
    el.append(svg('line', { class: 'c-rej', x1: 28, x2: 50, y1: y(h), y2: y(h) }));
  }
  for (let h = 50; h < 500; h += 100) el.append(svg('line', { class: 'c-rej', x1: 30, x2: 36, y1: y(h), y2: y(h) }));
  el.append(svg('rect', { class: 'c-tubo', x: 32, y: y(500), width: 12, height: y(0) - y(500), rx: 6 }));
  const alt = S.T ? S.T.alt : 0;
  el.append(svg('rect', { class: 'c-lleno', x: 33, y: y(alt), width: 10, height: Math.max(0, y(0) - y(alt)), rx: 5 }));
  [[450, 'c-lib', 'c-txt-lib', 'Liberación'], [200, 'c-des', 'c-txt-des', 'Desacople']].forEach(([h, cl, ct, t]) => {
    el.append(svg('line', { class: `c-marca ${cl}`, x1: 46, x2: 70, y1: y(h), y2: y(h) }));
    el.append(svg('text', { class: ct, x: 74, y: y(h) - 2 }, t));
    el.append(svg('text', { class: ct, x: 74, y: y(h) + 12 }, `${h} m`));
  });
  // CanSat (pequeño cilindro) a la altura actual
  const cy = y(alt);
  el.append(svg('rect', { class: 'c-cansat', x: 30, y: cy - 8, width: 16, height: 16, rx: 4 }));
  el.append(svg('line', { x1: 31, x2: 45, y1: cy - 2, y2: cy - 2, stroke: css('--fondo'), 'stroke-width': 1.2 }));
}

function dibujarGauge() {
  const el = $('gauge');
  el.textContent = '';
  const cx = 130, cy = 132, r = 100, MAX = 40;
  const ang = (v) => Math.PI - (clamp(v, 0, MAX) / MAX) * Math.PI;
  const pt = (v, rr) => [cx + rr * Math.cos(ang(v)), cy - rr * Math.sin(ang(v))];
  const arco = (a, b, rr) => {
    const [x1, y1] = pt(a, rr), [x2, y2] = pt(b, rr);
    return `M${x1},${y1} A${rr},${rr} 0 0 1 ${x2},${y2}`;
  };
  el.append(svg('path', { class: 'g-arco', d: arco(0, MAX, r) }));
  el.append(svg('path', { class: 'g-rango', d: arco(8, 12, r) }));
  for (let v = 0; v <= MAX; v += 2) {
    const mayor = v % 10 === 0;
    const [x1, y1] = pt(v, r - 9), [x2, y2] = pt(v, r - (mayor ? 20 : 14));
    el.append(svg('line', { class: `g-tick${mayor ? '' : ' chico'}`, x1, y1, x2, y2 }));
    if (mayor) { const [tx, ty] = pt(v, r - 33); el.append(svg('text', { class: 'g-num', x: tx, y: ty + 5 }, String(v))); }
  }
  const v = S.T ? Math.abs(S.T.vel) : 0;
  const a = ang(v);
  const px = (rr, da = 0) => cx + rr * Math.cos(a + da), py = (rr, da = 0) => cy - rr * Math.sin(a + da);
  el.append(svg('path', { class: 'g-aguja', d: `M${px(r - 18)},${py(r - 18)} L${px(7, Math.PI / 2)},${py(7, Math.PI / 2)} L${px(7, -Math.PI / 2)},${py(7, -Math.PI / 2)} Z` }));
  el.append(svg('circle', { class: 'g-eje', cx, cy, r: 7 }));
}

let horizonteListo = false;
function prepararHorizonte() {
  const el = $('horizonte');
  el.textContent = '';
  const defs = svg('defs');
  const clip = svg('clipPath', { id: 'hClip' });
  clip.append(svg('circle', { r: 62 }));
  defs.append(clip);
  el.append(defs);
  const g = svg('g', { 'clip-path': 'url(#hClip)' });
  const mov = svg('g', { id: 'hMov' });
  mov.append(svg('rect', { class: 'h-cielo', x: -200, y: -300, width: 400, height: 300 }));
  mov.append(svg('rect', { class: 'h-tierra', x: -200, y: 0, width: 400, height: 300 }));
  mov.append(svg('line', { class: 'h-linea', x1: -200, x2: 200, y1: 0, y2: 0 }));
  [-20, -10, 10, 20].forEach((p) => {
    const yy = -p * 2;
    mov.append(svg('line', { class: 'h-escala', x1: -18, x2: 18, y1: yy, y2: yy }));
    mov.append(svg('text', { class: 'h-txt', x: -28, y: yy + 3 }, String(p)));
    mov.append(svg('text', { class: 'h-txt', x: 28, y: yy + 3 }, String(p)));
  });
  g.append(mov);
  el.append(g);
  el.append(svg('circle', { class: 'h-aro', r: 65 }));
  [-60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60].forEach((a) => {
    const rad = ((a - 90) * Math.PI) / 180, l = a % 30 === 0 ? 9 : 5;
    el.append(svg('line', { class: 'h-tick', x1: 70 * Math.cos(rad), y1: 70 * Math.sin(rad), x2: (70 + l) * Math.cos(rad), y2: (70 + l) * Math.sin(rad) }));
  });
  el.append(svg('path', { class: 'h-avion', d: 'M-34,0 H-12 L0,10 L12,0 H34 M0,-2 V2' }));
  horizonteListo = true;
}
function dibujarHorizonte() {
  if (!horizonteListo) prepararHorizonte();
  const T = S.T;
  const roll = T ? T.roll : 0, pitch = T ? clamp(T.pitch, -30, 30) : 0;
  $('hMov').setAttribute('transform', `rotate(${-roll}) translate(0 ${pitch * 2})`);
  $('oRoll').textContent = T ? `${fmt(T.roll, 0)}°` : '—';
  $('oPitch').textContent = T ? `${fmt(T.pitch, 0)}°` : '—';
  $('oYaw').textContent = T ? `${fmt(T.yaw, 0)}°` : '—';
}

function dibujarInstrumentos() {
  const T = S.T;
  const viejo = S.tPriPc && hace(S.tPriPc) > 3;
  ['instAlt', 'instVel', 'instOri'].forEach((id) => $(id).classList.toggle('viejo', Boolean(viejo)));
  const edad = viejo ? `Último dato: hace ${Math.round(hace(S.tPriPc))} s` : '';
  $('altEdad').textContent = edad;
  $('velEdad').textContent = edad;

  $('altValor').textContent = T ? fmt(T.alt) : '—';
  $('altMax').textContent = `Altura máxima ${T ? fmt(T.alt_max) + ' m' : '—'}`;
  const v = T ? T.vel : null;
  $('velValor').textContent = T ? fmt(Math.abs(v)) : '—';
  $('velFlecha').textContent = !T || Math.abs(v) < 0.3 ? '' : (v > 0 ? '↑' : '↓');
  const nota = $('velNota');
  if (T && T.estado === 3) {
    const bien = Math.abs(v) >= 8 && Math.abs(v) <= 12;
    nota.hidden = false;
    nota.className = `etiqueta-rango ${bien ? 'ok' : 'aviso'}`;
    nota.textContent = bien ? '✓ En rango del autogiro' : '⚠ Fuera de 8–12 m/s';
  } else nota.hidden = true;
  dibujarCinta();
  dibujarGauge();
  dibujarHorizonte();
}

// -------------------------------------------------------------- gráficas --
Chart.defaults.font.family = '"Archivo Variable", "Segoe UI", system-ui, sans-serif';
Chart.defaults.font.size = 11;
Chart.defaults.animation = false;
const rangos = { alt: 0, vel: 0, acel: 0 };  // segundos visibles (0 = todo)

const marcasEventos = {
  id: 'marcasEventos',
  afterDatasetsDraw(chart) {
    const { ctx, chartArea: a, scales: { x } } = chart;
    if (!a) return;
    const lista = [['liberacion', 'Liberación', '--azul-texto'], ['desacople', 'Desacople', '--aviso'], ['aterrizaje', 'Aterrizaje', '--ok']];
    ctx.save();
    ctx.font = '10px "Archivo Variable", "Segoe UI", sans-serif';
    lista.forEach(([k, texto, color], fila) => {
      const m = S.marcas[k];
      if (!m) return;
      const px = x.getPixelForValue(m.t);
      if (px < a.left || px > a.right) return;
      ctx.strokeStyle = css(color);
      ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(px, a.top); ctx.lineTo(px, a.bottom); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = css(color);
      const derecha = px > a.right - 60;
      ctx.textAlign = derecha ? 'right' : 'left';
      // Cada evento en su propio renglón para que las etiquetas no se encimen
      ctx.fillText(`${texto} t=${m.t.toFixed(0)} s`, px + (derecha ? -4 : 4), a.top + 10 + fila * 12);
    });
    ctx.restore();
  },
};
const bandaAutogiro = {
  id: 'bandaAutogiro',
  beforeDatasetsDraw(chart) {
    const { ctx, chartArea: a, scales: { y } } = chart;
    if (!a) return;
    const y1 = y.getPixelForValue(-8), y2 = y.getPixelForValue(-12);
    ctx.save();
    ctx.fillStyle = css('--ok-fondo');
    ctx.fillRect(a.left, Math.min(y1, y2), a.right - a.left, Math.abs(y2 - y1));
    ctx.fillStyle = css('--ok');
    ctx.font = '10px "Archivo Variable", "Segoe UI", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('Rango autogiro (−8 a −12 m/s)', a.right - 4, Math.max(y1, y2) + 12);
    ctx.restore();
  },
};

function crearGrafica(id, series, extra = [], ejeY = {}) {
  return new Chart($(id), {
    type: 'line',
    data: { datasets: series.map((s) => ({ label: s.nombre, data: s.datos, borderWidth: 2, pointRadius: 0, tension: 0 })) },
    plugins: [marcasEventos, ...extra],
    options: {
      responsive: true, maintainAspectRatio: false, parsing: false, normalized: true,
      interaction: { mode: 'nearest', intersect: false, axis: 'x' },
      plugins: {
        legend: { display: series.length > 1, position: 'top', align: 'end', labels: { boxWidth: 10, boxHeight: 2, padding: 8 } },
        tooltip: { callbacks: { title: (it) => `t = ${it[0].parsed.x.toFixed(1)} s` } },
      },
      scales: {
        x: { type: 'linear', title: { display: true, text: 'Tiempo (s)' } },
        y: { ...ejeY },
      },
    },
  });
}
graficas = {
  alt: crearGrafica('gAlt', [{ nombre: 'Altitud (m)', datos: S.series.alt }], [], { suggestedMin: 0, suggestedMax: 500 }),
  vel: crearGrafica('gVel', [{ nombre: 'Velocidad (m/s)', datos: S.series.vel }], [bandaAutogiro], { suggestedMin: -40, suggestedMax: 20 }),
  acel: crearGrafica('gAcel', [
    { nombre: 'ax', datos: S.series.ax }, { nombre: 'ay', datos: S.series.ay }, { nombre: 'az', datos: S.series.az },
  ], [], { suggestedMin: -1, suggestedMax: 2 }),
};

function colorearGraficas() {
  const colores = {
    alt: [css('--azul-texto')], vel: [css('--ok')],
    acel: [css('--serie-x'), css('--serie-y'), css('--serie-z')],
  };
  Object.entries(graficas).forEach(([k, g]) => {
    g.data.datasets.forEach((d, i) => { d.borderColor = colores[k][i]; d.backgroundColor = colores[k][i]; });
    ['x', 'y'].forEach((eje) => {
      g.options.scales[eje].grid = { color: css('--rejilla') };
      g.options.scales[eje].ticks = { color: css('--tenue') };
      if (g.options.scales[eje].title) g.options.scales[eje].title.color = css('--tenue');
      g.options.scales[eje].border = { color: css('--borde') };
    });
    g.options.plugins.legend.labels.color = css('--suave');
    g.update('none');
  });
}
colorearGraficas();

document.querySelectorAll('.rangos').forEach((cont) => {
  const g = cont.dataset.g;
  [[60, '1 min'], [300, '5 min'], [0, 'Todo']].forEach(([seg, texto]) => {
    const b = document.createElement('button');
    b.textContent = texto;
    b.className = seg === rangos[g] ? 'activo' : '';
    b.onclick = () => {
      rangos[g] = seg;
      cont.querySelectorAll('button').forEach((x) => x.classList.toggle('activo', x === b));
      S.graficasSucias = true;
    };
    cont.append(b);
  });
});

function dibujarGraficas() {
  const T = S.T;
  graficas.alt.data.datasets[0].data = S.series.alt;
  graficas.vel.data.datasets[0].data = S.series.vel;
  graficas.acel.data.datasets[0].data = S.series.ax;
  graficas.acel.data.datasets[1].data = S.series.ay;
  graficas.acel.data.datasets[2].data = S.series.az;
  const tUlt = S.series.alt.length ? S.series.alt[S.series.alt.length - 1].x : null;
  Object.entries(graficas).forEach(([k, g]) => {
    const r = rangos[k];
    if (tUlt === null) {
      g.options.scales.x.min = undefined;
      g.options.scales.x.max = undefined;
    } else {
      // Al inicio hay pocos puntos: se muestran al menos 30 s para que el eje no quede en décimas.
      const t0 = S.series.alt[0].x;
      const min = r ? Math.max(t0, tUlt - r) : Math.floor(t0 / 5) * 5;
      g.options.scales.x.min = min;
      g.options.scales.x.max = Math.max(tUlt, min + 30);
      g.options.scales.x.ticks.precision = 0;
    }
    g.update('none');
  });
  $('gAltValor').textContent = T ? `${fmt(T.alt)} m` : '—';
  $('gVelValor').textContent = T ? `${fmt(T.vel)} m/s` : '—';
  $('gAcelValor').textContent = T ? `|a| ${fmt(Math.hypot(T.ax, T.ay, T.az), 2)} g` : '';
}

// ---------------------------------------------- requisitos / prevuelo ----
function itemsRequisitos() {
  const T = S.T;
  const items = [];
  const it = (texto, estado, valor = '') => items.push({ texto, estado, valor });
  const vivo = hace(S.tPriPc) < 3;
  it('Telemetría en tiempo real', T ? (vivo ? 'ok' : 'falla') : 'pendiente', T ? `${S.enlace.primaria.rec} paq.` : '');
  it('Velocidad en todo el trayecto', T && T.estado >= 1 ? 'ok' : 'pendiente');
  it('Altura máxima', T && T.estado >= 2 ? 'ok' : 'pendiente', T && T.estado >= 2 ? `${fmt(T.alt_max)} m` : '');
  it('Liberación desde 450 m', S.marcas.liberacion ? 'ok' : 'pendiente', S.marcas.liberacion ? `${fmt(S.marcas.liberacion.h)} m` : '');
  if (S.marcas.desacople) {
    const h = S.marcas.desacople.h;
    it('Desacople a 200 m', h !== null && Math.abs(h - 200) <= 20 ? 'ok' : 'falla', `${fmt(h)} m ${String(S.marcas.desacople.origen || '').toLowerCase()}`);
  } else it('Desacople a 200 m', 'pendiente');
  if (S.velsDescenso.length > 10) {
    const prom = Math.abs(S.velsDescenso.reduce((a, b) => a + b, 0) / S.velsDescenso.length);
    it('Descenso 8–12 m/s', prom >= 8 && prom <= 12 ? 'ok' : 'falla', `prom. ${fmt(prom)}`);
  } else it('Descenso 8–12 m/s', 'pendiente');
  const P = S.P;
  it('Distancia y dirección secundaria', P && P.dist_sec >= 0 ? 'ok' : 'pendiente', P && P.dist_sec >= 0 ? `${fmt(P.dist_sec)} m ${cardinal(P.rumbo_sec)}` : '');
  if (S.marcas.aterrizaje && T) {
    const seg = Math.max(0, T.t_ms / 1000 - S.marcas.aterrizaje.t);
    it('Transmitir ≥ 10 s tras aterrizar', S.postOk || seg >= 10 ? 'ok' : 'pendiente', `${fmt(seg, 0)} s`);
  } else it('Transmitir ≥ 10 s tras aterrizar', 'pendiente');
  return items;
}

function itemsPrevuelo(c) {
  const T = S.T, b = T && T.banderas;
  const items = [];
  const it = (texto, ok, valor = '') => items.push({ texto, estado: ok ? 'ok' : 'falla', valor });
  it('Receptor conectado', c.rec.estado === 'ok', c.rec.sub);
  it('Paquetes llegando', hace(S.tPriPc) < 3, S.tPriPc ? `hace ${fmt(hace(S.tPriPc))} s` : 'sin datos');
  it('BARO', b && b.baro);
  it('IMU', b && b.imu);
  it('microSD', b && b.sd);
  it('LoRa', b && b.lora);
  it('GPS primaria', b && b.gps);
  it('Baliza secundaria con GPS', edadSecundaria() < 5 && S.B && S.B.fix === 1, S.B ? `${S.B.sats} sat` : '');
  it('Batería ≥ 8.5 V', T && T.bat >= 8.5, T ? (T.bat > 0 ? `${fmt(T.bat, 2)} V` : 'sin divisor') : '');
  it('Altitud calibrada (±3 m)', T && Math.abs(T.alt) <= 3, T ? `${fmt(T.alt)} m` : '');
  it('Firmware de vuelo (no simulación)', b && (!b.simulacion || fuente.modo !== 'serie'), b && b.simulacion ? 'primaria_sim' : '');
  return items;
}

function dibujarRequisitos(c) {
  const prevuelo = !S.T || S.T.estado === 0;
  const items = prevuelo ? itemsPrevuelo(c) : itemsRequisitos();
  const oks = items.filter((i) => i.estado === 'ok').length;
  $('reqTitulo').textContent = prevuelo ? 'Verificación prevuelo' : 'Requisitos de la misión';
  const sello = $('prevueloSello');
  sello.hidden = !prevuelo;
  if (prevuelo) {
    const faltan = items.length - oks;
    sello.className = `sello ${faltan ? 'falla' : 'ok'}`;
    sello.textContent = faltan ? `NO LISTO · faltan ${faltan}` : 'LISTO PARA VUELO';
  }
  const marca = { ok: '✓', pendiente: '', falla: '✕' };
  $('requisitos').classList.toggle('largo', items.length > 8);
  ponerHtml($('requisitos'), items.map((i) =>
    `<li class="${i.estado}" title="${escapar(i.texto)}"><span class="m">${marca[i.estado]}</span><span class="t">${escapar(i.texto)}</span><span class="v">${escapar(i.valor)}</span></li>`).join(''));
  const circ = 2 * Math.PI * 42;
  const arco = $('anilloArco');
  arco.style.strokeDasharray = `${circ}`;
  arco.style.strokeDashoffset = `${circ * (1 - oks / items.length)}`;
  $('anilloTexto').textContent = `${oks}/${items.length}`;
  arco.parentElement.parentElement.classList.toggle('listo', oks === items.length);
}

// ----------------------------------------------------- carga secundaria --
function prepararBrujula() {
  const g = document.querySelector('#brujula .b-marcas');
  for (let a = 0; a < 360; a += 15) {
    const r = (a * Math.PI) / 180, l = a % 90 === 0 ? 0 : a % 45 === 0 ? 6 : 3;
    if (!l) continue;
    g.append(svg('line', { x1: 50 * Math.sin(r), y1: -50 * Math.cos(r), x2: (50 - l) * Math.sin(r), y2: -(50 - l) * Math.cos(r) }));
  }
}
prepararBrujula();

function metros(lat, lon, ref) {
  const k = 111320;
  return [(lon - ref.lon) * k * Math.cos((ref.lat * Math.PI) / 180), (lat - ref.lat) * k];
}

function dibujarSecundaria() {
  const P = S.P;
  const flecha = $('bFlecha');
  if (P && P.dist_sec >= 0) {
    flecha.setAttribute('transform', `rotate(${P.rumbo_sec})`);
    flecha.classList.remove('inactiva');
    $('secResumen').textContent = `${fmt(P.dist_sec, 1)} m · ${fmt(P.rumbo_sec, 0)}° ${cardinal(P.rumbo_sec)}`;
  } else {
    flecha.classList.add('inactiva');
    $('secResumen').textContent = P ? 'Sin GPS en alguna carga' : '—';
  }
  const e = edadSecundaria();
  $('secEdad').textContent = Number.isFinite(e) ? `hace ${fmt(e)} s${S.B && S.B.rssi ? ` · ${S.B.rssi} dBm` : ''}` : 'sin baliza';

  // Plano en metros (origen = punto de lanzamiento)
  const el = $('plano');
  el.textContent = '';
  const N = 150, c = N / 2;
  el.append(svg('rect', { class: 'p-fondo', x: 0.5, y: 0.5, width: N - 1, height: N - 1, rx: 8 }));
  const ref = S.lanzamiento || (P && P.fix ? { lat: P.lat, lon: P.lon } : null);
  const puntos = [];
  if (ref) {
    puntos.push(['d-lanz', 0, 0]);
    if (P && P.fix) puntos.push(['d-pri', ...metros(P.lat, P.lon, ref)]);
    const sLat = S.B && S.B.fix ? S.B.lat : (P && P.sec_lat ? P.sec_lat : null);
    const sLon = S.B && S.B.fix ? S.B.lon : (P && P.sec_lon ? P.sec_lon : null);
    if (sLat) puntos.push(['d-sec', ...metros(sLat, sLon, ref)]);
  }
  const ext = Math.max(10, ...puntos.map(([, x, y]) => Math.max(Math.abs(x), Math.abs(y)))) * 1.25;
  const px = (m) => (m / ext) * (c - 10);
  const escalas = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000];
  const esc = escalas.find((s) => px(s) >= 22) || 2000;
  for (let i = -3; i <= 3; i++) {
    const v = c + px(i * esc);
    if (v < 4 || v > N - 4) continue;
    el.append(svg('line', { class: i ? 'p-rej' : 'p-eje', x1: v, x2: v, y1: 4, y2: N - 4 }));
    el.append(svg('line', { class: i ? 'p-rej' : 'p-eje', y1: v, y2: v, x1: 4, x2: N - 4 }));
  }
  el.append(svg('text', { class: 'p-txt', x: 8, y: 14 }, '↑N'));
  el.append(svg('line', { class: 'p-escala', x1: N - 10 - px(esc), x2: N - 10, y1: N - 10, y2: N - 10 }));
  el.append(svg('text', { class: 'p-txt', x: N - 10, y: N - 14, 'text-anchor': 'end' }, `${esc} m`));
  if (!ref) el.append(svg('text', { class: 'p-txt', x: c, y: c + 4, 'text-anchor': 'middle' }, 'sin posición'));
  puntos.forEach(([cl, x, y]) => el.append(svg('circle', { class: cl, cx: c + px(x), cy: c - px(y), r: 5, stroke: css('--tarjeta').startsWith('rgba') ? '#0b1430' : '#fff', 'stroke-width': 1.5 })));
}

// ---------------------------------------------------- eventos / consola --
const NOMBRE_HITO = { ARRANQUE: 'Arranque', CALIBRADO: 'Calibrado', ASCENSO: 'Ascenso', LIBERACION: 'Liberación', DESACOPLE: 'Desacople', AUTOGIRO: 'Autogiro', ATERRIZAJE: 'Aterrizaje', POST_ATERRIZAJE_OK: 'Post-aterrizaje' };
function dibujarEventos() {
  const cont = $('lineaTiempo');
  const t0 = S.hitos.ARRANQUE !== undefined ? S.hitos.ARRANQUE : 0;
  let ultimo = -1;
  HITOS.forEach((h, i) => { if (S.hitos[h] !== undefined) ultimo = i; });
  const pos = (i) => 5 + (i / (HITOS.length - 1)) * 90;  // margen para que las etiquetas no se corten
  const clases = { LIBERACION: 'lib', DESACOPLE: 'des', AUTOGIRO: 'des', ATERRIZAJE: 'ate', POST_ATERRIZAJE_OK: 'ate' };
  ponerHtml(cont, `<div class="base" style="left:${pos(0)}%;right:${100 - pos(HITOS.length - 1)}%"></div><div class="avance" style="left:${pos(0)}%;width:${ultimo < 0 ? 0 : pos(ultimo) - pos(0)}%"></div>` +
    HITOS.map((h, i) => {
      const ocurrido = S.hitos[h] !== undefined;
      const cls = `hito-ev ${ocurrido ? clases[h] || '' : ''}`;
      const estilo = ocurrido ? '' : 'opacity:.45;';
      return `<div class="${cls}" style="left:${pos(i)}%;${estilo}"><span class="et">${NOMBRE_HITO[h]}</span><span class="tt">${ocurrido ? mmss(S.hitos[h] - t0) : '--:--'}</span><span class="palo"></span><span class="punto"${ocurrido ? '' : ` style="background:${css('--gris')}"`}></span></div>`;
    }).join(''));
}

let consolaFirma = '';
function dibujarConsola() {
  const filtro = $('filtroConsola').value;
  const lineas = S.consola.filter((l) => filtro === 'todo' ||
    (filtro === 'error' && l.clase === 'l-err') || (filtro === 'E' && l.clase === 'l-ev') || (filtro === 'INFO' && l.clase === 'l-info'));
  const firma = `${filtro}|${lineas.length}|${lineas.length ? lineas[lineas.length - 1].pc : 0}`;
  if (firma === consolaFirma) return;
  consolaFirma = firma;
  const el = $('consola');
  el.innerHTML = lineas.slice(-200).map((l) => `<div class="${l.clase}"><span class="hora">${horaPc(l.pc)}</span>${escapar(l.linea)}</div>`).join('') ||
    '<div class="hora">Sin líneas todavía.</div>';
  if ($('autoscroll').checked) el.scrollTop = el.scrollHeight;
}
$('filtroConsola').onchange = () => { consolaFirma = ''; S.sucio = true; };
$('btnLimpiar').onclick = () => { S.consola = []; consolaFirma = ''; S.sucio = true; };

// ------------------------------------------------------ bucle de dibujo --
let ultimoDiag = null;
function dibujarTodo() {
  const c = diagnosticar();
  evaluarAlertas(c);
  ultimoDiag = c;
  dibujarCadena(c);
  dibujarSalud(c);
  dibujarBateria();
  dibujarAlertas();
  dibujarFases();
  dibujarPerfil();
  dibujarInstrumentos();
  if (S.graficasSucias) { S.graficasSucias = false; dibujarGraficas(); }
  dibujarRequisitos(c);
  dibujarSecundaria();
  dibujarEventos();
  dibujarConsola();
  const edadPaquete = hace(S.tPriPc);
  $('reloj').textContent = fuente.conectado && wsAbierto && Number.isFinite(edadPaquete)
    ? `${fmt(edadPaquete)} s` : 'SIN DATOS';
  $('reloj').classList.toggle('atrasado', fuente.conectado && wsAbierto && edadPaquete > 3);
  $('respuesta').textContent = S.respuesta || (comandoPendiente ? `Enviado ${comandoPendiente.orden}… esperando respuesta` : 'El desacople es automático a 200 m; el manual es solo respaldo.');
  $('pieFuente').textContent = fuente.archivoLog ? `Registro: logs/${fuente.archivoLog}.txt` : '';
  $('btnConectar').classList.toggle('activo', fuente.conectado && fuente.modo === 'serie');
  $('btnSim').classList.toggle('activo', fuente.conectado && fuente.modo === 'simulacion');
}

setInterval(() => {
  try { dibujarTodo(); } catch (e) {
    erroresPanel++;
    console.error(e);
    alerta(`panel-${erroresPanel}`, 'aviso', 'Error al dibujar el panel', e.message, true);
  }
}, 250);
window.addEventListener('resize', () => { S.sucio = true; });

// ------------------------------------------------------------ conexión ----
// El servidor avisa si su código cambió después de prenderlo (git pull, una ruta
// nueva): sin reiniciarlo, alguna página daría "Cannot GET".
let servidorViejo = false;
function avisarServidorViejo() {
  condicion('servidor-viejo', servidorViejo, 'aviso', 'Reinicia el servidor',
    'Su código cambió después de prenderlo y puede faltar alguna página. En su terminal: Ctrl+C y otra vez npm run simular (o npm start).');
}
function conectarWs() {
  const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
  ws.onopen = () => { wsAbierto = true; };
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.tipo === 'estado') { fuente = m.fuente; S.sucio = true; servidorViejo = !!m.desactualizado; avisarServidorViejo(); }
    if (m.tipo === 'reinicio') { S = estadoInicial(); alertas.clear(); avisarServidorViejo(); }
    if (m.tipo === 'historial') { S = estadoInicial(); m.mensajes.forEach(procesar); }
    if (m.tipo === 'linea') procesar(m.msg);
  };
  ws.onclose = () => {
    wsAbierto = false;
    fuente = { ...fuente, conectado: false };
    setTimeout(conectarWs, 2000);
  };
}
conectarWs();

// Desde otro aparato de la red (servidor con --red) las órdenes piden el PIN
// que el servidor muestra en su terminal. Desde la compu del servidor no.
function leerPin() { try { return sessionStorage.getItem('zenit-pin') || ''; } catch { return ''; } }
async function post(url, cuerpo, reintento = false) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Zenit-Pin': leerPin() }, body: JSON.stringify(cuerpo || {}) });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && j.pin && !reintento) {
    const pin = prompt('PIN de la estación terrena (se ve en la terminal del servidor):');
    if (pin) {
      try { sessionStorage.setItem('zenit-pin', pin.trim()); } catch { /* sin almacenamiento */ }
      return post(url, cuerpo, true);
    }
  }
  if (!r.ok) throw new Error(j.error || r.statusText);
  return j;
}

async function cargarPuertos() {
  const sel = $('selPuerto');
  sel.innerHTML = '<option>Buscando puertos…</option>';
  try {
    const r = await fetch('/api/puertos');
    const puertos = await r.json();
    if (!r.ok) throw new Error(puertos.error);
    sel.innerHTML = puertos.length
      ? puertos.map((p) => `<option value="${escapar(p.ruta)}" ${p.esEsp32 ? 'selected' : ''}>${escapar(p.ruta)} — ${escapar(p.descripcion)}${p.esEsp32 ? ' (ESP32)' : ''}</option>`).join('')
      : '<option value="">No hay puertos (¿receptor conectado? ¿driver CP210x/CH340?)</option>';
  } catch (e) {
    sel.innerHTML = `<option value="">Error al listar puertos: ${escapar(e.message)}</option>`;
  }
}
cargarPuertos();
$('btnRefrescar').onclick = cargarPuertos;
$('btnConectar').onclick = async () => {
  if (!$('selPuerto').value) { alerta('sin-puerto', 'aviso', 'No hay puerto seleccionado', 'Conecta el receptor por USB y presiona ↻.', true); return; }
  try { await post('/api/conectar', { modo: 'serie', ruta: $('selPuerto').value }); } catch (e) { alerta(`con-${ahora()}`, 'critico', 'No se pudo abrir el puerto', `${e.message}. ¿Lo tiene abierto otro programa (monitor serial de PlatformIO)?`, true); }
};
$('btnSim').onclick = async () => {
  try { await post('/api/conectar', { modo: 'sim' }); } catch (e) { alerta(`sim-${ahora()}`, 'aviso', 'No se pudo iniciar la simulación', e.message, true); }
};
$('btnDesconectar').onclick = () => post('/api/desconectar').catch((e) => alerta(`des-${ahora()}`, 'aviso', 'Error al desconectar', e.message, true));

// -------------------------------------------------------------- comandos --
let armadoHasta = 0;
async function enviarComando(orden) {
  try {
    await post('/api/comando', { orden });
    comandoPendiente = { orden, pc: ahora() };
    S.respuesta = null;
  } catch (e) {
    alerta(`cmd-${ahora()}`, 'aviso', `No se envió ${orden}`, e.message, true);
  }
  S.sucio = true;
}
document.querySelectorAll('.cmd').forEach((b) => { b.onclick = () => enviarComando(b.dataset.orden); });
$('btnDesacoplar').onclick = () => {
  const b = $('btnDesacoplar');
  const txt = b.querySelector('span');
  if (ahora() > armadoHasta) {
    armadoHasta = ahora() + 4000;
    b.classList.add('armado');
    txt.textContent = '¿Seguro? Clic otra vez para DESACOPLAR';
    setTimeout(() => {
      if (ahora() >= armadoHasta) { b.classList.remove('armado'); txt.textContent = 'Desacople manual (doble clic)'; }
    }, 4050);
    return;
  }
  armadoHasta = 0;
  b.classList.remove('armado');
  txt.textContent = 'Desacople manual (doble clic)';
  enviarComando('DESACOPLAR');
};

// Tema inicial: el guardado, o el oscuro (el claro es para usar al sol)
aplicarTema(leerTema() || 'oscuro');
