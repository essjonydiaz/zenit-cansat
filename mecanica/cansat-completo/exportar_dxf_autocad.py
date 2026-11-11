# Archivos para AutoCAD: ensamble 3D (mallas) y plano 2D con cotas, en milímetros.
#   Uso: python exportar_dxf_autocad.py   (después de cansat_completo.py)
# Escribe los .dxf y, si está compilada la herramienta herramientas/hacer_dwg (LibreDWG),
# también los .dwg (R2000). Ver herramientas/hacer_dwg.c para compilarla.
import os, struct, math, subprocess, shutil
import numpy as np
import ezdxf
from ezdxf.render import MeshBuilder
from ezdxf.enums import TextEntityAlignment

AQUI = os.path.dirname(os.path.abspath(__file__))
VIS = os.path.join(AQUI, 'salida', '_vista')
OUT = os.path.join(AQUI, 'salida', 'autocad'); os.makedirs(OUT, exist_ok=True)
HACER_DWG = os.environ.get('HACER_DWG') or os.path.join(AQUI, 'herramientas', 'hacer_dwg')

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
caras_dwg = []                                      # (capa, color, triángulos) para el .dwg
for f in sorted(os.listdir(VIS)):
    if not (f.startswith('imp__') and f.endswith('.stl')): continue
    n = f[5:-4]
    capa = n.upper()
    if capa not in doc.layers: doc.layers.add(capa, color=color(n))
    pts, caras = leer_stl(os.path.join(VIS, f))
    mb = MeshBuilder(); mb.vertices = [tuple(p) for p in pts]; mb.faces = [tuple(int(i) for i in c) for c in caras]
    mb.render_mesh(msp, dxfattribs={'layer': capa})
    caras_dwg.append((capa, color(n), pts[caras]))
doc.saveas(os.path.join(OUT, 'Zenit_CanSat_ensamble_3D.dxf'))
print('ensamble 3D listo')

# ------------------------------------------------ 2) plano 2D con las medidas principales
doc = nuevo(); msp = doc.modelspace()
for capa, c in (('CONTORNO', 7), ('COTAS', 1), ('EJES', 8), ('TEXTO', 3)):
    doc.layers.add(capa, color=c)
R = 48.0; H_SEC = 70.0; H_PRI = 159.0; Z_TOP = H_SEC + H_PRI; L_ASPA = 110.0; Z_BIS = H_SEC + 153.0
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
cota_v((-w0, Z_BIS), (-w0, Z_BIS - L_ASPA), -R - 14, '110 aspa')
cota_h((-4.75, Z_TOP), (4.75, Z_TOP), Z_TOP + 12, '%%c9.5')
texto('VISTA DE FRENTE (mm)', -R, Z_TOP + 30, 5)
# vista superior
cx = 170
msp.add_circle((cx, 120), R, dxfattribs={'layer': 'CONTORNO'})
msp.add_circle((cx, 120), 4.75, dxfattribs={'layer': 'CONTORNO'})
for a in (90, 210, 330):
    r0 = math.radians(a)
    msp.add_line((cx + 40 * math.cos(r0), 120 + 40 * math.sin(r0)), (cx + 52 * math.cos(r0), 120 + 52 * math.sin(r0)), dxfattribs={'layer': 'EJES'})
    texto('aspa', cx + 56 * math.cos(r0) - 5, 120 + 56 * math.sin(r0), 3)
texto('VISTA SUPERIOR: %%c96, orificio del dron %%c9.5 x 3.5 de profundidad', cx - R, 120 + R + 16, 4)
for i, t in enumerate(['CanSat Zénit 2026 - diseño v2 (unidades: milímetros)',
                       'Pared de 1.2 mm; aspas de 1.6 mm en canales de 2 mm, al ras',
                       'Debe entrar en el cilindro de revisión de 110 mm de diámetro',
                       'Masa estimada: 587 g de 600 g (con pilas de litio y 2 huevos de 65 g)']):
    texto(t, cx - R, 40 - i * 8, 3.5)
doc.saveas(os.path.join(OUT, 'Zenit_CanSat_plano_cotas.dxf'))
print('plano listo')

