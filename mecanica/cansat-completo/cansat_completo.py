# =============================================================================
#  cansat_completo.py — CanSat Zénit completo en CAD paramétrico (CadQuery)
#
#    python cansat_completo.py
#
#  Sale en ./salida/:
#    imprimir/*.stl  y  *.step     cada pieza que se imprime en 3D
#    ensamble_cansat.step          todo armado (con componentes comprados de muestra)
#    reporte.txt                   medidas, revisión de choques y masa estimada
#
#  Unidades: mm. Eje Z hacia arriba. Z = 0 es el fondo de la carga secundaria.
#  La unión primaria/secundaria está en Z = H_SEC.
#
#  Reglas de la Guía de Misión CASAT-FIT2026 que respeta:
#    · cilindro de Ø 9–10 cm y 20–23 cm de alto; primaria ≤ 16 cm, secundaria ≤ 7 cm
#    · superficie lisa; un solo orificio (Ø 9–10 mm, ≥ 3 mm de profundo) en la tapa superior
#    · autogiro embebido, sin protuberancias, sin motor; antenas por dentro
#    · la pared no queda con huecos al abrirse las aspas (van en canales por fuera de la pared)
#    · ≤ 600 g con los 2 huevos de 65 g (ver reporte.txt)
# =============================================================================
import os, math
import cadquery as cq

AQUI = os.path.dirname(os.path.abspath(__file__))
SAL = os.path.join(AQUI, 'salida'); IMP = os.path.join(SAL, 'imprimir'); VIS = os.path.join(SAL, '_vista')
for d in (SAL, IMP, VIS): os.makedirs(d, exist_ok=True)

# ================================================================ MEDIDAS ===
OD = 96.0; R = OD / 2          # diámetro exterior
T = 1.2                        # pared de las carcasas (3 perímetros de 0.4)
RI = R - T                     # radio interior (46.8)
H_SEC = 70.0                   # secundaria (≤ 70)
H_PRI = 159.0                  # primaria (≤ 160)
ZU = H_SEC                     # unión
Z_TOP = ZU + H_PRI             # 229

ANG_ASPAS = (90.0, 210.0, 330.0)       # dónde van las 3 aspas
ANG_COLUMNA = (30.0, 150.0, 270.0)     # varillas M3 que forman la columna de la primaria
R_COLUMNA = 38.0
ANG_GUIAS = (0.0, 180.0, 270.0)        # guías del anillo de retención

# --- primaria (alturas absolutas)
Z_PISO1 = ZU + 2.0                     # cara de arriba de la ceja del piso
Z_PISO2 = ZU + 4.0                     # cara de arriba del piso
Z_PASADOR = ZU + 9.0                   # altura del pasador de desacople
Z_ANILLO = (ZU + 22.0, ZU + 24.5)      # anillo de retención de aspas
Z_HUEVO_BASE = (ZU + 26.5, ZU + 29.0)  # disco de abajo del módulo del huevo
Z_ELEC_BASE = (ZU + 90.0, ZU + 95.0)   # disco de arriba del huevo = base de la electrónica
ESP_PLACAS = (6.0, 16.0, 18.0, 6.0)    # base→P1, P1→P2, P2→P3, P3→tapa
HULE = (8.0, 2.0)                      # arandela de hule bajo P1 y sobre P3 (Ø, grosor)
PLACA = (60.0, 40.0, 1.6)
AGUJERO_MARGEN = 2.5
Z_TUBO_ARRIBA = ZU + 148.8             # borde de arriba del tubo
Z_TAPA = (ZU + 145.8, ZU + 150.8)      # tapa de la electrónica (con ceja Ø96 arriba)
Z_ROTOR0 = ZU + 151.3                  # falda del rotor
Z_ROTOR_PLATO = ZU + 155.0             # plato superior del rotor (hasta Z_TOP)
Z_BISAGRA = ZU + 153.0                 # eje de las bisagras (su radio, R_BISAGRA, va abajo)
L_ASPA = 130.0
Z_ASPA_RAIZ = Z_BISAGRA - 1.0          # 222
Z_ASPA_PUNTA = Z_ASPA_RAIZ - L_ASPA    # 92
ASPA_ANCHO = (26.0, 20.0)              # raíz, punta
ORIFICIO_DRON = (9.5, 3.5)             # Ø y profundidad
BALERO = (16.0, 8.0, 5.0)              # 688ZZ: Ø ext, Ø int, ancho (4 g)
GPS_ANT = (25.4, 4.5); GPS_POS = (28.5, 0.0)

# --- canales de las aspas: la pared del tubo es CONTINUA (sin huecos). Cada aspa va en un
#     canal poco profundo por fuera, al ras; al abrirse, la pared queda entera.
T_ASPA = 1.6                           # grueso del aspa (4 perímetros)
HOLGURA_ASPA = 0.4
R_CANAL = R - T_ASPA - HOLGURA_ASPA    # 46.0: fondo del canal (cara de afuera de la pared)
RI_CANAL = R_CANAL - T                 # 44.8: cara de adentro de la pared en los canales
R_BISAGRA = R_CANAL + HOLGURA_ASPA     # 46.4: eje en la cara de adentro del aspa (al abrir no choca con el rotor)
# Retención con imanes a través de la pared (no hay que perforarla):
IMAN_ASPA = (8.0, 1.0)                 # Ø × grueso, en la punta de cada aspa
IMAN_ANILLO = (8.0, 2.0)               # Ø × grueso, en cada diente del anillo de retención
Z_IMAN = Z_ASPA_PUNTA + 6.5            # 98.5
GIRO_ANILLO = 15.0                     # grados que gira el anillo (antihorario visto desde arriba) para soltar
ORING = (86.0, 2.0)                    # Ø interior × sección: centra la electrónica contra los 3 canales

