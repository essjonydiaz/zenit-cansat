// =============================================================================
//  mision3d.js — Escena de misión en 3D para la tercera edición (v3.html)
//
//  Lee el mismo estado que el resto del panel (window.zenit.estado(), de app.js)
//  y dibuja el vuelo en metros:
//    altura de la trama T            → el CanSat sube y baja por la regla
//    GPS de la primaria (trama P)    → se mueve en el plano y deja su rastro
//    roll / pitch / yaw              → orientación del modelo
//    DESACOPLE / AUTOGIRO / fase     → la secundaria cae, las aspas se abren y giran
//    baliza de la secundaria (B)     → columna de luz donde está
//  Solo lee: no toma decisiones de misión. Sin WebGL, el panel sigue abajo.
// =============================================================================
import * as THREE from 'three';
import { crearCanSat, prepararEstudio, webglDisponible } from './cansat3d.js';

const ESCALA = 0.01 * 9;          // el modelo está en cm; se ve 9 veces más grande para leerlo
const LIBERACION = 450, DESACOPLE = 200, TOPE = 520;
// Con "reducir movimiento" la cámara no gira sola y nada late; el CanSat
// sigue moviéndose con los datos (eso es telemetría, no adorno).
const reducido = matchMedia('(prefers-reduced-motion: reduce)');

const lienzo = document.getElementById('escenaMision');
const zona = lienzo && lienzo.parentElement;

