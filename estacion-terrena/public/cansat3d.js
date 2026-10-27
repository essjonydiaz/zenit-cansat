// =============================================================================
//  cansat3d.js — Modelo 3D del CanSat Zénit (three.js, todo en código)
//
//  Unidades: 1 = 1 cm. Origen en el centro del cilindro completo, eje Y hacia
//  arriba (el CanSat cae vertical). Medidas de docs/07-requisitos-y-riesgos.md:
//  Ø 9.6 cm, alto 21.5 cm (primaria 15 cm arriba, secundaria 6.5 cm abajo).
//  Los componentes son los del PDR (docs/02-conexiones.md). El aspecto sigue los
//  renders conceptuales del equipo (acrílico ahumado, acero cepillado, aspas de
//  aluminio con punta azul); el acomodo interno es ILUSTRATIVO hasta tener el
//  CAD en mecanica/cad.
//
//  const cansat = crearCanSat({ calidad: 'alta' | 'baja' });
//  escena.add(cansat.grupo);
//  cansat.actualizar({ explosion, separacion, despliegue, giro, cubierta }, dt);
// =============================================================================
import * as THREE from 'three';

const R = 4.8;            // radio del cilindro
const ALTO_PRI = 15;
const ALTO_SEC = 6.5;
const ARRIBA = (ALTO_PRI + ALTO_SEC) / 2;        // 10.75
const UNION = ARRIBA - ALTO_PRI;                 // -4.25 (unión primaria/secundaria)
const ABAJO = -ARRIBA;                           // -10.75
const LARGO_ASPA = 13;

const lerp = (a, b, t) => a + (b - a) * t;
const suave = (t) => t * t * (3 - 2 * t);
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
function texturaLetrero() {
  return lienzo(2048, 256, (g) => {
    g.fillStyle = 'rgba(240,244,255,0.95)';
    g.font = '700 118px "Archivo Variable", "Segoe UI", sans-serif';
    g.textBaseline = 'middle';
    g.letterSpacing = '22px';
    g.fillText('ZÉNIT', 60, 128);
    const ancho = g.measureText('ZÉNIT').width + 22 * 5;
    g.letterSpacing = '0px';
    g.fillStyle = '#2f6bff';
    g.fillRect(60 + ancho + 30, 124, 150, 9);
    g.fillStyle = 'rgba(225,232,248,0.85)';
    g.font = '600 62px "Archivo Variable", "Segoe UI", sans-serif';
    g.letterSpacing = '8px';
    g.fillText('CANSAT 2026', 60 + ancho + 220, 132);
  });
}

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

// Anillo de acero con espesor (perfil rectangular girado)
function aroAcero(M, y, alto = 0.5, salida = 0.18, tornillos = 6) {
  const g = new THREE.Group();
  const perfil = [[R - 0.08, -alto / 2], [R + salida, -alto / 2], [R + salida, alto / 2], [R - 0.08, alto / 2], [R - 0.08, -alto / 2]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  g.add(malla(new THREE.LatheGeometry(perfil, 96), M.acero));
  for (let i = 0; i < tornillos; i++) {
    const a = (i / tornillos) * Math.PI * 2 + 0.3;
    const t = malla(new THREE.CylinderGeometry(0.13, 0.13, 0.08, 12), M.tornillo);
    t.rotation.z = Math.PI / 2;
    t.position.set(Math.cos(a) * (R + salida + 0.01), 0, Math.sin(a) * (R + salida + 0.01));
    t.rotation.y = -a;
    g.add(t);
  }
  g.position.y = y;
  return g;
}

function lineaLuz(M, y, radio = R + 0.05) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(radio, 0.05, 8, 128), M.luzAzul);
  m.rotation.x = Math.PI / 2;
  m.position.y = y;
  return m;
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

function cable(M, puntos, color) {
  const curva = new THREE.CatmullRomCurve3(puntos.map(([x, y, z]) => v(x, y, z)));
  return new THREE.Mesh(new THREE.TubeGeometry(curva, 40, 0.05, 6), M.cables[color]);
}

// Hélice de cobre (la antena de resorte de la Heltec)
class Helice extends THREE.Curve {
  getPoint(t, destino = new THREE.Vector3()) {
    const a = t * Math.PI * 2 * 7;
    return destino.set(Math.cos(a) * 0.32, t * 1.3, Math.sin(a) * 0.32);
  }
}

