// =============================================================================
//  cansat3d.js — Modelo 3D ilustrativo del CanSat Zénit (three.js, sin archivos)
//
//  Unidades: 1 = 1 cm. Origen en el centro del cilindro completo, eje Y hacia
//  arriba (el CanSat cae vertical). Medidas de docs/07-requisitos-y-riesgos.md:
//  Ø 9.6 cm, alto 21.5 cm (primaria 15 cm arriba, secundaria 6.5 cm abajo).
//  Los componentes son los del PDR (docs/02-conexiones.md). El acomodo interno
//  es ILUSTRATIVO: cuando mecánica tenga el CAD (mecanica/cad) se reemplaza.
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

const lerp = (a, b, t) => a + (b - a) * t;
const suave = (t) => t * t * (3 - 2 * t);

function texturaLetrero() {
  // Banda con "ZÉNIT · CANSAT 2026" alrededor de la primaria.
  const c = document.createElement('canvas');
  c.width = 2048; c.height = 256;
  const g = c.getContext('2d');
  g.clearRect(0, 0, c.width, c.height);
  g.fillStyle = 'rgba(235,242,255,0.92)';
  g.font = '800 120px "Archivo Variable", "Segoe UI", sans-serif';
  g.textBaseline = 'middle';
  const texto = 'Z É N I T';
  g.fillText(texto, 70, 128);
  const ancho = g.measureText(texto).width;
  g.fillStyle = '#2f6bff';
  g.fillRect(70 + ancho + 40, 122, 120, 12);
  g.fillStyle = 'rgba(235,242,255,0.6)';
  g.font = '600 64px "Archivo Variable", "Segoe UI", sans-serif';
  g.fillText('CANSAT 2026 · PEU-UM', 70 + ancho + 200, 130);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function materiales(calidad) {
  const alta = calidad === 'alta';
  const fisico = (o) => (alta ? new THREE.MeshPhysicalMaterial(o) : new THREE.MeshStandardMaterial(o));
  return {
    cubierta: fisico({
      color: 0x1b2438, roughness: 0.22, metalness: 0.1, transparent: true, opacity: 0.34,
      side: THREE.DoubleSide, depthWrite: false,
      ...(alta ? { clearcoat: 1, clearcoatRoughness: 0.08, iridescence: 0.35, iridescenceIOR: 1.3 } : {}),
    }),
    cubiertaSec: fisico({
      color: 0x23314f, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.38,
      side: THREE.DoubleSide, depthWrite: false,
      ...(alta ? { clearcoat: 1, clearcoatRoughness: 0.1 } : {}),
    }),
    aluminio: new THREE.MeshStandardMaterial({ color: 0xd5dceb, metalness: 0.85, roughness: 0.28 }),
    aspa: fisico({ color: 0x9eabc4, metalness: 0.55, roughness: 0.3, ...(alta ? { clearcoat: 0.6 } : {}) }),
    aspaPunta: new THREE.MeshStandardMaterial({ color: 0x2f6bff, emissive: 0x1840b0, emissiveIntensity: 0.6, roughness: 0.4 }),
    pcbNegra: new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: 0.55, metalness: 0.2 }),
    pcbAzul: new THREE.MeshStandardMaterial({ color: 0x1d4fb8, roughness: 0.5, metalness: 0.15 }),
    pcbMorada: new THREE.MeshStandardMaterial({ color: 0x5a2d91, roughness: 0.5, metalness: 0.15 }),
    pcbRoja: new THREE.MeshStandardMaterial({ color: 0xb3262e, roughness: 0.5, metalness: 0.15 }),
    pcbVerde: new THREE.MeshStandardMaterial({ color: 0x16733f, roughness: 0.5, metalness: 0.15 }),
    pantalla: new THREE.MeshStandardMaterial({ color: 0x0b1a33, emissive: 0x3d8bff, emissiveIntensity: 0.9, roughness: 0.2 }),
    ceramica: new THREE.MeshStandardMaterial({ color: 0xc9a46a, roughness: 0.7 }),
    pila: new THREE.MeshStandardMaterial({ color: 0x1a1d24, roughness: 0.4, metalness: 0.5 }),
    pilaBanda: new THREE.MeshStandardMaterial({ color: 0xc8a13a, roughness: 0.35, metalness: 0.7 }),
    servo: new THREE.MeshStandardMaterial({ color: 0x2a5bd7, roughness: 0.45, transparent: true, opacity: 0.95 }),
    huevo: new THREE.MeshStandardMaterial({ color: 0xf3ead9, roughness: 0.62 }),
    espuma: new THREE.MeshStandardMaterial({ color: 0xe0b93f, roughness: 0.95 }),
    cobre: new THREE.MeshStandardMaterial({ color: 0xd08a4a, metalness: 0.9, roughness: 0.3 }),
  };
}

