// OPCIONAL. Sin este archivo los comandos se firman con "ZENIT".
// Para una clave privada: copiar este archivo como clave_local.h (en esta misma
// carpeta) y cambiar la clave. clave_local.h no se sube a GitHub; la estación
// terrena lo lee para firmar los comandos con la misma clave. Después de
// cambiarla, volver a subir env:primaria a la torre, y la laptop que mande
// comandos necesita el mismo archivo.
#pragma once
#define CLAVE_COMANDOS "CAMBIA-ESTA-CLAVE"
