# Instrucciones para GitHub Copilot — CanSat Zénit

Lee **[AGENTS.md](../AGENTS.md)**: ahí están las reglas del proyecto (idioma español, pines,
radio, protocolo, seguridad de la misión) y los comandos. Este archivo solo te lleva ahí y te
recuerda el mapa del código.

## Antes de abrir archivos: usa el mapa (graphify)

1. Lee `graphify-out/GRAPH_REPORT.md` (resumen de todo el repo).
2. Para una pregunta concreta, en la terminal:
   ```bash
   graphify query "¿dónde se decide el desacople?" --budget 800
   graphify explain "Secuencia"
   graphify path "procesarComando()" "iniciarSeparacion()"
   ```
3. Abre **solo** las líneas que devuelve (`loc=archivo:línea`).

Si cambiaste código: `graphify update .`. Detalle en [GRAPHIFY.md](../GRAPHIFY.md).
