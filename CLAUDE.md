# CLAUDE.md

Las instrucciones del proyecto para asistentes están en **AGENTS.md** (las comparte con
Copilot, Codex y Cursor). Léelas antes de empezar:

@AGENTS.md

## Solo para Claude Code

- **Grafo primero.** Antes de explorar archivos, lee `graphify-out/GRAPH_REPORT.md` o consulta
  `graphify-out/graph.json` con `/graphify query "<pregunta>"` (o `path` / `explain`). Abre solo
  las líneas que devuelva (`loc=`). Detalle en [GRAPHIFY.md](GRAPHIFY.md).
- **Después de cambios estructurales** (archivo nuevo, función renombrada, campo del
  protocolo): `/graphify . --update` (equivale a `graphify update .`).
- **Interfaz:** antes de tocar `estacion-terrena/public/` lee [PRODUCT.md](PRODUCT.md) y
  [DESIGN.md](DESIGN.md). La carpeta `.claude/` es local de cada quien y no se sube.
- Para ver la interfaz: `cd estacion-terrena && npm run simular` → http://localhost:3000 y
  http://localhost:3000/prototipo.html.