# --- huevos (65 g según la guía; medidas típicas de huevo grande)
HUEVO = (57.0, 43.0)                   # largo, Ø
HUEVO1_C = (0.0, 0.0, ZU + 59.75)      # primaria, acostado a lo largo de X
HUEVO2_C = (-12.0, 0.0, 33.0)          # secundaria, acostado a lo largo de Y

# --- tornillería
M3 = 3.4; HEX_M3 = 5.8 / math.cos(math.radians(30)); HEX_ALTO = 2.6

PLA = 1.24  # g/cm3

def ang_xy(r, a): return (r * math.cos(math.radians(a)), r * math.sin(math.radians(a)))

# ============================================================ utilidades ===
def cil(r, z0, z1, x=0.0, y=0.0):
    return cq.Workplane('XY').workplane(offset=z0).center(x, y).circle(r).extrude(z1 - z0)

def anillo(r0, r1, z0, z1):
    return cq.Workplane('XY').workplane(offset=z0).circle(r1).circle(r0).extrude(z1 - z0)

def caja(sx, sy, sz, c):
    return cq.Workplane('XY').box(sx, sy, sz).translate(c)

def hexagono(z0, z1, x, y):
    return cq.Workplane('XY').workplane(offset=z0).center(x, y).polygon(6, HEX_M3).extrude(z1 - z0)

def rot(obj, a):
    return obj.rotate((0, 0, 0), (0, 0, 1), a)

def cuna(r0, r1, a0, a1, z0, z1):
    """Sector de anillo entre los ángulos a0–a1 (grados)."""
    n = 24
    pts = [ang_xy(r1, a0 + (a1 - a0) * i / n) for i in range(n + 1)] + [ang_xy(r0, a1 - (a1 - a0) * i / n) for i in range(n + 1)]
    return cq.Workplane('XY').workplane(offset=z0).polyline(pts).close().extrude(z1 - z0)

def gancho(x, y, z, hacia_arriba=True):
    """Gancho tipo hongo para amarrar ligas."""
    s = 1 if hacia_arriba else -1
    poste = cil(1.6, z, z + s * 6.0, x, y) if s > 0 else cil(1.6, z - 6.0, z, x, y)
    cab = cil(2.8, z + s * 6.0, z + s * 7.5, x, y) if s > 0 else cil(2.8, z - 7.5, z - 6.0, x, y)
    return poste.union(cab)

def perfil_aspa(margen=0.0, z_arriba=None):
    """Trapecio con punta redonda en el plano YZ (para el aspa en ángulo 0)."""
    w0 = ASPA_ANCHO[0] / 2 + margen; w1 = ASPA_ANCHO[1] / 2 + margen
    za = z_arriba if z_arriba is not None else Z_ASPA_RAIZ
    zb = Z_ASPA_PUNTA + w1 - margen * 0
    p = (cq.Workplane('YZ').moveTo(-w0, za).lineTo(w0, za).lineTo(w1, zb)
         .threePointArc((0, zb - w1 - margen), (-w1, zb)).close())
    return p.extrude(70).translate((20, 0, 0))

def canal(r0, r1, z0, z1, margen):
    """Volumen del canal de un aspa (en ángulo 0) entre los radios r0–r1 y las alturas z0–z1."""
    return anillo(r0, r1, z0, z1).intersect(perfil_aspa(margen=margen, z_arriba=Z_TOP + 5))

def despejar(obj):
    """Quita de una pieza interior lo que choca con el lado de adentro de los 3 canales."""
    for a in ANG_ASPAS:
        obj = obj.cut(rot(canal(RI_CANAL - 0.4, R + 2, Z_ASPA_PUNTA - 8, Z_TUBO_ARRIBA, HOLGURA_ASPA + T + 0.4), a))
    return obj

# ============================================================ SECUNDARIA ===
def carcasa_secundaria():
    c = cil(R, 0, H_SEC).cut(cil(RI, 1.2, H_SEC + 1))
    c = c.faces('<Z').edges().chamfer(1.0)
    for a in ANG_COLUMNA:  # torres para los tornillos de la tapa
        x, y = ang_xy(43.0, a)
        t = cil(3.5, H_SEC - 12.0, H_SEC - 3.0, x, y).cut(cil(1.3, H_SEC - 12, H_SEC, x, y))
        puente = caja(4.0, 7.0, 9.0, (0, 0, 0)).translate((45.0, 0, H_SEC - 7.5))
        c = c.union(t).union(rot(puente, a))
    # nervaduras que funcionan como zona de deformación al impactar
    for a in range(0, 360, 45):
        c = c.union(rot(caja(17.0, 1.2, 4.8, (10.5, 0, 3.6)), a + 22.5))
    return c

