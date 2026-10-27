// =============================================================================
//  componentes3d.js — Componentes con detalle para la vista explotada
//
//  La pila con su etiqueta, la Heltec con la pantalla encendida y su antena de
//  resorte, los servos con su brazo, los GPS con su antena cerámica y los huevos
//  en su espuma. cansat3d.js los pone en el lugar de cada componente del CAD y
//  los muestra cuando el CanSat se abre (vista "Por dentro").
//  Unidades: 1 = 1 cm.
// =============================================================================
import * as THREE from 'three';

const v = (x, y, z) => new THREE.Vector3(x, y, z);

// ----------------------------------------------------- texturas en canvas --
function lienzo(w, h, dibujar) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  dibujar(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// Vetas del metal cepillado (sirve como mapa de rugosidad y de relieve)
function texturaCepillada() {
  const t = lienzo(512, 512, (g, w, h) => {
    g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {
      const y = Math.random() * h, l = 40 + Math.random() * 300, x = Math.random() * w;
      g.strokeStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${0.04 + Math.random() * 0.1})`;
      g.lineWidth = Math.random() * 1.4;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + l, y + (Math.random() - 0.5) * 2); g.stroke();
    }
  });
  t.colorSpace = THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Poros de la espuma
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

// Cara superior de una placa de circuito: máscara, pistas, pines dorados, chips
function texturaPCB({ base, ancho, fondo, chips = [], texto = '', pines = 'dos', usb = false }) {
  const px = 96;                                   // pixeles por cm
  return lienzo(Math.round(ancho * px), Math.round(fondo * px), (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    // pistas
    g.strokeStyle = 'rgba(255,255,255,0.10)'; g.lineWidth = 2;
    for (let i = 0; i < 26; i++) {
      let x = Math.random() * w, y = Math.random() * h;
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 3; k++) { if (k % 2) x += (Math.random() - 0.5) * w * 0.6; else y += (Math.random() - 0.5) * h * 0.6; g.lineTo(x, y); }
      g.stroke();
    }
    // vías
    g.fillStyle = 'rgba(210,180,90,0.55)';
    for (let i = 0; i < 40; i++) { g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 2.2, 0, Math.PI * 2); g.fill(); }
    // hileras de pines dorados en los bordes
    const fila = (y) => {
      for (let x = 18; x < w - 12; x += 24) {
        g.fillStyle = '#d9b45a'; g.beginPath(); g.arc(x, y, 7, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#2a2a2a'; g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2); g.fill();
      }
    };
    if (pines !== 'no') { fila(14); if (pines === 'dos') fila(h - 14); }
    // chips
    chips.forEach(([cx, cy, cw, ch, color = '#141518']) => {
      const x = cx * w, y = cy * h, ww = cw * w, hh = ch * h;
      g.fillStyle = '#b9bcc4';
      for (let p = 4; p < ww - 4; p += 7) { g.fillRect(x + p, y - 3, 3, 4); g.fillRect(x + p, y + hh - 1, 3, 4); }
      g.fillStyle = color; g.fillRect(x, y, ww, hh);
      g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(x, y, ww, hh * 0.18);
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.arc(x + 7, y + 7, 2.5, 0, Math.PI * 2); g.fill();
    });
    if (usb) { g.fillStyle = '#c9ccd3'; g.fillRect(w * 0.42, h - 30, w * 0.16, 30); }
    if (texto) {
      g.fillStyle = 'rgba(255,255,255,0.8)';
      g.font = `600 ${Math.round(h * 0.11)}px "Archivo Variable", sans-serif`;
      g.fillText(texto, 26, h * 0.62);
    }
  });
}

// Pantalla OLED de la Heltec, encendida
function texturaOled() {
  return lienzo(256, 128, (g, w, h) => {
    g.fillStyle = '#02060f'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#7fc4ff';
    g.font = '800 30px "Archivo Variable", sans-serif';
    g.fillText('ZÉNIT', 14, 38);
    g.font = '500 20px "JetBrains Mono Variable", monospace';
    g.fillText('h 450.0 m', 14, 72);
    g.fillText('LoRa  OK', 14, 102);
    g.fillRect(170, 18, 70, 6);
  });
}

// Etiqueta de la pila de 9 V
function texturaPila() {
  return lienzo(256, 440, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, 0);
    gr.addColorStop(0, '#0b0c0f'); gr.addColorStop(0.5, '#23262d'); gr.addColorStop(1, '#0b0c0f');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const oro = g.createLinearGradient(0, 0, w, 0);
    oro.addColorStop(0, '#8a6a22'); oro.addColorStop(0.5, '#f0cf73'); oro.addColorStop(1, '#8a6a22');
    g.fillStyle = oro; g.fillRect(0, 0, w, h * 0.2);
    g.fillStyle = '#e6c56a';
    g.font = '800 92px "Archivo Variable", sans-serif';
    g.fillText('9V', 58, h * 0.62);
  });
}

// Banda impresa en la carcasa: ZÉNIT ── CANSAT 2026
// ---------------------------------------------------------------- materiales
function materiales(calidad) {
  const alta = calidad === 'alta';
  const fisico = (o) => (alta ? new THREE.MeshPhysicalMaterial(o) : new THREE.MeshStandardMaterial(o));
  const vetas = texturaCepillada();
  const poros = texturaPoros();
  const metal = (color, rugosidad, extra = {}) => fisico({
    color, metalness: 1, roughness: rugosidad, roughnessMap: vetas, bumpMap: vetas, bumpScale: 0.015,
    ...(alta ? { anisotropy: 0.6, clearcoat: 0.25, clearcoatRoughness: 0.2 } : {}), ...extra,
  });
  return {
    acrilico: fisico({
      color: 0x0a0c12, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.55,
      side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 1.6,
      ...(alta ? { clearcoat: 1, clearcoatRoughness: 0.03, specularIntensity: 1 } : {}),
    }),
    acero: metal(0x9ea6b4, 0.5),
    aluminio: metal(0x8e97a8, 0.55),
    acrilicoNegro: fisico({ color: 0x0b0c10, roughness: 0.12, transparent: true, opacity: 0.82, ...(alta ? { clearcoat: 1 } : {}) }),
    laton: new THREE.MeshStandardMaterial({ color: 0xc9a04e, metalness: 1, roughness: 0.32 }),
    tornillo: new THREE.MeshStandardMaterial({ color: 0x2b2e35, metalness: 0.9, roughness: 0.35 }),
    hueco: new THREE.MeshStandardMaterial({ color: 0x050608, roughness: 0.8 }),
    luzAzul: new THREE.MeshStandardMaterial({ color: 0x2f6bff, emissive: 0x2f6bff, emissiveIntensity: 2.4, roughness: 0.3 }),
    puntaAzul: fisico({ color: 0x1f4fe0, metalness: 0.55, roughness: 0.28, ...(alta ? { clearcoat: 0.8 } : {}) }),
    huevo: fisico({ color: 0xf1e7d6, roughness: 0.6, ...(alta ? { sheen: 0.4, sheenColor: new THREE.Color(0xfff5e6) } : {}) }),
    espuma: new THREE.MeshStandardMaterial({ color: 0xe3c24a, roughness: 1, bumpMap: poros, bumpScale: 0.08 }),
    servo: fisico({ color: 0x2c63e8, roughness: 0.18, transparent: true, opacity: 0.88, ...(alta ? { clearcoat: 1 } : {}) }),
    plasticoBlanco: new THREE.MeshStandardMaterial({ color: 0xf1f2f4, roughness: 0.5 }),
    cobre: new THREE.MeshStandardMaterial({ color: 0xd28a4c, metalness: 1, roughness: 0.28 }),
    ceramica: new THREE.MeshStandardMaterial({ color: 0xe7d8b4, roughness: 0.75 }),
    blindaje: metal(0xc9ccd3, 0.45),
    pcbBorde: (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.1 }),
    cables: [0xd22b2b, 0x15161a, 0xf0a020].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.45 })),
  };
}

// ------------------------------------------------------------- utilidades --
function malla(geo, mat) { const m = new THREE.Mesh(geo, mat); m.castShadow = true; return m; }
function en(obj, x, y, z) { obj.position.set(x, y, z); return obj; }
function caja(a, b, c, mat) { return malla(new THREE.BoxGeometry(a, b, c), mat); }

// Placa con textura arriba y canto del color de la máscara
function placa(M, { ancho, fondo, base, chips, texto, pines, usb }, extras = []) {
  const g = new THREE.Group();
  const borde = M.pcbBorde(base);
  const arriba = new THREE.MeshStandardMaterial({ map: texturaPCB({ base, ancho, fondo, chips, texto, pines, usb }), roughness: 0.5, metalness: 0.15 });
  g.add(malla(new THREE.BoxGeometry(ancho, 0.16, fondo), [borde, borde, arriba, borde, borde, borde]));
  extras.forEach((e) => g.add(e));
  return g;
}

function huevo(mat) {
  // Perfil de huevo (más ancho abajo): 5.7 cm de alto, Ø 4.3 cm
  const puntos = [];
  for (let i = 0; i <= 32; i++) {
    const a = (i / 32) * Math.PI;
    const y = -Math.cos(a) * 2.85;
    const r = Math.sin(a) * 2.15 * (1 - 0.12 * (y / 2.85));
    puntos.push(new THREE.Vector2(Math.max(0.001, r), y));
  }
  return malla(new THREE.LatheGeometry(puntos, 48), mat);
}

function nidoEspuma(M, radio) {
  // Copa de espuma con el hueco donde se acomoda el huevo
  const perfil = [[0, -0.3], [radio, -0.3], [radio, 1.5], [radio - 0.6, 1.6], [2.0, 0.9], [1.4, 0.2], [0, 0.05]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  return malla(new THREE.LatheGeometry(perfil, 48), M.espuma);
}

function pila9v(M) {
  const g = new THREE.Group();
  const etiqueta = new THREE.MeshStandardMaterial({ map: texturaPila(), roughness: 0.35, metalness: 0.3 });
  const lado = new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: 0.4, metalness: 0.4 });
  g.add(malla(new THREE.BoxGeometry(2.6, 4.6, 1.7), [lado, lado, lado, lado, etiqueta, etiqueta]));
  [-0.6, 0.6].forEach((x, i) => {
    const borne = malla(new THREE.CylinderGeometry(i ? 0.32 : 0.28, i ? 0.32 : 0.28, 0.35, i ? 6 : 20), M.acero);
    borne.position.set(x, 2.47, 0);
    g.add(borne);
  });
  return g;
}

function servoSg90(M) {
  const g = new THREE.Group();
  g.add(caja(2.3, 2.2, 1.2, M.servo));
  g.add(en(caja(3.2, 0.22, 1.2, M.servo), 0, 0.55, 0));
  g.add(en(malla(new THREE.CylinderGeometry(0.5, 0.5, 0.4, 20), M.servo), 0.55, 1.3, 0));
  g.add(en(malla(new THREE.CylinderGeometry(0.2, 0.2, 0.3, 12), M.plasticoBlanco), 0.55, 1.6, 0));
  const brazo = new THREE.Group();
  brazo.position.set(0.55, 1.68, 0);
  brazo.add(en(caja(1.9, 0.14, 0.42, M.plasticoBlanco), 0.75, 0, 0));
  g.add(brazo);
  g.userData.brazo = brazo;
  return g;
}

class Helice extends THREE.Curve {
  getPoint(t, destino = new THREE.Vector3()) {
    const a = t * Math.PI * 2 * 7;
    return destino.set(Math.cos(a) * 0.32, t * 1.3, Math.sin(a) * 0.32);
  }
}


// Cada componente centrado en su origen. servos: brazos que se mueven.
export function crearDetalles({ calidad = 'alta' } = {}) {
  const M = materiales(calidad);
  const d = {};
  const centrado = (obj) => {
    const g = new THREE.Group();
    const c = new THREE.Box3().setFromObject(obj).getCenter(v(0, 0, 0));
    obj.position.sub(c);
    g.add(obj);
    return g;
  };

  d.gps = centrado(placa(M, { ancho: 3.6, fondo: 3.6, base: '#1f4fb5', chips: [[0.12, 0.6, 0.22, 0.2]], texto: 'NEO-M8N', pines: 'uno' },
    [en(caja(2.5, 0.42, 2.5, M.ceramica), 0, 0.29, -0.2), en(malla(new THREE.CylinderGeometry(0.22, 0.22, 0.05, 16), M.acero), 0, 0.52, -0.2)]));

  const oled = new THREE.MeshStandardMaterial({ color: 0x05080f, emissive: 0xffffff, emissiveMap: texturaOled(), emissiveIntensity: 1.2, roughness: 0.15 });
  d.heltec = centrado(placa(M, { ancho: 5.1, fondo: 2.6, base: '#111216', chips: [[0.62, 0.3, 0.22, 0.38], [0.86, 0.28, 0.1, 0.24, '#2a2d33']], usb: true }, [
    en(caja(2.4, 0.08, 1.3, oled), -0.7, 0.13, 0),
    en(new THREE.Mesh(new THREE.TubeGeometry(new Helice(), 120, 0.05, 6), M.cobre), 2.15, 0.08, 0.75),
  ]));

  d.gy91 = centrado(placa(M, { ancho: 2.2, fondo: 1.5, base: '#5b2b96', chips: [[0.3, 0.3, 0.3, 0.42], [0.66, 0.36, 0.18, 0.3, '#c9ccd3']], texto: 'GY-91', pines: 'uno' }));
  d.openlog = centrado(placa(M, { ancho: 1.9, fondo: 1.7, base: '#b3262e', chips: [[0.15, 0.55, 0.3, 0.25]], pines: 'uno' },
    [en(caja(1.15, 0.14, 1.05, M.blindaje), 0.25, 0.14, -0.2)]));
  d.pila = centrado(pila9v(M));

  const servoAuto = servoSg90(M);
  d['servo-autogiro'] = centrado(servoAuto);
  const servoDes = servoSg90(M);
  servoDes.rotation.y = Math.PI;
  d['servo-desacople'] = centrado(servoDes);

  const huevo1 = new THREE.Group();
  huevo1.add(en(huevo(M.huevo), 0, 0.15, 0), en(nidoEspuma(M, 3.6), 0, -2.5, 0));
  d.huevo1 = centrado(huevo1);

  d.esp32c3 = centrado(placa(M, { ancho: 1.8, fondo: 2.3, base: '#1f4fb5', chips: [[0.25, 0.3, 0.5, 0.3]], pines: 'dos', usb: true }));
  d.rfm95 = centrado(placa(M, { ancho: 1.7, fondo: 1.7, base: '#16733f', pines: 'no' }, [en(caja(1.25, 0.18, 1.25, M.blindaje), 0, 0.15, 0)]));
  d.neo6m = centrado(placa(M, { ancho: 2.5, fondo: 2.5, base: '#1f4fb5', texto: 'NEO-6M', pines: 'uno' }, [en(caja(1.8, 0.36, 1.8, M.ceramica), 0, 0.26, -0.2)]));
  const pilaSec = pila9v(M);
  pilaSec.rotation.z = Math.PI / 2;
  d['pila-sec'] = centrado(pilaSec);
  const huevo2 = new THREE.Group();
  const h2 = huevo(M.huevo);
  h2.rotation.z = Math.PI / 2;
  h2.scale.setScalar(0.92);
  const cuna = caja(5.6, 0.9, 3.6, M.espuma);
  cuna.position.y = -1.7;
  huevo2.add(h2, cuna);
  d.huevo2 = centrado(huevo2);

  return { piezas: d, brazos: { autogiro: servoAuto.userData.brazo, desacople: servoDes.userData.brazo } };
}