# ------------------------------------------------ 3) los mismos dibujos en .dwg (R2000)
def fmt(*v): return ' '.join(f'{x:.4f}' for x in v)

def txt_dwg(t):
    """Texto en ASCII para el .dwg: Ø como %%c y los acentos como \\U+XXXX (AutoCAD los entiende)."""
    return ''.join('%%c' if c in 'Øø⌀' else (c if ord(c) < 128 else f'\\U+{ord(c):04X}') for c in t)

def primitivas(e, out):
    """Pasa una entidad del plano a líneas, arcos, círculos, caras y textos sencillos."""
    t = e.dxftype(); capa = e.dxf.layer
    if t == 'LINE':
        out.append((capa, 'N ' + fmt(*e.dxf.start, *e.dxf.end)))
    elif t == 'CIRCLE':
        out.append((capa, 'I ' + fmt(e.dxf.center.x, e.dxf.center.y, e.dxf.radius)))
    elif t == 'ARC':
        out.append((capa, 'A ' + fmt(e.dxf.center.x, e.dxf.center.y, e.dxf.radius, e.dxf.start_angle, e.dxf.end_angle)))
    elif t == 'SOLID':                                   # flechas de las cotas: el contorno
        v = [e.dxf.vtx0, e.dxf.vtx1, e.dxf.vtx3, e.dxf.vtx2]
        for a, b in zip(v, v[1:] + v[:1]):
            if (a - b).magnitude > 1e-6: out.append((capa, 'N ' + fmt(*a, *b)))
    elif t == 'TEXT':
        h = {0: 0, 1: 1, 2: 1, 4: 1}.get(e.dxf.get('halign', 0), 0); v = e.dxf.get('valign', 0)
        p = e.dxf.align_point if (h or v) and e.dxf.hasattr('align_point') else e.dxf.insert
        out.append((capa, 'T ' + fmt(p.x, p.y, e.dxf.height, e.dxf.get('rotation', 0.0)) + f' {h} {v} ' + txt_dwg(e.dxf.text)))
    elif t == 'MTEXT':                                   # texto de las cotas (centrado)
        p = e.dxf.insert
        out.append((capa, 'T ' + fmt(p.x, p.y, e.dxf.char_height, e.dxf.get('rotation', 0.0)) + ' 1 2 ' + txt_dwg(e.plain_text())))
    elif t in ('LWPOLYLINE', 'POLYLINE', 'DIMENSION', 'INSERT'):
        for sub in e.virtual_entities():
            if not sub.dxf.hasattr('layer') or sub.dxf.layer == '0': sub.dxf.layer = capa
            primitivas(sub, out)

if os.path.exists(HACER_DWG):
    capas_plano = [(l.dxf.name, l.dxf.color) for l in doc.layers if l.dxf.name not in ('0', 'Defpoints')]
    prim = []
    for e in msp: primitivas(e, prim)
    trabajos = {'Zenit_CanSat_plano_cotas': [f'L {c} {k}' for c, k in capas_plano] +
                [ln for capa in [c for c, _ in capas_plano] for ln in (['C ' + capa] + [x for cc, x in prim if cc == capa])],
                'Zenit_CanSat_ensamble_3D': [ln for capa, col, tri in caras_dwg for ln in
                                             ([f'L {capa} {col}'] + ['F ' + fmt(*t.ravel()) for t in tri])]}
    for nombre, lineas in trabajos.items():
        txt = os.path.join(OUT, nombre + '.txt')
        with open(txt, 'w', encoding='utf-8') as fo: fo.write('\n'.join(lineas) + '\n')
        dwg = os.path.join(OUT, nombre + '.dwg')
        if os.path.exists(dwg): os.remove(dwg)          # LibreDWG no sobrescribe
        r = subprocess.run([HACER_DWG, txt, dwg], capture_output=True, text=True)
        os.remove(txt)
        print(nombre + '.dwg:', r.stderr.strip())
else:
    print('(no se hicieron los .dwg: falta compilar herramientas/hacer_dwg)')
