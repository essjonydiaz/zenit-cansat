import os, importlib.util
spec=importlib.util.spec_from_file_location('s','soporte_electronica.py'); s=importlib.util.module_from_spec(spec); spec.loader.exec_module(s)
import cadquery as cq
b=s.soporte_base(); t=s.tapa_gps().translate((0,0,-s.Z_TAPA))
for nombre,obj,z in (('soporte_base',b,4.2),('tapa_gps',t,4.2)):
    caja=cq.Workplane('XY').box(200,200,0.01,centered=(True,True,False)).translate((0,0,z))
    corte=obj.intersect(caja)
    caras=corte.faces('<Z')
    plano=cq.Workplane('XY').add(caras.vals()).translate((0,0,-z))
    print(nombre,'caras',len(caras.vals()), 'area', sum(f.Area() for f in caras.vals()))
    cq.exporters.export(plano, os.path.join(s.SALIDA,f'{nombre}_planta.dxf'))