def tapa_secundaria():
    z0, z1 = H_SEC - 3.0, H_SEC
    t = anillo(38.0, RI - 0.2, z0, z1).union(cil(10.0, z0, z1))
    for a in (0.0, 90.0, 180.0, 270.0):
        t = t.union(rot(caja(30.0, 6.0, 3.0, (24.0, 0, (z0 + z1) / 2)), a))
    t = t.union(caja(25.0, 21.0, 3.0, (-20.0, -22.0, (z0 + z1) / 2)))   # base del ESP32-C3
    t = t.union(caja(19.0, 19.0, 3.0, (-24.0, 16.0, (z0 + z1) / 2)))   # base del RFM95W
    poste = (cq.Workplane('XY').workplane(offset=H_SEC).circle(4.0).extrude(13.0)
             .faces('>Z').edges().chamfer(0.8))
    t = t.union(poste)
    t = t.cut(cq.Workplane('YZ').workplane(offset=-10).center(0, Z_PASADOR).circle(1.7).extrude(20))
    for a in ANG_COLUMNA:
        x, y = ang_xy(43.0, a)
        t = t.cut(cil(1.7, z0 - 1, z1 + 1, x, y)).cut(cil(3.2, z1 - 1.6, z1 + 1, x, y))
    for (x, y) in ((-12.0, 40.0), (-12.0, -40.0), (-40.0, 0.0), (6.0, 0.0)):  # ganchos de la hamaca (abajo de la tapa)
        t = t.union(gancho(x, y, z0, hacia_arriba=False))
    return t

def bandeja_secundaria():
    zb = 1.2
    b = anillo(36.0, RI - 0.4, zb, zb + 1.6)
    px0, px1 = 21.6, 39.9; py = 13.65
    caja_pila = (caja(px1 - px0 + 3.2, 2 * py + 3.2, 26.0, ((px0 + px1) / 2, 0, zb + 13.0))
                 .cut(caja(px1 - px0, 2 * py, 27.0, ((px0 + px1) / 2, 0, zb + 15.0))))
    caja_pila = caja_pila.cut(caja(30.0, 14.0, 18.0, ((px0 + px1) / 2, 0, zb + 15.0)))  # ventanas laterales
    b = b.union(caja_pila).union(caja(px1 - px0 + 3.2, 2 * py + 3.2, 2.0, ((px0 + px1) / 2, 0, zb + 1.0)))
    for y in (-16.0, 16.0):
        b = b.union(cil(2.2, zb, 54.0, 18.0, y))
    placa = (cq.Workplane('XY').workplane(offset=54.0).circle(RI - 0.6).extrude(2.0)
             .intersect(caja(40, 100, 10, (34.0, 0, 55.0))))
    b = b.union(placa.cut(caja(12.0, 20.0, 5.0, (40.0, 0, 55.0))))
    for a in (150.0, 210.0, 270.0, 90.0, 180.0):  # ganchos de la hamaca abajo del huevo
        x, y = ang_xy(38.5, a)
        b = b.union(gancho(x, y, zb + 1.6))
    b = b.union(caja(8.0, 3.0, 2.0, (-30.0, 30.0, zb + 2.6)))  # base del reed switch
    return b

# ============================================================== PRIMARIA ===
def piso_primaria():
    # ceja exterior (asiento del tubo) + anillo que entra en el tubo; el centro va calado
    p = anillo(41.0, R, ZU, Z_PISO1).union(anillo(43.5, RI - 0.2, Z_PISO1, Z_PISO2))
    p = p.faces('<Z').edges().chamfer(0.6)
    for a in ANG_COLUMNA:   # rayos del centro a cada varilla de la columna
        x, y = ang_xy(R_COLUMNA, a)
        p = p.union(rot(caja(R_COLUMNA, 6.0, Z_PISO2 - ZU, (R_COLUMNA / 2, 0, (ZU + Z_PISO2) / 2)), a))
        p = p.union(cil(5.0, ZU, Z_PISO2, x, y))
    p = p.union(caja(50.6, 29.2, 1.6, (0, 25.0, Z_PISO2 - 0.8)).intersect(cil(RI - 0.3, ZU, Z_PISO2)))  # cama de la pila
    for sx in (-1, 1):
        p = p.union(caja(26.0, 26.4, 1.6, (sx * 18.6, -22.75, Z_PISO2 - 0.8)).intersect(cil(RI - 0.3, ZU, Z_PISO2)))  # cama de cada servo
    # torre central: recibe el poste de la secundaria; el pasador la cruza
    p = p.union(cil(11.0, Z_PISO2, ZU + 14.0))
    p = p.cut(cil(5.25, ZU - 1, ZU + 15.0))
    p = p.cut(cq.Workplane('YZ').workplane(offset=-30).center(0, Z_PASADOR).circle(1.7).extrude(60)
              .intersect(caja(60, 30, 30, (0, 0, Z_PASADOR))))
    # columna: agujeros + hexágono para la tuerca por abajo
    for a in ANG_COLUMNA:
        x, y = ang_xy(R_COLUMNA, a)
        p = p.cut(cil(M3 / 2, ZU - 1, Z_PISO2 + 1, x, y)).cut(hexagono(ZU - 0.1, ZU + HEX_ALTO, x, y))
    # cuna de la pila de 9 V (acostada)
    bx, by0, by1 = 24.65, 11.35, 38.65
    for sx in (-1, 1):
        for yy in (by0, by1):
            esquina = (caja(8.0, 1.6, 9.0, (sx * (bx - 3.2), yy + (-0.8 if yy == by0 else 0.8), Z_PISO2 + 4.5))
                       .union(caja(1.6, 8.0, 9.0, (sx * (bx + 0.8), yy + (4.0 if yy == by0 else -4.0), Z_PISO2 + 4.5))))
            p = p.union(esquina.intersect(cil(RI - 0.3, ZU, ZU + 30)))
    for x in (-10.0, 10.0):  # pasos para el cincho de la pila
        p = p.cut(caja(3.0, 6.0, 5.0, (x, by0 - 4.0, Z_PISO2 - 1)))
    # cunas de los 2 servos SG90 (acostados, eje hacia +Y)
    for sx in (-1, 1):
        cx = sx * 18.6; y0, y1 = -34.2, -11.3
        eje_x = cx + 5.9 * (1 if cx < 0 else -1)
        u = (caja(25.8, 26.0, 7.0, (cx, (y0 + y1) / 2, Z_PISO2 + 3.5))
             .cut(caja(23.2, 22.9, 8.0, (cx, (y0 + y1) / 2, Z_PISO2 + 4.0)))
             .cut(caja(8.0, 30.0, 8.0, (eje_x, (y0 + y1) / 2, Z_PISO2 + 5.0))))
        p = p.union(u.intersect(cil(RI - 0.3, Z_PISO2, ZU + 20)))
    # guías del anillo de retención (dedos con ceja)
    for a in ANG_GUIAS:
        d = (caja(1.6, 5.0, Z_ANILLO[1] + 2.0 - Z_PISO2, (45.3, 0, (Z_PISO2 + Z_ANILLO[1] + 2.0) / 2))
             .union(caja(3.6, 5.0, 1.5, (44.3, 0, Z_ANILLO[1] + 1.25)))
             .union(caja(3.6, 5.0, 1.5, (44.3, 0, Z_ANILLO[0] - 0.75))))
        p = p.union(rot(d, a))
    # guía del pasador (lado del servo de desacople)
    p = p.union(caja(14.0, 6.0, 6.0, (-18.0, 0, Z_PASADOR)).cut(
        cq.Workplane('YZ').workplane(offset=-30).center(0, Z_PASADOR).circle(1.7).extrude(30)))
    return despejar(p)

