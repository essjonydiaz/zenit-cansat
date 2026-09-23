# 6. Día del lanzamiento — checklist

Lugar: Universidad de Montemorelos, cancha de futbol frente a ARCOM.
El **líder** engancha el CanSat al dron; el resto opera la estación terrena.

## La noche anterior

- [ ] Firmware final subido: primaria `env:primaria` (¡no `primaria_sim`!), secundaria, receptor.
- [ ] Pilas de 9 V **nuevas** (y 2 de repuesto) — no usar las de las pruebas.
- [ ] microSD formateada en FAT32 dentro de la primaria.
- [ ] Laptop cargada, cargador, extensión. `npm install` ya hecho (en la cancha no hay internet).
- [ ] Cable USB **de datos** para el receptor (+ uno de repuesto).
- [ ] Ensayo con `npm run simular` y con `env:primaria_sim`: todos saben qué mirar y qué botón NO tocar.
- [ ] Herramientas: desarmadores, cinta, bridas, multímetro, pegamento ya fraguado, báscula.

## En la mesa (antes del turno)

- [ ] `npm start` → elegir el COM del receptor → **Conectar**. En *Cadena de conexión*, Navegador, Servidor y Receptor en verde.
- [ ] Encender la **secundaria**: 2 pitidos; en el panel aparece la baliza (enlace secundaria).
- [ ] Encender la **primaria** con el CanSat **quieto y vertical** (se calibra al encender):
      3 pitidos = todo bien, 1 pitido largo = falta un sensor.
- [ ] En el panel: evento `ARRANQUE` con `baro=1 imu=1 lora=1 sd=1` y los 6 mosaicos de *Salud de subsistemas* en verde.
- [ ] Comando **Ping** → llega `PONG PREVUELO`.
- [ ] Batería ≥ 8.5 V en el panel.
- [ ] Con el interruptor, **apagar** mientras se espera turno (la guía lo pide para no gastar pila).

## Carga de huevos (máximo 45 minutos desde que los entregan)

- [ ] Recibir los 2 huevos. Revisar el sello de identificación.
- [ ] Huevo 1 → carga primaria; huevo 2 → carga secundaria (procedimiento de 5 pasos del CoDR).
- [ ] Unir primaria y secundaria; comando **Cerrar seguro** si hace falta.
- [ ] Encender ambas cargas (vertical y quieta la primaria) y esperar 3 pitidos.
- [ ] Revisar en el panel: fase **Prevuelo**, altitud ≈ 0, baliza vigente y el sello **LISTO PARA VUELO** en *Verificación prevuelo* (si dice "NO LISTO", el panel marca con ✕ lo que falta).
- [ ] Revisar orificio superior libre y envolvente sin protuberancias.
- [ ] Entregar al dron.

## Durante el vuelo

| Qué debe pasar | Dónde verlo |
|---|---|
| Altitud sube hasta ~450 m | Gráfica de altitud · fase **Ascenso** |
| Al soltarlo: fase **Caída libre**, aceleración ~0 g | Evento `LIBERACION` |
| A 200 m: fase **Descenso autogiro** | Evento `DESACOPLE AUTO h≈200` |
| Velocidad entre 8 y 12 m/s | Indicador verde "En rango del autogiro" |
| Distancia y dirección a la secundaria | Brújula |
| Fase **Aterrizado** y luego `POST_ATERRIZAJE_OK` | Eventos |

**Desacople manual:** solo si el CanSat ya bajó de ~180 m y NO apareció el evento
`DESACOPLE`. Un operador designado (y solo él) presiona dos veces el botón.

## Después de aterrizar

- [ ] No apagar nada ni cerrar el panel hasta ver `POST_ATERRIZAJE_OK`.
- [ ] Recuperar ambas cargas (buzzer + brújula de la secundaria).
- [ ] Entregar los 2 huevos a los jueces.
- [ ] Anotar: estado de los huevos, distancia al centro del blanco de 3 m.
- [ ] Copiar `estacion-terrena/logs/` y el `VUELO_XXX.CSV` de la microSD a una USB y a GitHub.
- [ ] `python herramientas/analisis_vuelo.py ...` → tabla y gráficas para el RAM.
- [ ] Entregar **PEU-MC2024-RAM-EQUIPO.pdf** antes de **7 horas** después del aterrizaje.
