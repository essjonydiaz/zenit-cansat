# Revisa que cada aspa abra de 0° a 96° sin chocar con el rotor (orejas, falda, plato),
# la tapa de la electrónica ni la carcasa. Uso: python revisar_apertura.py
import math
import cadquery as cq
import cansat_completo as C

def girar_aspa(obj, ang_aspa, giro):
    a = math.radians(ang_aspa)
    p = cq.Vector(C.R_BISAGRA * math.cos(a), C.R_BISAGRA * math.sin(a), C.Z_BISAGRA)
    eje = cq.Vector(-math.sin(a), math.cos(a), 0)          # tangente: abrir = la punta sale hacia afuera
    return obj.rotate(p, p + eje, giro)

def revisar():
    fijas = {'rotor': C.rotor(), 'tapa_electronica': C.tapa_electronica(), 'carcasa_primaria': C.carcasa_primaria()}
    peor = 0.0
    for ang in C.ANG_ASPAS[:1]:          # las 3 son iguales (simetría de 120°)
        asp = C.aspa(ang)
        for giro in range(0, 97, 3):
            for signo in (1,):
                g = girar_aspa(asp, ang, -signo * giro)
                for n, f in fijas.items():
                    v = g.intersect(f).val().Volume() if g.intersect(f).vals() else 0.0
                    peor = max(peor, v)
                    if v > 0.5: print(f'  aspa a {giro:3d}° choca con {n}: {v:.1f} mm³')
        # la punta debe salir hacia afuera (comprobación del sentido)
        bb = girar_aspa(asp, ang, -90).val().BoundingBox()
        print('aspa abierta a 90°: z de', round(bb.zmin, 1), 'a', round(bb.zmax, 1), '| alcance radial ≈', round(math.hypot(bb.xmax, bb.ymax), 1))
    print('mayor choque:', round(peor, 2), 'mm³')

if __name__ == '__main__':
    revisar()
