// =============================================================================
//  cansat3d.js — Modelo 3D del CanSat Zénit (three.js)
//
//  Es el MISMO diseño que se imprime: las piezas salen del CAD de
//  mecanica/cansat-completo (cansat_completo.py → exportar_web.py →
//  public/modelos/cansat.glb). Si cambia el CAD, se vuelve a correr
//  exportar_web.py y se copia el .glb aquí; este archivo solo pone colores,
//  agrupa las piezas y las mueve.
//
//  Los componentes comprados (Heltec, pilas, servos, GPS, radios) son cajas en
//  el CAD; aquí se dibujan con detalle (componentes3d.js) a esa misma medida y
//  en ese mismo lugar.
//
//  Unidades: 1 = 1 cm. Origen en el centro del cilindro completo, eje Y hacia
//  arriba. Ø 9.6 cm, alto 22.9 cm (primaria 15.9 cm arriba, secundaria 7 cm).
//
//  const cansat = crearCanSat({ calidad: 'alta' | 'baja' });
//  escena.add(cansat.grupo);              // las piezas aparecen al cargar el .glb
//  cansat.actualizar({ explosion, separacion, despliegue, giro, cubierta }, dt);
//  await cansat.listo;                    // opcional: cuando ya cargó
// =============================================================================
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { crearComponente, hayDetalle, materialEspuma } from './componentes3d.js';

const MODELO = new URL('modelos/cansat.glb', import.meta.url).href;
const LOGO = new URL('logo-zenit.jpeg', import.meta.url).href;

// Las mismas que imprime exportar_web.py (scenes[0].extras.medidas_cm)
const MEDIDAS = { R: 4.8, ALTO: 22.9, ARRIBA: 11.45, ABAJO: -11.45, UNION: -4.45 };

const lerp = (a, b, t) => a + (b - a) * t;
const suave = (t) => t * t * (3 - 2 * t);
const v = (x, y, z) => new THREE.Vector3(x, y, z);

