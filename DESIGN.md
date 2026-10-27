---
version: alpha
name: Zénit · Vidrio en órbita
description: Sistema visual de la estación terrena y de la página del prototipo 3D del CanSat Zénit. Sale del logo del equipo (espacio negro, estela azul de lanzamiento, arco del horizonte, tricolor) y del uso real en la cancha.
colors:
  primary: "#2F6BFF"
  primary-text: "#6D9BFF"
  primary-glow: "#9FC0FF"
  secondary: "#CFD8EA"
  tertiary: "#8FD8FF"
  neutral: "#03060C"
  surface: "#0A101E"
  surface-glass: "#17171B"
  on-surface: "#EEF3FF"
  on-surface-soft: "#B9C6E2"
  on-surface-muted: "#8494B8"
  border: "#1F2A44"
  mx-green: "#14975A"
  mx-red: "#E0283C"
  success: "#34D58A"
  warning: "#F6B73C"
  error: "#FF5D5D"
  phase-prevuelo: "#5D6A8E"
  phase-ascenso: "#2F6BFF"
  phase-caida: "#E0822A"
  phase-autogiro: "#22B573"
  phase-aterrizado: "#8A96B6"
  action-hover: "#36D67E"
  light-neutral: "#EAEEF6"
  light-on-surface: "#0D1A36"
  light-primary: "#1F55E0"
typography:
  display-brand:
    fontFamily: Archivo
    fontSize: 24px
    fontWeight: 800
    lineHeight: 1
    letterSpacing: 0.2em
    fontVariation: "'wdth' 125"
  headline-hero:
    fontFamily: Archivo
    fontSize: 96px
    fontWeight: 600
    lineHeight: 0.97
    letterSpacing: -0.045em
  headline-section:
    fontFamily: Archivo
    fontSize: 72px
    fontWeight: 750
    lineHeight: 1
    letterSpacing: -0.035em
    fontVariation: "'wdth' 118"
  headline-card:
    fontFamily: Archivo
    fontSize: 14px
    fontWeight: 650
    lineHeight: 1.25
    fontVariation: "'wdth' 106"
  label-caps:
    fontFamily: Archivo
    fontSize: 12px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: 0.16em
    fontVariation: "'wdth' 118"
  body-md:
    fontFamily: Archivo
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.4
  body-lg:
    fontFamily: Archivo
    fontSize: 17px
    fontWeight: 400
    lineHeight: 1.6
  data-xl:
    fontFamily: JetBrains Mono
    fontSize: 36px
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: -0.03em
    fontFeature: "'tnum' 1"
  data-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.55
    fontFeature: "'tnum' 1"
rounded:
  sm: 8px
  md: 12px
  lg: 18px
  xl: 26px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 10px
  lg: 16px
  xl: 28px
  gutter-panel: 10px
  margin-phone: 16px
  margin-hero-x: 5.5vw
components:
  header-pill:
    backgroundColor: "rgba(14, 20, 34, 0.72)"
    rounded: 22px
    padding: 6px
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: 8px
  card:
    backgroundColor: "rgba(16, 24, 42, 0.74)"
    rounded: "{rounded.md}"
    padding: 10px
  button:
    backgroundColor: "rgba(26, 37, 62, 0.62)"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.full}"
    height: 34px
  button-active:
    backgroundColor: "{colors.primary}"
    textColor: "#FFFFFF"
  button-danger:
    backgroundColor: "rgba(255, 93, 93, 0.13)"
    textColor: "{colors.error}"
    rounded: "{rounded.md}"
  pill-cta:
    backgroundColor: "#F1F3F8"
    textColor: "#0A0D14"
    rounded: 10px
    height: 52px
  pill-cta-hover:
    backgroundColor: "{colors.action-hover}"
  glass-shard:
    backgroundColor: "{colors.surface-glass}"
    rounded: 20px
  telemetry-value:
    textColor: "{colors.tertiary}"
    typography: "{typography.data-xl}"
---

# DESIGN.md — Zénit

