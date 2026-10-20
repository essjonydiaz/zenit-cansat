#!/usr/bin/env python3
"""
analisis_vuelo.py — Resultados de la misión para el documento RAM
(PEU-MC2024-RAM-EQUIPO.pdf, entrega máximo 7 horas después del aterrizaje).

Acepta cualquiera de las dos fuentes de datos:
  * la sesión de la estación terrena:  estacion-terrena/logs/sesion_XXXX_telemetria.csv
    (lee también ..._eventos.csv y ..._posicion.csv si existen)
  * el archivo de la microSD de la primaria (25 Hz): LOG00001.TXT del OpenLog
    (o VUELO_000.CSV si se usa el lector microSD SPI)

Uso:
  python herramientas/analisis_vuelo.py estacion-terrena/logs/sesion_20261015_101500_telemetria.csv
  python herramientas/analisis_vuelo.py E:/LOG00001.TXT --salida resultados_vuelo

Genera en la carpeta de salida:
  resumen.md       tabla de resultados lista para copiar al RAM
  resumen.json     los mismos números para otros scripts
  altitud.png, velocidad.png, aceleracion.png
"""
from __future__ import annotations

import argparse
import io
import json
import math
import sys
from pathlib import Path

import pandas as pd

ESTADOS = ["PREVUELO", "ASCENSO", "CAIDA_LIBRE", "DESCENSO_AUTOGIRO", "ATERRIZADO"]
# Colores validados para daltonismo (mismos que la estación terrena, tema claro)
AZUL, NARANJA, VERDE = "#2f6bff", "#d9480f", "#0f9d74"
TINTA, TINTA_SUAVE, REJILLA = "#121826", "#5b6475", "#e3e7ee"


# --------------------------------------------------------------- lectura --
def leer_datos(ruta: Path) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame | None, str]:
    """Devuelve (telemetría, eventos, posiciones, tipo_de_fuente)."""
    texto = ruta.read_text(encoding="utf-8", errors="replace")
    lineas = [l for l in texto.splitlines() if l.strip()]
    primera = lineas[0] if lineas else ""

    if primera.startswith("pc_iso"):  # sesión de la estación terrena
        tel = pd.read_csv(ruta)
        base = str(ruta).replace("_telemetria.csv", "")
        ev_ruta, pos_ruta = Path(base + "_eventos.csv"), Path(base + "_posicion.csv")
        eventos = pd.read_csv(ev_ruta) if ev_ruta.exists() else pd.DataFrame(columns=["t_ms", "codigo", "detalle"])
        posiciones = pd.read_csv(pos_ruta) if pos_ruta.exists() else None
        return tel, eventos, posiciones, "estacion"

    if primera.startswith("t_ms"):  # archivo de la microSD
        filas_ev = []
        for linea in lineas:
            if linea.startswith("# EVENTO,"):
                partes = linea.split(",", 3)
                filas_ev.append({"t_ms": int(partes[1]), "codigo": partes[2], "detalle": partes[3] if len(partes) > 3 else ""})
        # El OpenLog agrega al mismo archivo si solo se reinicia la placa: se
        # quitan los encabezados repetidos y las líneas cortadas por un apagón.
        n_campos = primera.count(",")
        datos = [primera] + [l for l in lineas[1:]
                             if not l.startswith(("t_ms", "#")) and l.count(",") == n_campos]
        tel = pd.read_csv(io.StringIO("\n".join(datos)))
        eventos = pd.DataFrame(filas_ev, columns=["t_ms", "codigo", "detalle"])
        pos = None
        if "dist_sec" in tel.columns:
            pos = tel[["t_ms", "dist_sec", "rumbo_sec"]].copy()
        return tel, eventos, pos, "microsd"

    sys.exit(f"No reconozco el formato de {ruta} (se esperaba el CSV de telemetría o el de la microSD).")


def separar_vuelos(tel: pd.DataFrame) -> list[pd.DataFrame]:
    """Si la primaria se reinició (t_ms vuelve a empezar) hay varios 'vuelos'."""
    cortes = [0] + list(tel.index[tel["t_ms"].diff() < -1000]) + [len(tel)]
    return [tel.iloc[a:b].reset_index(drop=True) for a, b in zip(cortes[:-1], cortes[1:]) if b - a > 5]


