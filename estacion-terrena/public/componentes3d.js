// =============================================================================
//  componentes3d.js — Componentes con detalle, a la medida exacta del CAD
//
//  En el CAD los componentes comprados son cajas con su medida real. Aquí cada
//  caja se cambia por un componente bonito del MISMO tamaño y en el MISMO
//  lugar: la Heltec con su pantalla encendida, la pila con su etiqueta, los
//  servos con su brazo, los GPS con su antena cerámica, etc.
//
//  const det = crearComponente('heltec', cajaWeb, { calidad });  // → { obj, brazo? }
//  cajaWeb: THREE.Box3 de la pieza del CAD (cm, eje Y arriba). obj queda
//  centrado en su origen: se coloca en el centro de esa caja.
// =============================================================================
import * as THREE from 'three';

const v = (x, y, z) => new THREE.Vector3(x, y, z);

// ----------------------------------------------------- texturas en canvas --
function lienzo(w, h, dibujar) {
  const c = document.createElement('canvas');
  c.width = Math.max(8, Math.round(w)); c.height = Math.max(8, Math.round(h));
  dibujar(c.getContext('2d'), c.width, c.height);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// Cara de una placa: máscara, pistas, vías, chips, hileras de pines y letrero
function texturaPCB({ base, ancho, fondo, chips = [], texto = '', pines = 'dos', serigrafia = [] }) {
  const px = 110;                                   // pixeles por cm
  return lienzo(ancho * px, fondo * px, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    const sombra = g.createRadialGradient(w * 0.3, h * 0.3, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.8);
    sombra.addColorStop(0, 'rgba(255,255,255,0.06)'); sombra.addColorStop(1, 'rgba(0,0,0,0.18)');
    g.fillStyle = sombra; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,0.10)'; g.lineWidth = 2;
    let semilla = (ancho * 97 + fondo * 31) | 0;
    const azar = () => ((semilla = (semilla * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 22; i++) {
      let x = azar() * w, y = azar() * h;
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 3; k++) { if (k % 2) x += (azar() - 0.5) * w * 0.5; else y += (azar() - 0.5) * h * 0.5; g.lineTo(x, y); }
      g.stroke();
    }
    g.fillStyle = 'rgba(214,184,96,0.6)';
    for (let i = 0; i < 30; i++) { g.beginPath(); g.arc(azar() * w, azar() * h, 2.4, 0, Math.PI * 2); g.fill(); }
    // agujeros de montaje
    [[0.06, 0.1], [0.94, 0.1], [0.06, 0.9], [0.94, 0.9]].forEach(([fx, fy]) => {
      if (ancho < 2.4) return;
      g.fillStyle = '#d9b45a'; g.beginPath(); g.arc(fx * w, fy * h, 11, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#0b0b0d'; g.beginPath(); g.arc(fx * w, fy * h, 6, 0, Math.PI * 2); g.fill();
    });
    const fila = (y) => {
      for (let x = 30; x < w - 26; x += 27.9) {
        g.fillStyle = '#d9b45a'; g.beginPath(); g.arc(x, y, 8, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#1b1b1d'; g.beginPath(); g.arc(x, y, 3.4, 0, Math.PI * 2); g.fill();
      }
    };
    if (pines !== 'no') { fila(16); if (pines === 'dos') fila(h - 16); }
    chips.forEach(([cx, cy, cw, ch, color = '#141518']) => {
      const x = cx * w, y = cy * h, ww = cw * w, hh = ch * h;
      g.fillStyle = '#b9bcc4';
      for (let p = 4; p < ww - 4; p += 7) { g.fillRect(x + p, y - 3, 3, 4); g.fillRect(x + p, y + hh - 1, 3, 4); }
      g.fillStyle = color; g.fillRect(x, y, ww, hh);
      g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(x, y, ww, hh * 0.18);
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.arc(x + 7, y + 7, 2.5, 0, Math.PI * 2); g.fill();
    });
    // resistencias y capacitores pequeños
    for (let i = 0; i < 14; i++) {
      const x = azar() * w * 0.9 + w * 0.05, y = azar() * h * 0.7 + h * 0.15;
      g.fillStyle = azar() < 0.5 ? '#2b2b2e' : '#b88a52'; g.fillRect(x, y, 10, 5);
      g.fillStyle = '#c9ccd3'; g.fillRect(x - 2, y, 2, 5); g.fillRect(x + 10, y, 2, 5);
    }
    serigrafia.forEach(([t, fx, fy, tam = 0.09]) => {
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.font = `600 ${Math.round(Math.min(w, h) * tam)}px "Archivo Variable", sans-serif`;
      g.fillText(t, fx * w, fy * h);
    });
    if (texto) {
      g.fillStyle = 'rgba(255,255,255,0.88)';
      g.font = `700 ${Math.round(Math.min(w, h) * 0.14)}px "Archivo Variable", sans-serif`;
      g.fillText(texto, w * 0.08, h * 0.62);
    }
  });
}

// Pantalla OLED de la Heltec, encendida
function texturaOled() {
  return lienzo(256, 128, (g, w, h) => {
    g.fillStyle = '#02060f'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#8fd0ff';
    g.font = '800 30px "Archivo Variable", sans-serif';
    g.fillText('ZÉNIT', 14, 38);
    g.font = '500 20px "JetBrains Mono Variable", monospace';
    g.fillText('h 450.0 m', 14, 72);
    g.fillText('LoRa  OK', 14, 102);
    g.fillRect(170, 18, 70, 6);
    g.fillRect(170, 30, 48, 6);
  });
}

// Etiqueta de la pila de 9 V: a lo largo (el borne queda a la derecha)
function texturaPila() {
  return lienzo(512, 280, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#0b0c0f'); gr.addColorStop(0.5, '#262a32'); gr.addColorStop(1, '#0b0c0f');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const oro = g.createLinearGradient(0, 0, 0, h);
    oro.addColorStop(0, '#8a6a22'); oro.addColorStop(0.5, '#f3d47c'); oro.addColorStop(1, '#8a6a22');
    g.fillStyle = oro; g.fillRect(w * 0.8, 0, w * 0.2, h);
    g.fillStyle = '#e8c76c';
    g.font = '800 128px "Archivo Variable", sans-serif';
    g.textBaseline = 'middle';
    g.fillText('9V', w * 0.12, h * 0.52);
    g.fillStyle = 'rgba(232,199,108,0.75)';
    g.font = '600 30px "Archivo Variable", sans-serif';
    g.fillText('LITHIUM', w * 0.46, h * 0.42);
    g.fillText('+  −', w * 0.46, h * 0.66);
  });
}

function texturaPoros() {
  const t = lienzo(256, 256, (g, w, h) => {
    g.fillStyle = '#9a9a9a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1800; i++) {
      g.fillStyle = `rgba(0,0,0,${0.1 + Math.random() * 0.35})`;
      g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 0.6 + Math.random() * 2.2, 0, Math.PI * 2); g.fill();
    }
  });
  t.colorSpace = THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 3);
  return t;
}

