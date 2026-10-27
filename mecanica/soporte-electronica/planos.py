# Planos del soporte de electrónica en PDF (carta): resumen, cotas y plantillas 1:1.
import os, importlib.util, math
import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.backends.backend_pdf import PdfPages
from matplotlib import patches
import ezdxf
from ezdxf.addons.drawing import RenderContext, Frontend
from ezdxf.addons.drawing.matplotlib import MatplotlibBackend
from ezdxf.addons.drawing.config import Configuration, LineweightPolicy

AQUI = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('s', os.path.join(AQUI, 'soporte_electronica.py'))
s = importlib.util.module_from_spec(spec); spec.loader.exec_module(s)
SAL = s.SALIDA
W, H = 215.9, 279.4                        # hoja carta en mm
plt.rcParams['font.family'] = 'DejaVu Sans'
AZUL = '#1f3a6b'; GRIS = '#555555'

def hoja():
    fig = plt.figure(figsize=(W / 25.4, H / 25.4))
    ax = fig.add_axes([0, 0, 1, 1]); ax.set_xlim(0, W); ax.set_ylim(0, H); ax.axis('off'); ax.set_aspect('equal')
    return fig, ax

def encabezado(ax, titulo, sub):
    ax.text(14, H - 16, titulo, fontsize=15, weight='bold', color='#111')
    ax.text(14, H - 22.5, sub, fontsize=8.5, color=GRIS)
    ax.plot([14, W - 14], [H - 25.5, H - 25.5], color=AZUL, lw=1.2)
    ax.text(14, 8, 'Zénit · CanSat 2026 · Soporte de electrónica de la carga primaria · medidas en mm',
            fontsize=7, color=GRIS)

def cota_v(ax, x, y0, y1, texto, lado=1):
    ax.annotate('', xy=(x, y0), xytext=(x, y1), arrowprops=dict(arrowstyle='<->', lw=0.6, color='#222', shrinkA=0, shrinkB=0))
    ax.text(x + 1.5 * lado, (y0 + y1) / 2, texto, fontsize=6.5, va='center', ha='left' if lado > 0 else 'right')

def cota_h(ax, y, x0, x1, texto):
    ax.annotate('', xy=(x0, y), xytext=(x1, y), arrowprops=dict(arrowstyle='<->', lw=0.6, color='#222', shrinkA=0, shrinkB=0))
    ax.text((x0 + x1) / 2, y + 1.2, texto, fontsize=6.5, ha='center')

def dibujar_dxf(ax, archivo, cx, cy):
    doc = ezdxf.readfile(archivo)
    msp = doc.modelspace()
    # se dibuja en un eje aparte y se copian las líneas trasladadas a (cx, cy)
    fig2, ax2 = plt.subplots()
    cfg = Configuration(lineweight_policy=LineweightPolicy.ABSOLUTE, min_lineweight=0.3)
    Frontend(RenderContext(doc), MatplotlibBackend(ax2), config=cfg).draw_layout(msp)
    from matplotlib.path import Path
    from matplotlib.patches import PathPatch
    def copiar(p, t=None):
        v = p.vertices if t is None else t.transform(p.vertices)
        ax.add_patch(PathPatch(Path(v + (cx, cy), p.codes), fill=False, ec='#000', lw=0.7))
    for ln in ax2.lines:
        x, y = ln.get_data(); ax.plot([v + cx for v in x], [v + cy for v in y], color='#000', lw=0.7)
    for col in ax2.collections:
        for p in col.get_paths(): copiar(p)
    for pa in ax2.patches:
        copiar(pa.get_path(), pa.get_transform() - ax2.transData)
    plt.close(fig2)

def cruz(ax, x, y, r=3.2, color='#c62828'):
    ax.plot([x - r, x + r], [y, y], color=color, lw=0.4); ax.plot([x, x], [y - r, y + r], color=color, lw=0.4)

def regla(ax, x, y):
    ax.plot([x, x + 50], [y, y], color='#000', lw=1.0)
    for i in range(0, 51, 10): ax.plot([x + i, x + i], [y, y + (2.5 if i % 50 else 4)], color='#000', lw=0.6)
    ax.text(x + 25, y - 4, 'Comprobación: esta línea debe medir 50 mm exactos', fontsize=6.5, ha='center')