def anillo_retencion():
    a = anillo(42.2, 44.3, *Z_ANILLO)
    for ang in ANG_ASPAS:
        # diente con un imán: jala el imán de la punta del aspa a través de la pared.
        # Al girar el anillo GIRO_ANILLO grados, el imán se aleja y el aspa se suelta.
        x1 = RI_CANAL - 0.45; z1 = Z_IMAN + IMAN_ANILLO[0] / 2 + 1.5
        d = caja(2.6, 11.0, z1 - Z_ANILLO[0], (x1 - 1.3, 0, (Z_ANILLO[0] + z1) / 2))
        d = d.cut(cq.Workplane('YZ').workplane(offset=x1 - IMAN_ANILLO[1] - 0.1).center(0, Z_IMAN)
                  .circle(IMAN_ANILLO[0] / 2 + 0.1).extrude(IMAN_ANILLO[1] + 1.0))
        a = a.union(rot(d, ang))
    brazo = caja(6.0, 4.0, 2.5, (40.0, 0, sum(Z_ANILLO) / 2)).cut(cil(0.8, 0, 300, 38.5, 0))
    a = a.union(rot(brazo, -62.0))
    return despejar(a)

def disco_huevo_base():
    z0, z1 = Z_HUEVO_BASE
    d = anillo(40.5, RI - 0.5, z0, z1).union(cil(12.0, z0, z1))
    for a in range(0, 360, 60):  # rayos
        d = d.union(rot(caja(30.0, 4.0, z1 - z0, (26.0, 0, (z0 + z1) / 2)), a))
    for a in ANG_COLUMNA:
        x, y = ang_xy(R_COLUMNA, a)
        d = d.union(cil(4.5, z0, z1, x, y)).cut(cil(M3 / 2, z0 - 1, z1 + 1, x, y))
        d = d.union(rot(caja(16.0, 4.0, z1 - z0, (31.0, 0, (z0 + z1) / 2)), a))
    d = d.cut(cil(4.0, z0 - 1, z1 + 1))
    for a in range(0, 360, 60):
        x, y = ang_xy(34.0, a)
        d = d.union(gancho(x, y, z1))
    for a in ANG_ASPAS:  # paso para el diente del anillo (en su lugar y al girar para soltar)
        d = d.cut(cuna(41.0, R + 1, a - 9.0, a + GIRO_ANILLO + 9.0, z0 - 1, z1 + 1))
    for a in (0.0, 120.0, 240.0):  # topes de hule (3 puntos contra la pared)
        x, y = ang_xy(RI - 1.0, a + 60)
        d = d.union(cil(1.0, z0, z1, x, y))
    return despejar(d)

def placa_pts():
    dx = PLACA[0] / 2 - AGUJERO_MARGEN; dy = PLACA[1] / 2 - AGUJERO_MARGEN
    return [(sx * dx, sy * dy) for sx in (-1, 1) for sy in (-1, 1)]

def z_placas():
    z = Z_ELEC_BASE[1] + ESP_PLACAS[0]
    zs = [z]
    for e in ESP_PLACAS[1:3]:
        z = z + PLACA[2] + e; zs.append(z)
    return zs

def disco_electronica_base():
    z0, z1 = Z_ELEC_BASE
    # más chico que el tubo: solo el o-ring toca, contra el lado de adentro de los 3 canales
    d = anillo(38.0, RI_CANAL - 0.5, z0, z1).union(cil(38.0, z1 - 3.0, z1))
    zc = (z0 + z1) / 2
    d = d.cut(anillo(ORING[0] / 2, RI + 1, zc - ORING[1] / 2 - 0.1, zc + ORING[1] / 2 + 0.1))      # ranura del o-ring
    # torres más bajas: arriba de cada una va una arandela de hule y luego la placa 1
    d = d.union(cq.Workplane('XY').workplane(offset=z1).pushPoints(placa_pts()).circle(3.6).extrude(ESP_PLACAS[0] - HULE[1]))
    for (x, y) in placa_pts():
        d = d.cut(cil(M3 / 2, z0 - 1, z1 + ESP_PLACAS[0] + 1, x, y)).cut(hexagono(z1 - 3.1, z1 - 3.0 + HEX_ALTO, x, y))
    for a in ANG_COLUMNA:
        x, y = ang_xy(R_COLUMNA, a); d = d.cut(cil(M3 / 2, z0 - 1, z1 + 1, x, y))
    d = d.cut(cil(7.0, z0 - 1, z1 + 1))
    for a in (90.0, 270.0):  # muescas para cables y antena LoRa
        d = d.cut(rot(caja(12.0, 9.0, 20.0, (RI, 0, zc)), a))
    # ventanas para aligerar (respetan torres, varillas y ganchos)
    d = d.cut(caja(44.0, 24.0, 20.0, (0, 0, zc)).cut(cil(9.0, z0 - 2, z1 + 2)))
    for sy in (-1, 1):
        d = d.cut(caja(30.0, 9.0, 20.0, (0, sy * 22.5, zc)))
    for a in range(0, 360, 60):
        x, y = ang_xy(34.0, a)
        d = d.union(gancho(x, y, z1 - 3.0, hacia_arriba=False))
    return d

