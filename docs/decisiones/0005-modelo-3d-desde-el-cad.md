# 0005 · El modelo 3D de la web sale del CAD real

**Fecha:** 2026-10-27 · **Estado:** vigente · **Reemplaza a:** 0003

## Contexto

Ya existe el diseño completo en CAD (`mecanica/cansat-completo`), el mismo que se imprime en 3D.
El modelo hecho en código (ADR 0003) era ilustrativo y ya no coincidía con el diseño: otras
medidas, aspas por fuera y componentes en otro lugar.

## Decisión

- `mecanica/cansat-completo/exportar_web.py` junta las piezas del CAD en
  `estacion-terrena/public/modelos/cansat.glb` (0.8 MB, en cm, eje Y hacia arriba). Se sirve
  desde la misma carpeta: funciona sin internet (ADR 0001).
- `cansat3d.js` lo carga con `GLTFLoader` y conserva la misma interfaz:
  `crearCanSat()` → `{ grupo, piezas, actualizar(), medidas }`, más `listo` (promesa).
  Pone los colores, agrupa las piezas, abre las aspas en su bisagra real y separa la secundaria.
- En la vista explotada, los componentes se muestran con detalle (`componentes3d.js`: pila con
  etiqueta, Heltec con pantalla, servos, GPS, huevos en su espuma), cada uno donde va en el CAD.
- Medidas nuevas: Ø 9.6 cm, alto 22.9 cm (primaria 15.9, secundaria 7).

## Consecuencias

- Si cambia el CAD: `python cansat_completo.py` y luego `python exportar_web.py`.
- Los colores y movimientos se cambian en `cansat3d.js`, no en el `.glb`.