// ------------------------------------------------- qué es cada pieza del CAD --
// mallas: prefijos de los nombres del .glb. explota: hacia dónde sale en la
// vista explotada (cm). Las ids son las que usa prototipo.js para las etiquetas.
const GRUPOS = [
  // primaria
  { id: 'autogiro', carga: 'pri', nombre: 'Autogiro', detalle: 'Rotor sobre balero · 3 aspas de 13 cm al ras de la pared',
    mallas: ['rotor', 'aspa_', 'balero'], explota: v(0, 14, 0) },
  { id: 'gps', carga: 'pri', nombre: 'GPS NEO-M8N', detalle: 'Placa 3 · antena cerámica en la tapa, mirando al cielo',
    mallas: ['neo_m8n', 'antena_gps'], explota: v(9, 6, 0) },
  { id: 'heltec', carga: 'pri', nombre: 'Heltec WiFi LoRa 32 V3', detalle: 'ESP32-S3 + SX1262 · el cerebro · placa 2',
    mallas: ['heltec'], explota: v(-11, 4.5, 0) },
  { id: 'antena', carga: 'pri', nombre: 'Antena LoRa 915 MHz', detalle: 'Por dentro, pegada a la pared',
    mallas: ['antena_lora'], explota: v(-10, 1, 3) },
  { id: 'gy91', carga: 'pri', nombre: 'GY-91', detalle: 'MPU9250 + BMP280 · presión, temperatura, orientación',
    mallas: ['gy91'], explota: v(-10, 0.5, 2) },
  { id: 'openlog', carga: 'pri', nombre: 'OpenLog', detalle: 'Respaldo del vuelo en microSD',
    mallas: ['openlog'], explota: v(10, 3, 1) },
  { id: 'electronica', carga: 'pri', nombre: 'Módulo de electrónica', detalle: '3 placas de 4 × 6 cm sobre hule · o-ring contra la pared',
    mallas: ['placa_', 'disco_electronica_base', 'separador_placas', 'hule_', 'varilla_placas', 'oring', 'tapa_electronica'], explota: v(0, 2.5, 0) },
  { id: 'pila', carga: 'pri', nombre: 'Pila de 9 V', detalle: 'Alimenta la primaria · va en la cuna del piso',
    mallas: ['pila_primaria'], explota: v(-13, -4, 0) },
  { id: 'servo-autogiro', carga: 'pri', nombre: 'Servo del autogiro', detalle: 'SG90 · gira el anillo que suelta las aspas',
    mallas: ['servo_autogiro'], explota: v(10, -1, 1) },
  { id: 'servo-desacople', carga: 'pri', nombre: 'Servo de desacople', detalle: 'SG90 · jala el pasador y suelta la secundaria a 200 m',
    mallas: ['servo_desacople', 'pasador'], explota: v(10, -5.5, 0) },
  { id: 'huevo1', carga: 'pri', nombre: 'Huevo 1 · 65 g', detalle: 'Hamaca de ligas y espuma EVA',
    mallas: ['huevo_primaria', 'espuma_huevo1'], explota: v(0, -6, 6) },
  { id: 'estructura', carga: 'pri', nombre: 'Estructura', detalle: 'Piso, anillo de retención y 3 varillas M3',
    mallas: ['piso_primaria', 'anillo_retencion', 'disco_huevo_base', 'espaciador_', 'varilla_columna'], explota: v(0, 0, 0) },
  { id: 'carcasa', carga: 'pri', nombre: 'Carcasa de la primaria', detalle: 'PLA de 1.2 mm · lisa por fuera',
    mallas: ['carcasa_primaria'], explota: v(0, 0, 0), cubierta: true },
  // secundaria
  { id: 'esp32c3', carga: 'sec', nombre: 'ESP32-C3 SuperMini', detalle: 'Controla la baliza de la secundaria',
    mallas: ['esp32_c3'], explota: v(-10, -3, 2) },
  { id: 'rfm95', carga: 'sec', nombre: 'RFM95W', detalle: 'LoRa 915 MHz · manda la trama B',
    mallas: ['rfm95w'], explota: v(9, -4, 4) },
  { id: 'neo6m', carga: 'sec', nombre: 'GPS NEO-6M', detalle: 'Posición para ubicar a la secundaria',
    mallas: ['neo_6m'], explota: v(10, -6, -3) },
  { id: 'pila-sec', carga: 'sec', nombre: 'Pila de 9 V', detalle: 'Alimenta la secundaria · va parada en la bandeja',
    mallas: ['pila_secundaria'], explota: v(-9, -11, -4) },
  { id: 'huevo2', carga: 'sec', nombre: 'Huevo 2 · 65 g', detalle: 'Hamaca de ligas y espuma EVA · cae libre',
    mallas: ['huevo_secundaria', 'espuma_huevo2'], explota: v(0, -14, 5) },
  { id: 'estructura-sec', carga: 'sec', nombre: 'Bandeja y tapa', detalle: 'La tapa lleva el poste del desacople',
    mallas: ['bandeja_secundaria', 'tapa_secundaria'], explota: v(0, -2, 0) },
  { id: 'carcasa-sec', carga: 'sec', nombre: 'Carcasa de la secundaria', detalle: 'Fondo con costillas que se aplastan',
    mallas: ['carcasa_secundaria'], explota: v(0, 0, 0), cubierta: true },
];

// ---------------------------------------------------------------- materiales
// Mismos colores que los renders de Blender (mecanica/cansat-completo/render_cansat.py)
function materiales(calidad) {
  const alta = calidad === 'alta';
  const fisico = (o) => (alta ? new THREE.MeshPhysicalMaterial(o) : new THREE.MeshStandardMaterial(o));
  const pla = (color, extra = {}) => fisico({ color, roughness: 0.5, metalness: 0, ...(alta ? { clearcoat: 0.2, clearcoatRoughness: 0.5 } : {}), ...extra });
  return {
    carcasa: pla(0x232d45, { roughness: 0.42 }),
    carcasaSec: pla(0x232d45, { roughness: 0.42 }),
    aspa: pla(0xe6eaf2, { roughness: 0.38 }),
    interior: pla(0x4a5a82),
    azul: pla(0x2f6bff, { roughness: 0.35 }),
    huevo: fisico({ color: 0xf1e7d6, roughness: 0.6, ...(alta ? { sheen: 0.4, sheenColor: new THREE.Color(0xfff5e6) } : {}) }),
    pila: fisico({ color: 0x17181c, roughness: 0.35, metalness: 0.4 }),
    servo: fisico({ color: 0x2c63e8, roughness: 0.18, transparent: true, opacity: 0.9, ...(alta ? { clearcoat: 1 } : {}) }),
    pcb: new THREE.MeshStandardMaterial({ color: 0x1d7a46, roughness: 0.5, metalness: 0.1 }),
    gps: new THREE.MeshStandardMaterial({ color: 0x1f4fb5, roughness: 0.5, metalness: 0.1 }),
    negro: new THREE.MeshStandardMaterial({ color: 0x111216, roughness: 0.4, metalness: 0.2 }),
    morado: new THREE.MeshStandardMaterial({ color: 0x5b2b96, roughness: 0.45, metalness: 0.1 }),
    rojo: new THREE.MeshStandardMaterial({ color: 0xb3262e, roughness: 0.45, metalness: 0.1 }),
    ceramica: new THREE.MeshStandardMaterial({ color: 0xe0cfa6, roughness: 0.7 }),
    metal: new THREE.MeshStandardMaterial({ color: 0xb9bfc8, metalness: 1, roughness: 0.3 }),
    cobre: new THREE.MeshStandardMaterial({ color: 0xd28a4c, metalness: 1, roughness: 0.28 }),
    goma: new THREE.MeshStandardMaterial({ color: 0x0f0f11, roughness: 0.75 }),
    espuma: materialEspuma(calidad),
  };
}

