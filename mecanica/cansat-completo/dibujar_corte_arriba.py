# Dibujo del corte visto desde arriba (aspas en sus canales). Uso: python dibujar_corte_arriba.py
import os
import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt
import cansat_completo as C
Z = C.ZU + 80.0
def contornos(obj):
    s = obj.intersect(C.caja(200, 200, 0.2, (0, 0, Z)))
    out = []
    for f in s.faces().vals():
        if abs(f.normalAt().z - 1) < 1e-6:
            for k, w in enumerate([f.outerWire()] + f.innerWires()):
                out.append((k == 0, [w.positionAt(i / 400).toTuple()[:2] for i in range(401)]))
    return out
pared = contornos(C.carcasa_primaria())
aspas = [c for a in C.ANG_ASPAS for c in contornos(C.aspa(a))]
fig, axs = plt.subplots(1, 2, figsize=(13.6, 8))
for ax, con_aspas, tit in ((axs[0], True, 'Cerrado: las aspas van en su canal, al ras'),
                           (axs[1], False, 'Aspas abiertas: la pared queda completa, sin huecos')):
    for afuera, c in sorted(pared, key=lambda t: not t[0]): ax.fill(*zip(*c), color='#1f2538' if afuera else 'white', lw=0)
    if con_aspas:
        for afuera, c in aspas: ax.fill(*zip(*c), color='#e0a32a', lw=0)
    ax.add_patch(plt.Circle((0, 0), C.R, fill=False, ls='--', color='red', lw=1.2))
    ax.set_aspect('equal'); ax.axis('off'); ax.set_xlim(-52, 52); ax.set_ylim(-52, 52); ax.set_title(tit, fontsize=14)
fig.suptitle('Corte visto desde arriba, a media altura de la primaria (v3: aspas de 2.0 mm)', fontsize=15)
h = [plt.Rectangle((0, 0), 1, 1, color='#1f2538'), plt.Rectangle((0, 0), 1, 1, color='#e0a32a'), plt.Line2D([], [], ls='--', color='red')]
fig.legend(h, ['Pared (1.2 mm, completa)', 'Aspas (2.0 mm)', 'Límite Ø 96 mm'], loc='lower left', ncol=3, frameon=False)
fig.savefig(os.path.join(C.SAL, 'imagenes', 'aspas_dentro_del_cilindro.png'), dpi=100, bbox_inches='tight', facecolor='white')
print('listo')