// ---------------------------------------------------------------- materiales
let compartidos = null;
function materiales(calidad) {
  if (compartidos && compartidos.calidad === calidad) return compartidos;
  const alta = calidad === 'alta';
  const fisico = (o) => (alta ? new THREE.MeshPhysicalMaterial(o) : new THREE.MeshStandardMaterial(o));
  compartidos = {
    calidad,
    oro: new THREE.MeshStandardMaterial({ color: 0xd9b45a, metalness: 1, roughness: 0.3 }),
    plasticoNegro: new THREE.MeshStandardMaterial({ color: 0x141518, roughness: 0.55 }),
    plasticoBlanco: new THREE.MeshStandardMaterial({ color: 0xf1f2f4, roughness: 0.5 }),
    blindaje: new THREE.MeshStandardMaterial({ color: 0xc9ccd3, metalness: 1, roughness: 0.35 }),
    acero: new THREE.MeshStandardMaterial({ color: 0xb9bfc8, metalness: 1, roughness: 0.3 }),
    ceramica: new THREE.MeshStandardMaterial({ color: 0xd8c39a, roughness: 0.75 }),
    plata: new THREE.MeshStandardMaterial({ color: 0xdfe2e8, metalness: 1, roughness: 0.25 }),
    servo: fisico({ color: 0x2c63e8, roughness: 0.18, transparent: true, opacity: 0.9, ...(alta ? { clearcoat: 1 } : {}) }),
    pilaLado: new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: 0.4, metalness: 0.4 }),
    espuma: new THREE.MeshStandardMaterial({ color: 0xe3c24a, roughness: 1, bumpMap: texturaPoros(), bumpScale: 0.08 }),
  };
  return compartidos;
}

