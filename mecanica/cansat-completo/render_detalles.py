# Imágenes de detalle con Blender: bisagra con tornillo M2 e interruptores.
#   Uso: python render_detalles.py -- <bisagra|ventana|cuna|ventana_sec>   (antes: python exportar_detalles.py)
import bpy, os, sys, math
AQUI = os.path.dirname(os.path.abspath(__file__))
D = os.path.join(AQUI, 'salida', '_detalle'); OUT = os.path.join(AQUI, 'salida', 'imagenes', 'detalles'); os.makedirs(OUT, exist_ok=True)
vista = sys.argv[-1]
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
def lin(h):
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)
def mat(n, c, r=0.45, m=0.0):
    M = bpy.data.materials.new(n)
    try: M.use_nodes = True
    except Exception: pass
    b = M.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*lin(c), 1); b.inputs['Roughness'].default_value = r; b.inputs['Metallic'].default_value = m
    return M
MAT = {'carcasa': mat('Carcasa', '#2a3550', 0.42), 'aspa': mat('Aspa', '#e6e9f0', 0.38), 'interior': mat('Interior', '#5b6c96', 0.5),
       'azul': mat('Azul', '#2f6bff', 0.35), 'metal': mat('Metal', '#c4cad3', 0.22, 1.0), 'negro': mat('Negro', '#15161a', 0.4)}
def material_de(n):
    if n.startswith('aspa'): return MAT['aspa']
    if n.startswith(('carcasa', 'rotor')): return MAT['carcasa']
    if n.startswith('tapa_secundaria'): return MAT['azul']
    if n.startswith(('tornillo', 'interruptor')): return MAT['metal']
    return MAT['interior']
ESCENAS = {   # piezas, punto que se mira (mm), dirección de la cámara (az°, elev°), distancia (m), lente
    'bisagra': (('rotor', 'tapa_electronica', 'carcasa_primaria_arriba', 'aspa_abierta_35', 'aspa_2', 'tornillo_bisagra_1'),
                (-6, 46, 222), (128, 22), 0.13, 60),
    'ventana': (('carcasa_primaria_arriba', 'rotor', 'aspa_1', 'aspa_2', 'tapa_electronica', 'interruptor_primaria'),
                (48 * math.cos(math.radians(126)), 48 * math.sin(math.radians(126)), 212), (126, 12), 0.13, 60),
    'cuna': (('tapa_electronica', 'interruptor_primaria'),
             (44 * math.cos(math.radians(126)), 44 * math.sin(math.radians(126)), 211), (126 + 180 + 35, -38), 0.11, 55),
    'ventana_sec': (('carcasa_secundaria', 'tapa_secundaria', 'interruptor_secundaria'),
                    (48 * math.cos(math.radians(69)), 48 * math.sin(math.radians(69)), 63), (69, 15), 0.14, 60),
}
piezas, mira, (az, el), dist, lente = ESCENAS[vista]
for n in piezas:
    bpy.ops.wm.stl_import(filepath=os.path.join(D, n + '.stl'))
    o = bpy.context.selected_objects[0]; o.name = n; o.scale = (0.001,) * 3
    o.data.materials.clear(); o.data.materials.append(material_de(n))
    for p in o.data.polygons: p.use_smooth = True
    try: o.data.set_sharp_from_angle(angle=math.radians(30))
    except Exception: pass
w = bpy.data.worlds.new('w'); sc.world = w
try: w.use_nodes = True
except Exception: pass
w.node_tree.nodes['Background'].inputs[0].default_value = (*lin('#dfe6f2'), 1); w.node_tree.nodes['Background'].inputs[1].default_value = 0.8
tgt = bpy.data.objects.new('t', None); sc.collection.objects.link(tgt); tgt.location = tuple(v / 1000 for v in mira)
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.lens = lente; cam.data.clip_start = 0.005
a, e = math.radians(az), math.radians(el)
cam.location = (tgt.location.x + dist * math.cos(e) * math.cos(a), tgt.location.y + dist * math.cos(e) * math.sin(a), tgt.location.z + dist * math.sin(e))
c = cam.constraints.new('TRACK_TO'); c.target = tgt; c.track_axis = 'TRACK_NEGATIVE_Z'; c.up_axis = 'UP_Y'
for nombre, off, en in (('k', (0.4, -0.3, 0.5), 40), ('f', (-0.4, -0.3, 0.2), 15), ('r', (0.0, 0.5, 0.4), 20)):
    L = bpy.data.lights.new(nombre, 'AREA'); L.energy = en; L.size = 0.4
    o = bpy.data.objects.new(nombre, L); sc.collection.objects.link(o)
    o.location = (cam.location.x + off[0], cam.location.y + off[1], cam.location.z + off[2])
    t = o.constraints.new('TRACK_TO'); t.target = tgt; t.track_axis = 'TRACK_NEGATIVE_Z'; t.up_axis = 'UP_Y'
sc.render.engine = 'CYCLES'; sc.cycles.samples = 48; sc.cycles.use_denoising = True
sc.render.resolution_x, sc.render.resolution_y = 1400, 1050
try: sc.view_settings.view_transform = 'AgX'; sc.view_settings.look = 'AgX - Medium High Contrast'
except Exception: pass
sc.render.filepath = os.path.join(OUT, f'{vista}.png')
bpy.ops.render.render(write_still=True)
print('ok', sc.render.filepath)
