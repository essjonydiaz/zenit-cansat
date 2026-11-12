# Mallas para las imágenes de detalle (bisagra con tornillo e interruptor). Uso: python exportar_detalles.py
import os, math
import cadquery as cq
import cansat_completo as C
from revisar_apertura import girar_aspa
OUT = os.path.join(C.SAL, '_detalle'); os.makedirs(OUT, exist_ok=True)
comp = C.componentes()
arriba = lambda o, z0: o.intersect(C.cil(C.R + 5, z0, C.Z_TOP + 5))
piezas = {
    'rotor': C.rotor(), 'tapa_electronica': C.tapa_electronica(),
    'carcasa_primaria_arriba': arriba(C.carcasa_primaria(), 175.0),
    'aspa_abierta_35': girar_aspa(C.aspa(C.ANG_ASPAS[0]), C.ANG_ASPAS[0], -35),
    'aspa_1': arriba(C.aspa(C.ANG_ASPAS[0]), 175.0), 'aspa_2': arriba(C.aspa(C.ANG_ASPAS[1]), 175.0),
    'tornillo_bisagra_1': comp['tornillo_bisagra_1'], 'interruptor_primaria': comp['interruptor_primaria'],
    'carcasa_secundaria': C.carcasa_secundaria(), 'tapa_secundaria': C.tapa_secundaria(),
    'interruptor_secundaria': comp['interruptor_secundaria'],
}
for n, o in piezas.items():
    cq.exporters.export(o, os.path.join(OUT, n + '.stl'), tolerance=0.02, angularTolerance=0.15)
print('listo', OUT)