function textoSprite(texto, color = '#cfe0ff', tam = 64, peso = 700) {
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  g.font = `${peso} ${tam}px "Archivo Variable", sans-serif`;
  const w = Math.ceil(g.measureText(texto).width) + 24;
  c.width = w; c.height = tam + 24;
  g.font = `${peso} ${tam}px "Archivo Variable", sans-serif`;
  g.fillStyle = color;
  g.textBaseline = 'middle';
  g.fillText(texto, 12, c.height / 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
  s.userData.aspecto = c.width / c.height;
  return s;
}

async function iniciar() {
  if (!lienzo) return;
  if (!webglDisponible()) { document.getElementById('escenaEspera').hidden = false; return; }
  await document.fonts.ready.catch(() => {});
  const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  const escena = new THREE.Scene();
  const camara = new THREE.PerspectiveCamera(42, 1, 0.05, 6000);
  await prepararEstudio(renderer, escena, { intensidad: 0.5 });

  // ------------------------------------------------------------ cielo --
  const cielo = new THREE.Mesh(
    new THREE.SphereGeometry(3000, 48, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      uniforms: { uAlto: { value: 0 } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
      fragmentShader: `varying vec3 vP; uniform float uAlto;
        void main(){
          float h = clamp(vP.y, -0.2, 1.0);
          vec3 horizonte = mix(vec3(0.09,0.22,0.5), vec3(0.03,0.08,0.2), uAlto);
          vec3 cenit = mix(vec3(0.02,0.07,0.2), vec3(0.004,0.008,0.025), uAlto);
          vec3 c = mix(horizonte, cenit, smoothstep(0.0, 0.6, h));
          c += vec3(0.18,0.38,1.0) * 0.35 * exp(-abs(h) * 18.0);   // brillo azul del horizonte (como el logo)
          gl_FragColor = vec4(c, 1.0);
        }`,
    }),
  );
  escena.add(cielo);
  const nEst = 1600;
  const pos = new Float32Array(nEst * 3);
  for (let i = 0; i < nEst; i++) {
    const v = new THREE.Vector3().randomDirection();
    v.y = Math.abs(v.y) * 0.9 + 0.08;
    v.normalize().multiplyScalar(2800);
    pos.set([v.x, v.y, v.z], i * 3);
  }
  const geoEst = new THREE.BufferGeometry();
  geoEst.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const estrellas = new THREE.Points(geoEst, new THREE.PointsMaterial({ color: 0xe6eeff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.2, depthWrite: false, fog: false }));
  escena.add(estrellas);

  // ------------------------------------------------------------ suelo --
  escena.fog = new THREE.Fog(0x0b1d44, 80, 1100);
  const suelo = new THREE.Mesh(new THREE.CircleGeometry(2000, 96), new THREE.MeshBasicMaterial({ color: 0x040b1c }));
  suelo.rotation.x = -Math.PI / 2;
  escena.add(suelo);
  const rejilla = new THREE.GridHelper(1200, 240, 0x3d7bff, 0x1c3a78);
  rejilla.material.transparent = true; rejilla.material.opacity = 0.75;
  rejilla.position.y = 0.01;
  escena.add(rejilla);
  const plataforma = new THREE.Mesh(new THREE.RingGeometry(1.6, 1.9, 64), new THREE.MeshBasicMaterial({ color: 0x6d9bff, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
  plataforma.rotation.x = -Math.PI / 2; plataforma.position.y = 0.02;
  escena.add(plataforma);

  // --------------------------------- regla de altura y anillos de misión --
  // Acompañan al CanSat en el plano (x, z) para que siempre estén a la vista.
  const guia = new THREE.Group();
  escena.add(guia);
  const lineaMat = new THREE.LineBasicMaterial({ color: 0xa9c6ff, transparent: true, opacity: 0.85 });
  // El eje de la regla es una franja y no una línea: una línea de 1 px y 520 m
  // de largo no se dibujaba en algunos WebGL.
  const eje = new THREE.Mesh(new THREE.PlaneGeometry(0.03, TOPE), new THREE.MeshBasicMaterial({ color: 0xa9c6ff, transparent: true, opacity: 0.85, depthWrite: false }));
  eje.position.set(-1.7, TOPE / 2, 0);
  guia.add(eje);
  const puntosRegla = [];
  // Marca cada metro (más larga cada 5 y cada 50): pasan corriendo al subir y bajar
  for (let h = 0; h <= TOPE; h += 1) {
    const largo = h % 50 === 0 ? 0.55 : h % 5 === 0 ? 0.3 : 0.12;
    puntosRegla.push(new THREE.Vector3(-1.7, h, 0), new THREE.Vector3(-1.7 + largo, h, 0));
  }
  guia.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(puntosRegla), lineaMat));
  for (let h = 2; h <= 500; h += 2) {
    if (h === LIBERACION || h === DESACOPLE) continue;
    const grande = h % 10 === 0;
    const s = textoSprite(h % 50 === 0 ? `${h} m` : String(h), grande ? '#dfe8ff' : '#8ea3cc', 48, grande ? 700 : 500);
    const alto = grande ? 0.24 : 0.16;
    s.scale.set(alto * s.userData.aspecto, alto, 1);
    s.position.set(-1.7 + 0.4 + (alto / 2) * s.userData.aspecto, h, 0);   // a la derecha de la regla, sin tocar al CanSat
    guia.add(s);
  }
  const anillo = (h, color, texto) => {
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.035, 8, 96), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }));
    m.rotation.x = Math.PI / 2;
    const halo = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.09, 8, 96), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.rotation.x = Math.PI / 2;
    // etiqueta al frente del anillo (el grupo gira para mirar a la cámara)
    const s = textoSprite(texto, '#ffffff', 56, 800);
    s.scale.set(0.2 * s.userData.aspecto, 0.2, 1);
    s.position.set(0, 0.42, 2.15);
    g.add(m, halo, s);
    g.position.y = h;
    guia.add(g);
    return g;
  };
  const anilloLib = anillo(LIBERACION, 0x6d9bff, 'LIBERACIÓN · 450 m');
  const anilloDes = anillo(DESACOPLE, 0xf6b73c, 'DESACOPLE · 200 m');

  // ---------------------------------------------------------- el CanSat --
  const cansat = crearCanSat({ calidad: 'alta' });
  const soporte = new THREE.Group();
  const pivote = new THREE.Group();
  cansat.grupo.scale.setScalar(ESCALA);
  pivote.add(cansat.grupo);
  soporte.add(pivote);
  escena.add(soporte);
  const medioAlto = (cansat.medidas.ALTO / 2) * ESCALA;
  const medioSinSec = -cansat.medidas.UNION * ESCALA;   // ya sin la secundaria, la base es la unión

  // rastro de la trayectoria
  const MAX_RASTRO = 4000;
  const posRastro = new Float32Array(MAX_RASTRO * 3);
  const geoRastro = new THREE.BufferGeometry();
  geoRastro.setAttribute('position', new THREE.BufferAttribute(posRastro, 3));
  geoRastro.setDrawRange(0, 0);
  const rastro = new THREE.Line(geoRastro, new THREE.LineBasicMaterial({ color: 0x8fd8ff, transparent: true, opacity: 0.75 }));
  escena.add(rastro);
  let nRastro = 0, ultimoRastro = null;

  // baliza de la secundaria: columna de luz y anillo que late
  const baliza = new THREE.Group();
  baliza.add(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xf6b73c, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false })));
  baliza.children[0].position.y = 30;
  const pulsoBaliza = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.8, 48), new THREE.MeshBasicMaterial({ color: 0xf6b73c, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
  pulsoBaliza.rotation.x = -Math.PI / 2; pulsoBaliza.position.y = 0.05;
  baliza.add(pulsoBaliza);
  const etiquetaBaliza = textoSprite('SECUNDARIA', '#f6b73c', 48, 800);
  etiquetaBaliza.scale.set(0.5 * etiquetaBaliza.userData.aspecto, 0.5, 1);
  etiquetaBaliza.position.y = 2.2;
  baliza.add(etiquetaBaliza);
  baliza.visible = false;
  escena.add(baliza);

  // ------------------------------------------------------------ cámara --
  const puntero = { x: 0, y: 0 };
  addEventListener('pointermove', (e) => { puntero.x = (e.clientX / innerWidth) * 2 - 1; puntero.y = (e.clientY / innerHeight) * 2 - 1; }, { passive: true });
  function medir() {
    const w = lienzo.clientWidth, h = lienzo.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camara.aspect = w / h;
    camara.updateProjectionMatrix();
  }
  new ResizeObserver(medir).observe(lienzo);
  medir();

  // Solo se dibuja cuando la escena está a la vista (al bajar al panel se pausa)
  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0.02 }).observe(zona);

  const rad = THREE.MathUtils.degToRad;
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  const objetivo = new THREE.Quaternion();
  const mirar = new THREE.Vector3(), desfase = new THREE.Vector3(0, 1.1, 7.2), desfaseMeta = new THREE.Vector3();
  let alt = 0, x = 0, z = 0, separacion = 0, despliegue = 0, giro = 0, velGiro = 0, previo = performance.now();

  const medioAltoActual = () => THREE.MathUtils.lerp(medioAlto, medioSinSec, Math.min(1, separacion));

  function cuadro(t) {
    requestAnimationFrame(cuadro);
    if (!visible || document.hidden) { previo = t; return; }
    const dt = Math.min(0.1, (t - previo) / 1000);
    previo = t;
    const S = window.zenit && window.zenit.estado();
    const T = S && S.T;
    const fase = T ? T.estado : 0;

    // altura y posición (las tramas llegan a 2 Hz: se suaviza el movimiento)
    const metaAlt = T ? Math.max(0, T.alt) : 0;
    alt += (metaAlt - alt) * (1 - Math.exp(-dt * 3.5));
    let metaX = 0, metaZ = 0;
    if (S && S.P && S.P.fix && S.lanzamiento && typeof metros === 'function') {
      const [este, norte] = metros(S.P.lat, S.P.lon, S.lanzamiento);
      metaX = este; metaZ = -norte;
    }
    x += (metaX - x) * (1 - Math.exp(-dt * 2));
    z += (metaZ - z) * (1 - Math.exp(-dt * 2));
    soporte.position.set(x, alt + medioAltoActual(), z);
    guia.position.set(x, 0, z);

    // orientación
    if (T) euler.set(rad(T.pitch || 0), rad(-(T.yaw || 0)), rad(-(T.roll || 0)), 'YXZ');
    else euler.set(0, t / 5000, 0, 'YXZ');
    objetivo.setFromEuler(euler);
    pivote.quaternion.slerp(objetivo, 1 - Math.exp(-dt * 6));

    // separación y autogiro (mismas reglas que el visor del panel)
    const marcas = (S && S.marcas) || {};
    const metaSep = marcas.desacople ? 1 : 0;
    const metaDes = marcas.autogiro || fase === 3 || (fase === 4 && marcas.autogiro) ? 1 : 0;
    separacion += (metaSep - separacion) * (1 - Math.exp(-dt * (metaSep ? 0.9 : 6)));
    despliegue += (metaDes - despliegue) * (1 - Math.exp(-dt * 3));
    const metaVel = fase === 3 ? 4 + Math.min(10, Math.abs(T.vel || 0)) : 0;
    velGiro += (metaVel * despliegue - velGiro) * (1 - Math.exp(-dt * (fase === 4 ? 0.8 : 1.5)));
    giro += velGiro * dt;
    cansat.actualizar({ separacion: Math.min(1, separacion), despliegue, giro });

    // rastro: un punto nuevo cada 0.5 m recorridos
    const aqui = new THREE.Vector3(x, alt + 0.05, z);
    if (T && T.estado >= 1 && (!ultimoRastro || ultimoRastro.distanceTo(aqui) > 0.5) && nRastro < MAX_RASTRO) {
      posRastro.set([aqui.x, aqui.y, aqui.z], nRastro * 3);
      nRastro++;
      geoRastro.setDrawRange(0, nRastro);
      geoRastro.attributes.position.needsUpdate = true;
      ultimoRastro = aqui.clone();
    }
    if (S && T && T.estado === 0 && nRastro > 0 && alt < 1) { nRastro = 0; ultimoRastro = null; geoRastro.setDrawRange(0, 0); }

    // baliza de la secundaria
    const B = S && S.B;
    if (B && B.fix && S.lanzamiento && typeof metros === 'function') {
      const [este, norte] = metros(B.lat, B.lon, S.lanzamiento);
      baliza.position.set(este, 0, -norte);
      baliza.visible = separacion > 0.9;        // aparece cuando ya se separó
      const p = reducido.matches ? 0.3 : (t / 1400) % 1;
      pulsoBaliza.scale.setScalar(1 + p * 4);
      pulsoBaliza.material.opacity = 1 - p;
    } else baliza.visible = false;

    // anillos: brillan al cruzarlos
    [[anilloLib, LIBERACION], [anilloDes, DESACOPLE]].forEach(([a, h]) => {
      const cerca = Math.max(0, 1 - Math.abs(alt - h) / 25);
      a.children[1].material.opacity = 0.06 + cerca * 0.22;
      a.children[0].material.opacity = 0.6 + cerca * 0.4;
    });

    // cielo: más oscuro y con más estrellas mientras más alto
    const k = Math.min(1, alt / LIBERACION);
    cielo.material.uniforms.uAlto.value = k;
    estrellas.material.opacity = 0.15 + k * 0.7;
    cielo.position.copy(camara.position);
    estrellas.position.copy(camara.position);
    plataforma.material.opacity = reducido.matches ? 0.8 : 0.5 + 0.4 * Math.sin(t / 400);

    // cámara: sigue al CanSat, gira despacio y se inclina con el puntero
    const ang = (reducido.matches ? 0.6 : t / 16000) + puntero.x * 0.5;
    const dist = 7.2;
    // La cámara va pegada al CanSat (aunque caiga a 36 m/s); solo el ángulo
    // de órbita se suaviza.
    mirar.set(x, alt + medioAltoActual(), z);
    desfaseMeta.set(Math.sin(ang) * dist, 1.1 - puntero.y * 0.8, Math.cos(ang) * dist);
    desfase.lerp(desfaseMeta, 1 - Math.exp(-dt * 4));
    camara.position.copy(mirar).add(desfase);
    if (camara.position.y < 0.4) camara.position.y = 0.4;
    camara.lookAt(mirar);
    guia.rotation.y = Math.atan2(desfase.x, desfase.z);   // la regla siempre queda a la izquierda de la pantalla

    renderer.render(escena, camara);
  }
  requestAnimationFrame(cuadro);
}

iniciar().catch((e) => {
  console.error('[mision3d]', e);
  const aviso = document.getElementById('escenaEspera');
  if (aviso) aviso.hidden = false;
});