function materialDe(M, n) {
  if (n.startsWith('aspa')) return M.aspa;
  if (n === 'carcasa_primaria' || n === 'rotor') return M.carcasa;
  if (n === 'carcasa_secundaria') return M.carcasaSec;
  if (n === 'tapa_secundaria') return M.azul;
  if (n.startsWith('hule') || n === 'oring') return M.goma;
  const tabla = [['huevo_', 'huevo'], ['pila', 'pila'], ['servo', 'servo'], ['placa_', 'pcb'], ['heltec', 'negro'],
    ['gy91', 'morado'], ['openlog', 'rojo'], ['neo_', 'gps'], ['antena_gps', 'ceramica'], ['balero', 'metal'],
    ['antena_lora', 'cobre'], ['espuma', 'espuma'], ['esp32', 'negro'], ['rfm', 'pcb'], ['varilla', 'metal'], ['pasador', 'metal']];
  const t = tabla.find(([k]) => n.startsWith(k));
  return t ? M[t[1]] : M.interior;
}

// Calcomanía de vinil del logo (4.5 × 6 cm) al frente de la primaria, entre dos aspas.
// El fondo negro del .jpeg se vuelve transparente.
function calcomaniaLogo(R) {
  const tex = new THREE.Texture();
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height);
    for (let i = 0; i < d.data.length; i += 4) {
      const l = (0.3 * d.data[i] + 0.59 * d.data[i + 1] + 0.11 * d.data[i + 2]) / 255;
      d.data[i + 3] = Math.min(255, l * 3 * 255);
    }
    g.putImageData(d, 0, 0);
    tex.image = c;
    tex.needsUpdate = true;
  };
  img.src = LOGO;
  const medio = 2.25 / R;                          // medio ancho en radianes
  const geo = new THREE.CylinderGeometry(R, R, 6, 32, 1, true, -medio, 2 * medio);
  const mat = new THREE.MeshStandardMaterial({
    map: tex, transparent: true, roughness: 0.6, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2,
  });
  const m = new THREE.Mesh(geo, mat);
  m.position.y = (132 + 192) / 20 - MEDIDAS.ALTO / 2;   // de 13.2 a 19.2 cm sobre la base
  m.renderOrder = 3;
  return m;
}

