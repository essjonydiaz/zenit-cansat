# Lista de compras · CanSat Zénit (diseño v2)

Todo lo que **no** sale de la impresora 3D. Las piezas impresas son los 16 archivos de
`Zenit_STL_v2.zip`. La columna "Qué pedir" dice cómo pedirlo en la tienda. Anoten el precio real:
la guía pone un **máximo de $100 USD** (≈ $1,800 MXN) para todo el CanSat y hay que reportarlo.

## 1. Tornillería y mecánica (ferretería o tornillería)

| ☐ | Cant. | Qué pedir | Para qué | Precio |
|---|---|---|---|---|
| ☐ | 1 m | **Varilla roscada de 3 mm (M3)**, de acero | Cortar 3 pedazos de 16 cm: la "columna" que carga el peso del piso a la tapa | |
| ☐ | 20 | Tuercas M3 | Columna, placas, tapa de la secundaria | |
| ☐ | 4 | Tuercas M3 **con seguro de nylon** | Placas de electrónica (no se aflojan) | |
| ☐ | 6 | Tornillos M3 × 10 mm | Tapa de la secundaria y rotor | |
| ☐ | 1 | Tornillo M3 × 12 mm con rondana | Detiene el rotor por abajo del balero | |
| ☐ | 10 cm | Varilla o clavo de **acero de 3 mm** | El pasador del desacople (cortar a 18.5 mm) | |
| ☐ | 50 cm | **Alambre de acero de 1 mm** (cuerda de piano) | Varilla en Z del servo de desacople y alambre del autogiro | |
| ☐ | 20 cm | Alambre o clavo de acero de 1.5 mm | Ejes de las 3 bisagras de las aspas (3 de 18 mm) | |
| ☐ | 12 | Separadores hexagonales de nylon M3 (16 y 18 mm) | Entre las placas (o se imprimen) | |

## 2. Piezas especiales (tienda de baleros, electrónica o Mercado Libre)

| ☐ | Cant. | Qué pedir | Para qué | Precio |
|---|---|---|---|---|
| ☐ | 1 | **Balero 688ZZ** (8 × 16 × 5 mm) | Para que gire el rotor del autogiro | |
| ☐ | 3 + 1 | **Imán de neodimio N52 de Ø 8 × 1 mm** | Punta de cada aspa (+1 de repuesto) | |
| ☐ | 3 + 1 | **Imán de neodimio N52 de Ø 8 × 2 mm** | Dientes del anillo (+1 de repuesto) | |
| ☐ | 1 | **O-ring de 86 × 2 mm** (Ø interior × grueso) | Centra el módulo de electrónica | |
| ☐ | 8 | Arandelas de hule o silicón de Ø 8 × 3 × 2 mm | Amortiguan las 3 placas | |

## 3. Energía y electrónica que falta

| ☐ | Cant. | Qué pedir | Para qué | Precio |
|---|---|---|---|---|
| ☐ | 2 (+1) | **Pila de 9 V de LITIO** (por ejemplo, Energizer Ultimate Lithium) | Una por carga. Las alcalinas pesan 24 g más y el CanSat pasaría de 600 g | |
| ☐ | 2 | Broche para pila de 9 V | Conectar cada pila | |
| ☐ | 2 | **Servo SG90** | Desacople y autogiro (si ya los tienen, pesen uno) | |
| ☐ | 2 | Capacitor electrolítico de 470 µF, 10 V o más | Junto a cada servo, para que no reinicie la Heltec | |
| ☐ | 2 | Interruptor de encendido chico (deslizable) | La guía lo pide; **falta definir dónde va** sin sobresalir | |

## 4. Armado y protección (papelería o ferretería)

| ☐ | Cant. | Qué pedir | Para qué | Precio |
|---|---|---|---|---|
| ☐ | 1 bolsa | Ligas chicas | Hamaca de los huevos y resorte de cada aspa (lleven extras) | |
| ☐ | 1 hoja | Foamy (espuma EVA) de 5 mm | Cama y techo de cada huevo | |
| ☐ | 1 | Cinchos chicos | Pila, servos y cables | |
| ☐ | 1 | Termofit (tubo termoencogible) | Soldaduras | |
| ☐ | 1 | Silicón caliente y Kola Loca | Conectores e imanes (la guía pide que esté **seco** el día del vuelo) | |
| ☐ | 1 | Cinta de aislar | Fijar cables y el conector de la antena | |

## 5. Servicios

| ☐ | Qué | Detalle | Precio |
|---|---|---|---|
| ☐ | Impresión 3D | 16 archivos (31 piezas), ~240 g de PLA, 12–14 h · cotizado a $0.33/min | $240–280 |
| ☐ | Calcomanía del logo | Vinil blanco con laminado mate, 4.5 × 6 cm (hoja de 6) | |

## 6. Electrónica que ya deberían tener (revisar)

| ☐ | Cant. | Pieza |
|---|---|---|
| ☐ | 2 | Heltec WiFi LoRa 32 V3 (una para el CanSat y otra para la estación terrena, con su antena de 915 MHz) |
| ☐ | 1 | GY-91 (MPU9250 + BMP280) |
| ☐ | 1 | GPS NEO-M8N con antena cerámica |
| ☐ | 1 | OpenLog + tarjeta microSD |
| ☐ | 1 | Regulador MP1584EN |
| ☐ | 1 | ESP32-C3 SuperMini, RFM95W (915 MHz) y GPS NEO-6M (secundaria) |
| ☐ | 1 | Antena de 915 MHz para la secundaria |
| ☐ | 3 | Placas perforadas de 4 × 6 cm |

**Total gastado:** $ __________ (máximo $100 USD ≈ $1,800 MXN)

**Antes de imprimir y armar:** pesen un servo y una pila de litio. El diseño calcula unos 10.5 g por
servo y 34 g por pila, y con eso el CanSat queda en ~597 g de 600.
