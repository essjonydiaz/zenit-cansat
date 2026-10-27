import markdown, os, re, asyncio
from playwright.async_api import async_playwright
A=os.path.dirname(os.path.abspath(__file__))
md=open(os.path.join(A,'README.md'),encoding='utf-8').read()
html=markdown.markdown(md, extensions=['tables'])
html=re.sub(r'src="(salida/[^"]+)"', lambda m: f'src="file://{A}/{m.group(1)}"', html)
css='''@page{size:Letter;margin:15mm 14mm}
body{font-family:"Inter","DejaVu Sans",sans-serif;font-size:10pt;color:#111;line-height:1.42}
h1{font-size:19pt;margin:0 0 6pt;border-bottom:2px solid #1f3a6b;padding-bottom:5pt}
h2{font-size:13pt;color:#1f3a6b;margin:14pt 0 5pt;page-break-after:avoid}
table{border-collapse:collapse;width:100%;font-size:8.8pt;margin:4pt 0 8pt}
th,td{border:0.6pt solid #aaa;padding:3pt 5pt;text-align:left;vertical-align:top}
th{background:#e8edf5} tr{page-break-inside:avoid}
img{display:block;max-width:100%;max-height:105mm;margin:6pt auto;border-radius:4pt;page-break-inside:avoid}
code{font-family:"DejaVu Sans Mono",monospace;font-size:8.5pt;background:#f1f1f1;padding:0 2pt}
li{margin-bottom:2pt}'''
doc=f'<!doctype html><html lang="es"><head><meta charset="utf-8"><style>{css}</style></head><body>{html}</body></html>'
open('/tmp/claude-0/guia.html','w',encoding='utf-8').write(doc)
async def m():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page()
        await pg.goto('file:///tmp/claude-0/guia.html'); await pg.wait_for_timeout(800)
        await pg.pdf(path=os.path.join(A,'salida','Zenit_CanSat_diseno_completo.pdf'), format='Letter', print_background=True,
                     display_header_footer=True, header_template='<span></span>',
                     footer_template='<div style="font-size:7pt;width:100%;text-align:center;color:#666">Zénit · CanSat 2026 · Diseño completo v1 · <span class="pageNumber"></span>/<span class="totalPages"></span></div>')
        await b.close()
asyncio.run(m()); print('ok')