with PdfPages(os.path.join(SAL, 'planos_soporte_electronica.pdf')) as pdf:
    # ------------------------------------------------------------ hoja 1
    fig, ax = hoja()
    encabezado(ax, 'Soporte de electrónica · carga primaria',
               'Tres placas perforadas de 4 × 6 cm y la antena GPS de 25 mm, montadas en un solo bloque que entra en el tubo de la carga primaria.')
    for archivo, x0, titulo in (('vista_armado.png', 14, 'Armado'), ('vista_explosivo.png', 112, 'Explosivo (orden de armado)')):
        ruta = os.path.join(SAL, 'imagenes', archivo)
        if os.path.exists(ruta):
            img = plt.imread(ruta); h_img = 90 * img.shape[0] / img.shape[1]
            ax.imshow(img, extent=(x0, x0 + 90, H - 32 - h_img, H - 32)); ax.text(x0, H - 30, titulo, fontsize=8, weight='bold')
    y = H - 110
    datos = [
        ('Ø de los discos', f'{s.DISCO_DIAM:.1f} mm (tubo de Ø interior {s.TUBO_DIAM_INT:.0f} mm)'),
        ('Altura total con la antena', f'{s.ALTURA_TOTAL:.1f} mm'),
        ('Placas', f'{s.PLACA_X:.0f} × {s.PLACA_Y:.0f} mm, agujeros a {2*s.DX:.0f} × {2*s.DY:.0f} mm entre centros'),
        ('Altura de cada placa (cara de abajo)', f'{s.Z_P1:.1f} · {s.Z_P2:.1f} · {s.Z_P3:.1f} mm desde la base'),
        ('Alojamiento del GPS', f'{s.GPS_LADO + 2*s.GPS_HOLGURA:.1f} × {s.GPS_LADO + 2*s.GPS_HOLGURA:.1f} mm, {s.GPS_ALOJ_PROF:.1f} mm de profundo'),
    ]
    ax.text(14, y, 'Medidas principales', fontsize=10, weight='bold', color=AZUL); y -= 6
    for k, v in datos:
        ax.text(16, y, k, fontsize=8); ax.text(80, y, v, fontsize=8); y -= 5
    y -= 4
    ax.text(14, y, 'Lista de materiales (por soporte)', fontsize=10, weight='bold', color=AZUL); y -= 6
    bom = [
        ('1', 'Disco base (soporte_base.stl)', 'PLA o PETG, 3 perímetros, 40 % de relleno'),
        ('1', 'Tapa del GPS (tapa_gps.stl)', 'PLA o PETG, 3 perímetros, 40 % de relleno'),
        ('4 + 4 + 4', 'Separadores de 16, 18 y 6 mm', 'Impresos o de nylon (los que ya tienen)'),
        ('4', f'Varilla roscada M3 cortada a {math.floor(s.Z_TAPA + s.TAPA_GROSOR):.0f} mm (o tornillo M3 × 60)', 'Atraviesa todo el bloque; no debe salir por abajo'),
        ('4 + 4', 'Tuercas M3 (abajo quedan atrapadas en la base)', 'Más 4 para los amortiguadores'),
        ('2', 'O-ring 88 × 2 mm (o el más cercano: 86–90 × 2)', 'Uno en el canto de cada disco'),
        ('4', 'Amortiguadores de hule o silicón para M3', 'Tipo "anti-vibración" de controladora de dron'),
        ('—', 'Cinta doble cara de espuma + 1 cincho', 'Para fijar la antena del GPS'),
    ]
    for c, n, nota in bom:
        ax.text(16, y, c, fontsize=8); ax.text(32, y, n, fontsize=8); ax.text(132, y, nota, fontsize=7, color=GRIS); y -= 5
    y -= 4
    ax.text(14, y, 'Notas importantes', fontsize=10, weight='bold', color=AZUL); y -= 6
    notas = [
        'Antes de imprimir todo, midan con vernier los agujeros de sus placas y la antena. Si cambia algo, se corrige',
        'en soporte_electronica.py (sección MEDIDAS) y se vuelve a generar. Imprimir primero la plantilla de la hoja 3.',
        'El GY-91 (IMU) debe ir firme en una placa, NUNCA colgando de ligas: si se mueve, mide mal la orientación y',
        'no detecta el jalón del desacople. La amortiguación va en el bloque completo (o-rings + amortiguadores M3).',
        'La antena del GPS debe quedar mirando hacia arriba y sin metal encima. La antena LoRa pasa por las muescas',
        'del borde, pegada a la pared del tubo y lejos de la pila.',
    ]
    for n in notas:
        ax.text(16, y, n, fontsize=7.5); y -= 4.6
    pdf.savefig(fig); plt.close(fig)

    # ------------------------------------------------------------ hoja 2: vista lateral 2:1
    fig, ax = hoja()
    encabezado(ax, 'Vista lateral con alturas (escala 1.5:1)', 'Corte de frente. Las cotas son medidas reales en milímetros; el dibujo está 1.5 veces más grande.')
    E = 1.5; x0 = 34; z0 = 105
    X = lambda v: x0 + (v + s.DISCO_DIAM / 2) * E
    Z = lambda v: z0 + v * E
    def rect(x_a, x_b, z_a, z_b, fc, ec='#222'):
        ax.add_patch(patches.Rectangle((X(x_a), Z(z_a)), X(x_b) - X(x_a), Z(z_b) - Z(z_a), fc=fc, ec=ec, lw=0.6))
    R = s.DISCO_DIAM / 2
    rect(-R, R, 0, s.BASE_GROSOR, '#c9d2e6')
    for x in (-s.DX, s.DX): rect(x - 3.6, x + 3.6, s.BASE_GROSOR, s.Z_P1, '#c9d2e6')
    for z in (s.Z_P1, s.Z_P2, s.Z_P3): rect(-s.PLACA_X / 2, s.PLACA_X / 2, z, z + s.PLACA_Z, '#2e8b57')
    rect(-23, 23, s.Z_P2 + s.PLACA_Z, s.Z_P2 + s.PLACA_Z + 9, '#555')
    rect(-25.1, 25.1, s.Z_P2 + s.PLACA_Z + 9, s.Z_P2 + s.PLACA_Z + 10.6, '#222')
    rect(-6.7, 20.2, s.Z_P2 + s.PLACA_Z + 10.6, s.Z_P2 + s.PLACA_Z + 14.1, '#444')
    for (za, zb) in ((s.Z_P1 + s.PLACA_Z, s.Z_P2), (s.Z_P2 + s.PLACA_Z, s.Z_P3), (s.Z_P3 + s.PLACA_Z, s.Z_TAPA)):
        for x in (-s.DX, s.DX): rect(x - 3.2, x + 3.2, za, zb, '#eeeeee')
    rect(-R, R, s.Z_TAPA, s.Z_TAPA + s.TAPA_GROSOR, '#c9d2e6')
    za = s.Z_TAPA + s.TAPA_GROSOR - s.GPS_ALOJ_PROF
    rect(-s.GPS_LADO / 2, s.GPS_LADO / 2, za, za + 4.5, '#d9c19b')
    for x in (-s.DX, s.DX):
        ax.plot([X(x), X(x)], [Z(0), Z(s.Z_TAPA + s.TAPA_GROSOR)], color='#c62828', lw=0.6, ls='--')
    # tubo
    for x in (-s.TUBO_DIAM_INT / 2, s.TUBO_DIAM_INT / 2):
        ax.plot([X(x), X(x)], [Z(-6), Z(s.ALTURA_TOTAL + 6)], color='#888', lw=0.8, ls=(0, (4, 3)))
    ax.text(X(s.TUBO_DIAM_INT / 2) + 1, Z(s.ALTURA_TOTAL + 4), 'pared interior del tubo', fontsize=6.5, color='#666')
    # cotas a la derecha
    xc = X(R) + 12
    niveles = [(0, s.BASE_GROSOR, f'{s.BASE_GROSOR:.0f} base'), (s.BASE_GROSOR, s.Z_P1, f'{s.ESPACIO_BASE_P1:.0f}'),
               (s.Z_P1 + s.PLACA_Z, s.Z_P2, f'{s.ESPACIO_P1_P2:.0f}'), (s.Z_P2 + s.PLACA_Z, s.Z_P3, f'{s.ESPACIO_P2_P3:.0f}'),
               (s.Z_P3 + s.PLACA_Z, s.Z_TAPA, f'{s.ESPACIO_P3_TAPA:.0f}'), (s.Z_TAPA, s.Z_TAPA + s.TAPA_GROSOR, f'{s.TAPA_GROSOR:.0f} tapa')]
    for a, b, t in niveles: cota_v(ax, xc, Z(a), Z(b), t)
    cota_v(ax, xc + 18, Z(0), Z(s.ALTURA_TOTAL), f'{s.ALTURA_TOTAL:.1f}')
    cota_h(ax, Z(-10), X(-R), X(R), f'Ø {s.DISCO_DIAM:.1f}')
    for z, t in ((s.Z_P1, 'Placa 1'), (s.Z_P2, 'Placa 2 (Heltec encima)'), (s.Z_P3, 'Placa 3 (GPS NEO-M8N)')):
        ax.text(X(-R) - 2, Z(z) + 1, t, fontsize=6.5, ha='right')
    ax.text(X(-R) - 2, Z(za) + 3, 'Antena GPS 25 mm', fontsize=6.5, ha='right')
    ax.text(x0, Z(-30), 'Línea roja punteada: tornillo o varilla M3 que atraviesa todo. La tuerca de abajo queda atrapada en la base;', fontsize=7)
    ax.text(x0, Z(-34.5), 'la de arriba entra en el hueco hexagonal de la tapa y queda al ras.', fontsize=7)
    pdf.savefig(fig); plt.close(fig)

    # ------------------------------------------------------------ hojas 3 y 4: plantillas 1:1
    for archivo, titulo, marcas in (
            ('soporte_base_planta.dxf', 'Plantilla 1:1 · disco base', 'base'),
            ('tapa_gps_planta.dxf', 'Plantilla 1:1 · tapa del GPS', 'tapa')):
        fig, ax = hoja()
        encabezado(ax, titulo, 'Imprimir al 100 % (tamaño real, sin "ajustar a la página"). Recortar, pegar sobre MDF, acrílico o PVC y marcar con punzón.')
        cx, cy = W / 2, H / 2 + 8
        dibujar_dxf(ax, os.path.join(SAL, archivo), cx, cy)
        cruz(ax, cx, cy, 6)
        for (x, y) in s.PUNTOS_PLACA: cruz(ax, cx + x, cy + y)
        if marcas == 'base':
            for a in (45, 135, 225, 315):
                cruz(ax, cx + s.AMORT_RADIO * math.cos(math.radians(a)), cy + s.AMORT_RADIO * math.sin(math.radians(a)), color='#1f55e0')
            ax.text(cx, cy - s.DISCO_DIAM / 2 - 8, 'Rojo: agujeros de las placas (Ø 3.4) · Azul: amortiguadores (Ø 3.4) · Centro: paso de cables',
                    fontsize=7, ha='center')
        else:
            ax.text(cx, cy - s.DISCO_DIAM / 2 - 8, 'Cuadro central: antena GPS · Hexágonos: tuercas M3 · Óvalos: paso de cables · Muescas: antena LoRa',
                    fontsize=7, ha='center')
        cota_h(ax, cy + s.DISCO_DIAM / 2 + 6, cx - s.DISCO_DIAM / 2, cx + s.DISCO_DIAM / 2, f'Ø {s.DISCO_DIAM:.1f}')
        cota_h(ax, cy - s.DY - 6, cx - s.DX, cx + s.DX, f'{2*s.DX:.1f}')
        cota_v(ax, cx + s.DX + 6, cy - s.DY, cy + s.DY, f'{2*s.DY:.1f}')
        regla(ax, cx - 25, 30)
        pdf.savefig(fig); plt.close(fig)
print('PDF listo')
