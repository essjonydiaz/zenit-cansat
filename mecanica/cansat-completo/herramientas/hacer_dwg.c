/* hacer_dwg: escribe un .dwg (R2000) con la API de LibreDWG.
   Compilar (Linux), con LibreDWG 0.13.3 instalado en $P:
     gcc -O2 -o hacer_dwg hacer_dwg.c -I$P/include -L$P/lib -lredwg -lm
   Lo usa exportar_dxf_autocad.py para generar salida/autocad/*.dwg. */
/* Escribe un .dwg (R2000) desde una lista simple de entidades, con la API de LibreDWG.
   Formato de entrada (una entidad por línea):
     L nombre color          capa (y la deja como actual)
     C nombre                cambia a la capa actual
     F x y z x y z x y z     cara 3D (triángulo)
     N x y z x y z           línea
     I x y r                 círculo
     A x y r a0 a1           arco (grados)
     T x y h rot hal val texto...   texto (hal 0 izq/1 centro; val 0 base/2 medio)  */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <dwg.h>
#include <dwg_api.h>
int main (int argc, char **argv)
{
  if (argc < 3) { fprintf (stderr, "uso: hacer_dwg entrada.txt salida.dwg\n"); return 1; }
  FILE *f = fopen (argv[1], "r"); if (!f) return 1;
  Dwg_Data *dwg = dwg_new_Document (R_2000, 0, 0);
  dwg->header.from_version = R_2000;
  dwg->header_vars.INSUNITS = 4;      /* milímetros */
  dwg->header_vars.MEASUREMENT = 1;   /* métrico */
  Dwg_Object *mso = dwg_model_space_object (dwg);
  Dwg_Object_BLOCK_HEADER *ms = mso->tio.object->tio.BLOCK_HEADER;
  char line[4096], name[256]; long n = 0;
  while (fgets (line, sizeof line, f))
    {
      dwg_point_3d p[4];
      int err;
      if (line[0] == 'L')
        {
          int col; sscanf (line + 2, "%255s %d", name, &col);
          Dwg_Object_LAYER *lay = dwg_add_LAYER (dwg, name);
          lay->color.index = col;
          Dwg_Object *lo = dwg_obj_generic_to_object (lay, &err);
          dwg->header_vars.CLAYER = dwg_add_handleref (dwg, 5, lo->handle.value, NULL);
        }
      else if (line[0] == 'C')
        {
          sscanf (line + 2, "%255s", name);
          BITCODE_H h = dwg_find_tablehandle (dwg, name, "LAYER");
          if (h) dwg->header_vars.CLAYER = dwg_add_handleref (dwg, 5, h->absolute_ref, NULL);
        }
      else if (line[0] == 'F')
        {
          sscanf (line + 2, "%lf %lf %lf %lf %lf %lf %lf %lf %lf", &p[0].x, &p[0].y, &p[0].z,
                  &p[1].x, &p[1].y, &p[1].z, &p[2].x, &p[2].y, &p[2].z);
          dwg_add_3DFACE (ms, &p[0], &p[1], &p[2], &p[2]); n++;
        }
      else if (line[0] == 'N')
        {
          sscanf (line + 2, "%lf %lf %lf %lf %lf %lf", &p[0].x, &p[0].y, &p[0].z, &p[1].x, &p[1].y, &p[1].z);
          dwg_add_LINE (ms, &p[0], &p[1]); n++;
        }
      else if (line[0] == 'I')
        {
          double r; p[0].z = 0; sscanf (line + 2, "%lf %lf %lf", &p[0].x, &p[0].y, &r);
          dwg_add_CIRCLE (ms, &p[0], r); n++;
        }
      else if (line[0] == 'A')
        {
          double r, a0, a1; p[0].z = 0; sscanf (line + 2, "%lf %lf %lf %lf %lf", &p[0].x, &p[0].y, &r, &a0, &a1);
          dwg_add_ARC (ms, &p[0], r, a0 * M_PI / 180.0, a1 * M_PI / 180.0); n++;
        }
      else if (line[0] == 'T')
        {
          double h, rot; int hal, val, k = 0;
          p[0].z = 0;
          sscanf (line + 2, "%lf %lf %lf %lf %d %d %n", &p[0].x, &p[0].y, &h, &rot, &hal, &val, &k);
          char *txt = line + 2 + k; txt[strcspn (txt, "\r\n")] = 0;
          Dwg_Entity_TEXT *t = dwg_add_TEXT (ms, txt, &p[0], h);
          t->rotation = rot * M_PI / 180.0;
          t->width_factor = 1.0;
          t->horiz_alignment = hal; t->vert_alignment = val;
          t->alignment_pt.x = p[0].x; t->alignment_pt.y = p[0].y;
          /* dataflags: bit puesto = valor por omisión (no se escribe) */
          unsigned char df = 0x01 | 0x04 | 0x10 | 0x20;
          if (rot == 0.0) df |= 0x08;
          if (hal == 0 && val == 0) df |= 0x02 | 0x40 | 0x80;
          else { if (hal == 0) df |= 0x40; if (val == 0) df |= 0x80; }
          t->dataflags = df; n++;
        }
    }
  fclose (f);
  BITCODE_H h0 = dwg_find_tablehandle (dwg, "0", "LAYER");
  if (h0) dwg->header_vars.CLAYER = dwg_add_handleref (dwg, 5, h0->absolute_ref, NULL);
  int e = dwg_write_file (argv[2], dwg);
  fprintf (stderr, "%ld entidades, dwg_write_file = %d\n", n, e);
  return e >= 0x80 ? 1 : 0;
}
