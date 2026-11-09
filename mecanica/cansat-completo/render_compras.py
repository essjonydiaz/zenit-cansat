# Ilustraciones de lo que falta comprar (Blender bpy).  Uso: python render_compras.py
import bpy, os, math
from mathutils import Vector
AQUI = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(AQUI, 'salida', 'imagenes', 'compras'); os.makedirs(OUT, exist_ok=True)

def lin(h):
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)

MATS = {}
def escena_nueva():
    MATS.clear()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
    w.node_tree.nodes['Background'].inputs[0].default_value = (*lin('#f3f5fa'), 1)
    w.node_tree.nodes['Background'].inputs[1].default_value = 0.35
    sc.render.engine = 'CYCLES'; sc.cycles.samples = 40; sc.cycles.use_denoising = True
    sc.render.resolution_x, sc.render.resolution_y = 800, 560
    try: sc.view_settings.view_transform = 'AgX'
    except Exception: pass
    return sc

def mat(c, r=0.4, m=0.0):
    k = (c, r, m)
    if k in MATS: return MATS[k]
    M = bpy.data.materials.new(c); M.use_nodes = True
    b = M.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*lin(c), 1); b.inputs['Roughness'].default_value = r; b.inputs['Metallic'].default_value = m
    MATS[k] = M; return M

def poner(o, M, loc=(0, 0, 0), rot=(0, 0, 0)):
    o.data.materials.append(M); o.location = loc; o.rotation_euler = rot
    try:
        for p in o.data.polygons: p.use_smooth = True
    except Exception: pass
    return o

def cil(r, h, M, loc=(0, 0, 0), rot=(0, 0, 0), v=48):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=h, vertices=v)
    return poner(bpy.context.active_object, M, loc, rot)

def anillo(r0, r1, h, M, loc=(0, 0, 0), rot=(0, 0, 0)):
    o = cil(r1, h, M, loc, rot)
    bpy.ops.mesh.primitive_cylinder_add(radius=r0, depth=h * 3, vertices=48); hueco = bpy.context.active_object
    hueco.location = loc; hueco.rotation_euler = rot
    md = o.modifiers.new('b', 'BOOLEAN'); md.object = hueco; md.operation = 'DIFFERENCE'
    bpy.context.view_layer.objects.active = o; bpy.ops.object.modifier_apply(modifier='b')
    bpy.data.objects.remove(hueco); return o

def toro(R, r, M, loc=(0, 0, 0), rot=(0, 0, 0), escala=(1, 1, 1)):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, major_segments=72, minor_segments=16)
    o = poner(bpy.context.active_object, M, loc, rot); o.scale = escala; return o

def caja(dx, dy, dz, M, loc=(0, 0, 0), rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1); o = bpy.context.active_object; o.scale = (dx, dy, dz)
    bpy.ops.object.transform_apply(scale=True)
    bv = o.modifiers.new('bv', 'BEVEL'); bv.width = min(dx, dy, dz) * 0.08; bv.segments = 3
    return poner(o, M, loc, rot)

def camara_luces(sc, objetivo, dist, elev=0.55, az=-0.6, lente=60):
    t = bpy.data.objects.new('t', None); sc.collection.objects.link(t); t.location = objetivo
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
    cam.data.lens = lente
    cam.location = (objetivo[0] + dist * math.cos(elev) * math.sin(az), objetivo[1] - dist * math.cos(elev) * math.cos(az), objetivo[2] + dist * math.sin(elev))
    c = cam.constraints.new('TRACK_TO'); c.target = t; c.track_axis = 'TRACK_NEGATIVE_Z'; c.up_axis = 'UP_Y'
    for n, loc, e in (('k', (dist, -dist, dist * 1.5), 55 * dist ** 2), ('f', (-dist, -dist * 0.5, dist), 18 * dist ** 2)):
        L = bpy.data.lights.new(n, 'AREA'); L.energy = e; L.size = dist
        o = bpy.data.objects.new(n, L); o.location = loc; sc.collection.objects.link(o)
        tt = o.constraints.new('TRACK_TO'); tt.target = t; tt.track_axis = 'TRACK_NEGATIVE_Z'; tt.up_axis = 'UP_Y'
    bpy.ops.mesh.primitive_plane_add(size=dist * 20, location=(0, 0, 0)); poner(bpy.context.active_object, mat('#e9edf5', 0.7))