// ============================================================== el modelo ==
export function crearCanSat({ calidad = 'alta' } = {}) {
  const M = materiales(calidad);
  const grupo = new THREE.Group();
  grupo.name = 'CanSat Zénit';
  const primaria = new THREE.Group(); primaria.name = 'Carga primaria';
  const secundaria = new THREE.Group(); secundaria.name = 'Carga secundaria';
  grupo.add(primaria, secundaria);

  // Un grupo por pieza; su origen se mueve al centro de la pieza al cargar
  // (ahí apuntan las etiquetas de la vista explotada).
  const piezas = GRUPOS.map((d) => {
    const obj = new THREE.Group();
    obj.name = d.nombre;
    (d.carga === 'sec' ? secundaria : primaria).add(obj);
    return { id: d.id, nombre: d.nombre, detalle: d.detalle, obj, base: v(0, 0, 0), explota: d.explota.clone(), def: d };
  });
  const rotor = piezas.find((p) => p.id === 'autogiro').obj;
  const aspas = [];                                // { pivote, eje, grados }
  const brazos = {};                               // servo_autogiro / servo_desacople

  const logo = calcomaniaLogo(MEDIDAS.R + 0.012);
  primaria.add(logo);

  const cubiertas = [M.carcasa, M.carcasaSec];
  cubiertas.forEach((m) => { m.userData.opacidad = m.opacity; });

  const listo = new GLTFLoader().loadAsync(MODELO).then((gltf) => {
    const datos = gltf.scene.userData || {};
    const bisagras = new Map((datos.bisagras || []).map((b) => [b.aspa, b]));
    const mallas = [];
    gltf.scene.traverse((o) => { if (o.isMesh) mallas.push(o); });

    piezas.forEach((p) => {
      const propias = mallas.filter((m) => p.def.mallas.some((k) => m.name.startsWith(k)));
      if (!propias.length) return;
      const caja = new THREE.Box3();
      propias.forEach((m) => { m.geometry.computeBoundingBox(); caja.union(m.geometry.boundingBox); });
      const centro = caja.getCenter(v(0, 0, 0));
      if (p.id === 'autogiro') centro.set(0, centro.y, 0);   // gira sobre el eje del cilindro
      p.base.copy(centro);

      propias.forEach((m) => {
        if (hayDetalle(m.name)) {
          // componente comprado: versión con detalle del tamaño de su caja
          const det = crearComponente(m.name, m.geometry.boundingBox, { calidad });
          det.obj.name = m.name;
          det.obj.position.copy(m.geometry.boundingBox.getCenter(v(0, 0, 0))).sub(centro);
          p.obj.add(det.obj);
          if (det.brazo) brazos[m.name] = det.brazo;
          return;
        }
        const geo = toCreasedNormals(m.geometry, THREE.MathUtils.degToRad(32));
        const malla = new THREE.Mesh(geo, materialDe(M, m.name));
        malla.name = m.name;
        malla.castShadow = true;
        const b = bisagras.get(m.name);
        if (b && p.id === 'autogiro') {
          // aspa: cuelga de un pivote en su bisagra
          const punto = v(...b.punto);
          const pivote = new THREE.Group();
          pivote.position.copy(punto).sub(centro);
          malla.position.copy(punto).negate();
          pivote.add(malla);
          p.obj.add(pivote);
          aspas.push({ pivote, eje: v(...b.eje).normalize(), grados: b.grados });
        } else {
          malla.position.copy(centro).negate();
          p.obj.add(malla);
        }
      });
    });
    actualizar();
    return gltf;
  }).catch((e) => { console.error('[cansat3d] no se pudo cargar el modelo del CAD', e); throw e; });
  listo.catch(() => {});

  // ------------------------------------------------------------ estado --
  const estado = { explosion: 0, separacion: 0, despliegue: 0, giro: 0, cubierta: 1 };

  function actualizar(o = {}, dt = 0) {
    Object.assign(estado, o);
    const ex = suave(Math.min(1, Math.max(0, estado.explosion)));
    piezas.forEach((p) => { p.obj.position.copy(p.base).addScaledVector(p.explota, ex); });
    // La secundaria se aleja hacia abajo y un poco de lado
    const s = estado.separacion;
    secundaria.position.set(s * 4, -s * s * 34 - ex * 4, s * 2.5);
    secundaria.rotation.set(s * 0.5, s * 1.2, s * 0.35);
    secundaria.visible = s < 0.97;
    // Aspas: plegadas en su ranura (al ras de la pared) → abiertas. En la vista
    // explotada se abren a medias para que no tapen la electrónica.
    const d = Math.max(suave(Math.min(1, Math.max(0, estado.despliegue))), ex * 0.55);
    aspas.forEach((a) => { a.pivote.quaternion.setFromAxisAngle(a.eje, THREE.MathUtils.degToRad(a.grados) * d); });
    rotor.rotation.y = estado.giro;
    const brazo = (n, t) => { if (brazos[n]) brazos[n].rotation.z = brazos[n].userData.base + t * 1.4; };
    brazo('servo_autogiro', d);
    brazo('servo_desacople', Math.min(1, s * 4));
    // Carcasas: opacas (PLA) y se desvanecen para ver por dentro
    const c = Math.min(1, Math.max(0, estado.cubierta));
    cubiertas.forEach((m) => {
      const transparente = c < 0.999;
      if (m.transparent !== transparente) { m.transparent = transparente; m.depthWrite = !transparente; m.needsUpdate = true; }
      m.opacity = c;
    });
    piezas.forEach((p) => { if (p.def.cubierta) p.obj.visible = c > 0.01; });
    logo.material.opacity = Math.min(1, c * 1.2);
    logo.visible = c > 0.01;
    void dt;
  }
  actualizar();

  return { grupo, primaria, secundaria, rotor, piezas, estado, actualizar, listo, medidas: { ...MEDIDAS } };
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
