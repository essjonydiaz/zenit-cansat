# Imágenes del despliegue y de los servos (Blender bpy).  Uso: python render_despliegue.py -- <vista>
# vistas: servos · paso1 · paso2 · paso3 · paso4 · pasador · anillo
import bpy, os, sys, math
from mathutils import Vector, Matrix
AQUI = os.path.dirname(os.path.abspath(__file__))
V = os.path.join(AQUI, 'salida', '_vista'); OUT = os.path.join(AQUI, 'salida', 'imagenes', 'despliegue'); os.makedirs(OUT, exist_ok=True)
vista = sys.argv[-1]
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene

# medidas (mm) de cansat_completo.py
ZU = 70.0; Z_BISAGRA = ZU + 154.0; R_BISAGRA = 45.3; ANG_ASPAS = (90.0, 210.0, 330.0); GIRO_ASPA = -96.0

def lin(h):
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)
def mat(n, c, r=0.45, m=0.0, t=0.0, e=0.0, a=1.0):
    M = bpy.data.materials.new(n); M.use_nodes = True
    b = M.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*lin(c), 1); b.inputs['Roughness'].default_value = r; b.inputs['Metallic'].default_value = m
    if t: b.inputs['Transmission Weight'].default_value = t
    if e: b.inputs['Emission Color'].default_value = (*lin(c), 1); b.inputs['Emission Strength'].default_value = e
    if a < 1: b.inputs['Alpha'].default_value = a
    return M
MAT = {'carcasa': mat('c', '#1b2335', 0.42), 'aspa': mat('a', '#dfe4ee', 0.38), 'interior': mat('i', '#46557a', 0.5),
       'azul': mat('az', '#2f6bff', 0.35), 'huevo': mat('h', '#efdcc0', 0.55), 'pila': mat('p', '#1a1a1c', 0.4),
       'servo': mat('s', '#2554cc', 0.3, t=0.25), 'pcb': mat('pcb', '#1d7a46', 0.4), 'negro': mat('n', '#121317', 0.4),
       'metal': mat('m', '#c9ced6', 0.22, m=1.0), 'espuma': mat('e', '#d8b04a', 0.85), 'cobre': mat('cu', '#b87333', 0.3, m=1.0),
       'goma': mat('g', '#0d0d0d', 0.7), 'anillo': mat('an', '#f6b73c', 0.35), 'pasador': mat('pa', '#ff5a3c', 0.3, m=0.6),
       'blanco': mat('bl', '#f2f2f2', 0.5)}
def material_de(n):
    if 'aspa' in n: return MAT['aspa']
    if n.startswith(('carcasa', 'rotor')): return MAT['carcasa']
    if n == 'anillo_retencion': return MAT['anillo']
    if n == 'pasador': return MAT['pasador']
    if 'tapa_secundaria' in n: return MAT['azul']
    if n.startswith(('piso', 'disco', 'tapa_electronica', 'bandeja', 'espaciador', 'separador')): return MAT['interior']
    for k, m in (('huevo_', 'huevo'), ('pila', 'pila'), ('servo', 'servo'), ('placa', 'pcb'), ('heltec', 'negro'), ('gy91', 'pcb'),
                 ('openlog', 'pcb'), ('neo', 'pcb'), ('antena_gps', 'blanco'), ('balero', 'metal'), ('antena_lora', 'cobre'),
                 ('oring', 'goma'), ('hule', 'goma'), ('espuma', 'espuma'), ('esp32', 'negro'), ('rfm', 'pcb'), ('varilla', 'metal'), ('tornillo', 'metal'), ('interruptor', 'metal')):
        if k in n: return MAT[m]
    return MAT['interior']

SEC = ('carcasa_secundaria', 'tapa_secundaria', 'bandeja_secundaria', 'huevo_secundaria', 'pila_secundaria', 'neo_6m', 'esp32_c3', 'rfm95w', 'espuma_huevo2')
# estado: dz de la secundaria (mm), dx del pasador, giro del anillo (°), apertura de las aspas (0–1), giro del rotor (°)
EST = {'paso1': (0, 0, 0, 0.0, 0), 'paso2': (-45, -13, 0, 0.0, 0), 'paso3': (-160, -13, 15, 0.45, 0), 'paso4': (-400, -13, 15, 1.0, 25),
       'servos': (0, 0, 0, 0.0, 0), 'pasador': (-14, -13, 0, 0.0, 0), 'anillo': (0, -13, 15, 0.12, 0)}[vista]
interior = vista in ('servos', 'pasador', 'anillo')
SOLO = {'servos': ('piso_primaria', 'servo_', 'pila_primaria', 'pasador', 'tapa_secundaria'),
        'pasador': ('piso_primaria', 'servo_', 'pila_primaria', 'pasador', 'tapa_secundaria', 'espaciador_base'),
        'anillo': ('piso_primaria', 'servo_', 'pila_primaria', 'anillo_retencion', 'aspa_', 'disco_huevo_base', 'espaciador_base')}

