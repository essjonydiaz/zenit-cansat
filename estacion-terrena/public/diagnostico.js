// =============================================================================
//  diagnostico.js — Botón «Diagnóstico» de la consola (panel modo misión)
//
//  Junta en un solo reporte lo que el panel ya sabe (app.js) para decir QUÉ
//  falla y QUÉ revisar, no solo "error":
//   1. Conclusión: el primer eslabón de la cadena que falla, o el sensor.
//   2. Cadena: navegador → servidor → receptor → radio → primaria → secundaria.
//   3. Sensores de la primaria con el cable y el pin a revisar (Pines.h).
//   4. Enlace: paquetes, pérdidas, tramas corruptas, señal y archivo de registro.
//   5. Historia de la sesión: cada alerta con su hora y las tramas con error.
//  Se descarga como .txt (para mandarlo por WhatsApp) o se guarda como PDF con
//  la impresión del navegador: sin internet y sin librerías. Solo lee.
// =============================================================================
'use strict';

(() => {
  const NIVEL = { ok: 'OK', aviso: 'AVISO', critico: 'FALLA', gris: 'SIN DATOS', info: 'INFO' };
  const PESO = { critico: 0, aviso: 1, gris: 2, ok: 3, info: 3 };

  // Qué revisar si falla cada sensor (pines de firmware/comun/ZenitComun/src/Pines.h).
  const SENSORES = [
    { bandera: 'baro', nombre: 'Barómetro BMP280 (GY-91)', falla: 'critico',
      revisar: 'Cable I2C del GY-91: SDA → GPIO 47, SCL → GPIO 48, VCC a 3.3 V y GND. Dirección 0x76. Sin barómetro no hay altitud ni desacople automático.' },
    { bandera: 'imu', nombre: 'IMU MPU9250 (GY-91)', falla: 'critico',
      revisar: 'Mismo cable I2C del GY-91: SDA → GPIO 47, SCL → GPIO 48. Dirección 0x68. Sin IMU no hay orientación ni aceleración.' },
    { bandera: 'lora', nombre: 'Radio LoRa SX1262 de la primaria', falla: 'critico',
      revisar: 'Antena de 915 MHz bien enroscada antes de prender la Heltec. Reinicia la placa (RST).' },
    { bandera: 'gps', nombre: 'GPS NEO-M8N de la primaria', falla: 'aviso',
      revisar: 'TX del GPS → GPIO 5 y RX del GPS ← GPIO 6. Necesita cielo abierto 1–2 minutos para tener posición.' },
  ];

  // Las ayudas de diagnosticar() traen <b>: aquí se pasan a texto plano.
  const comoTexto = (html) => new DOMParser().parseFromString(String(html || ''), 'text/html').body.textContent;
  const hora = (pc) => new Date(pc).toLocaleTimeString('es-MX', { hour12: false });

  function bateria(T) {
    const b = T && T.banderas;
    if (!T) return null;
    if (b && b.bateria_sin_medir && !b.simulacion) {
      return { estado: 'aviso', texto: 'Sin medir', revisar: 'Falta el divisor 100k/33k hacia GPIO 7. Mide la pila con multímetro (mínimo 8.5 V).' };
    }
    if (T.bat < 7.5) return { estado: 'critico', texto: `${fmt(T.bat, 2)} V`, revisar: 'Pila casi agotada: cámbiala por una nueva de 9 V antes del vuelo.' };
    if (T.bat < 8.5) return { estado: 'aviso', texto: `${fmt(T.bat, 2)} V`, revisar: 'Pila por debajo de 8.5 V: mejor cambiarla antes del vuelo.' };
    return { estado: 'ok', texto: `${fmt(T.bat, 2)} V`, revisar: '' };
  }

  function reunir() {
    const c = diagnosticar();
    const T = S.T;
    const b = T && T.banderas;
    const cadena = ESLABONES.map((e) => ({ nombre: e.nombre, estado: c[e.id].estado, sub: c[e.id].sub, ayuda: comoTexto(c[e.id].ayuda) }));
    // Si la primaria no llega, sus banderas son viejas: no se acusa a los sensores.
    const sensoresVigentes = b && c.pri.estado !== 'gris';
    const sensores = sensoresVigentes
      ? SENSORES.map((s) => ({ nombre: s.nombre, estado: b[s.bandera] ? 'ok' : s.falla, revisar: b[s.bandera] ? '' : s.revisar }))
      : [];
    const bat = sensoresVigentes ? bateria(T) : null;
    if (bat) sensores.push({ nombre: 'Pila de 9 V', estado: bat.estado, revisar: bat.revisar, valor: bat.texto });
    if (sensoresVigentes && fuente.modo === 'serie' && b.simulacion) {
      sensores.push({ nombre: 'Firmware de la primaria', estado: 'aviso', revisar: 'Tiene el firmware de simulación: sube env:primaria (no primaria_sim) antes del vuelo.' });
    }

    const pr = S.enlace.primaria;
    const se = S.enlace.secundaria;
    const modo = { simulacion: 'Simulación', serie: 'Receptor por USB', replay: 'Reproducción', ninguna: 'Ninguna' }[fuente.modo] || fuente.modo;
    const enlace = [
      ['Fuente de datos', fuente.conectado ? `${modo}${fuente.ruta ? ` (${fuente.ruta})` : ''}` : `Desconectada${fuente.error ? ` — ${fuente.error}` : ''}`],
      ['Último paquete de la primaria', S.tPriPc ? `hace ${fmt(hace(S.tPriPc))} s` : 'Nunca llegó'],
      ['Paquetes de la primaria', `${pr.rec} recibidos · ${pr.perd} perdidos (${fmt(perdidasPct(pr))} %)`],
      ['Paquetes de la secundaria', `${se.rec} recibidos · ${se.perd} perdidos (${fmt(perdidasPct(se))} %)`],
      ['Tramas corruptas (checksum malo)', String(S.corruptas)],
      ['Señal', S.rssi !== null ? `RSSI ${S.rssi} dBm · SNR ${S.snr ?? '—'} dB` : 'Sin dato'],
      ['Registro de la sesión', fuente.archivoLog ? `estacion-terrena/logs/${fuente.archivoLog}.txt` : '—'],
    ];
    const historia = historialAlertas.slice().reverse();
    const tramasMalas = S.consola.filter((l) => l.clase === 'l-err').slice(-15).reverse();
    return { cadena, sensores, enlace, historia, tramasMalas, conclusion: concluir(cadena, sensores), fecha: new Date() };
  }

  // La conclusión es la causa más grave y, entre iguales, la primera de la cadena:
  // lo que va después depende de ella. Si es la primaria, se nombra el sensor.
  function concluir(cadena, sensores) {
    const malo = cadena.find((e) => e.estado === 'critico') || cadena.find((e) => e.estado === 'aviso')
      || cadena.find((e) => e.estado === 'gris');
    const sensor = sensores.filter((s) => s.estado !== 'ok').sort((a, b) => PESO[a.estado] - PESO[b.estado])[0];
    const porSensor = (s) => ({ estado: s.estado, titulo: `${s.nombre}: ${NIVEL[s.estado].toLowerCase()}`, texto: s.revisar });
    if (!malo) {
      return sensor ? porSensor(sensor)
        : { estado: 'ok', titulo: 'Todo funciona', texto: 'La cadena completa responde y los sensores de la primaria están bien.' };
    }
    if (malo.nombre === 'Carga primaria' && sensor) return porSensor(sensor);
    return { estado: malo.estado, titulo: `${malo.nombre}: ${malo.sub}`, texto: malo.ayuda };
  }

  // ------------------------------------------------------------ en pantalla --
  const etiqueta = (estado) => `<span class="diag-etq ${estado}">${NIVEL[estado]}</span>`;

  function comoHtml(r) {
    const filaCadena = (e) => `<li>${etiqueta(e.estado)}<div><b>${escapar(e.nombre)}</b> · ${escapar(e.sub)}<p>${escapar(e.ayuda)}</p></div></li>`;
    const filaSensor = (s) => `<li>${etiqueta(s.estado)}<div><b>${escapar(s.nombre)}</b>${s.valor ? ` · ${escapar(s.valor)}` : ''}${s.revisar ? `<p>${escapar(s.revisar)}</p>` : ''}</div></li>`;
    const filaHistoria = (h) => `<li>${etiqueta(h.nivel)}<div><span class="num">${hora(h.pc)}</span> <b>${escapar(h.titulo)}</b>${h.detalle ? `<p>${escapar(h.detalle)}</p>` : ''}</div></li>`;
    return `
      <section class="diag-conclusion ${r.conclusion.estado}">
        <span class="diag-etiqueta">Qué pasa</span>
        <strong>${escapar(r.conclusion.titulo)}</strong>
        <p>${escapar(r.conclusion.texto)}</p>
      </section>
      <h3>Cadena de conexión</h3>
      <ol class="diag-lista">${r.cadena.map(filaCadena).join('')}</ol>
      <h3>Sensores de la carga primaria</h3>
      ${r.sensores.length ? `<ol class="diag-lista">${r.sensores.map(filaSensor).join('')}</ol>` : '<p class="tenue">Sin telemetría reciente de la primaria: primero hay que recuperar la cadena.</p>'}
      <h3>Enlace</h3>
      <dl class="diag-datos">${r.enlace.map(([k, v]) => `<dt>${escapar(k)}</dt><dd>${escapar(v)}</dd>`).join('')}</dl>
      <h3>Historia de la sesión <small>(lo más reciente arriba)</small></h3>
      ${r.historia.length ? `<ol class="diag-lista">${r.historia.map(filaHistoria).join('')}</ol>` : '<p class="tenue">Sin alertas en esta sesión.</p>'}
      ${r.tramasMalas.length ? `<h3>Tramas con error</h3><pre class="diag-tramas">${r.tramasMalas.map((l) => `${hora(l.pc)}  ${escapar(l.linea)}`).join('\n')}</pre>` : ''}`;
  }

  // ------------------------------------------------------------ como texto --
  function comoTxt(r) {
    const L = [];
    const linea = '='.repeat(60);
    L.push(linea, 'ZÉNIT · Diagnóstico de la estación terrena', `${r.fecha.toLocaleString('es-MX', { hour12: false })}`, linea, '');
    L.push(`QUÉ PASA: [${NIVEL[r.conclusion.estado]}] ${r.conclusion.titulo}`, `  ${r.conclusion.texto}`, '');
    L.push('CADENA DE CONEXIÓN');
    r.cadena.forEach((e) => L.push(`  [${NIVEL[e.estado]}] ${e.nombre} · ${e.sub}`, `      ${e.ayuda}`));
    L.push('', 'SENSORES DE LA CARGA PRIMARIA');
    if (r.sensores.length) r.sensores.forEach((s) => L.push(`  [${NIVEL[s.estado]}] ${s.nombre}${s.valor ? ` · ${s.valor}` : ''}`, ...(s.revisar ? [`      ${s.revisar}`] : [])));
    else L.push('  Sin telemetría reciente de la primaria.');
    L.push('', 'ENLACE');
    r.enlace.forEach(([k, v]) => L.push(`  ${k}: ${v}`));
    L.push('', 'HISTORIA DE LA SESIÓN (lo más reciente arriba)');
    if (r.historia.length) r.historia.forEach((h) => L.push(`  ${hora(h.pc)} [${NIVEL[h.nivel] || h.nivel}] ${h.titulo}${h.detalle ? ` — ${h.detalle}` : ''}`));
    else L.push('  Sin alertas en esta sesión.');
    if (r.tramasMalas.length) {
      L.push('', 'TRAMAS CON ERROR');
      r.tramasMalas.forEach((l) => L.push(`  ${hora(l.pc)}  ${l.linea}`));
    }
    L.push('');
    return L.join('\r\n');
  }

  // --------------------------------------------------------------- ventana --
  const dialogo = document.createElement('dialog');
  dialogo.id = 'diagnostico';
  dialogo.className = 'diagnostico';
  dialogo.setAttribute('aria-labelledby', 'diagTitulo');
  dialogo.innerHTML = `
    <header class="diag-cabeza">
      <h2 id="diagTitulo">Diagnóstico</h2>
      <span class="diag-fecha tenue chico"></span>
      <div class="diag-acciones">
        <button class="btn chico" data-accion="actualizar">Actualizar</button>
        <button class="btn chico" data-accion="txt">Descargar .txt</button>
        <button class="btn chico" data-accion="pdf">Guardar PDF</button>
        <button class="btn chico" data-accion="cerrar" aria-label="Cerrar">Cerrar</button>
      </div>
    </header>
    <div class="diag-cuerpo"></div>`;
  document.body.appendChild(dialogo);

  let ultimo = null;
  function mostrar() {
    ultimo = reunir();
    dialogo.querySelector('.diag-cuerpo').innerHTML = comoHtml(ultimo);
    dialogo.querySelector('.diag-fecha').textContent = ultimo.fecha.toLocaleString('es-MX', { hour12: false });
  }
  function descargar() {
    const r = ultimo || reunir();
    const sello = r.fecha.toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿', comoTxt(r)], { type: 'text/plain;charset=utf-8' }));
    a.download = `diagnostico-zenit-${sello}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function imprimir() {
    document.documentElement.classList.add('imprimiendo-diag');
    window.print();
  }
  addEventListener('afterprint', () => document.documentElement.classList.remove('imprimiendo-diag'));

  dialogo.addEventListener('click', (ev) => {
    if (ev.target === dialogo) { dialogo.close(); return; }      // clic fuera de la ventana
    const accion = ev.target.closest('[data-accion]');
    if (!accion) return;
    ({ actualizar: mostrar, txt: descargar, pdf: imprimir, cerrar: () => dialogo.close() })[accion.dataset.accion]();
  });
  $('btnDiagnostico').addEventListener('click', () => { mostrar(); dialogo.showModal(); });
})();
