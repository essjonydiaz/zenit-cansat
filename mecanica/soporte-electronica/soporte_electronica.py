# =============================================================================
#  soporte_electronica.py — Soporte de la electrónica de la carga primaria
#  (CanSat Zénit). CAD paramétrico con CadQuery: cambia los números de
#  "MEDIDAS" y vuelve a correrlo para regenerar todo.
#
#    python soporte_electronica.py
#
#  Sale en ./salida/:
#    soporte_base.step/.stl      disco de abajo (con ranura para o-ring y 4 amortiguadores)
#    tapa_gps.step/.stl          disco de arriba con el alojamiento del GPS de 25 mm
#    separador_XXmm.step/.stl    separadores impresos (si no usan los de nylon)
#    ensamble.step               todo armado, con placas y antena de muestra (para revisar)
#
#  Unidades: milímetros. Eje Z hacia arriba, origen al centro de la cara de
#  abajo del disco base.
# =============================================================================
import os
import cadquery as cq

SALIDA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "salida")
os.makedirs(SALIDA, exist_ok=True)

# ------------------------------------------------------------ MEDIDAS ------
# Tubo (carcasa de la primaria)
TUBO_DIAM_INT = 92.0        # Ø interior del tubo. Carcasa Ø 96 con pared de 2 mm.
HOLGURA_TUBO = 0.5          # espacio entre disco y tubo, por lado

# O-ring en el borde de cada disco: centra el soporte en el tubo y amortigua golpes laterales
ORING_GROSOR = 2.0          # sección del o-ring (comprar 88 x 2 mm o lo más parecido)
ORING_RANURA_PROF = 1.2     # el o-ring sobresale 0.8 mm: se aprieta 0.3 mm contra el tubo

# Placas perforadas 4 x 6 cm (medir con vernier y corregir)
PLACA_X, PLACA_Y, PLACA_Z = 60.0, 40.0, 1.6
AGUJERO_MARGEN = 2.5        # centro del agujero de montaje al borde de la placa
TORNILLO = 3.0              # M3 (si sus placas traen agujero de 2 mm, poner 2.0)

# Alturas (de cara a cara). Total de la pila ≈ 60 mm con la antena del GPS.
BASE_GROSOR = 5.0
ESPACIO_BASE_P1 = 6.0       # debajo de la placa 1 (soldaduras y cables)
ESPACIO_P1_P2 = 16.0
ESPACIO_P2_P3 = 18.0        # la Heltec con su pantalla mide ~14 mm sobre la placa 2
ESPACIO_P3_TAPA = 6.0
TAPA_GROSOR = 5.0

# Antena GPS de parche (1 pulgada)
GPS_LADO = 25.4
GPS_HOLGURA = 0.3           # por lado
GPS_ALOJ_PROF = 2.5         # cuánto se mete la antena en la tapa
GPS_CABLE_ANCHO = 3.0       # canal para el cable IPEX

# Amortiguadores de la base (hule / silicón antivibración M3, como los de drones)
AMORT_RADIO = 38.0          # a qué distancia del centro van los 4 amortiguadores
AMORT_ASIENTO = 7.5         # Ø del asiento para la arandela de hule
AMORT_ASIENTO_PROF = 1.5

# Pasos de cables por el borde (antena LoRa, cables de servos y pila)
MUESCA_ANCHO, MUESCA_PROF = 9.0, 6.0

# ------------------------------------------------------ medidas derivadas --
DISCO_DIAM = TUBO_DIAM_INT - 2 * HOLGURA_TUBO
DX = PLACA_X / 2 - AGUJERO_MARGEN
DY = PLACA_Y / 2 - AGUJERO_MARGEN
PUNTOS_PLACA = [(sx * DX, sy * DY) for sx in (-1, 1) for sy in (-1, 1)]
PASO_TORNILLO = TORNILLO + 0.4          # agujero pasante
TUERCA_ENTRECARAS = 5.5 + 0.3          # tuerca M3 (5.5 mm entre caras) con holgura
TUERCA_ALTO = 2.4
Z_P1 = BASE_GROSOR + ESPACIO_BASE_P1
Z_P2 = Z_P1 + PLACA_Z + ESPACIO_P1_P2
Z_P3 = Z_P2 + PLACA_Z + ESPACIO_P2_P3
Z_TAPA = Z_P3 + PLACA_Z + ESPACIO_P3_TAPA
ALTURA_TOTAL = Z_TAPA + TAPA_GROSOR + (4.5 - GPS_ALOJ_PROF)   # antena de 4.5 mm de alto


