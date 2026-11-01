# 0004 · Un solo panel: «modo misión»

**Fecha:** 2026-10-27 · **Estado:** vigente

## Contexto

El panel tuvo tres ediciones sobre el mismo `app.js`: la clásica (`/v1`, `index.html`), la 2.ª
(`/v2`, `v2.html` · `v2.css` · `v2.js`) y la 3.ª «modo misión» (`/v3`, `v3.html` · `v3.css` ·
`v3.js` · `mision3d.js`), con un selector «Edición 1 · 2 · 3» para compararlas. El equipo
eligió la 3.ª: trae todo lo de las otras dos (abajo sigue el panel completo) más el vuelo en
3D con el HUD.

## Decisión

- Se borran `index.html`, `v2.html`, `v2.css`, `v2.js` y `visor3d.js` (el visor de
  orientación que solo usaban esas dos páginas; en la v3 el 3D es `mision3d.js`).
- Se quita el selector de edición (`.ediciones`).
- `/panel` y `/v3` abren `v3.html`. `/v1`, `/v2`, `/index.html` y `/v2.html` redirigen a
  `/panel` para que un marcador o un documento viejo no termine en «Cannot GET».

## Consecuencias

- Hay una sola página de panel que mantener y revisar. Los IDs que busca `app.js` son los
  de `v3.html`.
- `app.js`, `estilos.css`, `base.css` y `diagnostico.js` siguen siendo archivos aparte: la v3
  los carga y encima pone `v3.css` y `v3.js`.
- Si se quisiera recuperar una edición vieja, está en el historial de git (antes de este
  cambio).
