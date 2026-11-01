# GRAPHIFY.md — Mapa de conocimiento del repositorio

`graphify` convierte el código y la documentación en un grafo (`graphify-out/graph.json`) que
los asistentes consultan **antes** de abrir archivos. Ahorra tokens y evita explorar a ciegas.

## Qué hay en `graphify-out/`

| Archivo | Para qué |
|---|---|
| `GRAPH_REPORT.md` | Resumen legible (≈14 KB): comunidades, nodos centrales, conexiones sorprendentes. **Léelo primero.** |
| `graph.json` | El grafo completo; lo usan `query`, `path` y `explain` |
| `graph.html` | Vista interactiva para personas (abrir en el navegador) |
| `manifest.json` | Qué archivos entraron y con qué huella; sirve para saber si está viejo |

## Consultar (sin costo de API)

```bash
graphify query "¿dónde se decide el desacople?" --budget 800
graphify explain "Secuencia"
graphify path "procesarComando()" "iniciarSeparacion()"
graphify explain "crearCanSat()"          # modelo 3D compartido por el panel y el prototipo
```

En Claude Code también: `/graphify query "<pregunta>"`. Los resultados traen `loc=archivo:línea`:
abre **solo** esas líneas.

## Actualizar

| Cuándo | Comando |
|---|---|
| Cambiaste código (lo normal) | `graphify update .` |
| Cambio grande (archivos nuevos, refactor) | `graphify update . --force` y luego `graphify cluster-only .` |
| Desde Claude Code | `/graphify . --update` |
| ¿Está viejo? | Compara `git rev-parse HEAD` con el commit que dice `GRAPH_REPORT.md` |

Hazlo después de cualquier cambio estructural (archivo nuevo, función renombrada, campo del
protocolo) y súbelo en el mismo commit.

## Instalarlo en tu compu (una vez por persona)

```powershell
uv tool install graphifyy      # el paquete se llama así, con doble "y"
cd zenit-cansat                # la raíz del repositorio
graphify hook install          # actualiza el mapa solo en cada commit, pull o cambio de rama
```

Los ganchos de git viven en `.git/hooks` y **no se suben**: cada quien los instala en su
clon. Después de un commit quedan modificados los archivos de `graphify-out/`; súbelos en el
siguiente commit.

## Verlo en gráfica

Desde la **raíz** del repositorio (desde `estacion-terrena/` sería `..\graphify-out\graph.html`):

```powershell
start graphify-out\graph.html
```

Cada punto es un archivo, función o documento; los colores agrupan lo que va junto. Esta
vista carga su librería de dibujo de internet (la genera graphify así); las consultas por
terminal funcionan sin internet.

## Que los asistentes lo usen

| Asistente | Cómo se entera |
|---|---|
| Claude Code | `CLAUDE.md` + gancho local: `graphify claude install` (escribe `.claude/settings.json`, que no se sube; borra la sección en inglés que agrega a `CLAUDE.md`, ya está en español arriba) |
| Copilot (VS Code) | `.github/copilot-instructions.md` (se sube) |
| Codex, Cursor y otros | `AGENTS.md` (se sube) |

## Qué entra y qué no

Entra (lo que define el comportamiento):

- `firmware/` (primaria, secundaria, receptor, pruebas, `comun/`)
- `estacion-terrena/server.js`, `src/`, `public/*.js`, `public/*.html`, `test/`
- `herramientas/*.py`
- `docs/`, `docs/decisiones/` y los `.md` de la raíz (`AGENTS.md`, `CLAUDE.md`, `README.md`,
  `DESIGN.md`, `PRODUCT.md`, este archivo)

No entra (`.graphifyignore`):

- Dependencias y compilados: `node_modules/`, `.pio/`, `estacion-terrena/public/vendor` si
  existiera.
- Datos generados: `estacion-terrena/logs/`, resultados del análisis, PDFs de `documentos/`.
- `.claude/` (configuración local de cada asistente; tampoco se sube a GitHub).
- Imágenes (`*.png`, `*.jpeg`).

## Conceptos que el grafo debe conectar

Si una consulta no encuentra estas relaciones, el grafo está viejo:

- **Trama T** ↔ `main.cpp` (`banderas()`) ↔ `protocolo.js` (`BANDERAS`, `CAMPOS`) ↔
  `docs/03-protocolo-telemetria.md` ↔ `app.js` (`procesar()`).
- **Máquina de estados** (`MaquinaEstados`) ↔ fases del panel (`ESTADOS`, `dibujarFases()`) ↔
  `docs/04-maquina-de-estados.md`.
- **Separación** (`Secuencia`, 2 servos, 400 ms) ↔ eventos `DESACOPLE`/`SEPARACION`/`AUTOGIRO`
  ↔ `mision3d.js` y `cansat3d.js` (`actualizar({separacion, despliegue})`).
- **Radio** (`RadioConfig.h`) ↔ las 3 placas ↔ `aire::tiempoEnAireMs` ↔ `test_tiempo_en_aire`.
- **Pines** (`Pines.h`) ↔ `docs/02-conexiones.md`.
- **Interfaz**: `DESIGN.md` ↔ `base.css` (tokens) ↔ `estilos.css` / `prototipo.css`;
  `PRODUCT.md` ↔ reglas de la telemetría primero.
