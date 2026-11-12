# Archivos para AutoCAD: ensamble 3D (mallas) y plano 2D con cotas, en milímetros.
#   Uso: python exportar_dxf_autocad.py   (después de cansat_completo.py)
# Para el .dwg: abrir el .dxf en AutoCAD (o IMPORTAR el .step) y "Guardar como" .dwg.
# (Un .dwg escrito con LibreDWG no lo abrió AutoCAD 2027, por eso no se genera aquí.)
import os, struct, math
import numpy as np
import ezdxf
from ezdxf.render import MeshBuilder
from ezdxf.enums import TextEntityAlignment

AQUI = os.path.dirname(os.path.abspath(__file__))
VIS = os.path.join(AQUI, 'salida', '_vista')
OUT = os.path.join(AQUI, 'salida', 'autocad'); os.makedirs(OUT, exist_ok=True)

def poli(pts, fmt='xy', close=True, layer='CONTORNO'):
    msp.add_lwpolyline(pts, format=fmt, close=close, dxfattribs={'layer': layer})

def nuevo():
    doc = ezdxf.new('R2018', setup=True)
    doc.units = ezdxf.units.MM                     # $INSUNITS = 4 (milímetros)
    doc.header['$MEASUREMENT'] = 1                 # sistema métrico
    doc.header['$LUNITS'] = 2; doc.header['$LUPREC'] = 1
    return doc

def leer_stl(ruta):
    with open(ruta, 'rb') as f:
        f.read(80); n = struct.unpack('<I', f.read(4))[0]
        d = np.frombuffer(f.read(n * 50), dtype=np.dtype([('n', '<f4', 3), ('v', '<f4', (3, 3)), ('a', '<u2')]))
    v = d['v'].reshape(-1, 3).astype(np.float64)
    clave = np.round(v * 1000).astype(np.int64)
    _, idx, inv = np.unique(clave, axis=0, return_index=True, return_inverse=True)
    return v[idx], inv.reshape(-1, 3)

COLORES = {'carcasa': 5, 'aspa': 7, 'rotor': 5, 'tapa_secundaria': 4, 'anillo': 2}
def color(n):
    for k, c in COLORES.items():
        if n.startswith(k): return c
    return 8

# ------------------------------------------------ 1) ensamble 3D (piezas impresas)
doc = nuevo(); msp = doc.modelspace()
for f in sorted(os.listdir(VIS)):
    if not (f.startswith('imp__') and f.endswith('.stl')): continue
    n = f[5:-4]
    capa = n.upper()
    if capa not in doc.layers: doc.layers.add(capa, color=color(n))
    pts, caras = leer_stl(os.path.join(VIS, f))
    mb = MeshBuilder(); mb.vertices = [tuple(p) for p in pts]; mb.faces = [tuple(int(i) for i in c) for c in caras]
    mb.render_mesh(msp, dxfattribs={'layer': capa})
doc.saveas(os.path.join(OUT, 'Zenit_CanSat_ensamble_3D.dxf'))
print('ensamble 3D listo')

# ------------------------------------------------ 2) plano 2D con las medidas principales
doc = nuevo(); msp = doc.modelspace()
for capa, c in (('CONTORNO', 7), ('COTAS', 1), ('EJES', 8), ('TEXTO', 3)):
    doc.layers.add(capa, color=c)
R = 48.0; H_SEC = 70.0; H_PRI = 159.0; Z_TOP = H_SEC + H_PRI; L_ASPA = 111.0; Z_BIS = H_SEC + 154.0
def rect(x0, y0, x1, y1, capa='CONTORNO'):
    poli([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], layer=capa)
def cota_h(p1, p2, y, txt=None):
    d = msp.add_linear_dim(base=(0, y), p1=p1, p2=p2, angle=0, dimstyle='EZDXF', override={'dimtxt': 3.5, 'dimasz': 2.5}, dxfattribs={'layer': 'COTAS'})
    if txt: d.dimension.dxf.text = txt
    d.render()
def cota_v(p1, p2, x, txt=None):
    d = msp.add_linear_dim(base=(x, 0), p1=p1, p2=p2, angle=90, dimstyle='EZDXF', override={'dimtxt': 3.5, 'dimasz': 2.5}, dxfattribs={'layer': 'COTAS'})
    if txt: d.dimension.dxf.text = txt
    d.render()
