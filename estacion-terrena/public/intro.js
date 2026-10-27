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
//    data-una-vez   "sesion": en el panel solo sale la primera vez por pestaña
//                   (o siempre que la dirección traiga ?intro=1),
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

  // "?intro=1" (los botones "Abrir panel" del prototipo) pide la intro aunque ya
  // se haya visto; se quita de la dirección para que recargar no la repita.
  const pedida = new URLSearchParams(location.search).has('intro');
  if (pedida) {
    const url = new URL(location.href);
    url.searchParams.delete('intro');
    history.replaceState(null, '', url.pathname + url.search + url.hash);
  }

  let vista = false;
  try { vista = !pedida && unaVez && sessionStorage.getItem('zenit-intro') === '1'; } catch { /* sin almacenamiento */ }
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

  // Suena en el prototipo y cuando el panel se abre desde ahí (?intro=1); en el
  // uso normal del panel nunca.
  if ((script.dataset.sonido === 'si' || pedida) && !quieto) sonidoDespegue(inicio);

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
  capa.addEventListener('pointerdown', () => { clearTimeout(temporizador); cerrar(); });
  addEventListener('keydown', function tecla(ev) {
    if (['Escape', 'Enter', ' '].includes(ev.key)) { clearTimeout(temporizador); cerrar(); removeEventListener('keydown', tecla); }
  });

  // ---------------------------------------------------------------- sonido --
  // Solo en la página del prototipo (data-sonido="si"); el panel nunca suena.
  // Se sintetiza con Web Audio (sin archivos). Los navegadores no dejan sonar
  // nada hasta que la persona hace clic o toca una tecla: si el audio está
  // bloqueado, arranca con ese primer gesto desde el punto en que va la intro.
  function sonidoDespegue(t0) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    let ctx;
    try { ctx = new Ctx(); } catch { return; }
    const salida = ctx.createGain();
    salida.gain.value = 0.55;
    salida.connect(ctx.destination);

    const ruido = (seg) => {
      const b = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seg), ctx.sampleRate);
      const d = b.getChannelData(0);
      let ult = 0;
      for (let i = 0; i < d.length; i++) { ult = (ult + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = ult * 3.5; }  // ruido café
      const f = ctx.createBufferSource();
      f.buffer = b;
      return f;
    };
    const envolvente = (g, t, puntos) => {
      g.gain.setValueAtTime(0.0001, t);
      puntos.forEach(([dt, v]) => g.gain.exponentialRampToValueAtTime(Math.max(0.0001, v), t + dt));
    };

    // retumbe grave mientras sube la lata
    function retumbe(t) {
      const f = ruido(1.6), pb = ctx.createBiquadFilter(), g = ctx.createGain();
      pb.type = 'lowpass'; pb.frequency.value = 140;
      envolvente(g, t, [[0.5, 0.9], [1.2, 0.5], [1.55, 0.0001]]);
      f.connect(pb).connect(g).connect(salida);
      f.start(t); f.stop(t + 1.6);
    }
    // golpe + "whoosh" cuando despega el huevo
    function despegue(t) {
      const o = ctx.createOscillator(), go = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.35);
      envolvente(go, t, [[0.02, 0.9], [0.4, 0.0001]]);
      o.connect(go).connect(salida);
      o.start(t); o.stop(t + 0.45);
      const f = ruido(1.1), bp = ctx.createBiquadFilter(), g = ctx.createGain();
      bp.type = 'bandpass'; bp.Q.value = 0.9;
      bp.frequency.setValueAtTime(350, t); bp.frequency.exponentialRampToValueAtTime(3200, t + 0.7);
      envolvente(g, t, [[0.06, 0.8], [0.35, 0.45], [1.0, 0.0001]]);
      f.connect(bp).connect(g).connect(salida);
      f.start(t); f.stop(t + 1.1);
    }
    // brillo suave cuando aparece el nombre
    function brillo(t) {
      [880, 1318.5, 1760].forEach((hz, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = hz;
        envolvente(g, t + i * 0.06, [[0.04, 0.12 / (i + 1)], [1.6, 0.0001]]);
        o.connect(g).connect(salida);
        o.start(t + i * 0.06); o.stop(t + 1.8);
      });
    }

    // momentos de la intro (en segundos, iguales a base.css)
    const eventos = [[0.7, retumbe], [1.55, despegue], [2.05, brillo]];
    let programado = false;
    function programar() {
      if (programado || ctx.state !== 'running') return;
      programado = true;
      const pasado = (performance.now() - t0) / 1000;
      if (pasado > 4) { ctx.close().catch(() => {}); return; }   // la intro ya terminó: no suena después
      eventos.forEach(([seg, fn]) => {
        const falta = seg - pasado;
        if (falta > -0.3) fn(ctx.currentTime + Math.max(0.02, falta));
        else if (fn === despegue) fn(ctx.currentTime + 0.02);   // si ya pasó, suena al menos el despegue
      });
      setTimeout(() => ctx.close().catch(() => {}), 6000);
    }
    const desbloquear = () => {
      ctx.resume().then(programar).catch(() => {});
      ['pointerdown', 'keydown'].forEach((e) => removeEventListener(e, desbloquear, true));
    };
    ctx.resume().then(programar).catch(() => {});
    if (ctx.state !== 'running') ['pointerdown', 'keydown'].forEach((e) => addEventListener(e, desbloquear, true));
  }
})();
