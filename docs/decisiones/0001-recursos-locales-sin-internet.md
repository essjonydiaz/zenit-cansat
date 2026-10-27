# 0001 · Recursos de la interfaz servidos localmente

**Fecha:** 2026-10-26 · **Estado:** vigente

## Contexto

La estación terrena se usa en la cancha de lanzamiento, donde no hay internet. El panel ya
servía Chart.js desde `node_modules`. El rediseño agrega three.js (modelo 3D y portada de
vidrio) y tipografías propias (Archivo y JetBrains Mono). Las guías de diseño suelen
cargarlas desde jsDelivr o Google Fonts.

## Decisión

- Se instalan como dependencias npm: `three@0.169.0` (versión exacta), `@fontsource-variable/archivo`
  y `@fontsource-variable/jetbrains-mono`.
- `server.js` las sirve en `/vendor/three`, `/vendor/fuentes/archivo` y `/vendor/fuentes/mono`.
- Las páginas usan un *import map* (`"three": "/vendor/three/build/three.module.min.js"`) y
  `@import` locales en `base.css`.

## Consecuencias

- `npm install` una vez con internet basta; después todo funciona desconectado.
- Actualizar three.js es una decisión explícita (cambiar la versión en `package.json` y
  revisar `cansat3d.js`, `visor3d.js` y `prototipo.js`).
- Prohibido agregar CDNs o Google Fonts a `public/`.