def texto(t, x, y, h=4.0):
    msp.add_text(t, height=h, dxfattribs={'layer': 'TEXTO'}).set_placement((x, y), align=TextEntityAlignment.LEFT)

# vista de frente
rect(-R, 0, R, H_SEC)                                   # secundaria
rect(-R, H_SEC, R, Z_TOP)                               # primaria (con rotor)
msp.add_line((-R, Z_TOP - 8), (R, Z_TOP - 8), dxfattribs={'layer': 'EJES'})      # unión rotor / tubo (aprox.)
msp.add_line((0, -10), (0, Z_TOP + 10), dxfattribs={'layer': 'EJES', 'linetype': 'CENTER'})
w0, w1 = 13.0, 10.0                                     # aspa: 26 mm en la raíz, 20 mm en la punta
yb = Z_BIS - L_ASPA + w1                                # aspa plegada, vista de frente (punta redonda)
poli([(-w1, yb, 0, 0, 0), (-w0, Z_BIS, 0, 0, 0), (w0, Z_BIS, 0, 0, 0), (w1, yb, 0, 0, -1.0)], fmt='xyseb')
texto('aspa plegada (al ras)', -w1 + 1, yb + 20, 2.5)
rect(-4.75, Z_TOP - 3.5, 4.75, Z_TOP, 'EJES')       # orificio del dron
cota_h((-R, 0), (R, 0), -14, '%%c96')
cota_v((R, 0), (R, Z_TOP), R + 28, '229')
cota_v((R, H_SEC), (R, Z_TOP), R + 14, '159 primaria')
cota_v((R, 0), (R, H_SEC), R + 14, '70 secundaria')
cota_v((-w0, Z_BIS), (-w0, Z_BIS - L_ASPA), -R - 14, '111 aspa')
cota_h((-4.75, Z_TOP), (4.75, Z_TOP), Z_TOP + 12, '%%c9.5')
texto('VISTA DE FRENTE (mm)', -R, Z_TOP + 30, 5)
# vista superior
cx = 170
msp.add_circle((cx, 120), R, dxfattribs={'layer': 'CONTORNO'})
msp.add_circle((cx, 120), 4.75, dxfattribs={'layer': 'CONTORNO'})
for a, z, nom in ((126, Z_TOP - 10.8, 'interruptor primaria (126°)'), (69, 67 - 3.1, 'interruptor secundaria (69°)')):
    r0 = math.radians(a)                                # ventanas de 9 × 4.2 mm de los interruptores
    msp.add_line((cx + R * math.cos(r0), 120 + R * math.sin(r0)), (cx + (R + 8) * math.cos(r0), 120 + (R + 8) * math.sin(r0)), dxfattribs={'layer': 'COTAS'})
    texto(nom, cx + (R + 9) * math.cos(r0) - (30 if math.cos(r0) < 0 else 0), 120 + (R + 9) * math.sin(r0), 2.5)
for a in (90, 210, 330):
    r0 = math.radians(a)
    msp.add_line((cx + 40 * math.cos(r0), 120 + 40 * math.sin(r0)), (cx + 52 * math.cos(r0), 120 + 52 * math.sin(r0)), dxfattribs={'layer': 'EJES'})
    texto('aspa', cx + 56 * math.cos(r0) - 5, 120 + 56 * math.sin(r0), 3)
texto('VISTA SUPERIOR: %%c96, orificio del dron %%c9.5 x 3.5 de profundidad', cx - R, 120 + R + 16, 4)
for i, t in enumerate(['CanSat Zénit 2026 - diseño v3 (unidades: milímetros)',
                       'Pared de 1.2 mm; aspas de 2.0 mm (PLA) en canales de 2.4 mm, al ras',
                       'Bisagras: eje = tornillo M2 x 25; orejas del rotor de 3.6 mm',
                       'Interruptores: ventana de 9 x 4.2 mm en cada carga (único hoyo extra)',
                       'Debe entrar en el cilindro de revisión de 110 mm de diámetro',
                       'Masa estimada: 595 g de 600 g (con pilas de litio y 2 huevos de 65 g)']):
    texto(t, cx - R, 40 - i * 8, 3.5)
doc.saveas(os.path.join(OUT, 'Zenit_CanSat_plano_cotas.dxf'))
print('plano listo')
