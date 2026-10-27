# 11. Prender y apagar el servidor de la estación terrena

Guía rápida para abrir el panel en tu compu (Windows, PowerShell) y para salir del error
**«Cannot GET /…»** cuando una página no abre.

## Prender el servidor

Los comandos de `npm` se corren **dentro de `estacion-terrena/`**. En la raíz del repositorio no
hay `package.json`, así que ahí `npm run simular` falla con `ENOENT`.

```powershell
cd estacion-terrena
npm run simular
```

| Comando | Para qué |
|---|---|
| `npm run simular` | Vuelo simulado, sin hardware |
| `npm start` | Con el receptor por USB; el puerto COM se elige en el panel |
| `npm start -- --puerto COM5` | Conecta directo al receptor en COM5 |
| `npm run replay -- logs/sesion_X.txt` | Repite una sesión guardada |

Cuando aparezca `Abrir en el navegador: http://localhost:3000`, abre la página que quieras:

| Página | Dirección |
|---|---|
| Panel, 3.ª edición «modo misión» (3D, **la predeterminada**) | `http://localhost:3000` (o `/v3`) |
| Panel, 1.ª edición (clásica) | `http://localhost:3000/v1` |
| Panel, 2.ª edición | `http://localhost:3000/v2` |
| Recorrido 3D del prototipo | `http://localhost:3000/prototipo.html` |

Dentro del panel, el selector **«Edición 1 · 2 · 3»** del encabezado cambia de una edición a otra.

**Para apagarlo:** presiona `Ctrl+C` en la terminal donde lo prendiste.

## Apagar un servidor que quedó prendido

Si ya no encuentras la terminal, o al prender sale que el puerto está ocupado:

```powershell
# 1. Ver qué proceso tiene ocupado el puerto 3000 (sale su número, el ID)
Get-NetTCPConnection -LocalPort 3000 -State Listen | Select-Object OwningProcess

# 2. Apagar lo que esté en el puerto 3000, sin tener que saber el número
Get-NetTCPConnection -LocalPort 3000 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

Si prendiste servidores en otros puertos (3001, 3002…), repite el paso 2 cambiando el número.

> Evita `taskkill /IM node.exe /F`: cierra **todos** los programas de Node de la compu, no solo
> el servidor, y eso puede incluir herramientas que estés usando.

## Usar otro puerto sin apagar nada

```powershell
npm run simular -- --http 3001
```

Y entonces la dirección es `http://localhost:3001/v3`

## «Cannot GET /v3» (o cualquier página que no abre)

| Lo que pasa | Por qué | Qué hacer |
|---|---|---|
| Una página nueva (`/v2`, `/v3`…) dice «Cannot GET» | El servidor se prendió **antes** de que se agregara esa ruta. Node no vuelve a leer `server.js` mientras corre | Apágalo (`Ctrl+C`) y vuelve a correr `npm run simular`. Pasa cada vez que haces `git pull` o cambias `server.js` |
| La dirección termina en punto o coma (`/v3.`) | Se copió el punto de la oración junto con el enlace | El servidor ya lo corrige y te manda a `/v3`. Si no, bórralo de la barra de direcciones |
| `npm error enoent … package.json` | Corriste `npm` en la raíz del repositorio | `cd estacion-terrena` y repite |
| «El puerto 3000 está ocupado» | Ya hay otro servidor prendido | Apágalo (sección de arriba) o usa `--http 3001` |

La prueba `estacion-terrena/test/rutas.test.js` (dentro de `npm test`) revisa que `/v1`, `/v2`, `/v3` y
`/prototipo.html` respondan, y que `/` abra la 3.ª edición. Si agregas otra edición del panel, súmala a esa prueba.
