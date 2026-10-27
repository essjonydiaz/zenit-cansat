// =============================================================================
//  prototipo.js — Página "Prototipo 3D" de Zénit
//
//  1. Portada de vidrio: la página es una placa de vidrio ahumado partida en
//     piezas gruesas (ExtrudeGeometry). El contenido va impreso en el vidrio
//     (un canvas) y cada pieza se lleva su pedazo. La placa se inclina hacia
//     el cursor, la pieza bajo el puntero se levanta y se ladea, y al bajar con
//     el scroll todo se hace añicos (y se rearma al subir).
//  2. Recorrido: detrás del vidrio está el CanSat (cansat3d.js). Cada sección
//     de la página mueve el modelo: vista explotada, ascenso a 450 m,
//     desacople a 200 m, autogiro y aterrizaje.
//  Sin WebGL o con "reducir movimiento": portada HTML estática (prototipo.css).
// =============================================================================
import * as THREE from 'three';
import { crearCanSat, prepararEstudio, webglDisponible } from './cansat3d.js';

const raiz = document.documentElement;
const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const suave = (t) => t * t * (3 - 2 * t);
const entradaCubica = (t) => t * t * t;
const salidaRebote = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2; };

// Tramas reales del firmware de vuelo ejecutado en un ESP32-S3 emulado
// (estacion-terrena/test/datos/salida_firmware_sim.txt)
const TRAMAS = [
  '$E,150,63873,LIBERACION,h=449.2*22',
  '$E,178,72817,DESACOPLE,AUTO h=198.0 v=-36.5*0A',
  '$E,179,72838,SEPARACION,cambio=1.47 g*3E',
  '$E,180,73220,AUTOGIRO,h=183.4*21',
  '$E,250,96356,ATERRIZAJE,alt_max=450.4 g_max=16.0*4C',
  '$E,281,106365,POST_ATERRIZAJE_OK,10 s transmitiendo tras aterrizar*1D',
  '$T,317,118122,4,-0.02,-0.03,450.39,96298,28.0,-0.02,-0.00,0.99,0,-0,-0,0.0,0.1,38.7,16.00,9.07,9975*64',
];

// ----------------------------------------------- secciones visibles (texto) --
function activarTramos() {
  const io = new IntersectionObserver((entradas) => {
    entradas.forEach((e) => { if (e.isIntersecting) e.target.classList.add('visible'); });
  }, { threshold: 0.2 });
  document.querySelectorAll('.tramo').forEach((t) => io.observe(t));
}
function llenarTicker() {
  const t = document.getElementById('ticker');
  const lineas = [];
  for (let i = 0; i < 4; i++) lineas.push(...TRAMAS);
  t.innerHTML = lineas.map((l) => {
    const m = /^\$(\w),[^,]*,[^,]*,(\w+)?/.exec(l);
    const cod = m && m[1] === 'E' ? m[2] : null;
    return `<div>${cod ? l.replace(cod, `<span class="t">${cod}</span>`) : l}</div>`;
  }).join('');
}

activarTramos();
llenarTicker();
if (quieto || !webglDisponible()) raiz.classList.add('sin-3d');
else iniciar().catch((e) => { console.error('[prototipo]', e); raiz.classList.add('sin-3d'); });

