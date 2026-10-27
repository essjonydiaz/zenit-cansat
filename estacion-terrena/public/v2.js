// =============================================================================
//  v2.js — Segunda edición del panel (v2.html)
//
//  Se carga DESPUÉS de app.js y reutiliza todo su estado y sus funciones (las
//  declaraciones de nivel superior de un <script> clásico son globales). Aquí
//  solo se agrega o se corrige encima, así la primera edición (index.html)
//  queda igual y se pueden comparar lado a lado.
//
//  Cambios:
//   1. Un solo reloj: gráficas, marcas y línea de eventos cuentan desde el
//      evento ARRANQUE (antes las gráficas usaban el reloj de la placa).
//   2. Etiquetas de eventos en las gráficas sin encimarse (se acomodan en
//      renglones solo cuando chocan) y la banda del autogiro sin texto encima.
//   3. Franja "Estado de la misión": fase en grande, tiempo de misión, altura,
//      velocidad y el siguiente hito con su barra de avance.
//   4. Tarjeta "Enlace LoRa": RSSI de los últimos 2 min, SNR y pérdidas.
//   5. Avisos que caducan: vistos a los 90 s, borrados a los 5 min.
//   6. Aceleración en m/s² (como pide el PDR, diap. 24) con opción de ver g.
// =============================================================================
'use strict';