Fuente de verdad visual de `estacion-terrena/public/`. Los valores en CSS viven en
`estacion-terrena/public/base.css` (tokens) y deben coincidir con los de arriba. Producto,
usuarios y contexto: [PRODUCT.md](PRODUCT.md).

## Overview

**Vidrio en órbita.** El mundo visual sale del logo del equipo: un CanSat que despega sobre
el espacio negro, una estela azul, el arco del horizonte terrestre y las líneas verde y roja
de México. Dos superficies comparten el sistema pero no el tono:

- **Panel de la estación terrena** (`/`, modo *operar*): se usa en la cancha, con prisa, a
  veces al sol y sin internet. Manda la lectura: estados claros, números grandes y tabulares,
  y diagnóstico en lenguaje del equipo. La marca vive en los detalles: el filo de luz del
  vidrio, el aura que cambia con la fase del vuelo, el modelo 3D en vivo.
- **Página del prototipo** (`/prototipo.html`, modo *persuadir/experiencia*): la presentación
  para jueces, familia y patrocinadores. Aquí sí hay espectáculo: una placa de vidrio
  ahumado partida que reacciona al cursor y se hace añicos con el scroll, y el CanSat que
  cuenta la misión.

Ambas abren con la intro del logo (`intro.js`), que entra sola (sin botón; un clic o una
tecla la adelantan). En el panel sale **una vez por pestaña**, para no tapar la telemetría
si alguien recarga en pleno vuelo.

## Colors