function caja(ancho, alto, fondo, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(ancho, alto, fondo), mat);
  m.castShadow = true;
  return m;
}

function en(obj, x, y, z) {
  obj.position.set(x, y, z);
  return obj;
}

function placa(ancho, fondo, mat, extras = []) {
  const g = new THREE.Group();
  g.add(caja(ancho, 0.16, fondo, mat));
  extras.forEach((e) => g.add(e));
  return g;
}

function huevo(mat) {
  // Perfil de huevo (más ancho abajo) girado: 5.7 cm de alto, Ø 4.3 cm
  const puntos = [];
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * Math.PI;
    const y = -Math.cos(a) * 2.85;
    const r = Math.sin(a) * 2.15 * (1 - 0.12 * (y / 2.85));
    puntos.push(new THREE.Vector2(Math.max(0.001, r), y));
  }
  const m = new THREE.Mesh(new THREE.LatheGeometry(puntos, 40), mat);
  m.castShadow = true;
  return m;
}

function pila9v(M) {
  const g = new THREE.Group();
  g.add(caja(2.6, 4.6, 1.7, M.pila));
  const banda = caja(2.62, 0.5, 1.72, M.pilaBanda); banda.position.y = 1.6; g.add(banda);
  [-0.6, 0.6].forEach((x, i) => {
    const borne = new THREE.Mesh(i ? new THREE.CylinderGeometry(0.28, 0.28, 0.35, 6) : new THREE.CylinderGeometry(0.3, 0.3, 0.35, 16), M.aluminio);
    borne.position.set(x, 2.47, 0); g.add(borne);
  });
  return g;
}

