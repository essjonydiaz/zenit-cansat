// =============================================================================
//  v3.js — Tercera edición del panel: "modo misión" (v3.html)
//
//  Se carga DESPUÉS de app.js y reutiliza su estado y sus funciones (como v2.js).
//  Aquí solo va el HUD que flota sobre la escena 3D (mision3d.js):
//   1. Fase en grande y reloj T+ desde el arranque de la primaria.
//   2. "Siguiente": el próximo hito de la misión con su barra de avance.
//   3. Anuncio grande cuando ocurre un momento clave EN VIVO (no al abrir la
//      página con historial): despegue, liberación, desacople, autogiro…
//  El panel original (index.html) y la v2 no cambian.
// =============================================================================
'use strict';

(() => {
  const NOMBRES_FASE = ['Prevuelo', 'Ascenso', 'Caída libre', 'Descenso con autogiro', 'Aterrizado'];
  const ANUNCIOS = {
    ASCENSO: { titulo: 'DESPEGUE', color: '--f-ascenso', detalle: () => 'el dron sube el CanSat' },
    LIBERACION: { titulo: 'LIBERACIÓN', color: '--azul', detalle: () => `h = ${fmt(S.marcas.liberacion && S.marcas.liberacion.h)} m · caída libre` },
    DESACOPLE: { titulo: 'DESACOPLE', color: '--aviso', detalle: () => `h = ${fmt(S.marcas.desacople && S.marcas.desacople.h)} m · ${String((S.marcas.desacople && S.marcas.desacople.origen) || '').toLowerCase()}` },
    AUTOGIRO: { titulo: 'AUTOGIRO', color: '--f-autogiro', detalle: () => `aspas abiertas · h = ${fmt(S.marcas.autogiro && S.marcas.autogiro.h)} m` },
    ATERRIZAJE: { titulo: 'ATERRIZAJE', color: '--f-aterrizado', detalle: () => `altura máxima ${fmt(S.T && S.T.alt_max)} m` },
    POST_ATERRIZAJE_OK: { titulo: 'MISIÓN COMPLETA', color: '--ok', detalle: () => '10 s transmitiendo en tierra' },
  };

  // ------------------------------------------------ 1 y 2. fase y siguiente --
  function siguiente(T) {
    if (!T) return { titulo: 'Esperando telemetría', detalle: 'Conecta el receptor o usa Simulación.', avance: 0 };
    const alt = Math.max(0, T.alt);
    switch (T.estado) {
      case 0: return { titulo: 'Despegue', detalle: `En la plataforma · ${fmt(alt)} m`, avance: 0 };
      case 1: return { titulo: 'Liberación · 450 m', detalle: `Faltan ${fmt(Math.max(0, 450 - alt), 0)} m`, avance: alt / 450 };
      case 2:
        if (!S.marcas.desacople) {
          const tope = Math.max(T.alt_max, 250);
          return { titulo: 'Desacople · 200 m', detalle: `Faltan ${fmt(Math.max(0, alt - 200), 0)} m`, avance: (tope - alt) / (tope - 200) };
        }
        return { titulo: 'Autogiro', detalle: '400 ms después del desacople', avance: 1 };
      case 3: {
        const desde = (S.marcas.autogiro && S.marcas.autogiro.h) || 200;
        return { titulo: 'Aterrizaje', detalle: `${fmt(alt)} m · bajando a ${fmt(Math.abs(T.vel))} m/s`, avance: 1 - alt / desde };
      }
      default: {
        if (S.postOk) return { titulo: 'Misión completa', detalle: 'Ya transmitió más de 10 s en tierra.', avance: 1 };
        const seg = S.marcas.aterrizaje ? Math.max(0, T.t_ms / 1000 - S.marcas.aterrizaje.t) : 0;
        return { titulo: 'Transmitir 10 s en tierra', detalle: `${fmt(seg, 0)} de 10 s`, avance: seg / 10 };
      }
    }
  }

  function dibujarHud() {
    const T = S.T;
    $('v3Fase').textContent = T ? NOMBRES_FASE[T.estado] || '—' : 'Sin datos';
    const t0 = S.hitos.ARRANQUE;
    $('v3Reloj').textContent = T && t0 !== undefined ? mmss(T.t_ms / 1000 - t0) : '--:--';
    const sig = siguiente(T);
    $('v3Sig').textContent = sig.titulo;
    $('v3SigDet').textContent = sig.detalle;
    $('v3SigBarra').style.width = `${clamp(sig.avance, 0, 1) * 100}%`;
  }

  // ------------------------------------------------------- 3. anuncios ----
  let estadoVisto = null;
  let vistos = new Set();
  function revisarAnuncios() {
    if (S !== estadoVisto) {
      // Estado nuevo (historial o reinicio): lo que ya pasó no se anuncia.
      estadoVisto = S;
      vistos = new Set(Object.keys(S.hitos));
      return;
    }
    Object.keys(S.hitos).forEach((h) => {
      if (vistos.has(h)) return;
      vistos.add(h);
      const a = ANUNCIOS[h];
      if (a && hace(S.tPriPc) < 4) anunciar(a.titulo, a.detalle(), a.color);
    });
  }
  function anunciar(titulo, detalle, color) {
    const el = $('v3Anuncio');
    el.innerHTML = `<b>${escapar(titulo)}</b><span>${escapar(detalle)}</span>`;
    el.style.setProperty('--anuncio-color', css(color));
    el.classList.remove('visible');
    void el.offsetWidth;                 // reinicia la animación
    el.classList.add('visible');
  }

  // ------------------------------------------- altura del encabezado -----
  // La escena se mete debajo del encabezado lo que este mida (uno o dos renglones).
  const encabezado = document.querySelector('.encabezado');
  new ResizeObserver(() => {
    const cs = getComputedStyle(encabezado);
    const alto = encabezado.offsetHeight + parseFloat(cs.marginTop) + parseFloat(cs.marginBottom);
    document.documentElement.style.setProperty('--v3-encabezado', `${Math.round(alto)}px`);
  }).observe(encabezado);

  // ------------------------------------------------------- integración ---
  const dibujarTodoOriginal = dibujarTodo;
  dibujarTodo = function () {
    dibujarTodoOriginal();
    dibujarHud();
    revisarAnuncios();
  };
})();