(() => {
  const G0 = 9.80665;
  const COLOR_FASE_V2 = ['--f-prevuelo', '--f-ascenso', '--f-caida', '--f-autogiro', '--f-aterrizado'];
  const reducido = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------------------------------------------------------- 1. un reloj --
  const t0 = () => (S.hitos.ARRANQUE !== undefined ? S.hitos.ARRANQUE : 0);
  const rel = (t) => t - t0();

  // Paso "redondo" para que el eje marque 0, 10, 20… desde el arranque (no 1, 7, 17).
  const pasoRedondo = (rango, maxMarcas = 8) => [1, 2, 5, 10, 15, 20, 30, 60, 120, 300, 600, 1200].find((p) => rango / p <= maxMarcas) || 3600;
  function marcasRedondas(eje) {
    const a = t0();
    const lo = eje.min - a, hi = eje.max - a;
    const paso = pasoRedondo(hi - lo);
    const marcas = [];
    for (let v = Math.ceil(lo / paso) * paso; v <= hi + 1e-6; v += paso) marcas.push({ value: v + a });
    eje.ticks = marcas;
  }

  function ejesRelativos() {
    Object.entries(graficas).forEach(([k, g]) => {
      const x = g.options.scales.x;
      x.afterBuildTicks = marcasRedondas;
      x.ticks = { ...(x.ticks || {}), callback: (v) => fmt(rel(v), 0) };
      x.title = { ...(x.title || {}), display: true, text: 'Tiempo desde el arranque (s)' };
      const y = g.options.scales.y;
      const titulo = { alt: 'm', vel: 'm/s', acel: unidadAcel === 'g' ? 'g' : 'm/s²' }[k];
      y.title = { display: true, text: titulo, color: css('--tenue') };
      g.options.plugins.tooltip.callbacks.title = (it) => `T+ ${mmss(rel(it[0].parsed.x))} (${fmt(rel(it[0].parsed.x), 1)} s)`;
    });
  }

  // ------------------------------- 2. marcas de eventos sin encimarse ----
  const MARGEN_ETIQUETAS = 38;   // alto reservado arriba de cada gráfica (2 renglones)
  Object.values(graficas).forEach((g) => { g.options.layout = { padding: { top: MARGEN_ETIQUETAS } }; });
  graficas.acel.options.plugins.legend.position = 'bottom';
  marcasEventos.afterDatasetsDraw = function (chart) {
    const { ctx, chartArea: a, scales: { x } } = chart;
    if (!a) return;
    const lista = [['liberacion', 'Liberación', '--azul-texto'], ['desacople', 'Desacople', '--aviso'],
      ['autogiro', 'Autogiro', '--f-autogiro'], ['aterrizaje', 'Aterrizaje', '--ok']];
    let marcas = lista.map(([k, texto, color]) => ({ m: S.marcas[k], texto, color: css(color) }))
      .filter((o) => o.m && Number.isFinite(o.m.t))
      .map((o) => ({ ...o, px: x.getPixelForValue(o.m.t) }))
      .filter((o) => o.px >= a.left && o.px <= a.right)
      .sort((p, q) => p.px - q.px);
    // El autogiro abre 400 ms después del desacople: en la gráfica son un solo momento.
    marcas = marcas.reduce((acc, o) => {
      const prev = acc[acc.length - 1];
      if (prev && Math.abs(o.m.t - prev.m.t) < 1.5) { prev.texto = `${prev.texto} y ${o.texto.toLowerCase()}`; return acc; }
      acc.push({ ...o });
      return acc;
    }, []);
    ctx.save();
    ctx.font = '600 9.5px "Archivo Variable", "Segoe UI", sans-serif';
    // Autogiro sale 400 ms después del desacople: si caen en el mismo píxel, se dibuja una sola línea.
    let ultimaLinea = -99;
    marcas.forEach((o) => {
      if (Math.abs(o.px - ultimaLinea) < 2) return;
      ultimaLinea = o.px;
      ctx.strokeStyle = o.color;
      ctx.globalAlpha = 0.85;
      ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(o.px, a.top - MARGEN_ETIQUETAS + 2); ctx.lineTo(o.px, a.bottom); ctx.stroke();
    });
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    // Píldoras: se acomodan en el primer renglón libre (como bloques en una repisa).
    const renglones = [];
    const alto = 15, padX = 5;
    marcas.forEach((o) => {
      const texto = `${o.texto} ${mmss(rel(o.m.t))}`;
      const w = ctx.measureText(texto).width + padX * 2;
      let x0 = o.px - w / 2;
      x0 = Math.max(a.left + 2, Math.min(a.right - w - 2, x0));
      let fila = 0;
      while (renglones[fila] !== undefined && renglones[fila] > x0 - 4) fila++;
      renglones[fila] = x0 + w;
      // Los dos primeros renglones van en el margen de arriba (fuera de los datos).
      const y0 = a.top - MARGEN_ETIQUETAS + 2 + fila * (alto + 3);
      ctx.fillStyle = css('--tarjeta').startsWith('rgba') ? 'rgba(8,13,24,0.92)' : 'rgba(255,255,255,0.95)';
      ctx.strokeStyle = o.color;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x0, y0, w, alto, 7); else ctx.rect(x0, y0, w, alto);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = o.color;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(texto, x0 + padX, y0 + alto / 2 + 0.5);
    });
    ctx.restore();
  };

  // La banda verde se queda; su texto pasa a la cabeza de la tarjeta.
  bandaAutogiro.beforeDatasetsDraw = function (chart) {
    const { ctx, chartArea: a, scales: { y } } = chart;
    if (!a) return;
    const y1 = y.getPixelForValue(-8), y2 = y.getPixelForValue(-12);
    ctx.save();
    ctx.fillStyle = css('--ok-fondo');
    ctx.fillRect(a.left, Math.min(y1, y2), a.right - a.left, Math.abs(y2 - y1));
    ctx.strokeStyle = css('--ok');
    ctx.globalAlpha = 0.5;
    ctx.setLineDash([2, 3]);
    [y1, y2].forEach((yy) => { ctx.beginPath(); ctx.moveTo(a.left, yy); ctx.lineTo(a.right, yy); ctx.stroke(); });
    ctx.restore();
  };

  // ------------------------------------------- 6. aceleración en m/s² ----
  let unidadAcel = 'ms2';
  try { unidadAcel = localStorage.getItem('zenit-acel') || 'ms2'; } catch { /* sin almacenamiento */ }
  const cacheAcel = { ax: { n: -1, d: [] }, ay: { n: -1, d: [] }, az: { n: -1, d: [] } };
  function serieAcel(k) {
    const src = S.series[k];
    if (unidadAcel === 'g') return src;
    const c = cacheAcel[k];
    // Las series solo crecen (o se reinician): se convierte únicamente lo nuevo.
    if (c.src !== src || c.d.length > src.length || (src.length && c.d.length && c.d[0].x !== src[0].x)) { c.src = src; c.d = []; }
    for (let i = c.d.length; i < src.length; i++) c.d.push({ x: src[i].x, y: src[i].y * G0 });
    return c.d;
  }
  function aplicarUnidad() {
    document.querySelectorAll('.unidades button').forEach((b) => b.classList.toggle('activo', b.dataset.u === unidadAcel));
    const y = graficas.acel.options.scales.y;
    if (unidadAcel === 'g') { y.suggestedMin = -1; y.suggestedMax = 2; } else { y.suggestedMin = -10; y.suggestedMax = 20; }
    ejesRelativos();
    S.graficasSucias = true;
  }
  document.querySelectorAll('.unidades button').forEach((b) => {
    b.onclick = () => {
      unidadAcel = b.dataset.u;
      try { localStorage.setItem('zenit-acel', unidadAcel); } catch { /* sin almacenamiento */ }
      aplicarUnidad();
    };
  });

  // Versión propia de dibujarGraficas: igual que la original, con m/s² y el reloj único.
  dibujarGraficas = function () {
    const T = S.T;
    graficas.alt.data.datasets[0].data = S.series.alt;
    graficas.vel.data.datasets[0].data = S.series.vel;
    graficas.acel.data.datasets[0].data = serieAcel('ax');
    graficas.acel.data.datasets[1].data = serieAcel('ay');
    graficas.acel.data.datasets[2].data = serieAcel('az');
    const tUlt = S.series.alt.length ? S.series.alt[S.series.alt.length - 1].x : null;
    Object.entries(graficas).forEach(([k, g]) => {
      const r = rangos[k];
      if (tUlt === null) {
        g.options.scales.x.min = undefined;
        g.options.scales.x.max = undefined;
      } else {
        const ini = S.series.alt[0].x;
        const min = r ? Math.max(ini, tUlt - r) : Math.max(ini, Math.floor(ini / 5) * 5);
        g.options.scales.x.min = min;
        g.options.scales.x.max = Math.max(tUlt, min + 30);
      }
      g.update('none');
    });
    $('gAltValor').textContent = T ? `${fmt(T.alt)} m` : '—';
    $('gAltMax').textContent = T ? `${fmt(T.alt_max)} m` : '—';
    $('gVelValor').textContent = T ? `${fmt(T.vel)} m/s` : '—';
    const modulo = T ? Math.hypot(T.ax, T.ay, T.az) : null;
    $('gAcelValor').textContent = T ? (unidadAcel === 'g' ? `${fmt(modulo, 2)} g` : `${fmt(modulo * G0, 1)} m/s²`) : '';
  };

  // Perfil de misión: igual que el original, pero el eje de tiempo cuenta desde el arranque.
  dibujarPerfil = function () {
    const el = $('perfil');
    const W = Math.max(300, el.clientWidth || 800), H = 150;
    el.setAttribute('viewBox', `0 0 ${W} ${H}`);
    el.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    el.textContent = '';
    const plan = planRestante();
    const tFin = Math.max(plan[plan.length - 1][0], S.perfil.length ? S.perfil[S.perfil.length - 1].t : 0, 60);
    const hMax = Math.max(500, S.T ? S.T.alt_max * 1.1 : 0);
    const mL = 40, mR = 10, mT = 10, mB = 20;
    const x = (t) => mL + (t / tFin) * (W - mL - mR);
    const y = (h) => mT + (1 - clamp(h, -20, hMax) / hMax) * (H - mT - mB);
    [0, 200, 400].concat(hMax >= 600 ? [600] : []).forEach((h) => {
      el.append(svg('line', { class: 'rej', x1: mL, x2: W - mR, y1: y(h), y2: y(h) }));
      el.append(svg('text', { class: 'eje', x: mL - 6, y: y(h) + 4, 'text-anchor': 'end' }, String(h)));
    });
    const a = t0();
    const paso = pasoRedondo(tFin - a, 7);
    for (let tr = 0; tr + a <= tFin; tr += paso) {
      el.append(svg('text', { class: 'eje', x: x(tr + a), y: H - 4, 'text-anchor': 'middle' }, `${tr} s`));
    }
    el.append(svg('text', { class: 'eje', x: 4, y: mT + 6 }, 'm'));
    el.append(svg('polyline', { class: 'plan', points: plan.map(([t, h]) => `${x(t)},${y(h)}`).join(' ') }));
    let tramo = [], estado = null;
    const cerrar = () => {
      if (tramo.length > 1) el.append(svg('polyline', { class: 'tramo', stroke: css(COLOR_FASE_V2[estado] || '--f-prevuelo'), points: tramo.join(' ') }));
    };
    S.perfil.forEach((p, i) => {
      if (i % 2 && i !== S.perfil.length - 1) return;
      const pt = `${x(p.t)},${y(p.alt)}`;
      if (p.estado !== estado) { if (tramo.length) tramo.push(pt); cerrar(); tramo = tramo.length ? [tramo[tramo.length - 1]] : []; estado = p.estado; }
      tramo.push(pt);
    });
    cerrar();
    const hito = (m, color, etiqueta) => {
      if (!m) return;
      const p = S.perfil.find((q) => q.t >= m.t) || S.perfil[S.perfil.length - 1];
      if (!p) return;
      el.append(svg('circle', { cx: x(p.t), cy: y(p.alt), r: 4.5, fill: css(color), stroke: css('--fondo'), 'stroke-width': 1.5 }));
      const lx = x(p.t) + 8, ly = y(p.alt) - 14;
      el.append(svg('text', { class: 'hito', x: lx, y: ly }, `${etiqueta} · ${mmss(rel(m.t))}`));
      el.append(svg('text', { class: 'hito-v', x: lx, y: ly + 13 }, `${fmt(m.h, 0)} m`));
    };
    hito(S.marcas.liberacion, '--azul-texto', 'Liberación');
    hito(S.marcas.desacople, '--aviso', 'Desacople');
    const u = S.perfil[S.perfil.length - 1];
    if (u) {
      el.append(svg('circle', { cx: x(u.t), cy: y(u.alt), r: 9, fill: css('--cian'), opacity: 0.25 }));
      el.append(svg('circle', { cx: x(u.t), cy: y(u.alt), r: 5, fill: css('--cian'), stroke: '#fff', 'stroke-width': 1.5 }));
    }
  };

  // colorearGraficas reemplaza los objetos ticks/title: se vuelven a poner los del reloj único.
  const colorearOriginal = colorearGraficas;
  colorearGraficas = function () { colorearOriginal(); ejesRelativos(); Object.values(graficas).forEach((g) => g.update('none')); };

  // ------------------------------------------ 3. estado de la misión -----
  const NOMBRES = ['Prevuelo', 'Ascenso', 'Caída libre', 'Descenso con autogiro', 'Aterrizado'];
  let faseAnterior = null, fasePc = null;
  function siguienteHito(T) {
    const h = T.alt, e = T.estado;
    const barra = (desde, hasta, valor) => clamp((valor - desde) / (hasta - desde), 0, 1);
    if (e === 0) {
      const sello = $('prevueloSello');
      return { titulo: 'Despegue con el dron', det: sello && !sello.hidden ? sello.textContent : 'Verificación prevuelo', avance: Number(($('anilloTexto').textContent || '0/1').split('/')[0]) / Number(($('anilloTexto').textContent || '0/1').split('/')[1] || 1) };
    }
    if (e === 1) return { titulo: 'Liberación a 450 m', det: `faltan ${fmt(Math.max(0, 450 - h), 0)} m de subida`, avance: barra(0, 450, h) };
    if (e === 2) return { titulo: 'Desacople y autogiro a 200 m', det: `faltan ${fmt(Math.max(0, h - 200), 0)} m de caída`, avance: barra(T.alt_max || 450, 200, h) };
    if (e === 3) return { titulo: 'Aterrizaje', det: `faltan ${fmt(Math.max(0, h), 0)} m · ${Math.abs(T.vel) >= 8 && Math.abs(T.vel) <= 12 ? 'velocidad en rango' : 'velocidad fuera de 8–12 m/s'}`, avance: barra(200, 0, h) };
    if (e === 4) {
      const seg = S.marcas.aterrizaje ? Math.max(0, T.t_ms / 1000 - S.marcas.aterrizaje.t) : 0;
      if (S.postOk || seg >= 10) return { titulo: 'Misión completa', det: 'Ya transmitió más de 10 s en tierra. Ve por las dos cargas.', avance: 1 };
      return { titulo: 'Transmitir 10 s en tierra', det: `${fmt(seg, 0)} de 10 s`, avance: seg / 10 };
    }
    return { titulo: '—', det: '', avance: 0 };
  }
  function dibujarEstatus() {
    const T = S.T;
    const sec = $('estatus');
    const e = T ? T.estado : -1;
    if (e !== faseAnterior) {
      if (faseAnterior !== null && e >= 0 && !reducido()) {
        sec.animate([{ boxShadow: '0 0 0 0 transparent' }, { boxShadow: `0 0 0 3px ${css(COLOR_FASE_V2[e])}` }, { boxShadow: '0 0 0 0 transparent' }], { duration: 1100, easing: 'cubic-bezier(.16,1,.3,1)' });
      }
      faseAnterior = e; fasePc = ahora();
    }
    sec.dataset.fase = String(e);
    sec.style.setProperty('--fase', e >= 0 ? css(COLOR_FASE_V2[e]) : css('--gris'));
    const viejo = S.tPriPc && hace(S.tPriPc) > 3;
    sec.classList.toggle('viejo', Boolean(viejo));
    if (!T) {
      $('estFase').textContent = 'Sin telemetría';
      $('estFaseDesde').textContent = fuente.conectado ? 'Esperando la primera trama de la primaria' : 'Conecta el receptor o usa Simulación';
      $('estReloj').textContent = 'T+ --:--';
      ['estAlt', 'estVel'].forEach((id) => { $(id).textContent = '—'; });
      $('estAltMax').textContent = 'máx. —';
      $('estVelNota').innerHTML = '&nbsp;';
      $('estSig').textContent = '—';
      $('estSigDet').innerHTML = '&nbsp;';
      $('estBarra').style.width = '0';
      return;
    }
    $('estFase').textContent = NOMBRES[e] || '—';
    const tFase = (() => {
      const cod = [null, 'ASCENSO', 'LIBERACION', 'AUTOGIRO', 'ATERRIZAJE'][e];
      return cod && S.hitos[cod] !== undefined ? T.t_ms / 1000 - S.hitos[cod] : null;
    })();
    $('estFaseDesde').textContent = viejo ? `Último dato hace ${Math.round(hace(S.tPriPc))} s` : (tFase !== null ? `desde hace ${mmss(tFase)}` : 'en tierra');
    $('estReloj').textContent = `T+ ${mmss(rel(T.t_ms / 1000))}`;
    $('estAlt').textContent = fmt(T.alt);
    $('estAltMax').textContent = `máx. ${fmt(T.alt_max)} m`;
    $('estVel').textContent = fmt(Math.abs(T.vel));
    const v = T.vel;
    $('estVelNota').textContent = Math.abs(v) < 0.3 ? 'quieto' : (v > 0 ? '↑ subiendo' : '↓ bajando');
    const s = siguienteHito(T);
    $('estSig').textContent = s.titulo;
    $('estSigDet').textContent = s.det || ' ';
    $('estBarra').style.width = `${clamp(s.avance || 0, 0, 1) * 100}%`;
  }

  // -------------------------------------------------- 4. enlace LoRa -----
  const historial = [];      // {pc, rssi, snr}
  let ultimoPcMuestra = null;
  function muestrearEnlace() {
    if (S.tAnyPc && S.tAnyPc !== ultimoPcMuestra && S.rssi !== null && S.rssi !== undefined) {
      ultimoPcMuestra = S.tAnyPc;
      historial.push({ pc: ahora(), rssi: S.rssi, snr: S.snr });
    }
    while (historial.length && ahora() - historial[0].pc > 120000) historial.shift();
  }
  function dibujarEnlace() {
    const el = $('lnkGrafica');
    el.textContent = '';
    const W = 240, H = 64, min = -125, max = -40;
    const y = (r) => 4 + (1 - (clamp(r, min, max) - min) / (max - min)) * (H - 8);
    const x = (pc) => W - ((ahora() - pc) / 120000) * W;
    [-60, -90, -110].forEach((r) => el.append(svg('line', { class: 'lnk-rej', x1: 0, x2: W, y1: y(r), y2: y(r) })));
    el.append(svg('line', { class: 'lnk-limite', x1: 0, x2: W, y1: y(-115), y2: y(-115) }));
    if (historial.length > 1) {
      const pts = historial.map((m) => `${x(m.pc).toFixed(1)},${y(m.rssi).toFixed(1)}`);
      el.append(svg('polygon', { class: 'lnk-area', points: `${x(historial[0].pc).toFixed(1)},${H} ${pts.join(' ')} ${x(historial[historial.length - 1].pc).toFixed(1)},${H}` }));
      el.append(svg('polyline', { class: 'lnk-linea', points: pts.join(' ') }));
    } else {
      el.append(svg('text', { class: 'lnk-vacio', x: W / 2, y: H / 2 + 4, 'text-anchor': 'middle' }, 'Sin señal de radio todavía'));
    }
    const r = S.rssi;
    const rs = $('lnkRssi');
    rs.textContent = r === null || r === undefined ? '—' : String(r);
    rs.className = `num ${r === null || r === undefined ? '' : r < -115 ? 'critico' : r < -110 ? 'aviso' : 'ok'}`;
    $('lnkSnr').textContent = S.snr === null || S.snr === undefined ? '—' : `${fmt(S.snr, 1)} dB`;
    const pr = S.enlace.primaria, sc = S.enlace.secundaria;
    $('lnkPri').textContent = pr.rec ? `${pr.rec} paq.` : '—';
    const pp = perdidasPct(pr);
    const perd = $('lnkPerd');
    perd.textContent = pr.rec ? `${fmt(pp)} %` : '—';
    perd.className = `num ${pr.rec ? (pp > 10 ? 'aviso' : 'ok') : ''}`;
    $('lnkSec').textContent = sc.rec ? `${sc.rec} paq.` : '—';
  }

  // --------------------------------------------- 5. avisos que caducan ---
  function caducarAvisos() {
    const t = ahora();
    alertas.forEach((a, id) => {
      if (a.nivel === 'critico') return;
      if (a.persistente && !a.ack && t - a.pc > 90000) { a.ack = true; S.sucio = true; }
      if (a.ack && t - a.pc > 300000) { alertas.delete(id); S.sucio = true; }
    });
  }

  // ------------------------------------------------------- integración ---
  const dibujarTodoOriginal = dibujarTodo;
  dibujarTodo = function () {
    caducarAvisos();
    dibujarTodoOriginal();
    muestrearEnlace();
    dibujarEstatus();
    dibujarEnlace();
  };

  aplicarUnidad();
  colorearGraficas();
})();