def disco_con_oring(grosor):
    """Disco que entra en el tubo, con ranura para o-ring en el canto."""
    d = cq.Workplane("XY").circle(DISCO_DIAM / 2).extrude(grosor)
    ranura = (cq.Workplane("XY").workplane(offset=grosor / 2 - (ORING_GROSOR + 0.2) / 2)
              .circle(DISCO_DIAM / 2 + 1).circle(DISCO_DIAM / 2 - ORING_RANURA_PROF)
              .extrude(ORING_GROSOR + 0.2))
    d = d.cut(ranura)
    d = d.faces(">Z").edges().chamfer(0.4)
    return d


def muescas(cuerpo, grosor):
    """Muescas en el borde para que pasen la antena LoRa y los cables."""
    for ang in (90, 270):  # a los lados largos de la placa
        m = (cq.Workplane("XY").center(0, 0)
             .rect(MUESCA_ANCHO, MUESCA_PROF * 2).extrude(grosor + 2)
             .translate((0, DISCO_DIAM / 2, -1))
             .rotate((0, 0, 0), (0, 0, 1), ang - 90))
        cuerpo = cuerpo.cut(m)
    return cuerpo


def soporte_base():
    b = disco_con_oring(BASE_GROSOR)
    # 4 torres para la placa 1 (hueco para que el tornillo haga rosca)
    torres = (cq.Workplane("XY").workplane(offset=BASE_GROSOR)
              .pushPoints(PUNTOS_PLACA).circle(3.6).extrude(ESPACIO_BASE_P1))
    b = b.union(torres)
    # agujero pasante para la varilla roscada M3 + hueco hexagonal abajo para atrapar la tuerca
    for (x, y) in PUNTOS_PLACA:
        b = b.cut(cq.Workplane("XY").center(x, y).circle(PASO_TORNILLO / 2).extrude(BASE_GROSOR + ESPACIO_BASE_P1 + 1).translate((0, 0, -0.5)))
        b = b.cut(cq.Workplane("XY").center(x, y).polygon(6, TUERCA_ENTRECARAS / 0.866).extrude(TUERCA_ALTO + 0.5).translate((0, 0, -0.5)))
    # costillas entre torres (rigidez sin agregar peso)
    for (x0, y0), (x1, y1) in (((-DX, -DY), (DX, -DY)), ((-DX, DY), (DX, DY)), ((-DX, -DY), (-DX, DY)), ((DX, -DY), (DX, DY))):
        largo = ((x1 - x0) ** 2 + (y1 - y0) ** 2) ** 0.5
        ang = 0 if y0 == y1 else 90
        cost = (cq.Workplane("XY").rect(largo, 2.4).extrude(3.0)
                .rotate((0, 0, 0), (0, 0, 1), ang).translate(((x0 + x1) / 2, (y0 + y1) / 2, BASE_GROSOR)))
        b = b.union(cost)
    # 4 amortiguadores a 45°: agujero pasante + asiento para la arandela de hule por abajo
    import math
    pts_am = [(AMORT_RADIO * math.cos(math.radians(a)), AMORT_RADIO * math.sin(math.radians(a))) for a in (45, 135, 225, 315)]
    b = (b.faces("<Z").workplane().pushPoints([(x, -y) for x, y in pts_am])
         .cboreHole(PASO_TORNILLO, AMORT_ASIENTO, AMORT_ASIENTO_PROF))
    # paso central de cables + dos ventanas laterales
    b = b.cut(cq.Workplane("XY").circle(7.0).extrude(BASE_GROSOR + 1).translate((0, 0, -0.5)))
    for sx in (-1, 1):
        v = cq.Workplane("XY").center(sx * 15, 0).slot2D(16, 7, 90).extrude(BASE_GROSOR + 1).translate((0, 0, -0.5))
        b = b.cut(v)
    b = muescas(b, BASE_GROSOR)
    # nombre grabado
    try:
        txt = (cq.Workplane("XY").workplane(offset=BASE_GROSOR - 0.6)
               .center(0, -30).text("ZENIT  BASE", 4.2, 0.7, kind="bold", halign="center", valign="center"))
        b = b.cut(txt)
    except Exception:
        pass
    return b


