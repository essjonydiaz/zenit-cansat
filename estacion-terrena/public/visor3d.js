// =============================================================================
//  visor3d.js — Orientación del CanSat en 3D dentro del panel (en vivo)
//
//  Lee el estado que expone app.js (window.zenit.estado()) y mueve el modelo:
//    roll / pitch / yaw de la trama T  → giro del cilindro
//    evento DESACOPLE                  → la secundaria se separa
//    evento AUTOGIRO / fase 3          → las aspas se abren y giran
//  Si no hay WebGL se queda el horizonte artificial (SVG) de siempre.
// =============================================================================
import * as THREE from 'three';
import { crearCanSat, prepararEstudio, webglDisponible } from './cansat3d.js';

const caja = document.getElementById('visor3d');
const tarjeta = document.getElementById('instOri');

async function iniciar() {
  if (!caja || !webglDisponible()) return;
  await document.fonts.ready.catch(() => {});
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  } catch { return; }
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  caja.prepend(renderer.domElement);
  tarjeta.classList.add('con-3d');

  const escena = new THREE.Scene();
  const camara = new THREE.PerspectiveCamera(30, 1, 1, 400);
  camara.position.set(20, 11, 42);
  camara.lookAt(0, -0.5, 0);
  await prepararEstudio(renderer, escena, { intensidad: 0.45 });

  const cansat = crearCanSat({ calidad: 'baja' });
  const pivote = new THREE.Group();       // aquí se aplica la orientación
  pivote.add(cansat.grupo);
  escena.add(pivote);

  // Referencia: anillo del horizonte y eje vertical tenue
  const horizonte = new THREE.Mesh(
    new THREE.RingGeometry(10.6, 10.85, 96),
    new THREE.MeshBasicMaterial({ color: 0x6d9bff, transparent: true, opacity: 0.35, side: THREE.DoubleSide }),
  );
  horizonte.rotation.x = -Math.PI / 2;
  escena.add(horizonte);
  const marcasN = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.8, 3), new THREE.MeshBasicMaterial({ color: 0x9fc0ff }));
  marcasN.rotation.x = -Math.PI / 2; marcasN.position.set(0, 0, -11.6);
  escena.add(marcasN);

  function medir() {
    const w = caja.clientWidth, h = caja.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camara.aspect = w / h;
    camara.updateProjectionMatrix();
  }
  new ResizeObserver(medir).observe(caja);
  medir();

  const objetivo = new THREE.Quaternion();
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  let separacion = 0, despliegue = 0, giro = 0, velGiro = 0, previo = performance.now();
  const rad = THREE.MathUtils.degToRad;

  function cuadro(t) {
    requestAnimationFrame(cuadro);
    if (document.hidden) return;
    const dt = Math.min(0.1, (t - previo) / 1000);
    previo = t;
    const S = window.zenit && window.zenit.estado();
    const T = S && S.T;
    const quieto = !T;
    if (T) {
      euler.set(rad(T.pitch || 0), rad(-(T.yaw || 0)), rad(-(T.roll || 0)), 'YXZ');
      objetivo.setFromEuler(euler);
    } else {
      // Sin datos: gira despacio para que se vea vivo pero claramente "en espera"
      euler.set(0, t / 4000, 0, 'YXZ');
      objetivo.setFromEuler(euler);
    }
    pivote.quaternion.slerp(objetivo, 1 - Math.exp(-dt * 8));

    const marcas = (S && S.marcas) || {};
    const fase = T ? T.estado : 0;
    const metaSep = marcas.desacople ? 1 : 0;
    const metaDes = marcas.autogiro || fase === 3 ? 1 : 0;
    separacion += (metaSep - separacion) * (1 - Math.exp(-dt * (metaSep ? 0.9 : 6)));
    despliegue += (metaDes - despliegue) * (1 - Math.exp(-dt * 3));
    const metaVel = fase === 3 ? 9 : (fase === 4 ? 0 : 0);
    velGiro += (metaVel * despliegue - velGiro) * (1 - Math.exp(-dt * (fase === 4 ? 0.8 : 1.5)));
    giro += velGiro * dt;
    cansat.actualizar({ separacion: Math.min(1, separacion), despliegue, giro });
    tarjeta.classList.toggle('en-espera', quieto);
    renderer.render(escena, camara);
  }
  requestAnimationFrame(cuadro);
}

iniciar().catch((e) => console.error('[visor3d]', e));
