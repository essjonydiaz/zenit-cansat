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
| `npm run simular` | Vuelo simulado, sin hardware. Se reinicia solo si cambia el código del servidor (`git pull`, una ruta nueva) |
| `npm start` | Con el receptor por USB; el puerto COM se elige en el panel |
| `npm start -- --puerto COM5` | Conecta directo al receptor en COM5 |
| `npm run replay -- logs/sesion_X.txt` | Repite una sesión guardada |

Cuando aparezca `Abrir en el navegador: http://localhost:3000`, abre la página que quieras:

| Página | Dirección |
|---|---|
| Portada: recorrido 3D del prototipo (lo primero que se ve) | `http://localhost:3000` |
| Panel en vivo «modo misión» | `http://localhost:3000/panel` (o `/v3`) |

Desde el prototipo, el botón **«Abrir panel»** lleva al panel. El día del vuelo, quien opera
puede entrar directo a `/panel`. La 1.ª y la 2.ª edición se quitaron: `/v1` y `/v2` llevan
al panel (ver `docs/decisiones/0004-un-solo-panel-modo-mision.md`).

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
| Una página nueva dice «Cannot GET», o el panel avisa **«Reinicia el servidor»** | El servidor se prendió **antes** de que se agregara esa ruta. Node no vuelve a leer `server.js` mientras corre | Apágalo (`Ctrl+C`) y vuelve a correr el comando. `npm run simular` ya se reinicia solo; `npm start` no, a propósito: en pleno vuelo no debe reiniciarse |
| La dirección termina en punto o coma (`/v3.`) | Se copió el punto de la oración junto con el enlace | El servidor ya lo corrige y te manda a `/v3`. Si no, bórralo de la barra de direcciones |
| `npm error enoent … package.json` | Corriste `npm` en la raíz del repositorio | `cd estacion-terrena` y repite |
| «El puerto 3000 está ocupado» | Ya hay otro servidor prendido | Apágalo (sección de arriba) o usa `--http 3001` |

La prueba `estacion-terrena/test/rutas.test.js` (dentro de `npm test`) revisa que `/panel`, `/v3` y
`/prototipo.html` respondan, que `/` abra el prototipo, que `/panel` abra el modo misión y que
`/v1` y `/v2` lleven a `/panel`. Si agregas otra página, súmala a esa prueba.

## ¿Qué está fallando? Botón «Diagnóstico»

En la tarjeta **Consola** del panel está el botón **Diagnóstico**. Abre un reporte con:

1. **Qué pasa:** la causa más grave en una frase y qué revisar. Si es un sensor, dice el cable
   y el pin (por ejemplo «Barómetro: SDA → GPIO 47, SCL → GPIO 48»).
2. **Cadena de conexión:** navegador → servidor → receptor → radio → primaria → secundaria.
3. **Sensores de la primaria:** barómetro, IMU, radio, microSD, GPS y pila.
4. **Enlace:** paquetes recibidos y perdidos, tramas con checksum malo, señal y archivo de registro.
5. **Historia de la sesión:** cada alerta con su hora, aunque ya se haya quitado sola.

**Descargar .txt** sirve para mandarlo por WhatsApp; **Guardar PDF** abre la impresión del
navegador (elige «Guardar como PDF»). Funciona sin internet.

## Seguridad en la cancha

En la cancha la laptop comparte WiFi con otros equipos. Por eso:

- **Por defecto el servidor solo responde en tu propia compu.** Nadie más del WiFi puede abrir
  el panel ni mandar comandos (desacople, desconectar, calibrar).
- **Para verlo desde los celulares del equipo**, prende el servidor con `--red`:

  ```powershell
  npm start -- --red
  ```

  En la terminal aparecen la dirección para los celulares (`http://192.168.x.x:3000`) y un
  **PIN de 6 dígitos**. Ver el panel no pide nada; **mandar un comando desde otro aparato pide
  el PIN**. Desde la laptop del servidor no se pide. Para fijar tu propio PIN:
  `npm start -- --red --pin 482913`.
- **Una página de internet abierta en la laptop no puede mandar órdenes** a la estación: el
  servidor solo acepta las órdenes como las manda el panel y con la dirección `localhost`.

> Los comandos por radio llevan la clave `CLAVE_COMANDOS`. La real va en
> `firmware/primaria/include/clave_local.h`, que **no se sube a GitHub**: se copia de
> `clave_local.ejemplo.h`, y el firmware y la estación terrena leen ese mismo archivo. Sin él se
> usa `ZENIT`, que es pública, y el servidor lo avisa al arrancar. Después de cambiar la clave hay
> que volver a subir `env:primaria` a la torre, y cada laptop que mande comandos necesita su copia
> del archivo. La clave viaja sin cifrar: alguien que escuche la radio podría copiarla. Cómo
> protegerlo del todo sigue pendiente (ver `docs/10-pendientes-del-equipo.md`).

La prueba `estacion-terrena/test/seguridad.test.js` revisa estas protecciones.
