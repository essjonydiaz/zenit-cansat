# Vista previa del soporte (Blender como módulo bpy). Solo para revisar y presentar.
import bpy, os, sys, math
from mathutils import Vector
V = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'salida', '_vista')
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'salida', 'imagenes')
os.makedirs(OUT, exist_ok=True)
modo = sys.argv[-1] if sys.argv[-1] in ('armado', 'explosivo', 'tubo', 'tapa', 'base') else 'armado'

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
def lin(h):
    h = h.lstrip('#'); c = [int(h[i:i+2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)
def mat(n, c, r=0.45, m=0.0, t=0.0):
    M = bpy.data.materials.new(n)
    try: M.use_nodes = True
    except Exception: pass
    b = M.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*lin(c), 1); b.inputs['Roughness'].default_value = r
    b.inputs['Metallic'].default_value = m
    if t: b.inputs['Transmission Weight'].default_value = t; b.inputs['IOR'].default_value = 1.49
    return M
MAT = {'soporte': mat('PLA', '#2b3550', 0.5), 'tapa': mat('PLA', '#2b3550', 0.5),
       'placa': mat('PCB', '#1d7a46', 0.4), 'heltec': mat('Heltec', '#16181d', 0.35),
       'separador': mat('Separador', '#f2f2f2', 0.5), 'antena': mat('Ceramica', '#cdb48a', 0.6),
       'tubo': mat('Tubo', '#c8d6f0', 0.05, t=1.0)}
objs = {}
for f in sorted(os.listdir(V)):
    if not f.endswith('.stl'): continue
    n = f[:-4]
    if n == 'tubo' and modo != 'tubo': continue
    bpy.ops.wm.stl_import(filepath=os.path.join(V, f))
    o = bpy.context.selected_objects[0]; o.name = n
    o.scale = (0.001, 0.001, 0.001)
    clave = next(k for k in MAT if n.startswith(k))
    o.data.materials.clear(); o.data.materials.append(MAT[clave])
    for p in o.data.polygons: p.use_smooth = True
    try: o.data.set_sharp_from_angle(angle=math.radians(30))
    except Exception: pass
    objs[n] = o
if modo in ('tapa', 'base'):
    for n, o in list(objs.items()):
        if not n.startswith('tapa' if modo == 'tapa' else 'soporte'): bpy.data.objects.remove(o)
    o = objs['tapa_gps' if modo == 'tapa' else 'soporte_base']
    pass
if modo == 'explosivo':
    capas = {'soporte_base': 0, 'placa_1': 1, 'separador_1': 1.5, 'placa_2': 2, 'heltec': 2.25,
             'separador_2': 2.5, 'placa_3': 3, 'separador_3': 3.5, 'tapa_gps': 4, 'antena': 4.6}
    for n, o in objs.items():
        k = next((c for c in capas if n.startswith(c)), None)
        if k is not None: o.location.z += capas[k] * 0.022

# luz y cámara
w = bpy.data.worlds.new('w'); sc.world = w
try: w.use_nodes = True
except Exception: pass
w.node_tree.nodes['Background'].inputs[0].default_value = (1, 1, 1, 1)
w.node_tree.nodes['Background'].inputs[1].default_value = 0.35
tgt = bpy.data.objects.new('t', None); sc.collection.objects.link(tgt)
alto = {'explosivo': 0.075, 'armado': 0.03, 'tubo': 0.035, 'tapa': 0.002, 'base': 0.004}[modo]
tgt.location = (0, 0, alto)
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.lens = 60
dist = {'explosivo': 0.42, 'armado': 0.30, 'tubo': 0.33, 'tapa': 0.22, 'base': 0.22}[modo]
elev = {'explosivo': 0.32, 'armado': 0.55, 'tubo': 0.5, 'tapa': 1.0, 'base': 0.9}[modo]
az = math.radians(-35)
cam.location = (dist * math.sin(-az) * math.cos(elev) * -1 + 0, -dist * math.cos(az) * math.cos(elev), alto + dist * math.sin(elev))
c = cam.constraints.new('TRACK_TO'); c.target = tgt; c.track_axis = 'TRACK_NEGATIVE_Z'; c.up_axis = 'UP_Y'
for nombre, loc, e in (('k', (0.3, -0.3, 0.45), 9), ('f', (-0.35, -0.2, 0.2), 3), ('r', (0.0, 0.35, 0.3), 6)):
    L = bpy.data.lights.new(nombre, 'AREA'); L.energy = e; L.size = 0.35
    o = bpy.data.objects.new(nombre, L); o.location = loc; sc.collection.objects.link(o)
    t = o.constraints.new('TRACK_TO'); t.target = tgt; t.track_axis = 'TRACK_NEGATIVE_Z'; t.up_axis = 'UP_Y'
# piso que recibe sombra
bpy.ops.mesh.primitive_plane_add(size=3, location=(0, 0, -0.0005 if modo not in ('explosivo',) else -0.0005))
piso = bpy.context.active_object; piso.is_shadow_catcher = True
sc.render.engine = 'CYCLES'; sc.cycles.samples = 48; sc.cycles.use_denoising = True
sc.render.film_transparent = False
sc.render.resolution_x, sc.render.resolution_y = (1600, 1200)
try: sc.view_settings.view_transform = 'AgX'; sc.view_settings.look = 'AgX - Medium High Contrast'
except Exception: pass
sc.render.filepath = os.path.join(OUT, f'vista_{modo}.png')
bpy.ops.render.render(write_still=True)
print('ok', sc.render.filepath)