- **Azul de lanzamiento (#2F6BFF):** la estela del logo. Acción principal, fase de ascenso,
  selección y brillos. En texto se usa la variante más clara (#6D9BFF) para contraste.
- **Plata (#CFD8EA):** el aro del logo. Bordes finos, metal del modelo 3D.
- **Cian telemetría (#8FD8FF):** solo para valores medidos en vivo (altitud, velocidad,
  ángulos). Si un número es cian, viene del CanSat.
- **Negro espacial (#03060C):** fondo. Nunca negro puro: lleva un poco de azul.
- **Vidrio ahumado (#17171B):** las piezas de la portada (MeshPhysicalMaterial con
  iridiscencia) y, en CSS, paneles translúcidos con desenfoque.
- **Tricolor (#14975A / blanco / #E0283C):** firma, nunca relleno. Solo la línea de 2 px
  bajo la marca del panel y las líneas junto a "MÉXICO" en la intro. No va en el pie ni en
  el modelo 3D.
- **Estados:** ok #34D58A, aviso #F6B73C, crítico #FF5D5D. Siempre acompañados de texto o
  símbolo (✓ ⚠ ✕), nunca solo color.
- **Fases del vuelo:** prevuelo, ascenso, caída libre, autogiro y aterrizado tienen color
  propio; el aura inferior del panel toma el de la fase actual.
- **Tema claro** (para el sol): mismo sistema con fondo #EAEEF6 y texto #0D1A36; sin
  estrellas ni aura fuerte. Se elige con el botón sol/luna y se recuerda.

## Typography

- **Archivo (variable, ancho 62–125 %)** para todo el texto. La marca usa el ancho 125 % y
  espaciado amplio, como el "ZÉNIT" del logo. Los títulos de sección usan 118 %; el
  texto corrido, 100 %.
- **JetBrains Mono (variable)** solo para datos: telemetría, tramas `$T,...`, horas y
  consola. Cifras tabulares para que los números no bailen.
- Las dos fuentes se sirven desde `node_modules` (`/vendor/fuentes/...`): en la cancha no
  hay internet. Nunca enlazar Google Fonts ni CDNs.
- Titular de portada: hasta 6 rem, interletra −0.045 em, degradado plateado vertical
  (#DCDCE0 → #BDBDC3) impreso en el vidrio. Ningún otro texto lleva degradado.

## Layout

- **Panel:** rejilla de 4 columnas (estado · vuelo · vuelo · misión) con la cadena de
  conexión arriba y eventos/consola abajo. Baja a 2 columnas a 1250 px y a una a 760 px.
  Separación de 10 px entre paneles; densidad alta a propósito.
- **Prototipo:** lienzo 3D fijo detrás; el texto avanza en secciones de 120–190 vh con
  bloques fijos (sticky). El modelo cambia de lado según la sección para dejar espacio al
  texto. En teléfono el texto va abajo y el modelo arriba.
- Margen lateral de 16 px en teléfono; sin scroll horizontal (cuidado con textos `nowrap`
  dentro de flex: usar `min-width: 0`).

## Elevation & Depth

La profundidad viene del **vidrio**, no de sombras duras:

- Paneles translúcidos con `backdrop-filter`, borde de 1 px y un **filo de luz** (degradado
  de 1 px) en el canto superior.
- Sombra suave con desplazamiento (`0 18px 40px -18px`), nunca halos de color sin offset.
- En 3D: entorno RoomEnvironment (intensidad 0.42), luz clave blanco-azul arriba a la
  izquierda y contraluz azul. Las piezas de vidrio miden 13·S de grueso con bisel de 2.6·S.

## Shapes

- Radios: 8 / 12 / 18 / 26 px y píldora completa para botones y fases.
- Las piezas de la portada son polígonos con esquinas de 20·S, separadas 14·S.
- Iconos: Lucide (SVG en línea, trazo 2), sin emojis como iconos.

## Components

- **Encabezado píldora flotante:** marca, conexión, reloj del último paquete, alertas,
  enlace al prototipo y tema.
- **Tarjeta de instrumento:** título en mayúsculas pequeñas azul, valor en `data-xl` cian.
  Si el dato tiene más de 3 s, el valor se vuelve tenue y aparece la edad en ámbar.
- **Orientación 3D:** modelo del CanSat (`cansat3d.js`) movido por roll/pitch/yaw; el
  desacople separa la secundaria y el autogiro abre y gira las aspas. Sin WebGL queda el
  horizonte artificial SVG.
- **Botón de peligro (desacople manual):** rojo translúcido; pide doble clic y late mientras
  está armado.
- **Pieza de vidrio (portada):** ver `prototipo.js`. Se levanta 50·S y se ladea hasta 0.24 rad
  bajo el cursor (resorte k 170, c 19), con brillo lavanda tenue y más iridiscencia.
- **Sonido:** solo en la intro de `/prototipo.html` (`data-sonido="si"`), sintetizado con
  Web Audio: retumbe al subir la lata, golpe y "whoosh" al despegar el huevo, brillo al
  aparecer el nombre. Si el navegador bloquea el audio, arranca con el primer clic o tecla
  mientras dura la intro; después ya no suena. El panel nunca suena.
- **Píldora CTA:** clara; se vuelve verde #36D67E al pasar el cursor.
- **Botón de vidrio (secundario):** mismo tamaño que la píldora, fondo blanco al 4 % y
  contorno al 26 %; con el cursor sube a 12 % / 60 %. Sin flechas ni iconos decorativos.

## Do's and Don'ts

- Haz que cada animación diga algo: la fase cambió, llegó una alerta, el vidrio se rompe
  porque bajaste. Respeta `prefers-reduced-motion` (portada estática, sin entradas).
- Haz los recursos locales: three.js 0.169.0, fuentes y Chart.js salen de `node_modules`.
- Haz que el panel funcione sin WebGL y sin la intro: la telemetría es lo primero.
- No uses etiquetas pequeñas encima de un título (*eyebrow*), números de sección decorativos
  ni tarjetas idénticas con icono + título + texto como estructura.
- No uses texto con degradado salvo el titular impreso en el vidrio.
- No cambies los IDs del panel sin revisar `app.js`: el dibujo depende de ellos.
- No metas la intro en el camino de quien opera: una vez por pestaña y se salta.
- No afirmes medidas del hardware que no estén en `docs/`: el modelo 3D es ilustrativo
  hasta que exista el CAD en `mecanica/cad`.