def tapa_gps():
    t = disco_con_oring(TAPA_GROSOR)
    # agujeros pasantes a las torres / separadores de la placa 3
    t = t.faces(">Z").workplane().pushPoints(PUNTOS_PLACA).hole(PASO_TORNILLO)
    # hueco hexagonal arriba para la tuerca de cada varilla (queda al ras)
    for (x, y) in PUNTOS_PLACA:
        t = t.cut(cq.Workplane("XY").center(x, y).polygon(6, TUERCA_ENTRECARAS / 0.866).extrude(TUERCA_ALTO + 0.5).translate((0, 0, TAPA_GROSOR - TUERCA_ALTO)))
    lado = GPS_LADO + 2 * GPS_HOLGURA
    # alojamiento cuadrado de la antena, con esquinas aliviadas
    aloj = (cq.Workplane("XY").workplane(offset=TAPA_GROSOR - GPS_ALOJ_PROF)
            .rect(lado, lado).extrude(GPS_ALOJ_PROF + 1))
    t = t.cut(aloj)
    t = t.cut(cq.Workplane("XY").workplane(offset=TAPA_GROSOR - GPS_ALOJ_PROF)
              .rect(lado, lado, forConstruction=True).vertices().circle(1.2).extrude(GPS_ALOJ_PROF + 1))
    # hueco al centro para la soldadura de abajo de la antena
    t = t.cut(cq.Workplane("XY").circle(5.0).extrude(TAPA_GROSOR + 1).translate((0, 0, -0.5)))
    # canal del cable IPEX hacia un agujero que baja a la placa del GPS
    canal = (cq.Workplane("XY").workplane(offset=TAPA_GROSOR - GPS_ALOJ_PROF)
             .center(lado / 2 + 5, 0).rect(10.5, GPS_CABLE_ANCHO).extrude(GPS_ALOJ_PROF + 1))
    t = t.cut(canal)
    t = t.cut(cq.Workplane("XY").center(lado / 2 + 10, 0).circle(3.0).extrude(TAPA_GROSOR + 1).translate((0, 0, -0.5)))
    # 2 ranuras para un cincho que abraza la antena (por si se despega la cinta)
    for sy in (-1, 1):
        t = t.cut(cq.Workplane("XY").center(0, sy * (lado / 2 + 3.5)).rect(5.0, 2.2).extrude(TAPA_GROSOR + 1).translate((0, 0, -0.5)))
    # ventanas para aligerar y pasar cables
    for sx in (-1, 1):
        t = t.cut(cq.Workplane("XY").center(sx * 33, 0).slot2D(18, 8, 90).extrude(TAPA_GROSOR + 1).translate((0, 0, -0.5)))
    t = muescas(t, TAPA_GROSOR)
    try:
        txt = (cq.Workplane("XY").workplane(offset=TAPA_GROSOR - 0.6)
               .center(0, -30).text("ZENIT  GPS", 4.2, 0.7, kind="bold", halign="center", valign="center"))
        t = t.cut(txt)
    except Exception:
        pass
    return t.translate((0, 0, Z_TAPA))


def separador(largo):
    return (cq.Workplane("XY").polygon(6, 6.4).extrude(largo)
            .faces(">Z").workplane().hole(PASO_TORNILLO))


# --------------------------------------------- piezas de muestra (no se imprimen)
def placa(z):
    p = cq.Workplane("XY").rect(PLACA_X, PLACA_Y).extrude(PLACA_Z)
    p = p.faces(">Z").workplane().pushPoints(PUNTOS_PLACA).hole(PASO_TORNILLO)
    return p.translate((0, 0, z))


def heltec(z):
    cuerpo = cq.Workplane("XY").rect(50.2, 25.5).extrude(1.6).translate((0, 0, z + 9.0))
    headers = cq.Workplane("XY").pushPoints([(0, 11.4), (0, -11.4)]).rect(46, 2.5).extrude(9.0).translate((0, 0, z))
    pantalla = cq.Workplane("XY").center(6.5, 0).rect(26.7, 19.3).extrude(3.5).translate((0, 0, z + 10.6))
    return cuerpo.union(headers).union(pantalla)