def elegir_vuelo(vuelos: list[pd.DataFrame], n: int | None) -> pd.DataFrame:
    if n is not None:
        return vuelos[n]
    completos = [v for v in vuelos if (v["estado"] == 4).any()]
    return (completos or vuelos)[-1]


def numero_en(texto: str, clave: str) -> float | None:
    import re
    m = re.search(rf"{clave}=(-?[\d.]+)", str(texto))
    return float(m.group(1)) if m else None


# --------------------------------------------------------------- análisis --
def analizar(tel: pd.DataFrame, eventos: pd.DataFrame, pos: pd.DataFrame | None) -> dict:
    t = tel["t_ms"] / 1000.0
    tel = tel.assign(t=t)
    t0, t1 = tel["t_ms"].min(), tel["t_ms"].max()
    if len(eventos) and "pc_iso" in tel.columns and "pc_iso" in eventos.columns:
        # Sesión de la estación: los eventos de ESTE vuelo son los que llegaron
        # (hora de la PC) mientras llegaba su telemetría.
        pc = pd.to_datetime(tel["pc_iso"])
        pc_ev = pd.to_datetime(eventos["pc_iso"])
        ev = eventos[(pc_ev >= pc.min() - pd.Timedelta(seconds=10)) & (pc_ev <= pc.max() + pd.Timedelta(seconds=5))]
    elif len(eventos):
        ev = eventos[(eventos["t_ms"] >= t0 - 5000) & (eventos["t_ms"] <= t1 + 60000)]
    else:
        ev = eventos

    def momento(estado: int):
        filas = tel[tel["estado"] >= estado]
        return None if filas.empty else filas.iloc[0]

    def evento(codigo: str):
        f = ev[ev["codigo"] == codigo] if len(ev) else ev
        return None if len(f) == 0 else f.iloc[0]

    r: dict = {}
    col_max = "alt_max" if "alt_max" in tel.columns else "alt"
    r["altura_maxima_m"] = round(float(max(tel[col_max].max(), tel["alt"].max())), 2)
    r["velocidad_max_subida_ms"] = round(float(tel["vel"].max()), 2)
    r["velocidad_max_bajada_ms"] = round(float(-tel["vel"].min()), 2)

    asc, lib, des, ate = momento(1), momento(2), momento(3), momento(4)
    ev_lib, ev_des, ev_ate = evento("LIBERACION"), evento("DESACOPLE"), evento("ATERRIZAJE")

    r["liberacion_altura_m"] = numero_en(ev_lib["detalle"], "h") if ev_lib is not None else (round(float(lib["alt"]), 1) if lib is not None else None)
    if ev_des is not None:
        r["desacople_altura_m"] = numero_en(ev_des["detalle"], "h")
        r["desacople_origen"] = str(ev_des["detalle"]).split(" ")[0]
        t_des = ev_des["t_ms"] / 1000
    elif des is not None:
        r["desacople_altura_m"] = round(float(des["alt"]), 1)
        r["desacople_origen"] = "estado"
        t_des = des["t"]
    else:
        r["desacople_altura_m"], r["desacople_origen"], t_des = None, None, None
    r["desacople_en_rango_200m"] = r["desacople_altura_m"] is not None and abs(r["desacople_altura_m"] - 200) <= 20

    # Velocidad con autogiro: tramo estable (quitamos la transición y el impacto)
    tramo = tel[(tel["estado"] == 3) & (tel["alt"] < 180) & (tel["alt"] > 20)]
    if len(tramo) >= 3:
        v = -tramo["vel"]
        r["descenso_autogiro_promedio_ms"] = round(float(v.mean()), 2)
        r["descenso_autogiro_min_ms"] = round(float(v.min()), 2)
        r["descenso_autogiro_max_ms"] = round(float(v.max()), 2)
        r["descenso_en_rango_8_12"] = 8 <= r["descenso_autogiro_promedio_ms"] <= 12
    else:
        r["descenso_autogiro_promedio_ms"] = None
        r["descenso_en_rango_8_12"] = False

    t_lib = (ev_lib["t_ms"] / 1000) if ev_lib is not None else (lib["t"] if lib is not None else None)
    t_ate = (ev_ate["t_ms"] / 1000) if ev_ate is not None else (ate["t"] if ate is not None else None)
    r["tiempo_caida_libre_s"] = round(t_des - t_lib, 1) if (t_des is not None and t_lib is not None) else None
    r["tiempo_descenso_autogiro_s"] = round(t_ate - t_des, 1) if (t_ate is not None and t_des is not None) else None
    r["tiempo_total_vuelo_s"] = round(t_ate - asc["t"], 1) if (t_ate is not None and asc is not None) else None
    r["transmision_post_aterrizaje_s"] = round(float(tel["t"].max() - t_ate), 1) if t_ate is not None else None
    r["transmision_post_aterrizaje_ok"] = bool(r["transmision_post_aterrizaje_s"] and r["transmision_post_aterrizaje_s"] >= 10)

    if "g_max" in tel.columns:
        r["aceleracion_maxima_g"] = round(float(tel["g_max"].max()), 2)
    elif "g" in tel.columns:
        r["aceleracion_maxima_g"] = round(float(tel["g"].max()), 2)
    r["nota_aceleracion"] = "El MPU9250 (GY-91) satura en 16 g: un valor de 16.0 significa 16 g o más."
    r["temperatura_min_c"] = round(float(tel["temp"].min()), 1)
    r["temperatura_max_c"] = round(float(tel["temp"].max()), 1)
    r["presion_min_hpa"] = round(float(tel["pres"].min()) / 100, 1)

    if "seq" in tel.columns and len(tel) > 1:
        # T, P y E comparten el contador de la primaria: contamos huecos globales si hay eventos/posiciones,
        # si no, solo reportamos cuántas T llegaron.
        r["tramas_T_recibidas"] = int(len(tel))
    if pos is not None and "dist_sec" in pos.columns:
        validas = pos[pos["dist_sec"] >= 0]
        if len(validas):
            ult = validas.iloc[-1]
            r["secundaria_distancia_final_m"] = round(float(ult["dist_sec"]), 1)
            r["secundaria_rumbo_final_grados"] = round(float(ult["rumbo_sec"]), 1)
    r["_t_eventos"] = {"liberacion": t_lib, "desacople": t_des, "aterrizaje": t_ate}
    return r


