"""Carimba um número de versão em todos os arquivos JS/CSS do site.

Rode antes de publicar uma mudança:  python3 scripts/versao.py
Assim o navegador nunca mistura arquivos novos com arquivos antigos guardados.
"""
import pathlib
import re
import time

raiz = pathlib.Path(__file__).resolve().parent.parent
versao = time.strftime('%Y%m%d%H%M')

# imports entre módulos: from './util.js' / from './util.js?v=...'
padrao_js = re.compile(r"""(from\s+['"]\./[\w-]+\.js)(\?v=\w+)?(['"])""")
# páginas: src="js/x.js" e href="css/style.css"
padrao_html = re.compile(r"""((?:src|href)="(?:js|css)/[\w-]+\.(?:js|css))(\?v=\w+)?(")""")

for arquivo in sorted(raiz.glob('js/*.js')):
    texto = arquivo.read_text(encoding='utf-8')
    novo = padrao_js.sub(lambda m: f'{m.group(1)}?v={versao}{m.group(3)}', texto)
    if novo != texto:
        arquivo.write_text(novo, encoding='utf-8')

for arquivo in sorted(raiz.glob('*.html')):
    texto = arquivo.read_text(encoding='utf-8')
    novo = padrao_html.sub(lambda m: f'{m.group(1)}?v={versao}{m.group(3)}', texto)
    if novo != texto:
        arquivo.write_text(novo, encoding='utf-8')

print('versão', versao)