def tapa_electronica():
    z0, z1 = Z_TAPA
    t = cil(RI - 0.5, z0, Z_TUBO_ARRIBA).union(cil(R, Z_TUBO_ARRIBA, z1))
    t = t.union(cil(11.0, z1, z1 + 3.7))                                  # torre del balero
    t = t.cut(cil(BALERO[0] / 2 + 0.05, z1 + 3.7 - BALERO[2], z1 + 4))    # asiento del balero
    t = t.cut(cil(6.0, z0 - 1, z1))                                      # paso del tornillo del rotor
    # alojamiento de la antena GPS (descentrado, el centro es del balero)
    gx, gy = GPS_POS; lado = GPS_ANT[0] + 0.6
    t = t.cut(caja(lado, lado, 3.0, (gx, gy, z1 - 2.5 + 1.5)))
    t = t.cut(caja(3.0, 12.0, 3.0, (gx, gy - lado / 2 - 4.0, z1 - 2.5 + 1.5)))
    t = t.cut(cil(3.0, z0 - 1, z1 + 1, gx, gy - lado / 2 - 9.0))
    t = t.cut(cil(4.0, z0 - 1, z1 + 1, gx, gy))                          # alivio bajo la antena
    for (x, y) in placa_pts():
        t = t.cut(cil(M3 / 2, z0 - 1, z1 + 1, x, y)).cut(hexagono(z1 - HEX_ALTO, z1 + 0.1, x, y))
    for a in ANG_COLUMNA:
        x, y = ang_xy(R_COLUMNA, a)
        t = t.cut(cil(M3 / 2, z0 - 1, z1 + 1, x, y)).cut(hexagono(z0 - 0.1, z0 + HEX_ALTO, x, y))
    for a in ANG_ASPAS:  # el canal de cada aspa sigue en el borde de la ceja (2 mm, sin hueco)
        t = t.cut(rot(canal(R_CANAL, R + 1, Z_TUBO_ARRIBA - 1, z1 + 1, HOLGURA_ASPA), a))
    for a in (90.0, 270.0):
        t = t.cut(rot(caja(10.0, 9.0, 4.0, (RI - 2.0, 0, z0 + 1.0)), a))
    # ventanas para aligerar
    t = t.cut(caja(9.0, 26.0, 20.0, (-19.5, 0, z0)))
    for sy in (-1, 1):
        t = t.cut(caja(24.0, 10.0, 20.0, (-2.0, sy * 23.0, z0)))
        t = t.cut(caja(12.0, 8.0, 20.0, (-26.0, sy * 31.0, z0)))
    t = t.cut(caja(10.0, 6.0, 20.0, (28.5, 22.5, z0)))
    return despejar(t)

def rotor():
    r = anillo(R - 1.2, R, Z_ROTOR0, Z_TOP).union(cil(R, Z_TOP - 1.8, Z_TOP))
    r = r.union(cil(10.0, Z_ROTOR_PLATO, Z_TOP))                                # centro grueso para el orificio
    for k in range(3):                                                           # costillas bajo el plato
        r = r.union(rot(caja(36.0, 1.6, Z_TOP - 1.8 - Z_ROTOR_PLATO, (28.0, 0, (Z_ROTOR_PLATO + Z_TOP - 1.8) / 2)), k * 120 + 30))
    r = r.cut(cil(ORIFICIO_DRON[0] / 2, Z_TOP - ORIFICIO_DRON[1], Z_TOP + 1))   # orificio para el dron
    perno = cil(BALERO[1] / 2 - 0.05, Z_TAPA[1] + 3.7 - BALERO[2] + 0.1, Z_ROTOR_PLATO)
    r = r.union(perno).cut(cil(1.25, Z_TAPA[1] - 1, Z_ROTOR_PLATO - 2))
    r = r.union(cil(5.2, Z_TAPA[1] + 3.8, Z_ROTOR_PLATO))                       # hombro sobre la pista interior
    for a in ANG_ASPAS:
        muesca = caja(8.0, 24.4, Z_ROTOR_PLATO - Z_ROTOR0 + 0.2, (R - 1.0, 0, (Z_ROTOR0 + Z_ROTOR_PLATO) / 2 - 0.1))
        r = r.cut(rot(muesca, a))
        for s in (-1, 1):  # orejas de la bisagra
            oreja = (caja(3.0, 2.5, Z_TOP - 1.8 - Z_ROTOR0, (R_BISAGRA, s * 10.75, (Z_ROTOR0 + Z_TOP - 1.8) / 2))
                     .cut(cq.Workplane('XZ').workplane(offset=-20).center(R_BISAGRA, Z_BISAGRA).circle(0.8).extrude(40)))
            r = r.union(rot(oreja, a))
    return r

