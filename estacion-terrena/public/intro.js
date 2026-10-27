// =============================================================================
//  Intro con el logo de Zénit (panel y página del prototipo)
//
//  El logo se recorta en capas (todas usan logo-zenit.jpeg; el negro desaparece
//  con mix-blend-mode: screen) y se cuenta como un despegue: horizonte → aro →
//  sube la lata con su escape → destello → el huevo despega con su estela → nombre.
//  Las capas y los tiempos están en base.css (sección INTRO).
//
//  <script src="intro.js" data-duracion="2900" data-una-vez="sesion"></script>
//    data-duracion  ms antes de levantarse sola
//    data-una-vez   "sesion": en el panel solo sale la primera vez por pestaña,
//                   para que recargar en pleno vuelo no tape la telemetría.
//  Entra sola; clic, Esc, Enter o espacio la adelantan. Al terminar dispara
//  "zenit:intro-fin".
// =============================================================================
'use strict';

(function () {
  const script = document.currentScript;
  const duracion = Number(script.dataset.duracion || 2900);
  const unaVez = script.dataset.unaVez === 'sesion';
  const terminar = () => { window.zenitIntroTerminada = true; window.dispatchEvent(new Event('zenit:intro-fin')); };

  let vista = false;
  try { vista = unaVez && sessionStorage.getItem('zenit-intro') === '1'; } catch { /* sin almacenamiento */ }
  if (vista) { document.documentElement.classList.add('sin-intro'); queueMicrotask(terminar); return; }
  try { if (unaVez) sessionStorage.setItem('zenit-intro', '1'); } catch { /* sin almacenamiento */ }

  const capa = document.createElement('div');
  capa.className = 'intro';
  capa.setAttribute('role', 'presentation');
  capa.innerHTML = `
    <canvas class="intro-estrellas" aria-hidden="true"></canvas>
    <div class="intro-escena">
      <div class="intro-logo" role="img" aria-label="Zénit México">
        <i class="c c-horizonte"></i><i class="c c-aro"></i>
        <i class="c c-escape"></i><i class="c c-lata"></i>
        <i class="intro-destello"></i>
        <i class="c c-estela"></i><i class="c c-huevo"></i>
        <i class="c c-nombre"></i><i class="c c-pais"></i>
      </div>
    </div>`;
  document.documentElement.classList.add('con-intro');
  document.body.prepend(capa);

  // Estrellas que se alejan (sensación de subir)
  const lienzo = capa.querySelector('canvas');
  const ctx = lienzo.getContext('2d');
  const estrellas = Array.from({ length: 220 }, () => ({ x: Math.random() * 2 - 1, y: Math.random() * 2 - 1, z: Math.random() }));
  let w = 0, h = 0, cuadro = 0, inicio = performance.now();
  function medir() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    w = lienzo.width = innerWidth * dpr; h = lienzo.height = innerHeight * dpr;
  }
  medir();
  addEventListener('resize', medir);
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function dibujar(t) {
    const avance = Math.min(1, (t - inicio) / duracion);
    ctx.clearRect(0, 0, w, h);
    const vel = quieto ? 0 : 0.0025 + avance * 0.012;
    for (const e of estrellas) {
      e.z -= vel;
      if (e.z <= 0.02) { e.z = 1; e.x = Math.random() * 2 - 1; e.y = Math.random() * 2 - 1; }
      const px = w / 2 + (e.x / e.z) * w * 0.35, py = h / 2 + (e.y / e.z) * h * 0.35;
      const r = (1 - e.z) * 2.2 * (w / innerWidth);
      ctx.globalAlpha = Math.min(1, (1 - e.z) * 1.4);
      ctx.fillStyle = e.z < 0.3 ? '#cfe0ff' : '#ffffff';
      ctx.fillRect(px, py, r, r);
    }
    cuadro = requestAnimationFrame(dibujar);
  }
  cuadro = requestAnimationFrame(dibujar);

  let cerrada = false;
  function cerrar() {
    if (cerrada) return;
    cerrada = true;
    capa.classList.add('saliendo');
    document.documentElement.classList.remove('con-intro');
    terminar();
    setTimeout(() => { cancelAnimationFrame(cuadro); removeEventListener('resize', medir); capa.remove(); }, 900);
  }
  const temporizador = setTimeout(cerrar, quieto ? 600 : duracion);
  capa.addEventListener('click', () => { clearTimeout(temporizador); cerrar(); });
  addEventListener('keydown', function tecla(ev) {
    if (['Escape', 'Enter', ' '].includes(ev.key)) { clearTimeout(temporizador); cerrar(); removeEventListener('keydown', tecla); }
  });
})();