// ------------------------------------------------------------- utilidades --
function malla(geo, mat) { const m = new THREE.Mesh(geo, mat); m.castShadow = true; return m; }
function en(obj, x, y, z) { obj.position.set(x, y, z); return obj; }
function caja(a, b, c, mat) { return malla(new THREE.BoxGeometry(a, b, c), mat); }

// Losa de placa de ancho (x) × fondo (z); la cara con textura mira arriba
// (o abajo si boca abajo). Devuelve la malla con su borde del color de la máscara.
function losa(ancho, fondo, opciones, bocaAbajo = false, grueso = 0.16) {
  const borde = new THREE.MeshStandardMaterial({ color: opciones.base, roughness: 0.55, metalness: 0.1 });
  const cara = new THREE.MeshStandardMaterial({ map: texturaPCB({ ancho, fondo, ...opciones }), roughness: 0.45, metalness: 0.15 });
  const mats = [borde, borde, bocaAbajo ? borde : cara, bocaAbajo ? cara : borde, borde, borde];
  if (bocaAbajo && cara.map) { cara.map.flipY = false; cara.map.needsUpdate = true; }
  return malla(new THREE.BoxGeometry(ancho, grueso, fondo), mats);
}

// Hilera de pines dorados (a lo largo de x), con su barra de plástico
function hileraPines(M, largo, haciaAbajo = true, alto = 0.6) {
  const g = new THREE.Group();
  const n = Math.max(2, Math.floor(largo / 0.254));
  g.add(en(caja(n * 0.254, 0.25, 0.25, M.plasticoNegro), 0, (haciaAbajo ? -1 : 1) * 0.2, 0));
  const pin = new THREE.BoxGeometry(0.064, alto, 0.064);
  const im = new THREE.InstancedMesh(pin, M.oro, n);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < n; i++) {
    m4.makeTranslation((i - (n - 1) / 2) * 0.254, (haciaAbajo ? -1 : 1) * (alto / 2), 0);
    im.setMatrixAt(i, m4);
  }
  g.add(im);
  return g;
}

// ----------------------------------------------------------- componentes --
// Cada constructor recibe el tamaño de la caja del CAD (x, y, z en cm) y
// regresa un grupo centrado de ese tamaño.