def aspa(a):
    # panel curvo de 1.6 mm que va en su canal, al ras del cilindro
    r_in = R_CANAL + HOLGURA_ASPA
    panel = anillo(r_in, R, Z_ASPA_PUNTA - 5, Z_BISAGRA - 2.2).intersect(perfil_aspa(z_arriba=Z_BISAGRA - 2.2))
    # arriba, una lengüeta de 18 mm entre las orejas del rotor, con el nudillo de la bisagra
    lengueta = anillo(r_in, R, Z_BISAGRA - 2.6, Z_BISAGRA + 1.0).intersect(caja(20.0, 18.0, 10.0, (R - 1.0, 0, Z_BISAGRA)))
    nudillo = cq.Workplane('XZ').workplane(offset=-9.0).center(R_BISAGRA, Z_BISAGRA).circle(1.5).extrude(18.0)
    b = panel.union(lengueta).union(nudillo)
    # alojamiento del imán de la punta (se pega por dentro; afuera quedan 0.5 mm de plástico)
    b = b.cut(cq.Workplane('YZ').workplane(offset=r_in - 0.05).center(0, Z_IMAN).circle(IMAN_ASPA[0] / 2 + 0.1).extrude(IMAN_ASPA[1] + 0.15))
    b = b.cut(cq.Workplane('XZ').workplane(offset=-12).center(R_BISAGRA, Z_BISAGRA).circle(0.8).extrude(24))
    return rot(b, a)

def carcasa_primaria():
    # pared de 1.2 mm completa; en cada aspa la pared se hunde 2 mm hacia adentro (canal) y sigue cerrada
    t = anillo(RI, R, Z_PISO1, Z_TUBO_ARRIBA)
    for a in ANG_ASPAS:
        t = t.union(rot(canal(RI_CANAL, R, Z_PISO1, Z_TUBO_ARRIBA, HOLGURA_ASPA + T), a))
        t = t.cut(rot(canal(R_CANAL, R + 1, Z_PISO1 - 1, Z_TUBO_ARRIBA + 1, HOLGURA_ASPA), a))
    return t

def espaciador(z0, z1, x, y, r=3.0):
    return cil(r, z0, z1, x, y).cut(cil(M3 / 2, z0 - 1, z1 + 1, x, y))

def separador_placa(z0, z1, x, y):
    return cq.Workplane('XY').workplane(offset=z0).center(x, y).polygon(6, 6.4).extrude(z1 - z0).cut(cil(M3 / 2, z0 - 1, z1 + 1, x, y))

# ======================================== componentes comprados (muestra) ===
def huevo(c, eje):
    L, D = HUEVO
    pts = []
    for i in range(1, 40):
        s = -1 + 2 * i / 40
        r = D / 2 * math.sqrt(max(0.0, 1 - s * s)) * (1 - 0.13 * s)
        pts.append((r, s * L / 2))
    prof = (cq.Workplane('XZ').moveTo(0, -L / 2).spline(pts + [(0, L / 2)], includeCurrent=True).close())
    h = prof.revolve(360, (0, 0, 0), (0, 1, 0))
    if eje == 'x': h = h.rotate((0, 0, 0), (0, 1, 0), 90)
    if eje == 'y': h = h.rotate((0, 0, 0), (1, 0, 0), 90)
    return h.translate(c)

def pila_9v(c, parada=False):
    p = caja(48.5, 26.5, 17.5, (0, 0, 0)) if not parada else caja(17.5, 26.5, 48.5, (0, 0, 0))
    return p.translate(c)

def servo(cx, cy, cz):
    return (caja(22.8, 22.5, 12.2, (cx, cy, cz))
            .union(cq.Workplane('XZ').workplane(offset=-(cy + 11.25 + 4.0)).center(cx + 5.9 * (1 if cx < 0 else -1), cz).circle(2.5).extrude(4.0)))

