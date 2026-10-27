# Modelo para la página web (three.js): junta las piezas de salida/_vista en un solo .glb.
#   Uso: python exportar_web.py   (después de cansat_completo.py)
# Cambia las unidades a las de la web: 1 = 1 cm, eje Y hacia arriba, origen en el centro del
# cilindro. Cada pieza es un nodo con su nombre; los colores los pone cansat3d.js.
import os, json, struct, math
import numpy as np

AQUI = os.path.dirname(os.path.abspath(__file__))
VIS = os.path.join(AQUI, 'salida', '_vista')
SALE = os.path.join(AQUI, 'salida', 'web', 'cansat.glb')
# y una copia directa para la página, si el repositorio está completo
WEB = os.path.join(AQUI, '..', '..', 'estacion-terrena', 'public', 'modelos', 'cansat.glb')

# las mismas medidas que cansat_completo.py
H_SEC, H_PRI = 70.0, 159.0
ZU = H_SEC; Z_TOP = ZU + H_PRI
ANG_ASPAS = (90.0, 210.0, 330.0)
Z_BISAGRA, R_BISAGRA, GIRO_ASPA = ZU + 153.0, 46.4, -96.0     # R_BISAGRA = R_CANAL + HOLGURA_ASPA
Z_CENTRO = Z_TOP / 2

def a_web(p):
    """mm, Z arriba -> cm, Y arriba, centrado (giro de -90° en X: no cambia la mano)."""
    p = np.asarray(p, dtype=np.float64)
    return np.stack([p[..., 0], p[..., 2] - Z_CENTRO, -p[..., 1]], axis=-1) / 10.0

def leer_stl(ruta):
    with open(ruta, 'rb') as f:
        f.read(80); n = struct.unpack('<I', f.read(4))[0]
        d = np.frombuffer(f.read(n * 50), dtype=np.dtype([('n', '<f4', 3), ('v', '<f4', (3, 3)), ('a', '<u2')]))
    v = a_web(d['v'].reshape(-1, 3))
    clave = np.round(v * 1000).astype(np.int64)          # une vértices a 0.01 mm
    _, idx, inv = np.unique(clave, axis=0, return_index=True, return_inverse=True)
    return v[idx].astype(np.float32), inv.reshape(-1).astype(np.uint32)

archivos = sorted(f for f in os.listdir(VIS) if f.endswith('.stl') and f.split('__')[0] in ('imp', 'com'))
binario = bytearray(); vistas, accesores, mallas, nodos = [], [], [], []

def agregar(datos, destino=None):
    while len(binario) % 4: binario.append(0)
    vistas.append({'buffer': 0, 'byteOffset': len(binario), 'byteLength': len(datos), **({'target': destino} if destino else {})})
    binario.extend(datos)
    return len(vistas) - 1

for f in archivos:
    nombre = f[:-4].split('__', 1)[1]
    pos, ind = leer_stl(os.path.join(VIS, f))
    corto = len(pos) < 65536
    ind_b = ind.astype(np.uint16 if corto else np.uint32).tobytes()
    vp = agregar(pos.tobytes(), 34962); vi = agregar(ind_b, 34963)
    accesores.append({'bufferView': vp, 'componentType': 5126, 'count': len(pos), 'type': 'VEC3',
                      'min': pos.min(0).tolist(), 'max': pos.max(0).tolist()})
    accesores.append({'bufferView': vi, 'componentType': 5123 if corto else 5125, 'count': len(ind), 'type': 'SCALAR'})
    mallas.append({'name': nombre, 'primitives': [{'attributes': {'POSITION': len(accesores) - 2}, 'indices': len(accesores) - 1}]})
    nodos.append({'name': nombre, 'mesh': len(mallas) - 1})

# bisagras de las aspas: punto, eje y giro para abrirlas (igual que exportar_vistas.py)
bisagras = []
for i, a in enumerate(ANG_ASPAS, 1):
    ar = math.radians(a)
    p = a_web([R_BISAGRA * math.cos(ar), R_BISAGRA * math.sin(ar), Z_BISAGRA])
    eje = a_web([-math.sin(ar), math.cos(ar), Z_CENTRO])          # vector: se cancela el corrimiento
    bisagras.append({'aspa': f'aspa_{i}', 'punto': p.round(4).tolist(), 'eje': eje.round(6).tolist(), 'grados': GIRO_ASPA})

extras = {'fuente': 'mecanica/cansat-completo (cansat_completo.py)',
          'medidas_cm': {'R': 4.8, 'ALTO': round(Z_TOP / 10, 2), 'ARRIBA': round(Z_CENTRO / 10, 3),
                         'ABAJO': round(-Z_CENTRO / 10, 3), 'UNION': round((ZU - Z_CENTRO) / 10, 3)},
          'bisagras': bisagras}
gltf = {'asset': {'version': '2.0', 'generator': 'Zénit exportar_web.py'}, 'scene': 0,
        'scenes': [{'name': 'CanSat Zénit', 'nodes': list(range(len(nodos))), 'extras': extras}],
        'nodes': nodos, 'meshes': mallas, 'accessors': accesores, 'bufferViews': vistas,
        'buffers': [{'byteLength': len(binario)}]}
js = json.dumps(gltf, separators=(',', ':')).encode()
js += b' ' * (-len(js) % 4)
while len(binario) % 4: binario.append(0)
os.makedirs(os.path.dirname(SALE), exist_ok=True)
with open(SALE, 'wb') as o:
    o.write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(binario)))
    o.write(struct.pack('<II', len(js), 0x4E4F534A)); o.write(js)
    o.write(struct.pack('<II', len(binario), 0x004E4942)); o.write(binario)
if os.path.isdir(os.path.dirname(WEB)):
    import shutil; shutil.copyfile(SALE, WEB); print('copiado a', os.path.normpath(WEB))
print(f'{len(nodos)} piezas · {os.path.getsize(SALE) / 1e6:.2f} MB · {SALE}')