function heltec(M, s) {
  // Placa de 5.02 × 2.55 arriba de la caja; abajo, los pines que entran a la placa 2
  const g = new THREE.Group();
  const yPlaca = s.y / 2 - 0.08;
  g.add(en(losa(s.x, s.z, {
    base: '#121317', pines: 'dos', serigrafia: [['WiFi LoRa 32 V3', 0.36, 0.86, 0.11], ['HELTEC', 0.05, 0.22, 0.1]],
    chips: [[0.6, 0.2, 0.16, 0.34], [0.82, 0.26, 0.12, 0.26, '#2a2d33']],
  }), 0, yPlaca, 0));
  const oled = new THREE.MeshStandardMaterial({ color: 0x05080f, emissive: 0xffffff, emissiveMap: texturaOled(), emissiveIntensity: 1.25, roughness: 0.12 });
  const vidrio = new THREE.MeshStandardMaterial({ color: 0x0b0d12, roughness: 0.1, metalness: 0.3 });
  g.add(en(caja(2.7, 0.12, 1.45, [vidrio, vidrio, oled, vidrio, vidrio, vidrio]), -0.95, yPlaca + 0.14, 0.05));
  // USB-C, botones, conector de la antena (IPEX) y de la pila
  g.add(en(caja(0.75, 0.32, 0.9, M.blindaje), -s.x / 2 + 0.3, yPlaca + 0.24, 0));
  [-0.45, 0.45].forEach((z) => g.add(en(caja(0.35, 0.18, 0.28, M.plasticoBlanco), -1.95 + 0.45, yPlaca + 0.17, z * 1.9)));
  g.add(en(malla(new THREE.CylinderGeometry(0.12, 0.12, 0.12, 16), M.oro), s.x / 2 - 0.35, yPlaca + 0.14, -0.85));
  g.add(en(caja(0.6, 0.45, 0.4, M.plasticoBlanco), s.x / 2 - 0.5, yPlaca + 0.3, 0.75));
  // pines: dos hileras por debajo hasta el fondo de la caja
  const largo = s.y - 0.4;
  [-1, 1].forEach((lado) => g.add(en(hileraPines(M, s.x - 0.6, true, largo), 0, yPlaca - 0.08, lado * (s.z / 2 - 0.13))));
  return g;
}

function placaChica(M, s, opciones, extras = [], bocaAbajo = false) {
  // losa de 1.6 mm pegada a un lado de la caja y los componentes en el otro
  const g = new THREE.Group();
  const signo = bocaAbajo ? 1 : -1;
  const yLosa = signo * (s.y / 2 - 0.08);
  g.add(en(losa(s.x, s.z, opciones, bocaAbajo), 0, yLosa, 0));
  extras.forEach(([obj, x, alto, z]) => {
    // alto: altura sobre la cara de la placa (cm)
    obj.position.set(x, yLosa - signo * (0.08 + alto), z);
    g.add(obj);
  });
  return g;
}

function gy91(M, s) {
  return placaChica(M, s, { base: '#5b2b96', pines: 'uno', texto: '', serigrafia: [['GY-91', 0.08, 0.86, 0.2]] }, [
    [caja(0.3, 0.1, 0.3, M.plasticoNegro), -0.15, 0.05, 0.05],
    [caja(0.25, 0.1, 0.25, M.blindaje), 0.5, 0.05, 0.1],
    [caja(0.35, 0.12, 0.25, M.plasticoNegro), -0.6, 0.06, 0.25],
  ]);
}

function openlog(M, s) {
  return placaChica(M, s, { base: '#b3262e', pines: 'uno', serigrafia: [['OpenLog', 0.08, 0.86, 0.18]] }, [
    [caja(1.2, 0.16, 1.15, M.blindaje), 0.28, 0.08, -0.08],
    [caja(0.38, 0.1, 0.38, M.plasticoNegro), -0.6, 0.05, 0.25],
  ]);
}

function neoM8n(M, s) {
  return placaChica(M, s, { base: '#1f4fb5', pines: 'uno', serigrafia: [['GPS NEO-M8N', 0.1, 0.9, 0.09]] }, [
    [caja(1.6, 0.24, 1.22, M.blindaje), 0, 0.12, 0.1],
    [malla(new THREE.CylinderGeometry(0.28, 0.28, 0.12, 24), M.plata), 0.75, 0.06, -1.1],
    [malla(new THREE.CylinderGeometry(0.11, 0.11, 0.1, 16), M.oro), -0.85, 0.05, -1.25],
  ]);
}

function antenaCeramica(M, s, base = true) {
  // parche cerámico: cuerpo crema, cuadro plateado arriba y el punto de alimentación
  const g = new THREE.Group();
  g.add(caja(s.x, s.y - (base ? 0.02 : 0), s.z, M.ceramica));
  g.add(en(caja(s.x * 0.78, 0.02, s.z * 0.78, M.plata), 0, s.y / 2 + 0.005, 0));
  g.add(en(malla(new THREE.CylinderGeometry(0.1, 0.1, 0.04, 16), M.oro), s.x * 0.12, s.y / 2 + 0.02, s.z * 0.12));
  return g;
}

