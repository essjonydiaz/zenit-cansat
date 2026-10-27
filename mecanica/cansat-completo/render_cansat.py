# Imágenes del CanSat completo con Blender (módulo bpy).  Uso: python render_cansat.py -- <vista>
# vistas: cerrado · corte · explosivo · desplegado
import bpy, os, sys, math
AQUI = os.path.dirname(os.path.abspath(__file__))
V = os.path.join(AQUI, 'salida', '_vista'); OUT = os.path.join(AQUI, 'salida', 'imagenes'); os.makedirs(OUT, exist_ok=True)
LOGO = next((p for p in (os.path.join(AQUI, 'logo-zenit.jpeg'), os.path.join(AQUI, '..', '..', 'estacion-terrena', 'public', 'logo-zenit.jpeg')) if os.path.exists(p)), '')
vista = sys.argv[-1]
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene

def lin(h):
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)
def mat(n, c, r=0.45, m=0.0, t=0.0, e=0.0):
    M = bpy.data.materials.new(n)
    try: M.use_nodes = True
    except Exception: pass
    b = M.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*lin(c), 1); b.inputs['Roughness'].default_value = r
    b.inputs['Metallic'].default_value = m
    if t: b.inputs['Transmission Weight'].default_value = t; b.inputs['IOR'].default_value = 1.45
    if e: b.inputs['Emission Color'].default_value = (*lin(c), 1); b.inputs['Emission Strength'].default_value = e
    return M
MAT = {
    'carcasa': mat('Carcasa PLA', '#1b2335', 0.42), 'aspa': mat('Aspas PLA', '#dfe4ee', 0.38),
    'interior': mat('Interior PLA', '#46557a', 0.5), 'azul': mat('Azul Zénit', '#2f6bff', 0.35),
    'huevo': mat('Huevo', '#efdcc0', 0.55), 'pila': mat('Pila', '#1a1a1c', 0.4), 'servo': mat('Servo', '#2554cc', 0.3, t=0.35),
    'pcb': mat('PCB', '#1d7a46', 0.4), 'negro': mat('Negro', '#121317', 0.4), 'metal': mat('Metal', '#b9bfc8', 0.25, m=1.0),
    'espuma': mat('Espuma EVA', '#d8b04a', 0.85), 'ceramica': mat('Cerámica', '#cdb48a', 0.6), 'cobre': mat('Cobre', '#b87333', 0.3, m=1.0),
    'morado': mat('GY-91', '#4a2f86', 0.4), 'rojo': mat('OpenLog', '#b3202a', 0.4), 'goma': mat('Hule', '#0d0d0d', 0.7),
}
def material_de(n):
    if 'aspa' in n: return MAT['aspa']
    if n.startswith(('carcasa', 'rotor')): return MAT['carcasa']
    if 'tapa_secundaria' in n: return MAT['azul']
    if n.startswith(('piso', 'disco', 'tapa_electronica', 'bandeja', 'anillo', 'espaciador', 'separador')): return MAT['interior']
    for k, m in (('huevo_', 'huevo'), ('pila', 'pila'), ('servo', 'servo'), ('placa', 'pcb'), ('heltec', 'negro'), ('gy91', 'morado'),
                 ('openlog', 'rojo'), ('neo', 'pcb'), ('antena_gps', 'ceramica'), ('balero', 'metal'), ('antena_lora', 'cobre'),
                 ('oring', 'goma'), ('espuma', 'espuma'), ('esp32', 'negro'), ('rfm', 'pcb'), ('varilla', 'metal'), ('pasador', 'metal')):
        if k in n: return MAT[m]
    return MAT['interior']

SECUNDARIA = ('carcasa_secundaria', 'tapa_secundaria', 'bandeja_secundaria', 'huevo_secundaria', 'pila_secundaria', 'neo_6m',
              'esp32_c3', 'rfm95w', 'espuma_huevo2')
def es_sec(n): return any(k in n for k in SECUNDARIA)

archivos = [f for f in sorted(os.listdir(V)) if f.endswith('.stl')]
usar = []
for f in archivos:
    pref, n = f[:-4].split('__', 1)
    if pref == 'abierta' and vista != 'desplegado': continue
    if pref == 'corte' and vista != 'corte': continue
    if vista == 'desplegado' and pref == 'imp' and n.startswith('aspa'): continue
    if vista == 'corte' and pref in ('imp', 'com') and os.path.exists(os.path.join(V, f'corte__{n}.stl')): continue
    if vista == 'corte' and n == 'aspa_3': continue
    if vista in ('cerrado', 'desplegado') and pref == 'com': continue   # por dentro no se ve
    usar.append((pref, n, f))

objs = []
for pref, n, f in usar:
    bpy.ops.wm.stl_import(filepath=os.path.join(V, f))
    o = bpy.context.selected_objects[0]; o.name = n
    o.scale = (0.001, 0.001, 0.001)
    o.data.materials.clear(); o.data.materials.append(material_de(n))
    for p in o.data.polygons: p.use_smooth = True
    try: o.data.set_sharp_from_angle(angle=math.radians(30))
    except Exception: pass
    if vista == 'desplegado' and es_sec(n): o.location.z -= 0.13; o.rotation_euler = (math.radians(9), math.radians(-5), 0)
    if vista == 'explosivo':
        if n.startswith('varilla_columna'):
            bpy.data.objects.remove(o); continue
        tabla = [('rotor', 0.215), ('tapa_electronica', 0.165), ('balero', 0.165), ('antena_gps', 0.165),
                 ('antena_lora', 0.11), ('separador_placas', 0.11), ('placa_', 0.11), ('heltec', 0.11), ('gy91', 0.11),
                 ('openlog', 0.11), ('neo_m8n', 0.11), ('disco_electronica_base', 0.11), ('oring', 0.11), ('varilla_placas', 0.11),
                 ('espuma_huevo1', 0.06), ('huevo_primaria', 0.06), ('espaciador_huevo', 0.06), ('disco_huevo_base', 0.035),
                 ('espaciador_base', 0.018), ('anillo_retencion', 0.018), ('tapa_secundaria', -0.045), ('esp32', -0.045),
                 ('rfm95', -0.045), ('carcasa_secundaria', -0.17), ('bandeja', -0.10), ('huevo_secundaria', -0.10),
                 ('pila_secundaria', -0.10), ('neo_6m', -0.10), ('espuma_huevo2', -0.10)]
        dz = next((d for k, d in tabla if n.startswith(k)), 0.0)
        if n == 'carcasa_primaria' or n.startswith('aspa'): o.location.x += 0.14; dz = 0.03
        o.location.z += dz
    objs.append(o)