def pieza_rotor(n): return n.startswith(('rotor', 'aspa', 'balero'))
objs = []
for f in sorted(os.listdir(V)):
    if not f.endswith('.stl'): continue
    pref, n = f[:-4].split('__', 1)
    if pref not in ('imp', 'com'): continue
    if interior and not n.startswith(SOLO[vista]): continue
    if vista == 'servos' and n == 'carcasa_secundaria': continue
    bpy.ops.wm.stl_import(filepath=os.path.join(V, f))
    o = bpy.context.selected_objects[0]; o.name = n
    o.data.transform(Matrix.Scale(0.001, 4))
    o.data.materials.clear(); o.data.materials.append(material_de(n))
    for p in o.data.polygons: p.use_smooth = True
    try: o.data.set_sharp_from_angle(angle=math.radians(30))
    except Exception: pass
    dz, dx, ga, ap, gr = EST
    if any(k in n for k in SEC): o.location.z += dz / 1000
    if n == 'pasador': o.location.x += dx / 1000
    if n == 'anillo_retencion': o.rotation_euler.z = math.radians(ga)
    if n.startswith('aspa_') and ap > 0:
        i = int(n[-1]) - 1; a = math.radians(ANG_ASPAS[i])
        p0 = Vector((R_BISAGRA * math.cos(a), R_BISAGRA * math.sin(a), Z_BISAGRA)) / 1000
        eje = Vector((-math.sin(a), math.cos(a), 0))
        R = Matrix.Translation(p0) @ Matrix.Rotation(math.radians(GIRO_ASPA * ap), 4, eje) @ Matrix.Translation(-p0)
        o.matrix_world = R @ o.matrix_world
    if pieza_rotor(n) and gr:
        o.matrix_world = Matrix.Rotation(math.radians(gr), 4, 'Z') @ o.matrix_world
    objs.append(o)

w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
w.node_tree.nodes['Background'].inputs[0].default_value = (*lin('#0b1324'), 1); w.node_tree.nodes['Background'].inputs[1].default_value = 0.35
tgt = bpy.data.objects.new('t', None); sc.collection.objects.link(tgt)
# cámara: objetivo (m), distancia, elevación, azimut, lente
CAM = {'paso1': ((0, 0, 0.115), 0.62, 0.20, -32, 50), 'paso2': ((0, 0, 0.10), 0.72, 0.20, -32, 50),
       'paso3': ((0, 0, 0.08), 0.95, 0.24, -32, 50), 'paso4': ((0, 0, 0.12), 1.05, 0.30, -32, 50),
       'servos': ((0, -0.006, 0.076), 0.26, 1.05, -25, 50), 'pasador': ((-0.012, -0.004, 0.074), 0.17, 0.45, -35, 50),
       'anillo': ((0.0, 0.035, 0.112), 0.24, 0.30, 15, 50)}[vista]
tgt.location = CAM[0]
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.lens = CAM[4]; cam.data.clip_start = 0.005
az = math.radians(CAM[3]); d = CAM[1]; el = CAM[2]
cam.location = (CAM[0][0] + d * math.cos(el) * math.sin(-az), CAM[0][1] - d * math.cos(el) * math.cos(az), CAM[0][2] + d * math.sin(el))
c = cam.constraints.new('TRACK_TO'); c.target = tgt; c.track_axis = 'TRACK_NEGATIVE_Z'; c.up_axis = 'UP_Y'
for nombre, loc, e, col in (('k', (0.5, -0.5, 0.7), 55, '#fff3e6'), ('f', (-0.6, -0.4, 0.3), 14, '#e8eeff'), ('r', (-0.2, 0.6, 0.5), 22, '#5d82ff')):
    L = bpy.data.lights.new(nombre, 'AREA'); L.energy = e * (0.5 if interior else 1); L.size = 0.5; L.color = lin(col)
    o = bpy.data.objects.new(nombre, L); o.location = loc; sc.collection.objects.link(o)
    t = o.constraints.new('TRACK_TO'); t.target = tgt; t.track_axis = 'TRACK_NEGATIVE_Z'; t.up_axis = 'UP_Y'
if not interior:
    bpy.ops.mesh.primitive_plane_add(size=8, location=(0, 0, -0.45 if vista == 'paso4' else (-0.2 if vista == 'paso3' else -0.06)))
    bpy.context.active_object.data.materials.append(mat('piso', '#0a0f1c', 0.8))
sc.render.engine = 'CYCLES'; sc.cycles.samples = 48; sc.cycles.use_denoising = True
sc.render.resolution_x, sc.render.resolution_y = (1200, 1200) if vista.startswith('paso') else (1400, 1050)
try: sc.view_settings.view_transform = 'AgX'; sc.view_settings.look = 'AgX - Medium High Contrast'
except Exception: pass
sc.render.filepath = os.path.join(OUT, f'{vista}.png')
bpy.ops.render.render(write_still=True)
print('ok', sc.render.filepath)