def render(sc, nombre):
    sc.render.filepath = os.path.join(OUT, nombre + '.png'); bpy.ops.render.render(write_still=True); print('ok', nombre)

ACERO = ('#c3c8d0', 0.28, 1.0); NIQUEL = ('#dfe3ea', 0.15, 1.0); NEGRO = ('#151517', 0.75, 0.0)

# 1. varilla roscada M3 con tuercas y tornillos (unidades: cm)
sc = escena_nueva(); A = mat(*ACERO)
cil(0.15, 10, A, (0, 0, 0.15), (0, math.pi / 2, 0.25))
for i in range(30): toro(0.15, 0.025, A, (-4.85 + i * 0.33 * math.cos(0.25), -4.85 * 0 + i * 0.33 * math.sin(0.25) - 1.21, 0.15), (0, math.pi / 2, 0.25))
for k, (x, y) in enumerate(((1.5, -2.0), (2.4, -1.6), (3.3, -2.2))): cil(0.32, 0.24, A, (x, y, 0.12), v=6)
for x, y in ((-2.0, -2.2), (-1.0, -2.6)):
    cil(0.15, 1.0, A, (x, y, 0.15), (0, math.pi / 2, 0.4)); cil(0.27, 0.2, A, (x - 0.55 * math.cos(0.4), y - 0.55 * math.sin(0.4), 0.27), (0, math.pi / 2, 0.4))
camara_luces(sc, (0.3, -1.2, 0), 9.5, 0.7, -0.2, 50); render(sc, '01_varilla')

# 2. balero 688ZZ (mm/10)
sc = escena_nueva(); A = mat(*ACERO); N = mat('#2a2b30', 0.35, 0.6)
anillo(0.66, 0.8, 0.5, A, (0, 0, 0.25)); anillo(0.4, 0.52, 0.5, A, (0, 0, 0.25)); anillo(0.52, 0.66, 0.42, N, (0, 0, 0.25))
anillo(0.66, 0.8, 0.5, A, (1.9, 0.4, 0.8), (math.pi / 2.2, 0, 0.3)); anillo(0.4, 0.52, 0.5, A, (1.9, 0.4, 0.8), (math.pi / 2.2, 0, 0.3)); anillo(0.52, 0.66, 0.42, N, (1.9, 0.4, 0.8), (math.pi / 2.2, 0, 0.3))
camara_luces(sc, (0.9, 0.2, 0.3), 6, 0.6, -0.4, 60); render(sc, '02_balero')

# 3. imanes de neodimio Ø 8 (1 y 2 mm)
sc = escena_nueva(); Ni = mat(*NIQUEL)
for i in range(4): cil(0.4, 0.2, Ni, (0, 0, 0.1 + i * 0.205))
for i in range(4): cil(0.4, 0.1, Ni, (1.2, 0.2, 0.05 + i * 0.105))
cil(0.4, 0.2, Ni, (-0.9, -0.6, 0.1)); cil(0.4, 0.1, Ni, (0.4, -0.9, 0.05))
camara_luces(sc, (0.2, -0.1, 0.3), 5.5, 0.55, -0.5, 60); render(sc, '03_imanes')

# 4. o-ring 86 × 2 (cm)
sc = escena_nueva(); G = mat(*NEGRO)
toro(4.4, 0.1, G, (0, 0, 0.1)); toro(4.4, 0.1, G, (1.0, 0.6, 0.3), (0.25, 0.1, 0))
camara_luces(sc, (0.5, 0.3, 0.1), 20, 0.85, -0.3, 50); render(sc, '04_oring')