function neo6m(M, s) {
  // placa de 2.5 × 3.5 abajo y el parche de 2.5 × 2.5 encima (como en el CAD)
  const g = new THREE.Group();
  const yLosa = -s.y / 2 + 0.08;
  g.add(en(losa(s.x, s.z, { base: '#1f4fb5', pines: 'uno', serigrafia: [['GY-GPS6MV2', 0.08, 0.92, 0.08]] }), 0, yLosa, 0));
  const alto = s.y - 0.16;
  const parche = antenaCeramica(M, { x: 2.5, y: alto, z: 2.5 });
  parche.position.set(0, yLosa + 0.08 + alto / 2, -0.25);
  g.add(parche);
  g.add(en(malla(new THREE.CylinderGeometry(0.28, 0.28, 0.1, 24), M.plata), 0.8, yLosa + 0.13, 1.35));
  return g;
}

function esp32c3(M, s) {
  // SuperMini pegada por debajo de la tapa de la secundaria (componentes hacia abajo)
  return placaChica(M, s, { base: '#16181d', pines: 'dos', serigrafia: [['ESP32-C3', 0.3, 0.55, 0.14]] }, [
    [caja(0.5, 0.1, 0.5, M.plasticoNegro), 0.2, 0.05, 0],
    [caja(0.75, 0.3, 0.9, M.blindaje), -s.x / 2 + 0.3, 0.15, 0],
    [caja(0.6, 0.1, 0.22, M.ceramica), s.x / 2 - 0.45, 0.05, 0.4],
  ], true);
}

function rfm95(M, s) {
  return placaChica(M, s, { base: '#16733f', pines: 'no', serigrafia: [['RFM95W', 0.1, 0.92, 0.12]] }, [
    [caja(1.25, s.y - 0.18, 1.25, M.blindaje), 0, (s.y - 0.18) / 2, 0],
  ], true);
}

// Pila de 9 V del tamaño de la caja: el lado más largo es el largo, el más
// corto el grueso. Etiqueta en las caras anchas, bornes en un extremo.
function pila(M, s) {
  const g = new THREE.Group();
  const ejes = [['x', s.x], ['y', s.y], ['z', s.z]].sort((a, b) => b[1] - a[1]);
  const [largo, ancho, grueso] = ejes.map((e) => e[1]);
  const local = new THREE.Group();
  const etiqueta = new THREE.MeshStandardMaterial({ map: texturaPila(), roughness: 0.35, metalness: 0.3 });
  // local: largo en X, grueso en Y, ancho en Z
  local.add(malla(new THREE.BoxGeometry(largo - 0.2, grueso, ancho), [M.pilaLado, M.pilaLado, etiqueta, etiqueta, M.pilaLado, M.pilaLado]));
  local.add(en(caja(0.2, grueso * 0.92, ancho * 0.94, M.pilaLado), largo / 2 - 0.1, 0, 0));
  [[-0.65, 0.3, 20], [0.65, 0.34, 6]].forEach(([z, r, lados]) => {
    const b = malla(new THREE.CylinderGeometry(r, r, 0.3, lados), M.acero);
    b.rotation.z = Math.PI / 2;
    local.add(en(b, largo / 2 - 0.05, 0, z * (ancho / 2.65)));
  });
  // bornes dentro de la caja: se encoge un poco el largo
  local.scale.x = (largo - 0.25) / largo;
  local.position.x = -0.1;
  // orienta: X local → eje largo, Y local → eje grueso
  const vec = { x: v(1, 0, 0), y: v(0, 1, 0), z: v(0, 0, 1) };
  const ex = vec[ejes[0][0]], ey = vec[ejes[2][0]], ez = new THREE.Vector3().crossVectors(ex, ey);
  const giro = new THREE.Group();
  giro.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(ex, ey, ez));
  giro.add(local);
  g.add(giro);
  return g;
}