// ============================================================== el modelo ==
export function crearCanSat({ calidad = 'alta' } = {}) {
  const M = materiales(calidad);
  const grupo = new THREE.Group();
  grupo.name = 'CanSat Zénit';
  const piezas = [];   // {id, nombre, detalle, obj, base, explota}

  const pieza = (padre, id, nombre, detalle, obj, pos, explota) => {
    obj.position.copy(pos);
    padre.add(obj);
    piezas.push({ id, nombre, detalle, obj, base: pos.clone(), explota: explota.clone() });
    return obj;
  };

  // ------------------------------------------------------------ primaria --
  const primaria = new THREE.Group();
  primaria.name = 'Carga primaria';
  grupo.add(primaria);

  const cubierta = malla(new THREE.CylinderGeometry(R, R, ALTO_PRI - 0.4, 96, 1, true), M.acrilico);
  cubierta.position.y = UNION + ALTO_PRI / 2 - 0.1;
  cubierta.renderOrder = 2;
  primaria.add(cubierta);

  const letrero = new THREE.Mesh(
    new THREE.CylinderGeometry(R + 0.015, R + 0.015, 1.4, 128, 1, true, -Math.PI * 0.95, Math.PI * 1.1),
    new THREE.MeshBasicMaterial({ map: texturaLetrero(), transparent: true, depthWrite: false }),
  );
  letrero.position.y = UNION + 1.7;
  letrero.renderOrder = 3;
  primaria.add(letrero);

  primaria.add(aroAcero(M, ARRIBA - 0.35, 0.45, 0.16, 8));
  primaria.add(lineaLuz(M, ARRIBA - 0.68));
  primaria.add(aroAcero(M, UNION + 0.32, 0.55, 0.22, 6));

  // Estructura interna: 4 varillas de latón y discos de acrílico negro
  const estructura = new THREE.Group();
  primaria.add(estructura);
  [45, 135, 225, 315].forEach((g) => {
    const a = THREE.MathUtils.degToRad(g);
    estructura.add(en(malla(new THREE.CylinderGeometry(0.12, 0.12, ALTO_PRI - 1.6, 10), M.laton), Math.cos(a) * 3.75, UNION + ALTO_PRI / 2, Math.sin(a) * 3.75));
  });
  const disco = (y, r = R - 0.3) => {
    const d = new THREE.Group();
    d.add(malla(new THREE.CylinderGeometry(r, r, 0.2, 64), M.acrilicoNegro));
    [45, 135, 225, 315].forEach((g) => {
      const a = THREE.MathUtils.degToRad(g);
      d.add(en(malla(new THREE.CylinderGeometry(0.26, 0.26, 0.42, 6), M.acero), Math.cos(a) * 3.75, 0, Math.sin(a) * 3.75));
    });
    d.position.y = y;
    estructura.add(d);
  };
  [9.3, 7.7, 6.35, 1.6].forEach((y) => disco(y));

  // ----------------------------------------------- autogiro (tapa giratoria) --
  // La tapa va sobre un balero: tapa, cubo, bisagras y aspas giran juntas.
  const rotor = new THREE.Group();
  rotor.position.y = ARRIBA;
  primaria.add(rotor);
  rotor.add(en(malla(new THREE.CylinderGeometry(R + 0.12, R + 0.12, 0.5, 96), M.acero), 0, 0.12, 0));
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    rotor.add(en(malla(new THREE.CylinderGeometry(0.17, 0.17, 0.05, 12), M.hueco), Math.cos(a) * 3.9, 0.38, Math.sin(a) * 3.9));
  }
  rotor.add(en(malla(new THREE.CylinderGeometry(0.85, 1.75, 1.2, 48), M.acero), 0, 0.95, 0));
  rotor.add(en(malla(new THREE.CylinderGeometry(0.5, 0.5, 0.05, 32), M.hueco), 0, 1.56, 0));   // el único orificio (R16)
  rotor.add(lineaLuz(M, -0.18, R + 0.1));
  const aspas = [];
  const N_ASPAS = 3;
  for (let i = 0; i < N_ASPAS; i++) {
    const a = (i / N_ASPAS) * Math.PI * 2 + Math.PI / 6;
    const base = new THREE.Group();
    base.rotation.y = -a;
    rotor.add(base);
    // bisagra (horquilla con pasador) en el borde de la tapa
    base.add(en(caja(0.7, 0.55, 0.3, M.acero), R + 0.2, 0.15, 0.62));
    base.add(en(caja(0.7, 0.55, 0.3, M.acero), R + 0.2, 0.15, -0.62));
    const pasador = malla(new THREE.CylinderGeometry(0.12, 0.12, 1.7, 12), M.acero);
    pasador.rotation.x = Math.PI / 2;
    base.add(en(pasador, R + 0.45, 0.15, 0));
    const bisagra = new THREE.Group();
    bisagra.position.set(R + 0.45, 0.15, 0);
    base.add(bisagra);
    const aspa = new THREE.Group();
    aspa.rotation.x = 0.14;                       // ángulo de paso: la hace girar sola al caer
    bisagra.add(aspa);
    const nudillo = malla(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 16), M.aluminio);
    nudillo.rotation.x = Math.PI / 2;
    aspa.add(nudillo);
    aspa.add(en(caja(LARGO_ASPA - 1.4, 0.32, 1.5, M.aluminio), (LARGO_ASPA - 1.4) / 2 + 0.2, 0, 0));
    aspa.add(en(caja(1.5, 0.4, 1.56, M.puntaAzul), LARGO_ASPA - 0.55, 0, 0));
    aspas.push(bisagra);
  }
  piezas.push({ id: 'autogiro', nombre: 'Autogiro', detalle: '3 aspas pasivas en una tapa con balero · las suelta un servo a 200 m', obj: rotor, base: rotor.position.clone(), explota: v(0, 12, 0) });

  // ------------------------------------------------- interior primaria --
  const gps = placa(M, { ancho: 3.6, fondo: 3.6, base: '#1f4fb5', chips: [[0.12, 0.6, 0.22, 0.2]], texto: 'NEO-M8N', pines: 'uno' },
    [en(caja(2.5, 0.42, 2.5, M.ceramica), 0, 0.29, -0.2), en(malla(new THREE.CylinderGeometry(0.22, 0.22, 0.05, 16), M.acero), 0, 0.52, -0.2)]);
  pieza(primaria, 'gps', 'GPS NEO-M8N', 'Posición de la primaria · antena cerámica', gps, v(0, 9.5, 0), v(9, 6, 0));

  const oled = new THREE.MeshStandardMaterial({ color: 0x05080f, emissive: 0xffffff, emissiveMap: texturaOled(), emissiveIntensity: 1.2, roughness: 0.15 });
  const heltec = placa(M, { ancho: 5.1, fondo: 2.6, base: '#111216', chips: [[0.62, 0.3, 0.22, 0.38], [0.86, 0.28, 0.1, 0.24, '#2a2d33']], usb: true }, [
    en(caja(2.4, 0.08, 1.3, oled), -0.7, 0.13, 0),
    en(new THREE.Mesh(new THREE.TubeGeometry(new Helice(), 120, 0.05, 6), M.cobre), 2.15, 0.08, 0.75),
  ]);
  pieza(primaria, 'heltec', 'Heltec WiFi LoRa 32 V3', 'ESP32-S3 + SX1262 · el cerebro · OLED', heltec, v(0, 7.9, 0), v(-11, 4.5, 0));

  const antena = new THREE.Group();
  antena.add(malla(new THREE.CylinderGeometry(0.05, 0.05, 7.4, 8), M.cobre));
  pieza(primaria, 'antena', 'Antena LoRa 915 MHz', 'Cuarto de onda dentro del cilindro', antena, v(-3.1, 4.2, 1.6), v(-10, 1, 3));

  const gy91 = placa(M, { ancho: 2.2, fondo: 1.5, base: '#5b2b96', chips: [[0.3, 0.3, 0.3, 0.42], [0.66, 0.36, 0.18, 0.3, '#c9ccd3']], texto: 'GY-91', pines: 'uno' });
  pieza(primaria, 'gy91', 'GY-91', 'MPU9250 + BMP280 · presión, temperatura, orientación', gy91, v(-1.5, 6.55, 0.9), v(-10, 0.5, 2));

  const openlog = placa(M, { ancho: 1.9, fondo: 1.7, base: '#b3262e', chips: [[0.15, 0.55, 0.3, 0.25]], pines: 'uno' },
    [en(caja(1.15, 0.14, 1.05, M.blindaje), 0.25, 0.14, -0.2)]);
  pieza(primaria, 'openlog', 'OpenLog', 'Respaldo del vuelo en microSD', openlog, v(1.7, 6.55, 0.6), v(10, 3, 1));

  const pilaPri = pila9v(M);
  pieza(primaria, 'pila', 'Pila de 9 V', 'Alimenta la primaria · regulador MP1584EN', pilaPri, v(-1.6, 3.97, -0.9), v(-11, -2.5, -1));

  const servoAuto = servoSg90(M);
  pieza(primaria, 'servo-autogiro', 'Servo del autogiro', 'SG90 · suelta las aspas 400 ms después del desacople', servoAuto, v(1.9, 4.6, -1.3), v(10, -1, 1));
  const servoDes = servoSg90(M);
  servoDes.rotation.y = Math.PI;
  pieza(primaria, 'servo-desacople', 'Servo de desacople', 'SG90 · libera la carga secundaria a 200 m', servoDes, v(1.7, 2.9, 1.0), v(10, -5.5, 0));

  const huevo1 = new THREE.Group();
  huevo1.add(en(huevo(M.huevo), 0, 0.15, 0), en(nidoEspuma(M, 3.6), 0, -2.5, 0));
  pieza(primaria, 'huevo1', 'Huevo 1 · 65 g', 'Bahía acolchada de la primaria', huevo1, v(0, -1.45, 0), v(0, -6, 6));

  // Cableado (se esconde en la vista explotada para que no se estire)
  const cableado = new THREE.Group();
  cableado.add(
    cable(M, [[-1.0, 6.3, -0.9], [-0.8, 7.1, -0.7], [-0.4, 7.85, -0.3]], 0),
    cable(M, [[-2.2, 6.3, -0.9], [-2.6, 7.0, -0.9], [-1.9, 7.85, -0.6]], 1),
    cable(M, [[0.8, 5.2, -1.3], [0.3, 6.3, -1.6], [1.2, 7.85, -0.9]], 2),
    cable(M, [[0.6, 3.4, 1.0], [0.0, 5.5, 1.7], [1.6, 7.85, 0.9]], 0),
    cable(M, [[0.6, 3.2, 0.8], [-0.2, 5.4, 1.5], [1.9, 7.85, 0.6]], 1),
  );
  primaria.add(cableado);

  // Seguro de la unión: gancho en la primaria
  const gancho = en(caja(1.5, 0.5, 0.35, M.acero), 0, UNION + 0.3, R + 0.33);
  primaria.add(gancho);

  // ---------------------------------------------------------- secundaria --
  const secundaria = new THREE.Group();
  secundaria.name = 'Carga secundaria';
  grupo.add(secundaria);
  const cubiertaSec = malla(new THREE.CylinderGeometry(R, R, ALTO_SEC - 0.6, 96, 1, true), M.acrilico);
  cubiertaSec.position.y = ABAJO + ALTO_SEC / 2;
  cubiertaSec.renderOrder = 2;
  secundaria.add(cubiertaSec);
  secundaria.add(aroAcero(M, UNION - 0.32, 0.55, 0.22, 6));
  secundaria.add(lineaLuz(M, UNION, R + 0.12));
  secundaria.add(aroAcero(M, ABAJO + 0.3, 0.6, 0.2, 6));
  secundaria.add(lineaLuz(M, ABAJO + 0.68));
  const fondo = malla(new THREE.CylinderGeometry(R + 0.1, R + 0.1, 0.3, 96), M.acero);
  fondo.position.y = ABAJO + 0.05;
  secundaria.add(fondo);
  // pestillo del seguro (lo abre el servo de desacople)
  const pestillo = new THREE.Group();
  pestillo.add(caja(1.7, 0.75, 0.3, M.acero));
  [-0.55, 0.55].forEach((x) => {
    const t = en(malla(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 10), M.tornillo), x, 0, 0.18);
    t.rotation.x = Math.PI / 2;
    pestillo.add(t);
  });
  pestillo.position.set(0, UNION - 0.25, R + 0.36);
  secundaria.add(pestillo);
  // estructura de la secundaria
  [45, 135, 225, 315].forEach((g) => {
    const a = THREE.MathUtils.degToRad(g);
    secundaria.add(en(malla(new THREE.CylinderGeometry(0.1, 0.1, ALTO_SEC - 1.2, 10), M.laton), Math.cos(a) * 3.75, ABAJO + ALTO_SEC / 2, Math.sin(a) * 3.75));
  });
  secundaria.add(en(malla(new THREE.CylinderGeometry(R - 0.3, R - 0.3, 0.2, 64), M.acrilicoNegro), 0, -5.6, 0));

  const c3 = placa(M, { ancho: 1.8, fondo: 2.3, base: '#1f4fb5', chips: [[0.25, 0.3, 0.5, 0.3]], pines: 'dos', usb: true });
  pieza(secundaria, 'esp32c3', 'ESP32-C3 SuperMini', 'Controla la baliza de la secundaria', c3, v(-2.2, -5.4, 1.1), v(-10, -3, 2));
  const rfm = placa(M, { ancho: 1.7, fondo: 1.7, base: '#16733f', pines: 'no' }, [en(caja(1.25, 0.18, 1.25, M.blindaje), 0, 0.15, 0)]);
  pieza(secundaria, 'rfm95', 'RFM95W', 'LoRa 915 MHz · manda la trama B', rfm, v(0.2, -5.4, 2.1), v(9, -4, 4));
  const gps6 = placa(M, { ancho: 2.5, fondo: 2.5, base: '#1f4fb5', texto: 'NEO-6M', pines: 'uno' }, [en(caja(1.8, 0.36, 1.8, M.ceramica), 0, 0.26, -0.2)]);
  pieza(secundaria, 'neo6m', 'GPS NEO-6M', 'Posición para ubicar a la secundaria', gps6, v(2.1, -5.4, -1.2), v(10, -6, -3));
  const pilaSec = pila9v(M);
  pilaSec.rotation.z = Math.PI / 2;
  pieza(secundaria, 'pila-sec', 'Pila de 9 V', 'Alimenta la secundaria', pilaSec, v(0, -9.25, -2.6), v(-9, -11, -4));
  const huevo2 = new THREE.Group();
  const h2 = huevo(M.huevo);
  h2.rotation.z = Math.PI / 2;
  h2.scale.setScalar(0.92);
  const cuna = caja(5.6, 0.9, 3.6, M.espuma);
  cuna.position.y = -1.7;
  huevo2.add(h2, cuna);
  pieza(secundaria, 'huevo2', 'Huevo 2 · 65 g', 'Va acostado en la secundaria', huevo2, v(0, -8.0, 1.0), v(0, -14, 5));

  // ------------------------------------------------------------ estado --
  const estado = { explosion: 0, separacion: 0, despliegue: 0, giro: 0, cubierta: 1 };
  const cubiertas = [cubierta, cubiertaSec];
  const opacidadBase = cubiertas.map((c) => c.material.opacity);

  function actualizar(o = {}, dt = 0) {
    Object.assign(estado, o);
    const ex = suave(Math.min(1, Math.max(0, estado.explosion)));
    piezas.forEach((p) => { p.obj.position.copy(p.base).addScaledVector(p.explota, ex); });
    cableado.visible = ex < 0.05;
    // La secundaria se aleja hacia abajo y un poco de lado
    const s = estado.separacion;
    secundaria.position.set(s * 4, -s * s * 34 - ex * 4, s * 2.5);
    secundaria.rotation.set(s * 0.5, s * 1.2, s * 0.35);
    secundaria.visible = s < 0.97;
    pestillo.rotation.x = Math.min(1, s * 6) * -0.9;      // el seguro se abre
    // Aspas: plegadas (pegadas por fuera del cilindro, hacia abajo) → abiertas
    const d = suave(Math.min(1, Math.max(0, estado.despliegue)));
    aspas.forEach((b) => { b.rotation.z = lerp(-Math.PI / 2, 0.1, d); });
    rotor.rotation.y = estado.giro;
    cubiertas.forEach((c, i) => {
      c.material.opacity = opacidadBase[i] * estado.cubierta;
      c.visible = estado.cubierta > 0.01;
    });
    letrero.material.opacity = Math.min(1, estado.cubierta * 1.4);
    [servoAuto, servoDes].forEach((sv, i) => {
      const abierto = i === 0 ? d : Math.min(1, s * 4);
      sv.userData.brazo.rotation.y = abierto * 1.4;
    });
    void dt;
  }
  actualizar();

  return {
    grupo, primaria, secundaria, rotor, piezas, estado, actualizar,
    medidas: { R, ALTO: ALTO_PRI + ALTO_SEC, ARRIBA, ABAJO, UNION },
  };
}

// Luces y entorno de estudio comunes (las dos vistas se ven igual)
export async function prepararEstudio(renderer, escena, { intensidad = 0.5 } = {}) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  try {
    const { RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js');
    const pmrem = new THREE.PMREMGenerator(renderer);
    escena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    escena.environmentIntensity = intensidad;
    pmrem.dispose();
  } catch { /* sin entorno: quedan las luces */ }
  const clave = new THREE.DirectionalLight(0xe6eeff, 2.2);
  clave.position.set(-30, 40, 30);
  escena.add(clave);
  const contra = new THREE.DirectionalLight(0x2f6bff, 2.4);
  contra.position.set(25, -10, -30);
  escena.add(contra);
  escena.add(new THREE.HemisphereLight(0x9fc0ff, 0x0a0f1c, 0.5));
  return { clave, contra };
}

export function webglDisponible() {
  try {
    const c = document.createElement('canvas');
    return Boolean(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch { return false; }
}
