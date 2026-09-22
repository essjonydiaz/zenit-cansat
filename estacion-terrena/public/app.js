// =============================================================================
//  Panel de la estación terrena Zénit (navegador).
//  Recibe los mensajes ya interpretados por server.js vía WebSocket.
// =============================================================================
'use strict';

const $ = (id) => document.getElementById(id);
const ESTADOS = ['Prevuelo', 'Ascenso', 'Caída libre', 'Descenso autogiro', 'Aterrizado'];
const MAX_PUNTOS = 6000;
let graficas = null;  // se crean más abajo

// ------------------------------------------------------------------ tema --
function leerPreferencia() {
  try { return localStorage.getItem('zenit-tema'); } catch { return null; }
}
function guardarPreferencia(v) {
  try { localStorage.setItem('zenit-tema', v); } catch { /* sin almacenamiento */ }
}
function aplicarTema(tema) {
  document.documentElement.dataset.tema = tema;
  actualizarColoresGraficas();
}
aplicarTema(leerPreferencia() || (matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro'));
$('btnTema').onclick = () => {
  const nuevo = document.documentElement.dataset.tema === 'oscuro' ? 'claro' : 'oscuro';
  guardarPreferencia(nuevo);
  aplicarTema(nuevo);
};
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

// ---------------------------------------------------------------- estado --
let S;
function estadoInicial() {
  return {
    series: { alt: [], vel: [], ax: [], ay: [], az: [] },
    T: null, P: null, B: null,
    eventos: [],
    enlace: {
      primaria: { ult: null, rec: 0, perd: 0 },
      secundaria: { ult: null, rec: 0, perd: 0 },
      prueba: { ult: null, rec: 0, perd: 0 },
    },
    corruptas: 0, rssi: null, snr: null, ultimoPc: null, receptor: null,
    liberacion: null, desacople: null, aterrizaje: null, postOk: false,
    velsDescenso: [],
    consola: [],
    sucio: true,
  };
}
S = estadoInicial();
let fuente = { modo: 'ninguna', conectado: false };

function reiniciarVuelo() {
  const conservar = { eventos: S.eventos, consola: S.consola, enlace: S.enlace, receptor: S.receptor };
  S = { ...estadoInicial(), ...conservar };
}

// -------------------------------------------------------------- gráficas --
Chart.defaults.font.family = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
Chart.defaults.animation = false;

const bandaAutogiro = {
  id: 'bandaAutogiro',
  beforeDatasetsDraw(chart) {
    const { ctx, chartArea: a, scales: { y } } = chart;
    if (!a) return;
    const y1 = y.getPixelForValue(-8), y2 = y.getPixelForValue(-12);
    ctx.save();
    ctx.fillStyle = css('--banda');
    ctx.fillRect(a.left, Math.min(y1, y2), a.right - a.left, Math.abs(y2 - y1));
    ctx.restore();
  },
};

function crearGrafica(id, series, opcionesY = {}, extra = []) {
  return new Chart($(id), {
    type: 'line',
    data: {
      datasets: series.map((s) => ({
        label: s.nombre, data: s.datos, borderWidth: 2, pointRadius: 0, tension: 0, spanGaps: false,
      })),
    },
    plugins: extra,
    options: {
      responsive: true, maintainAspectRatio: false, parsing: false, normalized: true,
      interaction: { mode: 'nearest', intersect: false, axis: 'x' },
      plugins: { legend: { display: series.length > 1, labels: { boxWidth: 12 } } },
      scales: {
        x: { type: 'linear', title: { display: true, text: 'Tiempo a bordo (s)' } },
        y: { ...opcionesY },
      },
    },
  });
}

graficas = {
  alt: crearGrafica('gAlt', [{ nombre: 'Altitud', datos: S.series.alt }]),
  vel: crearGrafica('gVel', [{ nombre: 'Velocidad', datos: S.series.vel }], {}, [bandaAutogiro]),
  acel: crearGrafica('gAcel', [
    { nombre: 'ax', datos: S.series.ax },
    { nombre: 'ay', datos: S.series.ay },
    { nombre: 'az', datos: S.series.az },
  ]),
};

function actualizarColoresGraficas() {
  if (!graficas) return;
  const colores = [css('--serie1'), css('--serie2'), css('--serie3')];
  Object.values(graficas).forEach((g) => {
    g.data.datasets.forEach((d, i) => { d.borderColor = colores[i]; d.backgroundColor = colores[i]; });
    ['x', 'y'].forEach((eje) => {
      g.options.scales[eje].grid = { color: css('--rejilla') };
      g.options.scales[eje].ticks = { color: css('--suave') };
      if (g.options.scales[eje].title) g.options.scales[eje].title.color = css('--suave');
    });
    g.options.plugins.legend.labels.color = css('--texto');
    g.update('none');
  });
}
actualizarColoresGraficas();

function enlazarSeries() {
  graficas.alt.data.datasets[0].data = S.series.alt;
  graficas.vel.data.datasets[0].data = S.series.vel;
  graficas.acel.data.datasets[0].data = S.series.ax;
  graficas.acel.data.datasets[1].data = S.series.ay;
  graficas.acel.data.datasets[2].data = S.series.az;
}

function agregarPunto(serie, x, y) {
  serie.push({ x, y });
  if (serie.length > MAX_PUNTOS) serie.shift();
}

// ----------------------------------------------------- procesar mensajes --
function contarSecuencia(fuenteNombre, seq) {
  const e = S.enlace[fuenteNombre];
  if (!e || !Number.isFinite(seq)) return;
  if (e.ult !== null && seq > e.ult + 1 && seq - e.ult < 500) e.perd += seq - e.ult - 1;
  e.ult = seq;
  e.rec += 1;
}

function numeroEn(texto, clave) {
  const m = new RegExp(`${clave}=(-?[\\d.]+)`).exec(texto || '');
  return m ? Number(m[1]) : null;
}

function procesar(msg) {
  S.consola.push(msg.linea);
  if (S.consola.length > 300) S.consola.shift();
  S.sucio = true;

  if (msg.origen === 'INFO') {
    if (msg.codigo === 'VIVO' || msg.codigo === 'RECEPTOR_LISTO' || msg.codigo === 'PONG') {
      S.receptor = `${msg.codigo} ${msg.detalle}`;
    }
    if (msg.codigo === 'COMANDO_ENVIADO') agregarEvento(null, `→ ${msg.detalle}`, 'comando enviado', msg.pc_ms);
    return;
  }
  if (msg.valida === false) { S.corruptas++; return; }
  if (!msg.datos) return;

  const d = msg.datos;
  if (msg.origen === 'RX') { S.rssi = msg.rssi; S.snr = msg.snr; }
  S.ultimoPc = msg.pc_ms;
  if (d.tipo === 'E' && d.codigo === 'ARRANQUE') reiniciarVuelo();
  contarSecuencia(d.fuente, d.seq);

  const t = d.t_ms / 1000;
  switch (d.tipo) {
    case 'T':
      S.T = d;
      agregarPunto(S.series.alt, t, d.alt);
      agregarPunto(S.series.vel, t, d.vel);
      agregarPunto(S.series.ax, t, d.ax);
      agregarPunto(S.series.ay, t, d.ay);
      agregarPunto(S.series.az, t, d.az);
      if (d.estado === 3 && d.alt > 20 && d.alt < 180) S.velsDescenso.push(d.vel);
      break;
    case 'P': S.P = { ...d, pc: msg.pc_ms }; break;
    case 'B': S.B = { ...d, pc: msg.pc_ms, rssi: msg.rssi }; break;
    case 'E': {
      agregarEvento(t, d.codigo, d.detalle, msg.pc_ms);
      if (d.codigo === 'LIBERACION') S.liberacion = { h: numeroEn(d.detalle, 'h') };
      if (d.codigo === 'DESACOPLE' && !S.desacople) {
        S.desacople = { h: numeroEn(d.detalle, 'h'), v: numeroEn(d.detalle, 'v'), origen: (d.detalle || '').split(' ')[0] };
      }
      if (d.codigo === 'ATERRIZAJE') S.aterrizaje = { t_ms: d.t_ms };
      if (d.codigo === 'POST_ATERRIZAJE_OK') S.postOk = true;
      break;
    }
    default: break;
  }
}

function agregarEvento(t, codigo, detalle, pc) {
  S.eventos.push({ t, codigo, detalle, pc });
  if (S.eventos.length > 200) S.eventos.shift();
}

// ------------------------------------------------------------------ dibujo --
const fmt = (v, dec = 1) => (v === null || v === undefined || Number.isNaN(v) ? '—' : Number(v).toFixed(dec));
function mmss(seg) {
  if (!Number.isFinite(seg)) return '—';
  const m = Math.floor(seg / 60), s = Math.floor(seg % 60);
  return `T+${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
function cardinal(r) {
  return ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'][Math.round((((r % 360) + 360) % 360) / 45) % 8];
}

function dibujar() {
  const T = S.T;
  const e = T ? T.estado : -1;
  document.querySelectorAll('#fases li').forEach((li) => {
    const n = Number(li.dataset.e);
    li.className = n === e ? 'actual' : (n < e ? 'hecha' : '');
  });
  $('tMision').textContent = T ? mmss(T.t_ms / 1000) : '—';

  $('kAlt').textContent = fmt(T?.alt);
  $('kVel').textContent = T ? `${T.vel >= 0 ? '↑' : '↓'} ${fmt(Math.abs(T.vel))}` : '—';
  const nota = $('kVelNota');
  if (T && T.estado === 3) {
    const v = Math.abs(T.vel);
    const bien = v >= 8 && v <= 12;
    nota.textContent = bien ? 'En rango del autogiro (8–12)' : 'Fuera de 8–12 m/s';
    nota.className = `nota ${bien ? 'ok' : 'aviso'}`;
  } else {
    nota.textContent = '';
  }
  $('kMax').textContent = fmt(T?.alt_max);
  $('kG').textContent = fmt(T?.g_max, 2);
  $('kTemp').textContent = fmt(T?.temp);
  $('kPres').textContent = T ? fmt(T.pres / 100, 1) : '—';
  $('kBat').textContent = fmt(T?.bat, 2);
  $('kOri').textContent = T ? `${fmt(T.roll, 0)} / ${fmt(T.pitch, 0)} / ${fmt(T.yaw, 0)}` : '—';

  enlazarSeries();
  Object.values(graficas).forEach((g) => g.update('none'));

  dibujarSecundaria();
  dibujarEnlace();
  dibujarRequisitos();
  dibujarEventos();
  const consola = $('consola');
  const alFinal = consola.scrollTop + consola.clientHeight >= consola.scrollHeight - 20;
  consola.textContent = S.consola.join('\n');
  if (alFinal) consola.scrollTop = consola.scrollHeight;
}

function dibujarSecundaria() {
  const P = S.P;
  const flecha = $('flecha');
  if (P && P.dist_sec >= 0) {
    flecha.setAttribute('transform', `rotate(${P.rumbo_sec})`);
    flecha.classList.remove('inactiva');
    $('sDist').textContent = `${fmt(P.dist_sec, 1)} m`;
    $('sRumbo').textContent = `${fmt(P.rumbo_sec, 0)}° ${cardinal(P.rumbo_sec)}`;
  } else {
    flecha.classList.add('inactiva');
    $('sDist').textContent = '—';
    $('sRumbo').textContent = P ? 'sin GPS en alguna carga' : '—';
  }
  $('sEdad').textContent = P && P.sec_edad_s >= 0 ? `hace ${fmt(P.sec_edad_s, 1)} s · ${P.sec_rssi} dBm` : '—';
  $('cPri').textContent = P && P.fix ? `${fmt(P.lat, 6)}, ${fmt(P.lon, 6)} (${P.sats} sat)` : 'sin posición';
  const B = S.B;
  $('cSec').textContent = B && B.fix ? `${fmt(B.lat, 6)}, ${fmt(B.lon, 6)} (${B.sats} sat)` :
    (P && P.sec_lat ? `${fmt(P.sec_lat, 6)}, ${fmt(P.sec_lon, 6)}` : 'sin posición');
}

function textoEnlace(e) {
  if (!e.rec) return 'sin datos';
  const total = e.rec + e.perd;
  return `${e.rec} recibidos · ${((100 * e.perd) / total).toFixed(1)} % perdidos`;
}

function dibujarEnlace() {
  $('lRssi').textContent = S.rssi === null ? '—' : `${S.rssi} dBm`;
  $('lSnr').textContent = S.snr === null ? '—' : `${S.snr} dB`;
  $('lPri').textContent = textoEnlace(S.enlace.primaria);
  $('lSec').textContent = textoEnlace(S.enlace.secundaria);
  $('lRec').textContent = S.receptor || '—';
  $('lLog').textContent = fuente.archivoLog ? `logs/${fuente.archivoLog}.txt` : '—';
  const chips = $('chips');
  chips.innerHTML = '';
  if (S.T) {
    const b = S.T.banderas;
    const lista = [['BARO', b.baro], ['IMU', b.imu], ['microSD', b.sd], ['LoRa', b.lora], ['GPS', b.gps], ['Baliza', b.baliza]];
    lista.forEach(([n, ok]) => chips.insertAdjacentHTML('beforeend', `<span class="chip ${ok ? 'ok' : 'mal'}">${n}</span>`));
    if (b.desacople) chips.insertAdjacentHTML('beforeend', '<span class="chip info">Desacoplado</span>');
    if (b.bateria_baja) chips.insertAdjacentHTML('beforeend', '<span class="chip mal">Batería baja</span>');
    if (b.simulacion) chips.insertAdjacentHTML('beforeend', '<span class="chip info">Firmware en simulación</span>');
  }
  if (S.corruptas) chips.insertAdjacentHTML('beforeend', `<span class="chip info">${S.corruptas} tramas corruptas</span>`);
}

function dibujarRequisitos() {
  const T = S.T;
  const reqs = [];
  const req = (texto, estado, valor = '') => reqs.push({ texto, estado, valor });
  const vivo = S.ultimoPc && Date.now() - S.ultimoPc < 3000;

  req('Telemetría en tiempo real (presión, temperatura, orientación, aceleración)',
    T ? (vivo ? 'ok' : 'falla') : 'pendiente', T ? `${S.enlace.primaria.rec} paquetes` : '');
  req('Velocidad calculada en todo el trayecto', T && T.estado >= 1 ? 'ok' : 'pendiente', T ? `${fmt(T.vel)} m/s` : '');
  req('Altura máxima alcanzada', T && T.estado >= 2 ? 'ok' : 'pendiente', T ? `${fmt(T.alt_max)} m` : '');
  req('Liberación desde ~450 m', S.liberacion ? 'ok' : 'pendiente', S.liberacion ? `${fmt(S.liberacion.h)} m` : '');
  if (S.desacople) {
    const h = S.desacople.h;
    req('Desacople y autogiro a 200 m', h !== null && Math.abs(h - 200) <= 20 ? 'ok' : 'falla',
      `${fmt(h)} m (${S.desacople.origen.toLowerCase()})`);
  } else {
    req('Desacople y autogiro a 200 m', 'pendiente');
  }
  if (S.velsDescenso.length > 10) {
    const prom = Math.abs(S.velsDescenso.reduce((a, b) => a + b, 0) / S.velsDescenso.length);
    req('Descenso con autogiro entre 8 y 12 m/s', prom >= 8 && prom <= 12 ? 'ok' : 'falla', `prom. ${fmt(prom)} m/s`);
  } else {
    req('Descenso con autogiro entre 8 y 12 m/s', 'pendiente');
  }
  const P = S.P;
  req('Distancia y dirección de la carga secundaria', P && P.dist_sec >= 0 ? 'ok' : 'pendiente',
    P && P.dist_sec >= 0 ? `${fmt(P.dist_sec)} m ${cardinal(P.rumbo_sec)}` : '');
  if (S.aterrizaje) {
    // Con el reloj del satélite: segundos entre el aterrizaje y la última telemetría recibida.
    const seg = T ? Math.max(0, (T.t_ms - S.aterrizaje.t_ms) / 1000) : 0;
    req('Transmitir ≥ 10 s después de aterrizar', S.postOk || seg >= 10 ? 'ok' : 'pendiente', `${fmt(seg, 0)} s`);
  } else {
    req('Transmitir ≥ 10 s después de aterrizar', 'pendiente');
  }
  const ep = S.enlace.primaria;
  const perd = ep.rec ? (100 * ep.perd) / (ep.rec + ep.perd) : 0;
  req('Enlace estable (pérdidas < 10 %)', ep.rec ? (perd < 10 ? 'ok' : 'falla') : 'pendiente', ep.rec ? `${perd.toFixed(1)} %` : '');

  const marca = { ok: '✓', pendiente: '○', falla: '!' };
  $('requisitos').innerHTML = reqs.map((r) =>
    `<li class="${r.estado}"><span class="marca-req">${marca[r.estado]}</span><span>${r.texto}</span><span class="valor-req">${r.valor}</span></li>`).join('');
}

const IMPORTANTES = new Set(['LIBERACION', 'DESACOPLE', 'ATERRIZAJE', 'POST_ATERRIZAJE_OK', 'ASCENSO']);
const MALOS = new Set(['CMD_RECHAZADO']);
function escapar(t) {
  return String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
function dibujarEventos() {
  $('eventos').innerHTML = S.eventos.slice(-100).reverse().map((ev) => {
    const clase = IMPORTANTES.has(ev.codigo) ? 'importante' : (MALOS.has(ev.codigo) ? 'malo' : '');
    const t = ev.t === null ? new Date(ev.pc).toLocaleTimeString() : `${ev.t.toFixed(1)} s`;
    return `<li><span class="t">${t}</span><span class="c ${clase}">${escapar(ev.codigo)}</span><span class="d">${escapar(ev.detalle)}</span></li>`;
  }).join('');
}

setInterval(() => {
  $('tUltimo').textContent = S.ultimoPc ? `hace ${((Date.now() - S.ultimoPc) / 1000).toFixed(1)} s` : '—';
  if (S.sucio) { S.sucio = false; dibujar(); }
}, 250);

// -------------------------------------------------------------- conexión --
function pintarConexion() {
  const p = $('pillConexion');
  if (fuente.error && !fuente.conectado) {
    p.className = 'pill error';
    p.textContent = `Error: ${fuente.error}`;
  } else if (!fuente.conectado) {
    p.className = 'pill apagado';
    p.textContent = 'Sin conexión';
  } else if (fuente.modo === 'serie') {
    p.className = 'pill ok';
    p.textContent = `Receptor en ${fuente.ruta}`;
  } else if (fuente.modo === 'simulacion') {
    p.className = 'pill aviso';
    p.textContent = 'Simulación';
  } else {
    p.className = 'pill aviso';
    p.textContent = `Reproducción: ${String(fuente.ruta).split(/[\\/]/).pop()}`;
  }
}

function conectarWs() {
  const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.tipo === 'estado') { fuente = m.fuente; pintarConexion(); S.sucio = true; }
    if (m.tipo === 'reinicio') { S = estadoInicial(); }
    if (m.tipo === 'historial') { S = estadoInicial(); m.mensajes.forEach(procesar); }
    if (m.tipo === 'linea') procesar(m.msg);
  };
  ws.onclose = () => {
    fuente = { ...fuente, conectado: false, error: 'servidor detenido (¿se cerró la terminal?)' };
    pintarConexion();
    setTimeout(conectarWs, 2000);
  };
}
conectarWs();

async function post(url, cuerpo) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo || {}) });
  const j = await r.json().catch(() => ({}));
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
    if (!puertos.length) {
      sel.innerHTML = '<option value="">No hay puertos (¿receptor conectado? ¿driver CP210x/CH340?)</option>';
      return;
    }
    sel.innerHTML = puertos.map((p) =>
      `<option value="${escapar(p.ruta)}" ${p.esEsp32 ? 'selected' : ''}>${escapar(p.ruta)} — ${escapar(p.descripcion)}${p.esEsp32 ? ' (ESP32)' : ''}</option>`).join('');
  } catch (e) {
    sel.innerHTML = `<option value="">Error al listar puertos: ${escapar(e.message)}</option>`;
  }
}
cargarPuertos();
$('btnRefrescar').onclick = cargarPuertos;
$('btnConectar').onclick = async () => {
  try { await post('/api/conectar', { modo: 'serie', ruta: $('selPuerto').value }); } catch (e) { $('respuesta').textContent = e.message; }
};
$('btnSim').onclick = async () => {
  try { await post('/api/conectar', { modo: 'sim' }); } catch (e) { $('respuesta').textContent = e.message; }
};
$('btnDesconectar').onclick = () => post('/api/desconectar').catch(() => {});

// -------------------------------------------------------------- comandos --
let armadoHasta = 0;
document.querySelectorAll('[data-orden]').forEach((b) => {
  b.onclick = async () => {
    const orden = b.dataset.orden;
    if (orden === 'DESACOPLAR' && Date.now() > armadoHasta) {
      armadoHasta = Date.now() + 4000;
      b.classList.add('armado');
      b.textContent = '¿Confirmar desacople?';
      setTimeout(() => {
        if (Date.now() >= armadoHasta) { b.classList.remove('armado'); b.textContent = 'Desacople manual'; }
      }, 4050);
      return;
    }
    if (orden === 'DESACOPLAR') {
      armadoHasta = 0;
      b.classList.remove('armado');
      b.textContent = 'Desacople manual';
    }
    try {
      await post('/api/comando', { orden });
      $('respuesta').textContent = `Enviado: ${orden}. La respuesta aparece en Eventos.`;
    } catch (e) {
      $('respuesta').textContent = `No se envió: ${e.message}`;
    }
  };
});
