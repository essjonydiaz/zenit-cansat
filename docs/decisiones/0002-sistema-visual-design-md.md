# 0002 · Sistema visual "Vidrio en órbita" en DESIGN.md

**Fecha:** 2026-10-26 · **Estado:** vigente

## Contexto

El panel funcionaba bien pero su estilo era el de un tablero genérico. El equipo pidió una
interfaz más dinámica, con el logo al inicio y un 3D del prototipo, inspirada en sitios con
animación ligada al scroll (motionsites.ai, getlayers.ai) y en una portada de vidrio
ahumado partido. Al mismo tiempo, el panel es una herramienta de misión: no puede perder
claridad.

## Decisión

- Un solo sistema visual derivado del logo (negro espacial, azul de lanzamiento, plata,
  tricolor como firma), documentado en `DESIGN.md` con el formato de Google y con los
  tokens en `estacion-terrena/public/base.css`.
- Dos intensidades: el **panel** (modo operar) gana pulido y movimiento con significado
  (aura por fase, destello al cambiar de fase, modelo 3D en vivo); la **página del prototipo**
  (modo persuadir) se lleva el espectáculo (vidrio que se rompe, recorrido con scroll).
- La intro del logo sale una vez por pestaña en el panel y se puede saltar.
- Se conserva la estructura existente (`server.js`, `src/`, `public/` y los IDs que usa
  `app.js`); no se introdujo framework ni paso de compilación.

## Consecuencias

- Cambios de color, tipografía o radios se hacen en `base.css` **y** en `DESIGN.md`.
- `PRODUCT.md` fija las prioridades (la telemetría manda) para cualquier rediseño futuro.