function servoSg90(M) {
  const g = new THREE.Group();
  g.add(caja(2.3, 2.2, 1.2, M.servo));
  const oreja = caja(3.2, 0.25, 1.2, M.servo); oreja.position.y = 0.55; g.add(oreja);
  const eje = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.5, 16), M.aluminio);
  eje.position.set(0.55, 1.35, 0); g.add(eje);
  const brazo = caja(1.8, 0.12, 0.35, new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.6 }));
  brazo.position.set(1.2, 1.6, 0); g.add(brazo);
  g.userData.brazo = brazo;
  return g;
}

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

  const centroPri = UNION + ALTO_PRI / 2;
  const cubierta = new THREE.Mesh(new THREE.CylinderGeometry(R, R, ALTO_PRI, 72, 1, true), M.cubierta);
  cubierta.position.y = centroPri;
  cubierta.renderOrder = 2;
  primaria.add(cubierta);

  const letrero = new THREE.Mesh(
    new THREE.CylinderGeometry(R + 0.02, R + 0.02, 1.6, 96, 1, true, -Math.PI * 0.9, Math.PI * 1.15),
    new THREE.MeshBasicMaterial({ map: texturaLetrero(), transparent: true, depthWrite: false }),
  );
  letrero.position.y = UNION + 2.2;
  letrero.renderOrder = 3;
  primaria.add(letrero);

  // Aros de aluminio en los extremos
  const aro = (y) => {
    const a = new THREE.Mesh(new THREE.TorusGeometry(R, 0.16, 12, 72), M.aluminio);
    a.rotation.x = Math.PI / 2; a.position.y = y; return a;
  };
  [ARRIBA, UNION + 0.05].forEach((y) => primaria.add(aro(y)));

  // Tapa superior con el único orificio (Ø 9–10 mm, R16)
  const tapa = new THREE.Mesh(new THREE.RingGeometry(0.5, R, 64), new THREE.MeshStandardMaterial({ color: 0x9aa6bf, metalness: 0.7, roughness: 0.35, side: THREE.DoubleSide }));
  tapa.rotation.x = -Math.PI / 2;
  tapa.position.y = ARRIBA;
  primaria.add(tapa);

  // ----------------------------------------------- autogiro (en la tapa) --
  const rotor = new THREE.Group();
  rotor.position.y = ARRIBA + 0.15;
  primaria.add(rotor);
  const cubo = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.4, 0.7, 32), M.aluminio);
  cubo.position.y = 0.3;
  rotor.add(cubo);
  const aspas = [];
  const N_ASPAS = 3;
  for (let i = 0; i < N_ASPAS; i++) {
    const a = (i / N_ASPAS) * Math.PI * 2;
    const giroBase = new THREE.Group();
    giroBase.rotation.y = -a;
    rotor.add(giroBase);
    const bisagra = new THREE.Group();
    bisagra.position.set(R + 0.25, 0.1, 0);
    giroBase.add(bisagra);
    const forma = new THREE.Shape();
    forma.moveTo(0, -0.8); forma.lineTo(12.6, -0.62); forma.quadraticCurveTo(13.5, 0, 12.6, 0.62); forma.lineTo(0, 0.8); forma.closePath();
    const geo = new THREE.ExtrudeGeometry(forma, { depth: 0.14, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2 });
    geo.rotateX(Math.PI / 2);            // plano de la aspa = horizontal
    const aspa = new THREE.Mesh(geo, M.aspa);
    aspa.rotation.x = 0.14;              // ángulo de paso: la hace girar sola al caer
    aspa.castShadow = true;
    bisagra.add(aspa);
    const punta = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.2, 1.3), M.aspaPunta);
    punta.position.set(12.2, 0, 0);
    aspa.add(punta);
    aspas.push(bisagra);
  }
  piezas.push({ id: 'autogiro', nombre: 'Autogiro', detalle: '3 aspas pasivas · las suelta un servo a 200 m', obj: rotor, base: rotor.position.clone(), explota: new THREE.Vector3(0, 12, 0) });

  // ------------------------------------------------- interior primaria --
  const v = (x, y, z) => new THREE.Vector3(x, y, z);
  const gps = placa(3.6, 3.6, M.pcbAzul, [en(caja(2.5, 0.4, 2.5, M.ceramica), 0, 0.28, 0)]);
  pieza(primaria, 'gps', 'GPS NEO-M8N', 'Posición de la primaria · antena cerámica', gps, v(0, 9.6, 0), v(9, 6, 0));

  const heltec = placa(5.1, 2.6, M.pcbNegra, [
    en(caja(2.4, 0.08, 1.3, M.pantalla), -0.6, 0.12, 0),
    en(new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.06, 6, 16), M.cobre), 2.1, 0.5, 0.6),
  ]);
  pieza(primaria, 'heltec', 'Heltec WiFi LoRa 32 V3', 'ESP32-S3 + SX1262 · el cerebro · OLED', heltec, v(0, 7.9, 0), v(-11, 4.5, 0));

  const antena = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 7.8, 8), M.cobre);
  pieza(primaria, 'antena', 'Antena LoRa 915 MHz', 'Cuarto de onda dentro del cilindro', antena, v(3.6, 5.2, -1.6), v(10, 2, -3));

  const gy91 = placa(2.2, 1.4, M.pcbMorada, [en(caja(0.5, 0.15, 0.5, M.pcbNegra), 0, 0.14, 0)]);
  pieza(primaria, 'gy91', 'GY-91', 'MPU9250 + BMP280 · presión, temperatura, orientación', gy91, v(-1.6, 6.5, 0.8), v(-10, 0.5, 2));

  const openlog = placa(1.9, 1.7, M.pcbRoja, [en(caja(1.1, 0.12, 1.1, M.aluminio), 0, 0.13, 0)]);
  pieza(primaria, 'openlog', 'OpenLog', 'Respaldo del vuelo en microSD', openlog, v(1.7, 6.5, 0.6), v(10, 3, 1));

  const pilaPri = pila9v(M);
  pieza(primaria, 'pila', 'Pila de 9 V', 'Alimenta la primaria · regulador MP1584EN', pilaPri, v(-1.7, 3.2, -0.6), v(-11, -2.5, -1));

  const servoAuto = servoSg90(M);
  pieza(primaria, 'servo-autogiro', 'Servo del autogiro', 'SG90 · suelta las aspas 400 ms después del desacople', servoAuto, v(1.7, 4.4, 0.4), v(10, -1, 1));
  const servoDes = servoSg90(M);
  servoDes.rotation.y = Math.PI;
  pieza(primaria, 'servo-desacople', 'Servo de desacople', 'SG90 · libera la carga secundaria a 200 m', servoDes, v(1.6, 1.4, 0.2), v(10, -5.5, 0));

  const nido = new THREE.Mesh(new THREE.CylinderGeometry(R - 0.25, R - 0.25, 4.6, 48, 1, true), M.espuma);
  nido.material = M.espuma.clone(); nido.material.transparent = true; nido.material.opacity = 0.35; nido.material.side = THREE.DoubleSide;
  const huevo1 = new THREE.Group();
  huevo1.add(huevo(M.huevo), nido);
  pieza(primaria, 'huevo1', 'Huevo 1 · 65 g', 'Bahía acolchada de la primaria', huevo1, v(0, -1.5, 0), v(0, -6, 6));

  // ---------------------------------------------------------- secundaria --
  const secundaria = new THREE.Group();
  secundaria.name = 'Carga secundaria';
  grupo.add(secundaria);
  const centroSec = ABAJO + ALTO_SEC / 2;
  const cubiertaSec = new THREE.Mesh(new THREE.CylinderGeometry(R, R, ALTO_SEC, 72, 1, true), M.cubiertaSec);
  cubiertaSec.position.y = centroSec;
  cubiertaSec.renderOrder = 2;
  secundaria.add(cubiertaSec);
  [UNION - 0.05, ABAJO].forEach((y) => secundaria.add(aro(y)));
  const fondo = new THREE.Mesh(new THREE.CircleGeometry(R, 64), new THREE.MeshStandardMaterial({ color: 0x8792ab, metalness: 0.6, roughness: 0.4, side: THREE.DoubleSide }));
  fondo.rotation.x = Math.PI / 2; fondo.position.y = ABAJO;
  secundaria.add(fondo);
  // Pestillo que sujeta el servo de desacople
  const pestillo = caja(0.6, 1.2, 0.6, M.aluminio);
  pestillo.position.set(1.6, UNION + 0.2, 0.2);
  secundaria.add(pestillo);

  const c3 = placa(1.8, 2.3, M.pcbAzul, [en(caja(0.7, 0.14, 0.9, M.aluminio), 0, 0.12, -0.5)]);
  pieza(secundaria, 'esp32c3', 'ESP32-C3 SuperMini', 'Controla la baliza de la secundaria', c3, v(-2.2, -5.2, 1.2), v(-10, -3, 2));
  const rfm = placa(1.6, 1.6, M.pcbVerde, [en(caja(1.2, 0.14, 1.2, M.aluminio), 0, 0.12, 0)]);
  pieza(secundaria, 'rfm95', 'RFM95W', 'LoRa 915 MHz · manda la trama B', rfm, v(0.2, -5.2, 2.2), v(9, -4, 4));
  const gps6 = placa(2.5, 2.5, M.pcbAzul, [en(caja(1.8, 0.35, 1.8, M.ceramica), 0, 0.25, 0)]);
  pieza(secundaria, 'neo6m', 'GPS NEO-6M', 'Posición para ubicar a la secundaria', gps6, v(2.2, -5.2, -1.2), v(10, -6, -3));
  const pilaSec = pila9v(M);
  pilaSec.rotation.z = Math.PI / 2;
  pieza(secundaria, 'pila-sec', 'Pila de 9 V', 'Alimenta la secundaria', pilaSec, v(0, -9.6, -2.4), v(-9, -11, -4));
  const huevo2 = huevo(M.huevo);
  huevo2.rotation.z = Math.PI / 2;
  huevo2.scale.setScalar(0.92);
  pieza(secundaria, 'huevo2', 'Huevo 2 · 65 g', 'Va acostado en la secundaria', huevo2, v(0, -7.6, 1.2), v(0, -14, 5));

  // ------------------------------------------------------------ estado --
  const estado = { explosion: 0, separacion: 0, despliegue: 0, giro: 0, cubierta: 1 };
  const cubiertas = [cubierta, cubiertaSec];
  const opacidadBase = cubiertas.map((c) => c.material.opacity);

  function actualizar(o = {}, dt = 0) {
    Object.assign(estado, o);
    const ex = suave(Math.min(1, Math.max(0, estado.explosion)));
    piezas.forEach((p) => { p.obj.position.copy(p.base).addScaledVector(p.explota, ex); });
    // La secundaria se aleja hacia abajo y un poco de lado
    const s = estado.separacion;
    secundaria.position.set(s * 4, -s * s * 34 - ex * 4, s * 2.5);
    secundaria.rotation.set(s * 0.5, s * 1.2, s * 0.35);
    secundaria.visible = s < 0.97;
    // Aspas: plegadas (apuntan hacia abajo pegadas al cilindro) → abiertas
    const d = suave(Math.min(1, Math.max(0, estado.despliegue)));
    aspas.forEach((b) => { b.rotation.z = lerp(-Math.PI / 2 + 0.04, 0.1, d); });
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