# 5. arandelas de hule Ø 8 × 3 × 2 (mm/10)
sc = escena_nueva(); G = mat(*NEGRO)
import random; random.seed(3)
for i in range(8):
    x, y = (i % 4) * 1.1, (i // 4) * 1.1
    anillo(0.15, 0.4, 0.2, G, (x + random.uniform(-0.15, 0.15), y + random.uniform(-0.15, 0.15), 0.1))
camara_luces(sc, (1.65, 0.55, 0), 7, 0.85, -0.25, 55); render(sc, '05_hules')

# 6. alambre cuerda de piano 1 mm en rollo + clavo de 3 mm (cm)
sc = escena_nueva(); A = mat(*ACERO)
cu = bpy.data.curves.new('espiral', 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = 0.05; cu.bevel_resolution = 4
sp = cu.splines.new('POLY'); n = 400; sp.points.add(n - 1)
for i in range(n):
    a = i / n * math.pi * 2 * 6; rr = 2.0 + 0.04 * math.sin(a * 0.5)
    sp.points[i].co = (rr * math.cos(a), rr * math.sin(a), 0.06 + i / n * 0.35, 1)
o = bpy.data.objects.new('alambre', cu); sc.collection.objects.link(o); o.data.materials.append(A)
cil(0.15, 6, A, (4.0, -1.5, 0.15), (0, math.pi / 2, 0.5)); cil(0.32, 0.12, A, (4.0 - 3.0 * math.cos(0.5), -1.5 - 3.0 * math.sin(0.5), 0.32), (0, math.pi / 2, 0.5))
bpy.ops.mesh.primitive_cone_add(radius1=0.15, depth=0.5, vertices=24); poner(bpy.context.active_object, A, (4.0 + 3.25 * math.cos(0.5), -1.5 + 3.25 * math.sin(0.5), 0.15), (0, math.pi / 2, 0.5))
camara_luces(sc, (1.5, -0.5, 0), 16, 0.8, -0.3, 50); render(sc, '06_alambre_clavo')

# 7. ligas chicas
sc = escena_nueva(); L = mat('#d9b98a', 0.55)
random.seed(5)
for i in range(9):
    toro(1.2, 0.06, L, (random.uniform(-1.5, 1.5), random.uniform(-1.0, 1.0), 0.07 + i * 0.03), (random.uniform(-0.05, 0.05), 0, random.uniform(0, 3)), (1, random.uniform(0.6, 1.0), 1))
camara_luces(sc, (0, 0, 0), 11, 0.9, -0.2, 50); render(sc, '07_ligas')

# 8. foamy de 5 mm
sc = escena_nueva()
caja(9, 6, 0.5, mat('#e3c24a', 0.95), (0, 0, 0.25), (0, 0, 0.2)); caja(9, 6, 0.5, mat('#3a7bd5', 0.95), (1.5, 1.2, 0.75), (0, 0, 0.35))
camara_luces(sc, (0.6, 0.5, 0.3), 18, 0.65, -0.4, 50); render(sc, '08_foamy')

# 9. interruptor deslizable chico (mm/10)
sc = escena_nueva(); Nb = mat('#1b1c20', 0.45); B = mat('#f2f2f2', 0.4); A = mat(*ACERO)
for k, x in enumerate((0, 2.2)):
    caja(1.2, 0.55, 0.55, Nb, (x, 0, 0.6)); caja(0.3, 0.3, 0.35, B, (x + 0.15, 0, 1.0))
    for dx in (-0.4, 0, 0.4): cil(0.03, 0.6, A, (x + dx, 0, 0.15))
camara_luces(sc, (1.1, 0, 0.5), 7, 0.4, -0.5, 55); render(sc, '09_interruptor')

# 10. capacitor electrolítico 470 µF
sc = escena_nueva(); C = mat('#1d2a6b', 0.35); Gs = mat('#c9cdd6', 0.4); A = mat(*ACERO)
for x in (0, 1.6):
    cil(0.5, 1.3, C, (x, 0, 1.55)); caja(0.12, 0.02, 1.25, Gs, (x - 0.12, -0.5, 1.55)); cil(0.47, 0.03, Gs, (x, 0, 2.21))
    for dx in (-0.2, 0.2): cil(0.025, 0.9, A, (x + dx, 0, 0.45))
camara_luces(sc, (0.8, 0, 1.1), 8, 0.35, -0.5, 55); render(sc, '10_capacitor')