# --------------------------------------------------------------- gráficas --
def graficar(tel: pd.DataFrame, r: dict, salida: Path) -> None:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    plt.rcParams.update({
        "font.size": 10, "axes.edgecolor": REJILLA, "axes.labelcolor": TINTA_SUAVE,
        "xtick.color": TINTA_SUAVE, "ytick.color": TINTA_SUAVE, "axes.grid": True,
        "grid.color": REJILLA, "grid.linewidth": 0.8, "axes.spines.top": False, "axes.spines.right": False,
        "axes.titleweight": "bold", "axes.titlecolor": TINTA, "axes.titlelocation": "left",
    })
    t = tel["t_ms"] / 1000.0
    nombres = {"liberacion": "Liberación", "desacople": "Desacople", "aterrizaje": "Aterrizaje"}
    marcas = [(nombres[k], v) for k, v in r["_t_eventos"].items() if v is not None]

    def marcar(ax):
        for nombre, x in marcas:
            ax.axvline(x, color=TINTA_SUAVE, linewidth=1, linestyle=(0, (4, 3)))
            ax.annotate(nombre, (x, 1), xycoords=("data", "axes fraction"), xytext=(3, -12),
                        textcoords="offset points", color=TINTA_SUAVE, fontsize=9)

    # Altitud
    fig, ax = plt.subplots(figsize=(9, 4), dpi=150)
    ax.plot(t, tel["alt"], color=AZUL, linewidth=2)
    marcar(ax)
    imax = tel["alt"].idxmax()
    ax.plot([t[imax]], [tel["alt"][imax]], marker="o", markersize=6, color=AZUL,
            markeredgecolor="white", markeredgewidth=2)
    ax.annotate(f"máx. {r['altura_maxima_m']:.1f} m", (t[imax], tel["alt"][imax]), xytext=(-10, -22),
                textcoords="offset points", ha="right", color=TINTA, fontsize=9)
    ax.set_ylim(top=tel["alt"].max() * 1.12)
    ax.set_title("Altitud sobre el punto de lanzamiento")
    ax.set_xlabel("Tiempo a bordo (s)")
    ax.set_ylabel("m")
    fig.tight_layout()
    fig.savefig(salida / "altitud.png")
    plt.close(fig)

    # Velocidad
    fig, ax = plt.subplots(figsize=(9, 4), dpi=150)
    ax.axhspan(-12, -8, color=AZUL, alpha=0.10, linewidth=0)
    ax.annotate("meta autogiro 8–12 m/s", (t.iloc[0], -12), xytext=(4, -12), textcoords="offset points",
                color=TINTA_SUAVE, fontsize=9)
    ax.plot(t, tel["vel"], color=AZUL, linewidth=2)
    ax.axhline(0, color=TINTA_SUAVE, linewidth=0.8)
    marcar(ax)
    ax.set_title("Velocidad vertical (positiva = subiendo)")
    ax.set_xlabel("Tiempo a bordo (s)")
    ax.set_ylabel("m/s")
    fig.tight_layout()
    fig.savefig(salida / "velocidad.png")
    plt.close(fig)

    # Aceleración (magnitud): una sola serie, el título la nombra
    g = (tel["ax"] ** 2 + tel["ay"] ** 2 + tel["az"] ** 2) ** 0.5
    fig, ax = plt.subplots(figsize=(9, 4), dpi=150)
    ax.plot(t, g, color=VERDE, linewidth=1.6)
    ax.axhline(1, color=TINTA_SUAVE, linewidth=0.8, linestyle=(0, (2, 2)))
    ax.annotate("1 g (reposo)", (t.iloc[0], 1), xytext=(4, 4), textcoords="offset points", color=TINTA_SUAVE, fontsize=9)
    marcar(ax)
    ax.set_title("Aceleración medida |a| (0 g = caída libre)")
    ax.set_xlabel("Tiempo a bordo (s)")
    ax.set_ylabel("g")
    fig.tight_layout()
    fig.savefig(salida / "aceleracion.png")
    plt.close(fig)