def componentes():
    comp = {}
    comp['huevo_primaria'] = huevo(HUEVO1_C, 'x')
    comp['huevo_secundaria'] = huevo(HUEVO2_C, 'y')
    comp['pila_primaria'] = pila_9v((0, 25.0, Z_PISO2 + 8.75))
    comp['pila_secundaria'] = pila_9v((30.75, 0, 3.6 + 24.25 + 0.05), parada=True)
    comp['servo_desacople'] = servo(-18.6, -22.75, Z_PISO2 + 6.1 + 0.05)
    comp['servo_autogiro'] = servo(18.6, -22.75, Z_PISO2 + 6.1 + 0.05)
    comp['pasador'] = cq.Workplane('YZ').workplane(offset=-24.0).center(0, Z_PASADOR).circle(1.5).extrude(31.0)
    zs = z_placas()
    for i, z in enumerate(zs, 1):
        comp[f'placa_{i}'] = caja(PLACA[0], PLACA[1], PLACA[2], (0, 0, z + PLACA[2] / 2)).cut(
            cq.Workplane('XY').workplane(offset=z - 1).pushPoints(placa_pts()).circle(M3 / 2).extrude(5))
    zh = zs[1] + PLACA[2]
    comp['heltec'] = (caja(50.2, 25.5, 1.6, (0, 0, zh + 9.8)).union(caja(46, 2.5, 9.0, (0, 11.4, zh + 4.5)))
                      .union(caja(46, 2.5, 9.0, (0, -11.4, zh + 4.5))).union(caja(26.7, 19.3, 3.5, (6.5, 0, zh + 12.35))))
    comp['gy91'] = caja(21.1, 14.3, 4.0, (-12.0, 8.0, zs[0] + PLACA[2] + 2.0))
    comp['neo_m8n'] = caja(25.0, 35.0, 4.0, (-10.0, 0, zs[2] + PLACA[2] + 2.0))
    comp['openlog'] = caja(19.0, 15.0, 4.0, (11.0, -7.0, zs[0] + PLACA[2] + 2.0))
    comp['antena_gps'] = caja(GPS_ANT[0], GPS_ANT[0], GPS_ANT[1], (GPS_POS[0], GPS_POS[1], Z_TAPA[1] - 2.5 + GPS_ANT[1] / 2))
    comp['balero_608'] = anillo(BALERO[1] / 2, BALERO[0] / 2, Z_TAPA[1] + 3.7 - BALERO[2], Z_TAPA[1] + 3.7)
    # 1/4 de onda (82 mm): baja pegada a la pared desde la Heltec hasta la zona del huevo
    comp['antena_lora'] = cil(0.6, z_placas()[1] + 12.0 - 82.0, z_placas()[1] + 12.0, 0, -(RI - 2.6))
    comp['oring'] = cq.Solid.makeTorus(ORING[0] / 2 + ORING[1] / 2, ORING[1] / 2, pnt=cq.Vector(0, 0, sum(Z_ELEC_BASE) / 2))
    comp['oring'] = cq.Workplane('XY').add(comp['oring'])
    for j, (x, y) in enumerate(placa_pts()):   # sándwich de hule de la electrónica
        comp[f'hule_abajo_{j}'] = anillo(M3 / 2, HULE[0] / 2, zs[0] - HULE[1], zs[0]).translate((x, y, 0))
        comp[f'hule_arriba_{j}'] = anillo(M3 / 2, HULE[0] / 2, Z_TAPA[0] - HULE[1], Z_TAPA[0]).translate((x, y, 0))
    comp['espuma_huevo1_abajo'] = cil(30.0, Z_HUEVO_BASE[1], HUEVO1_C[2] - HUEVO[1] / 2 - 0.3)
    comp['espuma_huevo1_arriba'] = cil(30.0, HUEVO1_C[2] + HUEVO[1] / 2 + 0.3, Z_ELEC_BASE[1] - 3.0)
    comp['espuma_huevo2_abajo'] = cil(16.0, 6.4, HUEVO2_C[2] - HUEVO[1] / 2 - 0.3, HUEVO2_C[0], 0)
    comp['espuma_huevo2_arriba'] = cil(16.0, HUEVO2_C[2] + HUEVO[1] / 2 + 0.3, H_SEC - 3.0 - 7.6, HUEVO2_C[0], 0)
    comp['neo_6m'] = caja(25.0, 35.0, 1.6, (28.5, 0, 56.8)).union(caja(25.0, 25.0, 4.0, (28.5, 0, 59.6)))
    comp['esp32_c3'] = caja(22.5, 18.0, 3.5, (-20.0, -22.0, H_SEC - 3.0 - 1.75 - 0.2))
    comp['rfm95w'] = caja(16.0, 16.0, 3.2, (-24.0, 16.0, H_SEC - 3.0 - 1.6 - 0.2))
    for i, a in enumerate(ANG_COLUMNA):
        x, y = ang_xy(R_COLUMNA, a)
        comp[f'varilla_columna_{i}'] = cil(1.5, ZU + 0.5, Z_TAPA[0] + HEX_ALTO, x, y)
    for i, (x, y) in enumerate(placa_pts()):
        comp[f'varilla_placas_{i}'] = cil(1.5, Z_ELEC_BASE[0] + 0.5, Z_TAPA[1] - 0.5, x, y)
    return comp

MASA_COMPRADOS = {  # g (valores típicos; pesar los reales)
    'Huevos (2, según la guía)': 130, 'Pilas 9 V de litio (2; las alcalinas pesan 24 g más)': 68, 'Servos SG90 (2)': 18,
    'Heltec WiFi LoRa 32 V3': 15, 'Placas perforadas 4×6 (3)': 18, 'GY-91 + OpenLog + reguladores': 10,
    'NEO-M8N + antena': 14, 'ESP32-C3 + RFM95W + NEO-6M': 15, 'Balero 688ZZ': 4,
    'Varillas M3 de acero (3) + tornillería': 26, 'Cables, conectores, o-ring y hules': 20, 'Espuma EVA y ligas': 12,
    'Pasador de acero y alambres': 4, 'Imanes de neodimio (6)': 4,
}

# =============================================================== ARMADO ===
def piezas_impresas():
    p = {
        'carcasa_secundaria': (carcasa_secundaria(), 1.0),
        'tapa_secundaria': (tapa_secundaria(), 0.8),
        'bandeja_secundaria': (bandeja_secundaria(), 0.8),
        'piso_primaria': (piso_primaria(), 0.7),
        'anillo_retencion': (anillo_retencion(), 1.0),
        'disco_huevo_base': (disco_huevo_base(), 0.8),
        'disco_electronica_base': (disco_electronica_base(), 0.6),
        'tapa_electronica': (tapa_electronica(), 0.6),
        'carcasa_primaria': (carcasa_primaria(), 1.0),
        'rotor': (rotor(), 0.8),
    }
    for i, a in enumerate(ANG_ASPAS, 1):
        p[f'aspa_{i}'] = (aspa(a), 1.0)
    for i, a in enumerate(ANG_COLUMNA):
        x, y = ang_xy(R_COLUMNA, a)
        p[f'espaciador_base_{i}'] = (espaciador(Z_PISO2, Z_HUEVO_BASE[0], x, y), 1.0)
        p[f'espaciador_huevo_{i}'] = (espaciador(Z_HUEVO_BASE[1], Z_ELEC_BASE[0], x, y), 1.0)
    zs = z_placas()
    tramos = [(zs[0] + PLACA[2], zs[1]), (zs[1] + PLACA[2], zs[2]), (zs[2] + PLACA[2], Z_TAPA[0] - HULE[1])]
    for i, (z0, z1) in enumerate(tramos):
        for j, (x, y) in enumerate(placa_pts()):
            p[f'separador_placas_{i}_{j}'] = (separador_placa(z0, z1, x, y), 1.0)
    return p