# calcomanía del logo al frente de la primaria (vista cerrada y desplegada)
if vista in ('cerrado', 'desplegado') and os.path.exists(LOGO):
    img = bpy.data.images.load(LOGO)
    M = bpy.data.materials.new('Logo'); M.use_nodes = True
    nt = M.node_tree; b = nt.nodes['Principled BSDF']; tx = nt.nodes.new('ShaderNodeTexImage'); tx.image = img
    bw = nt.nodes.new('ShaderNodeRGBToBW'); mu = nt.nodes.new('ShaderNodeMath'); mu.operation = 'MULTIPLY'; mu.inputs[1].default_value = 3; mu.use_clamp = True
    nt.links.new(tx.outputs[0], b.inputs['Base Color']); nt.links.new(tx.outputs[0], bw.inputs[0]); nt.links.new(bw.outputs[0], mu.inputs[0]); nt.links.new(mu.outputs[0], b.inputs['Alpha'])
    import bmesh
    bm = bmesh.new(); uv = bm.loops.layers.uv.new('UVMap'); r = 0.04808; ac = math.radians(270); hw = 0.0225 / r; nu = 24
    z0, z1 = 0.070 + 0.062, 0.070 + 0.122
    filas = [[bm.verts.new((r * math.cos(ac - hw + 2 * hw * u / nu), r * math.sin(ac - hw + 2 * hw * u / nu), z)) for u in range(nu + 1)] for z in (z0, z1)]
    for u in range(nu):
        fc = bm.faces.new([filas[0][u], filas[0][u + 1], filas[1][u + 1], filas[1][u]])
        for lp, q in zip(fc.loops, [(u / nu, 0), ((u + 1) / nu, 0), ((u + 1) / nu, 1), (u / nu, 1)]): lp[uv].uv = q
    me = bpy.data.meshes.new('logo'); bm.to_mesh(me); me.materials.append(M)
    lo = bpy.data.objects.new('logo', me); sc.collection.objects.link(lo)

# escena: fondo azul noche y luces de estudio
w = bpy.data.worlds.new('w'); sc.world = w
try: w.use_nodes = True
except Exception: pass
w.node_tree.nodes['Background'].inputs[0].default_value = (*lin('#0b1324'), 1); w.node_tree.nodes['Background'].inputs[1].default_value = 0.5
tgt = bpy.data.objects.new('t', None); sc.collection.objects.link(tgt)
conf = {'cerrado': (0.115, 0.62, 0.22, 50), 'corte': (0.12, 0.60, 0.18, 50), 'explosivo': (0.13, 1.2, 0.12, 50),
        'desplegado': (0.11, 0.95, 0.30, 50)}[vista]
tgt.location = (0.02 if vista == 'explosivo' else 0, 0, conf[0])
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.lens = conf[3]
az = math.radians(-32); d = conf[1]; el = conf[2]
cam.location = (d * math.cos(el) * math.sin(-az), -d * math.cos(el) * math.cos(az), conf[0] + d * math.sin(el))
c = cam.constraints.new('TRACK_TO'); c.target = tgt; c.track_axis = 'TRACK_NEGATIVE_Z'; c.up_axis = 'UP_Y'
for nombre, loc, e, col in (('k', (0.5, -0.5, 0.7), 60, '#fff3e6'), ('f', (-0.6, -0.4, 0.3), 18, '#cfe0ff'), ('r', (-0.2, 0.6, 0.5), 70, '#2f6bff')):
    L = bpy.data.lights.new(nombre, 'AREA'); L.energy = e; L.size = 0.5; L.color = lin(col)
    o = bpy.data.objects.new(nombre, L); o.location = loc; sc.collection.objects.link(o)
    t = o.constraints.new('TRACK_TO'); t.target = tgt; t.track_axis = 'TRACK_NEGATIVE_Z'; t.up_axis = 'UP_Y'
bpy.ops.mesh.primitive_plane_add(size=6, location=(0, 0, -0.16 if vista in ('explosivo', 'desplegado') else 0))
piso = bpy.context.active_object; piso.data.materials.append(mat('Piso', '#0e1628', 0.6))
sc.render.engine = 'CYCLES'; sc.cycles.samples = 64; sc.cycles.use_denoising = True
sc.render.resolution_x, sc.render.resolution_y = (1600, 1200) if vista != 'explosivo' else (1400, 1600)
try: sc.view_settings.view_transform = 'AgX'; sc.view_settings.look = 'AgX - Medium High Contrast'
except Exception: pass
sc.render.filepath = os.path.join(OUT, f'cansat_{vista}.png')
bpy.ops.render.render(write_still=True)
print('ok', sc.render.filepath)
