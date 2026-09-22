# 8. Git y GitHub para el equipo

## Subir el repositorio por primera vez (lo hace una sola persona)

1. Crear el repositorio vacío en GitHub: **New repository** → nombre `zenit-cansat` →
   **sin** README, sin .gitignore, sin licencia (ya vienen aquí) → *Create repository*.
2. En la terminal de VS Code (`Ctrl+ñ`), dentro de la carpeta `zenit-cansat`:

```powershell
git remote add origin https://github.com/<su-usuario>/zenit-cansat.git
git push -u origin main
```

(El repositorio ya trae un primer commit. Si Git pide identificarse:
`git config --global user.name "Su Nombre"` y `git config --global user.email "su@correo"`.)

3. En GitHub: **Settings → Collaborators → Add people** para cada integrante.

## Cada integrante

```powershell
git clone https://github.com/<su-usuario>/zenit-cansat.git
cd zenit-cansat
code zenit.code-workspace
```

## Flujo de trabajo

```powershell
git pull                             # 1. traer lo último
git switch -c firmware/ajuste-servo  # 2. rama para tu cambio
# ... editar, compilar, probar ...
git add -A
git commit -m "Ajusta ángulos del servo según prueba P6"
git push -u origin firmware/ajuste-servo
```

Luego en GitHub: **Compare & pull request**. Otro integrante revisa y hace *Merge*.
GitHub Actions compila los firmwares y corre las pruebas en cada pull request: si sale ❌,
no se mezcla.

Nombres de rama sugeridos: `firmware/...`, `estacion/...`, `docs/...`, `mecanica/...`,
`pruebas/...`.

## Qué subir y qué no

| Sí | No (ya lo ignora `.gitignore`) |
|---|---|
| Código, documentación, CAD/STL en `mecanica/` | `.pio/`, `node_modules/` |
| Logs **de pruebas importantes** (copiarlos a `pruebas-campo/AAAA-MM-DD/`) | `estacion-terrena/logs/` (se llenan en cada sesión) |
| Entregables PDF en `documentos/` | Contraseñas, claves |

## Quién es dueño de qué (según el CoDR)

| Carpeta | Responsables |
|---|---|
| `firmware/`, `estacion-terrena/` | Control y programación: Hiday, Jonathan H., Jonathan S. |
| `docs/02-conexiones.md` | Electrónica: Araceli, Diego |
| `mecanica/` | Mecánica: Diego, Esli |
| `docs/05-plan-de-pruebas.md` | Pruebas: Javier, Hiday |
| `docs/07-requisitos-y-riesgos.md` | Ingeniería de sistemas: Jonathan H., Jonathan S. |
| `documentos/` | Gestión de la misión: Araceli, Javier |