def antena_gps():
    a = cq.Workplane("XY").rect(GPS_LADO, GPS_LADO).extrude(4.5)
    return a.translate((0, 0, Z_TAPA + TAPA_GROSOR - GPS_ALOJ_PROF))


def tubo_fantasma(alto):
    return (cq.Workplane("XY").circle(TUBO_DIAM_INT / 2 + 2).circle(TUBO_DIAM_INT / 2)
            .extrude(alto).translate((0, 0, -10)))


def exportar(obj, nombre, stl=True):
    cq.exporters.export(obj, os.path.join(SALIDA, f"{nombre}.step"))
    if stl:
        cq.exporters.export(obj, os.path.join(SALIDA, f"{nombre}.stl"), tolerance=0.02, angularTolerance=0.1)


if __name__ == "__main__":
    base = soporte_base()
    tapa = tapa_gps()
    largos = {
        "p1_p2": ESPACIO_P1_P2,
        "p2_p3": ESPACIO_P2_P3,
        "p3_tapa": ESPACIO_P3_TAPA,
    }
    exportar(base, "soporte_base")
    exportar(tapa.translate((0, 0, -Z_TAPA)), "tapa_gps")
    for n, l in largos.items():
        exportar(separador(l), f"separador_{n}_{l:.0f}mm")

    ens = cq.Assembly(name="soporte_electronica_primaria")
    ens.add(base, name="soporte_base", color=cq.Color(0.16, 0.20, 0.30))
    ens.add(tapa, name="tapa_gps", color=cq.Color(0.16, 0.20, 0.30))
    for i, z in enumerate((Z_P1, Z_P2, Z_P3), 1):
        ens.add(placa(z), name=f"placa_{i}_muestra", color=cq.Color(0.10, 0.55, 0.30))
    ens.add(heltec(Z_P2 + PLACA_Z), name="heltec_v3_muestra", color=cq.Color(0.08, 0.08, 0.1))
    zs = [(Z_P1 + PLACA_Z, ESPACIO_P1_P2), (Z_P2 + PLACA_Z, ESPACIO_P2_P3), (Z_P3 + PLACA_Z, ESPACIO_P3_TAPA)]
    for i, (z, l) in enumerate(zs, 1):
        for j, (x, y) in enumerate(PUNTOS_PLACA):
            ens.add(separador(l).translate((x, y, z)), name=f"separador_{i}_{j}", color=cq.Color(0.95, 0.95, 0.95))
    ens.add(antena_gps(), name="antena_gps_muestra", color=cq.Color(0.80, 0.71, 0.55))
    ens.save(os.path.join(SALIDA, "ensamble.step"))
    # piezas sueltas en su posición (solo para las imágenes de vista previa)
    vista = os.path.join(SALIDA, "_vista"); os.makedirs(vista, exist_ok=True)
    for hijo in ens.children:
        cq.exporters.export(hijo.obj,
                            os.path.join(vista, f"{hijo.name}.stl"), tolerance=0.03, angularTolerance=0.15)
    cq.exporters.export(tubo_fantasma(ALTURA_TOTAL + 20), os.path.join(vista, "tubo.stl"), tolerance=0.05, angularTolerance=0.1)
    cq.exporters.export(ens.toCompound(), os.path.join(SALIDA, "ensamble.stl"), tolerance=0.05, angularTolerance=0.2)

    print(f"Disco: Ø {DISCO_DIAM:.1f} mm · agujeros de placa a {2*DX:.1f} × {2*DY:.1f} mm")
    print(f"Placas en z = {Z_P1:.1f}, {Z_P2:.1f}, {Z_P3:.1f} · tapa en z = {Z_TAPA:.1f}")
    print(f"Altura total con la antena: {ALTURA_TOTAL:.1f} mm")
    print(f"Varilla roscada M3: {Z_TAPA + TAPA_GROSOR:.0f} mm (de la cara de abajo de la base a la de arriba de la tapa)")
    bb = base.val().BoundingBox(); print(f"Base: {bb.xlen:.1f} × {bb.ylen:.1f} × {bb.zlen:.1f} mm")
    bb = tapa.val().BoundingBox(); print(f"Tapa: {bb.xlen:.1f} × {bb.ylen:.1f} × {bb.zlen:.1f} mm")
