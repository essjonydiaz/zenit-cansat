# Piezas extra para las imágenes: aspas abiertas y cortes de las carcasas.
import importlib.util, os, math
import cadquery as cq
spec = importlib.util.spec_from_file_location('c', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'cansat_completo.py'))
c = importlib.util.module_from_spec(spec); spec.loader.exec_module(c)
VIS = c.VIS
for i, a in enumerate(c.ANG_ASPAS, 1):
    b = c.aspa(a)
    ar = math.radians(a)
    p0 = (c.R_BISAGRA * math.cos(ar), c.R_BISAGRA * math.sin(ar), c.Z_BISAGRA)
    t = (-math.sin(ar), math.cos(ar), 0)
    p1 = (p0[0] + t[0], p0[1] + t[1], p0[2])
    for signo in (1, -1):
        ab = b.rotate(p0, p1, signo * 96.0)
        bb = ab.val().BoundingBox()
        if max(abs(bb.xmax), abs(bb.xmin), abs(bb.ymax), abs(bb.ymin)) > 100: break
    cq.exporters.export(ab, os.path.join(VIS, f'abierta__aspa_{i}.stl'), tolerance=0.05, angularTolerance=0.2)
# cortes: se quita el cuarto que mira a la cámara (x > 0, y < 0)
cuarto = cq.Workplane('XY').box(120, 120, 400, centered=(False, False, False)).translate((0, -120, -50))
for n in ('carcasa_primaria', 'carcasa_secundaria', 'rotor', 'tapa_electronica', 'piso_primaria', 'tapa_secundaria',
          'disco_electronica_base', 'disco_huevo_base', 'bandeja_secundaria'):
    o = dict(c.piezas_impresas())[n][0] if False else None
imp = c.piezas_impresas()
for n in ('carcasa_primaria', 'carcasa_secundaria', 'rotor', 'aspa_3'):
    o = imp[n][0].cut(cuarto)
    cq.exporters.export(o, os.path.join(VIS, f'corte__{n}.stl'), tolerance=0.05, angularTolerance=0.2)
comp = c.componentes()
for n in ('espuma_huevo1_abajo', 'espuma_huevo1_arriba', 'espuma_huevo2_abajo', 'espuma_huevo2_arriba'):
    cq.exporters.export(comp[n].cut(cuarto), os.path.join(VIS, f'corte__{n}.stl'), tolerance=0.05, angularTolerance=0.2)
print('ok')
