# PRODUCT.md — Zénit

Verdad del producto para quien diseñe o programe la interfaz (personas y asistentes de IA).

Lo visual está en [DESIGN.md](DESIGN.md); la misión técnica en
[docs/](docs/).

## Qué es

Software del CanSat **Zénit** (equipo Vectorcitos, PEU-UM, concurso CanSat 2026, misión
CASAT-FIT2026). Un dron sube el CanSat a **450 m** y lo suelta; a **200 m** se separa la carga
secundaria y se abre un **autogiro** que baja la primaria a **8–12 m/s**. La primaria transmite
por LoRa 915 MHz y sigue transmitiendo **≥ 10 s** después de aterrizar.

## Superficies

| Superficie | Ruta | Modo | Éxito para quien la usa |
|---|---|---|---|
| Panel de la estación terrena, 1.ª edición (clásica) | `/v1` (`estacion-terrena/public/index.html`) | Operar | Saber en 2 segundos si todo va bien y, si no, **qué cable o pieza revisar** |
| Panel, 2.ª edición | `/v2` (`v2.html` + `v2.js` sobre `app.js`) | Operar | Lo mismo, con la fase en grande, un solo reloj (T+ desde el arranque) y el enlace LoRa a la vista |
| Panel, 3.ª edición «modo misión» (**predeterminada**) | `/` y `/v3` (`v3.html` + `v3.js` + `mision3d.js` sobre `app.js`) | Operar · Mostrar en vivo | El vuelo en 3D con los datos reales (altura, orientación, desacople, autogiro) y el HUD encima, para el equipo y los jueces; abajo sigue el panel completo. Las tres ediciones se cambian con el selector «Edición 1 · 2 · 3» del encabezado |
| Prototipo 3D | `/prototipo.html` | Persuadir · Experiencia | Entender la misión y el aparato sin leer los docs; querer ver el vuelo en vivo |

## Quién lo usa y dónde

- **Equipo en la cancha** (7 estudiantes de IETE, IIS e ISC): laptop con Windows, el receptor
  Heltec V3 por USB, **sin internet**, a veces **al sol** (por eso existe el tema claro), con
  nervios y prisa. Leen el panel a un metro de distancia mientras otro opera.
- **Jueces, maestros y familias**: ven la página del prototipo en un proyector o en el
  teléfono.

## Lo que no se negocia

1. La telemetría manda: nada de la interfaz (intro, 3D, animaciones) puede retrasar o tapar
   un dato. Si WebGL falla, el panel sigue igual con el horizonte SVG.
2. Todo funciona **sin internet**: dependencias servidas desde `node_modules`.
3. Los textos de diagnóstico dicen qué hacer ("Conecta la antena SMA…"), no solo qué falló.
4. Los datos que se muestran son reales (tramas del firmware) o están marcados como
   simulación. El modelo 3D está marcado como **ilustrativo**.
5. El desacople manual siempre pide confirmación (doble clic).

## Voz

Español de México, directo y en segunda persona: "Revisa el cable USB", "Míralo en vivo".
Sin anglicismos innecesarios en la interfaz (sí en nombres de piezas: OpenLog, GPS, LoRa).
Cifras con unidades y espacio: `450 m`, `8–12 m/s`, `9.10 V`.

## Marca

Logo: `estacion-terrena/public/logo-zenit.jpeg` (CanSat despegando, arco del horizonte, "ZÉNIT"
con la N azul, "MÉXICO" entre líneas verde y roja). Lema: **Ideas que llegan más alto**.
Valores del equipo en el encabezado: Ciencia · Disciplina · Propósito.