# --------------------------------------------------------------- reporte --
def cumple(ok: bool | None) -> str:
    return "Cumple" if ok else ("No cumple" if ok is False else "Sin dato")


def escribir_resumen(r: dict, fuente: Path, tipo: str, salida: Path) -> None:
    f = lambda v, u="": "—" if v is None else f"{v} {u}".strip()  # noqa: E731
    lineas = [
        "# Resultados de la misión — CanSat Zénit",
        "",
        f"Fuente de datos: `{fuente.name}` ({'estación terrena' if tipo == 'estacion' else 'microSD de la primaria'})",
        "",
        "## Resultados principales",
        "",
        "| Parámetro | Resultado | Requisito | Estado |",
        "|---|---|---|---|",
        f"| Altura máxima alcanzada | {f(r['altura_maxima_m'], 'm')} | calcularla | Cumple |",
        f"| Velocidad máxima de subida | {f(r['velocidad_max_subida_ms'], 'm/s')} | calcular velocidad en todo el trayecto | Cumple |",
        f"| Velocidad máxima de bajada | {f(r['velocidad_max_bajada_ms'], 'm/s')} | calcular velocidad en todo el trayecto | Cumple |",
        f"| Altura de liberación | {f(r['liberacion_altura_m'], 'm')} | ~450 m | — |",
        f"| Altura de desacople (autogiro) | {f(r['desacople_altura_m'], 'm')} ({r.get('desacople_origen') or '—'}) | 200 m | {cumple(r['desacople_en_rango_200m'])} |",
        f"| Velocidad promedio con autogiro | {f(r['descenso_autogiro_promedio_ms'], 'm/s')} | 8–12 m/s | {cumple(r['descenso_en_rango_8_12'])} |",
        f"| Transmisión después de aterrizar | {f(r['transmision_post_aterrizaje_s'], 's')} | ≥ 10 s | {cumple(r['transmision_post_aterrizaje_ok'])} |",
        f"| Tiempo en caída libre | {f(r['tiempo_caida_libre_s'], 's')} | — | — |",
        f"| Tiempo de descenso con autogiro | {f(r['tiempo_descenso_autogiro_s'], 's')} | — | — |",
        f"| Tiempo total de vuelo | {f(r['tiempo_total_vuelo_s'], 's')} | — | — |",
        f"| Aceleración máxima | {f(r.get('aceleracion_maxima_g'), 'g')} | — | — |",
        f"| Temperatura mín / máx | {f(r['temperatura_min_c'])} / {f(r['temperatura_max_c'], '°C')} | — | — |",
        f"| Presión mínima | {f(r['presion_min_hpa'], 'hPa')} | — | — |",
    ]
    if "secundaria_distancia_final_m" in r:
        lineas.append(f"| Carga secundaria (distancia / dirección final) | {r['secundaria_distancia_final_m']} m / "
                      f"{r['secundaria_rumbo_final_grados']}° | detectarla | Cumple |")
    lineas += [
        "",
        f"_{r['nota_aceleracion']}_",
        "",
        "## Gráficas",
        "",
        "![Altitud](altitud.png)",
        "",
        "![Velocidad](velocidad.png)",
        "",
        "![Aceleración](aceleracion.png)",
        "",
        "## Para completar a mano en el RAM",
        "",
        "- Estado de los huevos al recuperarlos (primaria / secundaria).",
        "- Distancia del punto de aterrizaje al centro del blanco de 3 m.",
        "- Costo final del satélite (máximo 100 USD).",
        "- Qué funcionó, qué falló y por qué (conclusiones).",
    ]
    (salida / "resumen.md").write_text("\n".join(lineas) + "\n", encoding="utf-8")
    limpio = {k: v for k, v in r.items() if not k.startswith("_")}
    (salida / "resumen.json").write_text(json.dumps(limpio, indent=2, ensure_ascii=False), encoding="utf-8")