if __name__ == '__main__':
    import itertools, json, sys
    impresas = piezas_impresas()
    comp = componentes()
    lineas = []
    def log(s=''): print(s); lineas.append(s)

    # ---- exportar piezas (una por tipo para imprimir, en su posición para el ensamble)
    unicas = {}
    for n, (obj, _) in impresas.items():
        base = n.rsplit('_', 1)[0] if n[-1].isdigit() else n
        if base.startswith('separador_placas'): base = f'separador_placas_{n.split("_")[2]}'
        if base not in unicas: unicas[base] = obj
        cq.exporters.export(obj, os.path.join(VIS, f'imp__{n}.stl'), tolerance=0.05, angularTolerance=0.2)
    for base, obj in unicas.items():
        bb = obj.val().BoundingBox()
        obj_imp = obj.translate((0, 0, -bb.zmin))
        cq.exporters.export(obj_imp, os.path.join(IMP, f'{base}.stl'), tolerance=0.02, angularTolerance=0.1)
        cq.exporters.export(obj_imp, os.path.join(IMP, f'{base}.step'))
    for n, obj in comp.items():
        cq.exporters.export(obj, os.path.join(VIS, f'com__{n}.stl'), tolerance=0.05, angularTolerance=0.2)

    ens = cq.Assembly(name='cansat_zenit')
    for n, (obj, _) in impresas.items(): ens.add(obj, name=n, color=cq.Color(0.17, 0.21, 0.31))
    for n, obj in comp.items(): ens.add(obj, name=n, color=cq.Color(0.6, 0.6, 0.6))
    ens.export(os.path.join(SAL, 'ensamble_cansat.step')) if hasattr(ens, 'export') else ens.save(os.path.join(SAL, 'ensamble_cansat.step'))

    # ---- medidas contra la guía
    todo = None
    for n, (obj, _) in impresas.items():
        todo = obj if todo is None else todo.union(obj, clean=False)
    bb = todo.val().BoundingBox()
    log('=== MEDIDAS (guía: Ø 90–100 mm, alto 200–230 mm, primaria ≤ 160, secundaria ≤ 70) ===')
    log(f'Ø máximo: {max(bb.xlen, bb.ylen):.1f} mm · alto total: {bb.zlen:.1f} mm')
    log(f'Primaria: {H_PRI:.0f} mm · Secundaria: {H_SEC:.0f} mm · orificio dron Ø {ORIFICIO_DRON[0]} × {ORIFICIO_DRON[1]} mm')
    log(f'Aspas: {L_ASPA:.0f} mm · Ø del rotor abierto ≈ {2 * (R_BISAGRA + L_ASPA):.0f} mm')

    # ---- choques
    log(''); log('=== REVISIÓN DE CHOQUES (volumen compartido > 0.5 mm³) ===')
    todos = {**{k: v[0] for k, v in impresas.items()}, **{k: v for k, v in comp.items() if not k.startswith(('varilla', 'oring', 'pasador'))}}
    choques = 0
    nombres = list(todos.keys())
    cajas = {k: todos[k].val().BoundingBox() for k in nombres}
    for a, b in itertools.combinations(nombres, 2):
        A, B = cajas[a], cajas[b]
        if A.xmax < B.xmin or B.xmax < A.xmin or A.ymax < B.ymin or B.ymax < A.ymin or A.zmax < B.zmin or B.zmax < A.zmin:
            continue
        try:
            v = todos[a].intersect(todos[b]).val().Volume()
        except Exception:
            v = 0
        if v > 0.5:
            log(f'  CHOQUE {a} ↔ {b}: {v:.1f} mm³'); choques += 1
    log(f'Total de choques: {choques}')

    # ---- masa
    log(''); log('=== MASA ESTIMADA ===')
    total_imp = 0.0
    for n, (obj, relleno) in impresas.items():
        g = obj.val().Volume() / 1000 * PLA * relleno
        total_imp += g
    agrup = {}
    for n, (obj, relleno) in impresas.items():
        k = n.rstrip('0123456789').rstrip('_')
        if k.startswith('separador_placas'): k = 'separadores de placas (12)'
        agrup[k] = agrup.get(k, 0) + obj.val().Volume() / 1000 * PLA * relleno
    for k, g in sorted(agrup.items(), key=lambda t: -t[1]): log(f'  {k:32s} {g:6.1f} g')
    log(f'  {"PIEZAS IMPRESAS":32s} {total_imp:6.1f} g')
    total_com = sum(MASA_COMPRADOS.values())
    for k, g in MASA_COMPRADOS.items(): log(f'  {k:32s} {g:6.1f} g')
    log(f'  {"COMPRADOS":32s} {total_com:6.1f} g')
    log(f'  {"TOTAL":32s} {total_imp + total_com:6.1f} g   (límite 600 g)')
    with open(os.path.join(SAL, 'reporte.txt'), 'w', encoding='utf-8') as f: f.write('\n'.join(lineas) + '\n')