// Servo SG90 acostado como en el CAD: cuerpo de 2.28 × 1.22 × 2.25 y la flecha
// mirando hacia el centro (-z de la web). haciaX: lado donde va la flecha.
function servo(M, s, haciaX) {
  const g = new THREE.Group();
  const prof = 2.25;
  const zCuerpo = s.z / 2 - prof / 2;
  g.add(en(caja(s.x, s.y, prof, M.servo), 0, 0, zCuerpo));
  // orejas de montaje con sus agujeros
  g.add(en(caja(s.x + 0.94, s.y, 0.25, M.servo), 0, 0, zCuerpo - prof / 2 + 0.7));
  // torre de engranes y flecha
  const cara = zCuerpo - prof / 2;
  const fx = haciaX * 0.59;
  const torre = malla(new THREE.CylinderGeometry(0.5, 0.5, 0.36, 28), M.servo);
  torre.rotation.x = Math.PI / 2;
  g.add(en(torre, fx, 0, cara - 0.18));
  const flecha = malla(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 16), M.plasticoBlanco);
  flecha.rotation.x = Math.PI / 2;
  g.add(en(flecha, fx, 0, cara - 0.38));
  // brazo blanco (gira con la secuencia)
  const brazo = new THREE.Group();
  brazo.position.set(fx, 0, cara - 0.38);
  const forma = new THREE.Shape();
  forma.absarc(0, 0, 0.3, Math.PI / 2, Math.PI * 1.5, false);
  forma.lineTo(1.5, -0.14); forma.absarc(1.5, 0, 0.14, -Math.PI / 2, Math.PI / 2, false); forma.lineTo(0, 0.3);
  const geoBrazo = new THREE.ExtrudeGeometry(forma, { depth: 0.1, bevelEnabled: false });
  geoBrazo.translate(0, 0, -0.1);
  brazo.add(malla(geoBrazo, M.plasticoBlanco));
  brazo.rotation.z = haciaX > 0 ? Math.PI : 0;
  brazo.userData.base = brazo.rotation.z;
  g.add(brazo);
  // cable de 3 hilos que sale del cuerpo
  ['#7a4a22', '#d22b2b', '#f0a020'].forEach((c, i) => {
    const hilo = malla(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 6), new THREE.MeshStandardMaterial({ color: c, roughness: 0.5 }));
    hilo.rotation.z = Math.PI / 2;
    g.add(en(hilo, -haciaX * (s.x / 2 + 0.4), -0.1 + i * 0.09, zCuerpo + 0.6));
  });
  return { obj: g, brazo };
}

// ------------------------------------------------------------ fábrica --
const CONSTRUCTORES = {
  heltec, gy91, openlog, neo_m8n: neoM8n, antena_gps: (M, s) => antenaCeramica(M, s), neo_6m: neo6m,
  esp32_c3: esp32c3, rfm95w: rfm95, pila_primaria: pila, pila_secundaria: pila,
};

// Los servos ya vienen del CAD con su forma real (orejas, torre y cuerno), así que se usan tal cual.
export function hayDetalle(nombre) { return nombre in CONSTRUCTORES; }

export function crearComponente(nombre, cajaWeb, { calidad = 'alta' } = {}) {
  const M = materiales(calidad);
  const t = cajaWeb.getSize(v(0, 0, 0));
  const s = { x: t.x, y: t.y, z: t.z };
  if (nombre.startsWith('servo_')) {
    const c = cajaWeb.getCenter(v(0, 0, 0));
    return servo(M, s, c.x < 0 ? 1 : -1);          // la flecha mira hacia el centro en x
  }
  return { obj: CONSTRUCTORES[nombre](M, s) };
}

// Espuma EVA con poros (para las camas de los huevos)
export function materialEspuma(calidad = 'alta') { return materiales(calidad).espuma; }