// =============================================================================
async function iniciar() {
  const lienzo = document.getElementById('escena3d');
  const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x050507, 1);
  const escena = new THREE.Scene();
  const camara = new THREE.PerspectiveCamera(30, 1, 1, 10000);
  await prepararEstudio(renderer, escena, { intensidad: 0.42 });
  const luzClave = new THREE.DirectionalLight(0xe4ecff, 1.5);   // blanco-azul desde arriba a la izquierda
  luzClave.position.set(-0.8, 1.1, 1);
  escena.add(luzClave);

  await Promise.all([
    document.fonts.load('600 80px "Archivo Variable"'),
    document.fonts.load('400 20px "Archivo Variable"'),
    document.fonts.load('800 20px "Archivo Variable"'),
  ]).catch(() => {});
  const { emblema, completo: logoCompleto } = await cargarLogos();

  // ------------------------------------------------------------ vidrio --
  const compartidos = {
    uPuntero: { value: new THREE.Vector3(0, 0, 0) },
    uBrillo: { value: 0 },
    uS: { value: 1 },
  };
  function materialVidrio({ resplandor = true, iridiscencia = 0.55 } = {}) {
    const m = new THREE.MeshPhysicalMaterial({
      color: 0x17171b, roughness: 0.36, metalness: 0,
      clearcoat: 0.7, clearcoatRoughness: 0.12, specularIntensity: 0.7,
      iridescence: iridiscencia, iridescenceIOR: 1.3, iridescenceThicknessRange: [250, 650],
      envMapIntensity: 1,
    });
    if (resplandor) {
      // Brillo lavanda suave alrededor del puntero (inyectado en el shader)
      m.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, compartidos);
        sh.vertexShader = sh.vertexShader
          .replace('#include <common>', '#include <common>\nvarying vec3 vZMundo;')
          .replace('#include <project_vertex>', '#include <project_vertex>\nvZMundo = (modelMatrix * vec4(transformed, 1.0)).xyz;');
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <common>', '#include <common>\nvarying vec3 vZMundo;\nuniform vec3 uPuntero;\nuniform float uBrillo;\nuniform float uS;')
          .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
            float zd = distance(vZMundo.xy, uPuntero.xy) / (300.0 * uS);
            totalEmissiveRadiance += vec3(0.42, 0.37, 0.62) * 0.16 * exp(-1.6 * zd * zd) * uBrillo;`);
      };
      m.customProgramCacheKey = () => 'vidrio-zenit';
    }
    return m;
  }

  // Puntos del corte (coordenadas de la placa: x a la derecha, y hacia abajo)
  const P = {
    TL: [0, 0], TR: [1, 0], BL: [0, 1], BR: [1, 1],
    tAB: [0.22, 0], tBC: [0.515, 0], tCE: [0.84, 0], bAD: [0.34, 1], bDE: [0.865, 1],
    J0: [0.385, 0.72], J1: [0.48, 0.62], J2: [0.716, 0.49],
  };
  const DERIVA = {};
  Object.keys(P).forEach((k, i) => {
    const borde = !k.startsWith('J');
    const esquina = ['TL', 'TR', 'BL', 'BR'].includes(k);
    DERIVA[k] = {
      ax: esquina ? 0 : 0.03, ay: borde ? 0 : 0.05,
      px: 10 + ((i * 7.3) % 10), py: 12 + ((i * 5.1) % 8), fx: i * 1.7, fy: i * 2.3,
    };
  });
  const CELDAS = [
    ['TL', 'tAB', 'J0', 'bAD', 'BL'],
    ['tAB', 'tBC', 'J1', 'J0'],
    ['tBC', 'tCE', 'J2', 'J1'],
    ['J0', 'J1', 'J2', 'bDE', 'bAD'],
    ['tCE', 'TR', 'BR', 'bDE', 'J2'],
  ];

  const losa = new THREE.Group();          // la placa completa (se inclina)
  escena.add(losa);
  const piezas = [];                       // nav + 5 celdas
  const L = {};                            // medidas actuales
  let textura = null;

  function crearPieza(tipo, indice) {
    const grupo = new THREE.Group();
    const malla = new THREE.Mesh(new THREE.BufferGeometry(), materialVidrio());
    const impresion = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false }));
    impresion.renderOrder = 5;
    grupo.add(malla, impresion);
    losa.add(grupo);
    // Vuelo al estallar: hacia afuera, abajo y hacia la cámara, con giro
    const eje = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
    const p = {
      tipo, indice, grupo, malla, impresion, centro: new THREE.Vector2(),
      lift: { x: 0, v: 0 }, tipX: { x: 0, v: 0 }, tipY: { x: 0, v: 0 }, hover: 0,
      eje, giro: 2.0 + Math.random() * 1.6,
      velAfuera: 500 + Math.random() * 400, velZ: 420 + Math.random() * 380, abajo: 120 + Math.random() * 160,
    };
    malla.userData.pieza = p;
    piezas.push(p);
    return p;
  }
  crearPieza('nav', 0);
  CELDAS.forEach((_, i) => crearPieza('celda', i + 1));

  // ------------------------------------------------------------ medidas --
  function medir() {
    // Tamaño real del lienzo (en teléfonos innerWidth puede llegar tarde)
    const W = lienzo.clientWidth || innerWidth, H = lienzo.clientHeight || innerHeight;
    if (W === L.W && H === L.H) return;
    const tel = W < 700;
    renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
    renderer.setSize(W, H, false);
    camara.aspect = W / H;
    const dist = (H / 2) / Math.tan(THREE.MathUtils.degToRad(15));
    camara.position.set(0, 0, dist);
    camara.near = 10; camara.far = dist * 6;
    camara.updateProjectionMatrix();
    const mx = tel ? 16 : W * 0.055, my = tel ? 16 : H * 0.085;
    Object.assign(L, { W, H, tel, dist, retrato: H > W });
    L.bw = W - 2 * mx; L.bh = H - 2 * my;
    L.S = Math.max(L.bw / 1730, 0.36);
    L.U = Math.max(L.S, tel ? 0.6 : 0.72);          // escala mínima para textos chicos
    L.navH = Math.max(48, L.bh * 0.108);
    L.gap = 14;
    L.panelW = L.bw;
    L.panelH = L.bh - L.navH - L.gap;
    L.x0 = -L.bw / 2; L.yTop = L.bh / 2;               // mundo: y hacia arriba
    L.pTop = L.yTop - L.navH - L.gap;
    L.prof = 13 * L.S; L.bisel = 2.6 * L.S;
    compartidos.uS.value = L.S;
    dibujarPagina();
    reconstruir(performance.now() / 1000);
    escalaCanSat();
  }

  // Punto normalizado de la placa → mundo (con deriva y empuje del cursor)
  const punteroPlaca = new THREE.Vector2(9, 9);       // en coordenadas normalizadas
  function punto(id, t) {
    let [x, y] = P[id];
    const d = DERIVA[id];
    x += d.ax * Math.sin((t / d.px) * Math.PI * 2 + d.fx);
    y += d.ay * Math.sin((t / d.py) * Math.PI * 2 + d.fy);
    const dx = x - punteroPlaca.x, dy = y - punteroPlaca.y, dd = Math.hypot(dx, dy);
    if (dd < 0.6 && dd > 1e-4 && !['TL', 'TR', 'BL', 'BR'].includes(id)) {
      const empuje = 0.05 * (1 - dd / 0.6);
      x += (dx / dd) * empuje * (d.ax ? 1 : 0);
      y += (dy / dd) * empuje * (d.ay ? 1 : 0);
    }
    if (L.retrato) [x, y] = [y, x];
    return [L.x0 + x * L.panelW, L.pTop - y * L.panelH];
  }

  function formaRedondeada(pts, recorte, radio, cx, cy) {
    // Asegura sentido antihorario y recorta hacia adentro "recorte" px
    let area = 0;
    for (let i = 0; i < pts.length; i++) { const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length]; area += x1 * y2 - x2 * y1; }
    if (area < 0) pts = pts.slice().reverse();
    const n = pts.length;
    const lineas = pts.map((p, i) => {
      const q = pts[(i + 1) % n];
      const dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy) || 1;
      const nx = -dy / l, ny = dx / l;
      return { p: [p[0] + nx * recorte, p[1] + ny * recorte], d: [dx / l, dy / l] };
    });
    const v = lineas.map((b, i) => {
      const a = lineas[(i - 1 + n) % n];
      const den = a.d[0] * b.d[1] - a.d[1] * b.d[0];
      if (Math.abs(den) < 1e-6) return b.p;
      const t = ((b.p[0] - a.p[0]) * b.d[1] - (b.p[1] - a.p[1]) * b.d[0]) / den;
      return [a.p[0] + a.d[0] * t, a.p[1] + a.d[1] * t];
    });
    const forma = new THREE.Shape();
    for (let i = 0; i < n; i++) {
      const p0 = v[(i - 1 + n) % n], p1 = v[i], p2 = v[(i + 1) % n];
      const l1 = Math.hypot(p0[0] - p1[0], p0[1] - p1[1]), l2 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
      const r = Math.min(radio, l1 * 0.45, l2 * 0.45);
      const a = [p1[0] + ((p0[0] - p1[0]) / l1) * r, p1[1] + ((p0[1] - p1[1]) / l1) * r];
      const b = [p1[0] + ((p2[0] - p1[0]) / l2) * r, p1[1] + ((p2[1] - p1[1]) / l2) * r];
      if (i === 0) forma.moveTo(a[0] - cx, a[1] - cy); else forma.lineTo(a[0] - cx, a[1] - cy);
      forma.quadraticCurveTo(p1[0] - cx, p1[1] - cy, b[0] - cx, b[1] - cy);
    }
    forma.closePath();
    return forma;
  }

  function reconstruir(t) {
    const radio = 20 * L.S, recorte = L.gap * L.S / 2 + 1;
    piezas.forEach((p) => {
      let pts;
      if (p.tipo === 'nav') {
        pts = [[L.x0, L.yTop], [L.x0 + L.bw, L.yTop], [L.x0 + L.bw, L.yTop - L.navH], [L.x0, L.yTop - L.navH]];
      } else {
        pts = CELDAS[p.indice - 1].map((id) => punto(id, t));
      }
      const cx = pts.reduce((s, q) => s + q[0], 0) / pts.length;
      const cy = pts.reduce((s, q) => s + q[1], 0) / pts.length;
      p.centro.set(cx, cy);
      const forma = formaRedondeada(pts, p.tipo === 'nav' ? 1 : recorte, radio, cx, cy);
      const geo = new THREE.ExtrudeGeometry(forma, {
        depth: L.prof, bevelEnabled: true, bevelThickness: L.bisel, bevelSize: L.bisel, bevelSegments: 3, curveSegments: 7,
      });
      p.malla.geometry.dispose();
      p.malla.geometry = geo;
      const plano = new THREE.ShapeGeometry(forma, 7);
      const pos = plano.attributes.position, uv = plano.attributes.uv;
      for (let i = 0; i < pos.count; i++) {
        uv.setXY(i, (pos.getX(i) + cx - L.x0) / L.bw, (pos.getY(i) + cy - (L.yTop - L.bh)) / L.bh);
      }
      uv.needsUpdate = true;
      p.impresion.geometry.dispose();
      p.impresion.geometry = plano;
      p.impresion.position.z = L.prof + L.bisel + 0.6;
    });
  }

  // ----------------------------------------- contenido impreso en el vidrio --
  const lienzoPagina = document.createElement('canvas');
  const estadoHover = { pildora: false, enlace: false, nav: -1 };
  const capa = document.getElementById('capaTexto');
  const bloque = document.getElementById('bloque');

  function disposicion() {
    // Una sola fuente de medidas para el canvas y para la copia DOM
    const { bw, navH, gap, panelH, U, S } = L;
    const top = navH + gap;
    const tel = L.tel;
    const tamTitulo = Math.min(0.078 * bw, 0.2 * panelH) * (tel ? 1.25 : 1);
    const izq = tel ? 22 : 0.055 * bw;
    const yTitulo = top + panelH * (tel ? 0.2 : 0.26);
    const tamSub = Math.max(14, 19 * S * 1.05);
    const ySub = yTitulo + tamTitulo * 0.97 * 2 + tamTitulo * (tel ? 0.55 : 0.32);
    const yAcc = ySub + tamSub * 1.45 * 2 + 30 * U;
    return {
      nav: { y: navH / 2, fs: Math.max(13, 16 * U), marca: navH * 0.5, izq: tel ? 16 : 30 * U },
      titulo: { x: izq, y: yTitulo, fs: tamTitulo, lineas: ['Ideas que llegan', 'más alto.'] },
      sub: { x: izq, y: ySub, fs: tamSub, lineas: tel
        ? ['Sube a 450 m, se parte en dos a 200 m', 'y baja girando entre 8 y 12 m/s.']
        : ['Un CanSat que sube a 450 m, se parte en dos a 200 m', 'y baja girando como semilla entre 8 y 12 m/s.'] },
      pildora: { x: izq, y: yAcc, w: 138 * U, h: 46 * U, fs: 15 * U },
      enlace: { x: izq + 138 * U + 12 * U, y: yAcc, w: 150 * U, h: 46 * U, fs: 15 * U },
      pie: { y: top + panelH - 26 * U, fs: Math.max(11, 12 * U), izq: izq, der: bw - (tel ? 22 : 0.04 * bw) },
      enlacesNav: tel ? [] : ['Prototipo', 'Por dentro', 'Separación', 'Telemetría'],
    };
  }

  function dibujarPagina() {
    const dpr = Math.max(1.5, Math.min(2, devicePixelRatio || 1));
    lienzoPagina.width = Math.round(L.bw * dpr);
    lienzoPagina.height = Math.round(L.bh * dpr);
    const g = lienzoPagina.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, L.bw, L.bh);
    const D = disposicion();
    g.textBaseline = 'middle';

    // Nav: sello + nombre, enlaces y "Panel en vivo"
    const n = D.nav;
    if (emblema) g.drawImage(emblema, n.izq, n.y - n.marca / 2, n.marca, n.marca);
    g.font = `800 ${n.fs * 1.12}px "Archivo Variable"`;
    g.fillStyle = '#f2f4fa';
    g.letterSpacing = '0.18em';
    const xNombre = n.izq + n.marca + 10 * L.U;
    g.fillText('ZÉNIT', xNombre, n.y + 1);
    g.letterSpacing = '0px';
    g.font = `500 ${n.fs}px "Archivo Variable"`;
    let x = L.bw * 0.34;
    const posNav = [];
    D.enlacesNav.forEach((t, i) => {
      g.fillStyle = estadoHover.nav === i ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.6)';
      g.fillText(t, x, n.y);
      posNav.push({ x, w: g.measureText(t).width });
      x += g.measureText(t).width + 34 * L.U;
    });
    g.textAlign = 'right';
    g.fillStyle = estadoHover.nav === 9 ? '#36d67e' : 'rgba(255,255,255,0.9)';
    g.font = `600 ${n.fs}px "Archivo Variable"`;
    g.fillText('Panel en vivo', L.bw - n.izq, n.y);
    const wPanel = g.measureText('Panel en vivo').width;
    g.textAlign = 'left';

    // Titular con degradado vertical plateado
    const T = D.titulo;
    g.font = `600 ${T.fs}px "Archivo Variable"`;
    g.letterSpacing = `${-0.045 * T.fs}px`;
    g.textBaseline = 'top';
    T.lineas.forEach((l, i) => {
      const y = T.y + i * T.fs * 0.97;
      const grad = g.createLinearGradient(0, y, 0, y + T.fs);
      grad.addColorStop(0, '#dcdce0'); grad.addColorStop(1, '#bdbdc3');
      g.fillStyle = grad;
      g.fillText(l, T.x, y);
    });
    g.letterSpacing = '0px';

    // Subtítulo
    const Sb = D.sub;
    g.font = `400 ${Sb.fs}px "Archivo Variable"`;
    g.fillStyle = 'rgba(255,255,255,0.55)';
    Sb.lineas.forEach((l, i) => g.fillText(l, Sb.x, Sb.y + i * Sb.fs * 1.45));

    // Píldora (se vuelve verde con el cursor) y enlace
    const Pi = D.pildora;
    g.fillStyle = estadoHover.pildora ? '#36d67e' : '#eef0f5';
    g.beginPath(); g.roundRect(Pi.x, Pi.y, Pi.w, Pi.h, 6 * L.U); g.fill();
    g.fillStyle = '#0b0d12';
    g.font = `600 ${Pi.fs}px "Archivo Variable"`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('Abrir panel', Pi.x + Pi.w / 2, Pi.y + Pi.h / 2 + 1);
    g.textAlign = 'left';
    // Botón secundario: vidrio con contorno (se ilumina con el cursor)
    const E = D.enlace;
    g.beginPath(); g.roundRect(E.x + 0.5, E.y + 0.5, E.w - 1, E.h - 1, 6 * L.U);
    g.fillStyle = estadoHover.enlace ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)';
    g.fill();
    g.lineWidth = Math.max(1, L.U);
    g.strokeStyle = estadoHover.enlace ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.26)';
    g.stroke();
    g.font = `600 ${E.fs}px "Archivo Variable"`;
    g.fillStyle = '#ffffff';
    g.textAlign = 'center';
    g.fillText('Ver la misión', E.x + E.w / 2, E.y + E.h / 2 + 1);
    g.textAlign = 'left';
    const wEnlace = E.w;

    // Logo original impreso en el lado derecho de la placa (en teléfono no cabe)
    if (logoCompleto && !L.tel) {
      const alto = L.panelH * 0.8;
      const ancho = alto * (790 / 1120);
      const cx = L.bw * 0.74, cy = L.navH + L.gap + L.panelH * 0.5;
      g.globalAlpha = 0.92;
      g.drawImage(logoCompleto, cx - ancho / 2, cy - alto / 2, ancho, alto);
      g.globalAlpha = 1;
    }

    // Pie de la placa
    const Pf = D.pie;
    g.font = `400 ${Pf.fs}px "Archivo Variable"`;
    g.fillStyle = 'rgba(255,255,255,0.34)';
    g.fillText('© Equipo Zénit · PEU-UM', Pf.izq, Pf.y);
    g.textAlign = 'right';
    g.fillText('CASAT-FIT2026 · LoRa 915 MHz', Pf.der, Pf.y);
    g.textAlign = 'left';

    if (!textura) {
      textura = new THREE.CanvasTexture(lienzoPagina);
      textura.colorSpace = THREE.SRGBColorSpace;
      textura.anisotropy = renderer.capabilities.getMaxAnisotropy();
      piezas.forEach((p) => { p.impresion.material.map = textura; p.impresion.material.needsUpdate = true; });
    } else {
      textura.image = lienzoPagina;
      textura.needsUpdate = true;
    }
    colocarDom(D, posNav, xNombre, wPanel, wEnlace);
  }

  // Copia DOM con las mismas medidas (para seleccionar texto y hacer clic)
  function colocarDom(D, posNav, xNombre, wPanel, wEnlace) {
    bloque.style.width = `${L.bw}px`;
    bloque.style.height = `${L.bh}px`;
    const est = (sel, o) => { const el = bloque.querySelector(sel); if (el) Object.assign(el.style, o); return el; };
    const n = D.nav;
    est('.nav-marca', { left: `${n.izq}px`, top: `${n.y - n.marca / 2}px`, height: `${n.marca}px`, lineHeight: `${n.marca}px`, fontSize: `${n.fs * 1.12}px`, paddingLeft: `${xNombre - n.izq}px`, letterSpacing: '0.18em', fontWeight: 800 });
    const enlaces = bloque.querySelectorAll('.nav-enlaces a');
    enlaces.forEach((a, i) => {
      const p = posNav[i];
      Object.assign(a.style, p
        ? { display: 'block', left: `${p.x}px`, top: `${n.y - n.fs}px`, height: `${n.fs * 2}px`, lineHeight: `${n.fs * 2}px`, fontSize: `${n.fs}px`, width: `${p.w}px` }
        : { display: 'none' });
    });
    est('.nav-panel', { left: `${L.bw - n.izq - wPanel}px`, top: `${n.y - n.fs}px`, height: `${n.fs * 2}px`, lineHeight: `${n.fs * 2}px`, fontSize: `${n.fs}px`, fontWeight: 600 });
    const T = D.titulo;
    est('.heroe-titulo', { left: `${T.x}px`, top: `${T.y}px`, fontSize: `${T.fs}px`, lineHeight: 0.97, letterSpacing: '-0.045em', fontWeight: 600, fontStretch: '100%' });
    const Sb = D.sub;
    // en el canvas el subtítulo se dibuja con textBaseline "top"
    est('.heroe-sub', { left: `${Sb.x}px`, top: `${Sb.y - Sb.fs * 0.2}px`, fontSize: `${Sb.fs}px`, lineHeight: 1.45 });
    bloque.querySelectorAll('.heroe-sub span').forEach((s, i) => { s.textContent = Sb.lineas[i] || ''; });
    const Pi = D.pildora;
    est('.pildora', { left: `${Pi.x}px`, top: `${Pi.y}px`, width: `${Pi.w}px`, height: `${Pi.h}px`, lineHeight: `${Pi.h}px`, fontSize: `${Pi.fs}px`, textAlign: 'center', borderRadius: `${6 * L.U}px` });
    const E = D.enlace;
    est('.enlace-mision', { left: `${E.x}px`, top: `${E.y}px`, height: `${E.h}px`, lineHeight: `${E.h}px`, fontSize: `${E.fs}px`, width: `${wEnlace}px`, textAlign: 'center', borderRadius: `${6 * L.U}px` });
    const Pf = D.pie;
    est('.pie-izq', { left: `${Pf.izq}px`, top: `${Pf.y - Pf.fs}px`, fontSize: `${Pf.fs}px`, lineHeight: `${Pf.fs * 2}px` });
    est('.pie-der', { right: `${L.bw - Pf.der}px`, left: 'auto', top: `${Pf.y - Pf.fs}px`, fontSize: `${Pf.fs}px`, lineHeight: `${Pf.fs * 2}px` });
  }

  let paginaSucia = false;
  const hover = (sel, clave, valor = true) => {
    const el = bloque.querySelector(sel);
    el.addEventListener('pointerenter', () => { estadoHover[clave] = valor; paginaSucia = true; });
    el.addEventListener('pointerleave', () => { estadoHover[clave] = clave === 'nav' ? -1 : false; paginaSucia = true; });
  };
  hover('.pildora', 'pildora');
  hover('.enlace-mision', 'enlace');
  hover('.nav-panel', 'nav', 9);
  bloque.querySelectorAll('.nav-enlaces a').forEach((a, i) => {
    a.addEventListener('pointerenter', () => { estadoHover.nav = i; paginaSucia = true; });
    a.addEventListener('pointerleave', () => { estadoHover.nav = -1; paginaSucia = true; });
  });

  // ----------------------------------------------------------- el CanSat --
  const cansat = crearCanSat({ calidad: 'alta' });
  const soporte = new THREE.Group();
  soporte.add(cansat.grupo);
  escena.add(soporte);
  function escalaCanSat() { soporte.userData.base = (L.H * (L.tel ? 0.42 : 0.6)) / cansat.medidas.ALTO; }

  // Estrellas y el arco azul del horizonte (como en el logo)
  const nEst = 1400;
  const posEst = new Float32Array(nEst * 3);
  for (let i = 0; i < nEst; i++) {
    posEst[i * 3] = (Math.random() - 0.5) * 6000;
    posEst[i * 3 + 1] = (Math.random() - 0.5) * 4000;
    posEst[i * 3 + 2] = -800 - Math.random() * 2400;
  }
  const geoEst = new THREE.BufferGeometry();
  geoEst.setAttribute('position', new THREE.BufferAttribute(posEst, 3));
  const estrellas = new THREE.Points(geoEst, new THREE.PointsMaterial({ color: 0xdfe8ff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0.8, depthWrite: false }));
  escena.add(estrellas);

  const tierra = new THREE.Group();
  const radioTierra = 4200;
  const disco = new THREE.Mesh(new THREE.CircleGeometry(radioTierra, 160), new THREE.MeshBasicMaterial({ color: 0x02040a }));
  const arco = new THREE.Mesh(new THREE.TorusGeometry(radioTierra, 5, 8, 260), new THREE.MeshBasicMaterial({ color: 0x3b7bff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
  const halo = new THREE.Mesh(new THREE.TorusGeometry(radioTierra + 10, 60, 8, 260), new THREE.MeshBasicMaterial({ color: 0x2f6bff, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }));
  tierra.add(disco, halo, arco);
  tierra.position.z = -900;
  escena.add(tierra);

  // Etiquetas de la vista explotada
  const capaEtiquetas = document.getElementById('etiquetas');
  const ETIQUETAS = ['autogiro', 'gps', 'heltec', 'gy91', 'openlog', 'pila', 'servo-desacople', 'huevo1', 'esp32c3', 'neo6m', 'huevo2'];
  const etiquetas = ETIQUETAS.map((id) => {
    const p = cansat.piezas.find((q) => q.id === id);
    const el = document.createElement('div');
    el.className = 'etiqueta';
    el.innerHTML = `<b>${p.nombre}</b><small>${p.detalle}</small>`;
    capaEtiquetas.append(el);
    return { p, el };
  });

  // Fotogramas del recorrido (s = sección + avance dentro de la sección)
  const FOTOS = [
    { s: 0, x: 0, y: 0, e: 0.85, z: -900, spin: 0.25, tilt: 0, ex: 0, cub: 1, sep: 0, des: 0, rv: 0, est: 0.15, tierra: 0, et: 0 },
    { s: 1, x: 0.17, y: -0.01, e: 1, z: 0, spin: 0.3, tilt: 0.05, ex: 0, cub: 1, sep: 0, des: 0, rv: 0, est: 0.1, tierra: 0, et: 0 },
    { s: 2, x: 0.16, y: 0, e: 0.88, z: 0, spin: 0.12, tilt: 0.1, ex: 0, cub: 1, sep: 0, des: 0, rv: 0, est: 0.05, tierra: 0, et: 0 },
    { s: 2.35, x: 0.21, y: -0.04, e: 0.56, z: 0, spin: 0.05, tilt: 0.18, ex: 1, cub: 0.1, sep: 0, des: 0, rv: 0, est: 0.05, tierra: 0, et: 1 },
    { s: 2.8, x: 0.21, y: -0.04, e: 0.56, z: 0, spin: 0.05, tilt: 0.18, ex: 1, cub: 0.1, sep: 0, des: 0, rv: 0, est: 0.05, tierra: 0, et: 1 },
    { s: 3, x: -0.18, y: 0, e: 0.9, z: 0, spin: 0.2, tilt: 0.06, ex: 0, cub: 1, sep: 0, des: 0, rv: 0, est: 1.6, tierra: 0, et: 0 },
    { s: 3.85, x: -0.18, y: 0, e: 0.9, z: 0, spin: 0.15, tilt: -0.1, ex: 0, cub: 1, sep: 0, des: 0, rv: 0, est: 0.3, tierra: 0, et: 0 },
    { s: 4, x: 0.2, y: 0.04, e: 0.8, z: 0, spin: 0.1, tilt: 0.05, ex: 0, cub: 1, sep: 0, des: 0, rv: 0, est: -0.6, tierra: 0, et: 0 },
    { s: 4.45, x: 0.2, y: 0.08, e: 0.8, z: 0, spin: 0.1, tilt: 0.05, ex: 0, cub: 1, sep: 0.75, des: 0, rv: 0, est: -1, tierra: 0, et: 0 },
    { s: 4.7, x: 0.2, y: 0.1, e: 0.8, z: 0, spin: 0.1, tilt: 0.05, ex: 0, cub: 1, sep: 1, des: 1, rv: 9, est: -1, tierra: 0, et: 0 },
    { s: 5, x: -0.17, y: 0.06, e: 0.78, z: 0, spin: 0.05, tilt: 0.04, ex: 0, cub: 1, sep: 1, des: 1, rv: 10, est: -0.8, tierra: 0.25, et: 0 },
    { s: 5.75, x: -0.17, y: 0.02, e: 0.7, z: 0, spin: 0.03, tilt: 0, ex: 0, cub: 1, sep: 1, des: 1, rv: 0.4, est: -0.1, tierra: 0.72, et: 0 },
    { s: 6, x: 0.34, y: 0.16, e: 0.42, z: -300, spin: 0.2, tilt: 0.08, ex: 0, cub: 1, sep: 1, des: 1, rv: 1.2, est: 0.05, tierra: 0.62, et: 0 },
  ];
  function fotograma(s) {
    let i = 0;
    while (i < FOTOS.length - 2 && s > FOTOS[i + 1].s) i++;
    const a = FOTOS[i], b = FOTOS[i + 1];
    const t = suave(clamp((s - a.s) / (b.s - a.s), 0, 1));
    const r = {};
    Object.keys(a).forEach((k) => { r[k] = lerp(a[k], b[k], t); });
    return r;
  }

  const secciones = [...document.querySelectorAll('[data-escena]')];
  function avanceHistoria() {
    // s = i cuando el borde superior de la sección i llega a la mitad de la pantalla
    const mitad = innerHeight * 0.5;
    const marcas = [{ s: 0, y: -mitad }].concat(secciones.map((el) => ({ s: Number(el.dataset.escena), y: el.getBoundingClientRect().top + scrollY - mitad })));
    const y = scrollY;
    for (let i = marcas.length - 1; i >= 0; i--) {
      if (y >= marcas[i].y) {
        const sig = marcas[i + 1];
        return sig ? marcas[i].s + (y - marcas[i].y) / (sig.y - marcas[i].y) : marcas[i].s;
      }
    }
    return 0;
  }

  // ----------------------------------------------------------- interacción --
  const puntero = { x: 0, y: 0, dentro: false, ndc: new THREE.Vector2(9, 9) };
  addEventListener('pointermove', (ev) => {
    puntero.x = (ev.clientX / innerWidth) * 2 - 1;
    puntero.y = -((ev.clientY / innerHeight) * 2 - 1);
    puntero.ndc.set(puntero.x, puntero.y);
    puntero.dentro = true;
  }, { passive: true });
  document.addEventListener('pointerleave', () => { puntero.dentro = false; });
  addEventListener('blur', () => { puntero.dentro = false; });

  const rayo = new THREE.Raycaster();
  const inclinacion = { x: 0, y: 0 };
  let entradaInicio = null;
  const empezar = () => { entradaInicio = performance.now() / 1000; };
  if (window.zenitIntroTerminada) empezar(); else addEventListener('zenit:intro-fin', empezar, { once: true });

  new ResizeObserver(medir).observe(lienzo);
  medir();

  const ticker = document.getElementById('ticker');
  const contador = document.getElementById('contadorAltura');
  let previo = performance.now() / 1000, ultimoCorte = 0, giroModelo = 0, giroRotor = 0;
  const v3 = new THREE.Vector3();
  const quatTip = new THREE.Quaternion(), quatVuelo = new THREE.Quaternion(), eulerTip = new THREE.Euler();
  const resorte = (r, meta, dt, k = 170, c = 19) => {
    for (let i = 0; i < 2; i++) { const h = dt / 2; r.v += (k * (meta - r.x) - c * r.v) * h; r.x += r.v * h; }
  };

  function cuadro() {
    requestAnimationFrame(cuadro);
    const ahora = performance.now() / 1000;
    const dt = Math.min(1 / 30, ahora - previo);
    previo = ahora;
    if (document.hidden) return;

    // Estallido: ligado al scroll (y a la entrada al cargar)
    const pScroll = clamp(scrollY / (innerHeight * 0.7), 0, 1);
    const tEntrada = entradaInicio === null ? -1 : ahora - entradaInicio;
    const hayVidrio = pScroll < 0.999 || tEntrada < 1.2;

    // Inclinación global (como si presionaras la placa en el puntero)
    const metaY = puntero.dentro ? puntero.x * 7 - 1.2 : -1.2;
    const metaX = puntero.dentro ? -puntero.y * 5.5 + 0.8 : 0.8;
    const k = 1 - Math.exp(-dt / 0.3);
    inclinacion.y += (metaY - inclinacion.y) * k;
    inclinacion.x += (metaX - inclinacion.x) * k;
    losa.rotation.set(THREE.MathUtils.degToRad(inclinacion.x), THREE.MathUtils.degToRad(inclinacion.y), 0);
    losa.updateMatrixWorld(true);

    // Puntero sobre la placa (coordenadas normalizadas y mundo)
    let encima = null;
    if (hayVidrio) {
      rayo.setFromCamera(puntero.ndc, camara);
      const plano = new THREE.Plane(new THREE.Vector3(0, 0, 1).applyQuaternion(losa.quaternion), 0);
      plano.constant = -plano.normal.dot(v3.set(0, 0, L.prof).applyMatrix4(losa.matrixWorld));
      const hit = rayo.ray.intersectPlane(plano, new THREE.Vector3());
      if (hit && puntero.dentro) {
        compartidos.uPuntero.value.copy(hit);
        const local = losa.worldToLocal(hit.clone());
        let nx = (local.x - L.x0) / L.panelW, ny = (L.pTop - local.y) / L.panelH;
        if (L.retrato) [nx, ny] = [ny, nx];
        punteroPlaca.set(nx, ny);
      } else punteroPlaca.set(9, 9);
      const brilloMeta = puntero.dentro && pScroll < 0.05 ? 1 : 0;
      compartidos.uBrillo.value += (brilloMeta - compartidos.uBrillo.value) * (1 - Math.exp(-dt / 0.25));
      if (pScroll < 0.05 && tEntrada > 0.9 && puntero.dentro) {
        const r = rayo.intersectObjects(piezas.map((p) => p.malla), false)[0];
        encima = r ? r.object.userData.pieza : null;
      }
      if (ahora - ultimoCorte > 1 / 45) { reconstruir(ahora); ultimoCorte = ahora; }
      if (paginaSucia) { paginaSucia = false; dibujarPagina(); }
    }

    piezas.forEach((p, orden) => {
      // levantar y ladear la pieza bajo el puntero (resortes k 170, c 19)
      const activo = p === encima;
      const metaLift = activo ? (p.tipo === 'nav' ? 32 : 50) * L.S : 0;
      let metaTx = 0, metaTy = 0;
      if (activo) {
        const local = losa.worldToLocal(compartidos.uPuntero.value.clone());
        const ext = p.tipo === 'nav' ? L.bw / 2 : Math.max(L.panelW, L.panelH) / 3;
        const dx = clamp((local.x - p.centro.x) / ext, -1, 1), dy = clamp((local.y - p.centro.y) / ext, -1, 1);
        metaTy = dx * 0.24; metaTx = -dy * 0.24;
      }
      resorte(p.lift, metaLift, dt); resorte(p.tipX, metaTx, dt); resorte(p.tipY, metaTy, dt);
      p.hover += ((activo ? 1 : 0) - p.hover) * (1 - Math.exp(-dt / 0.15));
      p.malla.material.iridescence = 0.55 + 0.45 * p.hover;
      p.malla.material.envMapIntensity = 1 + 0.9 * p.hover;

      // vuelo: τ por pieza, nav primero, 30 ms entre piezas
      const retraso = orden * 0.03;
      const tauScroll = clamp(pScroll * 1.25 - orden * 0.04, 0, 1);
      let tauEntrada = 1;
      if (tEntrada >= 0) tauEntrada = 1 - salidaRebote(clamp((tEntrada - retraso) / 0.72, 0, 1));
      const tau = Math.max(tauScroll, tauEntrada);
      // τ < 0 solo ocurre en el rebote de la entrada: se pasa un poco y regresa
      const t = tau >= 0 ? entradaCubica(tau) * 0.72 : tau * 0.4;
      const dir = v3.set(p.centro.x, p.centro.y, 0).normalize();
      const ox = dir.x * p.velAfuera * L.S * 1.8 * t;
      const oy = dir.y * p.velAfuera * L.S * 1.8 * t - p.abajo * L.S * t - 0.5 * 1400 * L.S * t * t;
      const oz = p.velZ * L.S * 1.8 * t;
      p.grupo.position.set(p.centro.x + ox, p.centro.y + oy, p.lift.x + oz);
      eulerTip.set(p.tipX.x, p.tipY.x, 0);
      quatTip.setFromEuler(eulerTip);
      quatVuelo.setFromAxisAngle(p.eje, p.giro * t / 0.72);
      p.grupo.quaternion.copy(quatVuelo).multiply(quatTip);
      p.grupo.visible = tau < 0.995;
    });

    // Capa DOM: proyectar las 4 esquinas de la placa (homografía → matrix3d)
    const disperso = pScroll > 0.02 || tEntrada < 0.75;
    capa.classList.toggle('disperso', disperso);
    if (!disperso) proyectarDom();

    // ---------------------------------------------------- recorrido CanSat
    const s = avanceHistoria();
    const F = fotograma(s);
    giroModelo += F.spin * dt;
    giroRotor += F.rv * dt;
    const base = soporte.userData.base || 10;
    const parallaxX = puntero.dentro ? puntero.x * 0.18 : 0, parallaxY = puntero.dentro ? puntero.y * 0.08 : 0;
    soporte.position.set(L.tel ? 0 : F.x * L.W, F.y * L.H + (L.tel ? L.H * 0.12 : 0), F.z);
    soporte.scale.setScalar(base * F.e);
    soporte.rotation.set(F.tilt - parallaxY, giroModelo + parallaxX - 0.5, F.tilt * 0.4);
    cansat.actualizar({ explosion: F.ex, cubierta: F.cub, separacion: F.sep, despliegue: F.des, giro: giroRotor });

    // estrellas: suben o bajan según la fase (sensación de altura)
    const arr = geoEst.attributes.position.array;
    const vel = F.est * 420 * dt;
    for (let i = 0; i < nEst; i++) {
      arr[i * 3 + 1] -= vel;
      if (arr[i * 3 + 1] < -2000) arr[i * 3 + 1] += 4000;
      if (arr[i * 3 + 1] > 2000) arr[i * 3 + 1] -= 4000;
    }
    geoEst.attributes.position.needsUpdate = true;
    tierra.position.y = -radioTierra - L.H * 1.1 + F.tierra * L.H * 1.25;
    tierra.visible = F.tierra > 0.01;

    // etiquetas de la vista explotada
    etiquetas.forEach(({ p, el }) => {
      if (F.et < 0.02) { el.style.opacity = '0'; return; }
      p.obj.getWorldPosition(v3);
      v3.project(camara);
      const x = (v3.x * 0.5 + 0.5) * L.W, y = (-v3.y * 0.5 + 0.5) * L.H;
      const izq = x < soporte.position.x + L.W / 2;
      el.classList.toggle('izq', izq);
      el.style.transform = `translate(${izq ? `calc(${x}px - 100%)` : `${x}px`}, ${y - 8}px)`;
      el.style.opacity = String(F.et);
    });

    if (contador) contador.textContent = Math.round(450 * clamp((s - 3) / 0.85, 0, 1));
    if (ticker) ticker.style.transform = `translateY(${-clamp(s - 4.8, 0, 1.2) * 260}px)`;

    renderer.render(escena, camara);
  }

  function proyectarDom() {
    const z = L.prof + L.bisel;
    const esquinas = [[L.x0, L.yTop], [L.x0 + L.bw, L.yTop], [L.x0 + L.bw, L.yTop - L.bh], [L.x0, L.yTop - L.bh]]
      .map(([x, y]) => {
        v3.set(x, y, z).applyMatrix4(losa.matrixWorld).project(camara);
        return [(v3.x * 0.5 + 0.5) * L.W, (-v3.y * 0.5 + 0.5) * L.H];
      });
    bloque.style.transform = homografia(L.bw, L.bh, esquinas);
  }

  requestAnimationFrame(cuadro);
}

// Rectángulo (0,0)-(w,h) → cuadrilátero q (TL, TR, BR, BL) como matrix3d
function homografia(w, h, q) {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  let a, b, c, d, e, f, g, hh;
  if (Math.abs(dx3) < 1e-9 && Math.abs(dy3) < 1e-9) {
    a = x1 - x0; b = x2 - x1; c = x0; d = y1 - y0; e = y2 - y1; f = y0; g = 0; hh = 0;
  } else {
    const det = dx1 * dy2 - dx2 * dy1;
    g = (dx3 * dy2 - dx2 * dy3) / det;
    hh = (dx1 * dy3 - dx3 * dy1) / det;
    a = x1 - x0 + g * x1; b = x3 - x0 + hh * x3; c = x0;
    d = y1 - y0 + g * y1; e = y3 - y0 + hh * y3; f = y0;
  }
  a /= w; d /= w; g /= w; b /= h; e /= h; hh /= h;
  return `matrix3d(${a},${d},0,${g},${b},${e},0,${hh},0,0,1,0,${c},${f},0,1)`;
}

// Logo con el negro convertido en transparencia: el sello del nav (solo el
// emblema) y el logo completo que va impreso en la portada.
async function cargarLogos() {
  try {
    const img = new Image();
    img.src = '/logo-zenit.jpeg';
    await img.decode();
    return {
      emblema: recorteSinNegro(img, 128, 150, 830, 830, 256, 256),
      completo: recorteSinNegro(img, 150, 170, 790, 1120, 790, 1120),
    };
  } catch { return { emblema: null, completo: null }; }
}

function recorteSinNegro(img, sx, sy, sw, sh, w, h) {
  {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
    const datos = g.getImageData(0, 0, w, h);
    const p = datos.data;
    for (let i = 0; i < p.length; i += 4) {
      const m = Math.max(p[i], p[i + 1], p[i + 2]);
      p[i + 3] = m;
      if (m > 0) { const k = 255 / m; p[i] = Math.min(255, p[i] * k); p[i + 1] = Math.min(255, p[i + 1] * k); p[i + 2] = Math.min(255, p[i + 2] * k); }
    }
    g.putImageData(datos, 0, 0);
    return c;
  }
}