def main() -> None:
    p = argparse.ArgumentParser(description="Análisis del vuelo del CanSat Zénit para el documento RAM.")
    p.add_argument("archivo", type=Path, help="CSV de telemetría de la estación terrena o LOGxxxxx.TXT (OpenLog) de la microSD")
    p.add_argument("--salida", type=Path, default=None, help="carpeta de resultados (por defecto: junto al archivo)")
    p.add_argument("--vuelo", type=int, default=None, help="número de vuelo si hay varios en el archivo (0 = primero)")
    a = p.parse_args()

    if not a.archivo.exists():
        sys.exit(f"No existe {a.archivo}")
    tel, eventos, pos, tipo = leer_datos(a.archivo)
    vuelos = separar_vuelos(tel)
    if not vuelos:
        sys.exit("El archivo no tiene suficientes datos de telemetría.")
    vuelo = elegir_vuelo(vuelos, a.vuelo)
    if len(vuelos) > 1:
        print(f"El archivo contiene {len(vuelos)} arranques de la primaria; se analiza "
              f"{'el número ' + str(a.vuelo) if a.vuelo is not None else 'el último vuelo completo'}.")

    salida = a.salida or a.archivo.with_name(a.archivo.stem.replace("_telemetria", "") + "_resultados")
    salida.mkdir(parents=True, exist_ok=True)
    r = analizar(vuelo, eventos, pos)
    graficar(vuelo, r, salida)
    escribir_resumen(r, a.archivo, tipo, salida)

    print(f"\nResultados en: {salida}")
    for k in ["altura_maxima_m", "desacople_altura_m", "descenso_autogiro_promedio_ms",
              "transmision_post_aterrizaje_s", "aceleracion_maxima_g"]:
        print(f"  {k:32s} {r.get(k)}")


if __name__ == "__main__":
    main()
