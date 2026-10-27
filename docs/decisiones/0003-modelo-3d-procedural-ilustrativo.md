# 0003 · Modelo 3D del CanSat hecho en código e ilustrativo

**Fecha:** 2026-10-26 · **Estado:** vigente

## Contexto

Se pidió simular en 3D cómo se verá el prototipo. Todavía no hay CAD en `mecanica/cad`. Sí
hay medidas y componentes documentados: Ø 9–10 cm, alto 20–23 cm, primaria ≤ 16 cm,
secundaria ≤ 7 cm, 2 huevos de 65 g (uno en cada carga), los componentes del PDR y la
secuencia de separación con dos servos.

## Decisión

- `estacion-terrena/public/cansat3d.js` construye el modelo con geometrías de three.js (sin
  archivos externos): primaria de 15 cm arriba, secundaria de 6.5 cm abajo, Ø 9.6 cm, tres
  aspas pasivas plegadas por fuera, componentes del PDR por dentro.
- Un solo módulo para las dos vistas: `visor3d.js` (panel, orientación en vivo) y
  `prototipo.js` (vista explotada, desacople, autogiro).
- La interfaz lo marca como **ilustrativo** ("Acomodo ilustrativo: se actualiza cuando
  mecánica suba el CAD").

## Consecuencias

- Cuando exista el CAD, se puede exportar a glTF (`.glb`) y cargarlo con `GLTFLoader`
  conservando la misma interfaz `crearCanSat()` → `{ grupo, piezas, actualizar() }`.
- Si cambian las medidas en `docs/07-requisitos-y-riesgos.md`, hay que ajustar las
  constantes al inicio de `cansat3d.js`.
