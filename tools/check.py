#!/usr/bin/env python3
"""Confere o site antes de publicar. Sai com erro se achar algo quebrado.

- todo arquivo citado no index.html, 404.html e manifest existe (imagem, script, ícone)
- toda âncora interna (#secao) aponta pra um id que existe, e nenhum id se repete
- os blocos de dados pro Google (JSON-LD) e o manifest são JSON válido
- toda <img> tem largura e altura (a página não pula ao carregar)
- o index.html publicado é o que tools/build.py gera hoje (ninguém esqueceu de rodar o build)
Uso: python3 tools/check.py
"""
import json, os, re, sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
erros = []


def ler(nome):
    return open(os.path.join(RAIZ, nome), encoding="utf-8").read()


pagina = ler("index.html")

for nome in ("index.html", "404.html"):
    html = ler(nome)
    refs = set(re.findall(r'(?:src|href)="([^"#?]+)', html))
    for s in re.findall(r'srcset="([^"]+)"', html):
        refs.update(p.strip().split(" ")[0] for p in s.split(","))
    for r in refs:
        if re.match(r"^(https?:|mailto:|tel:|data:)", r):
            continue
        if not os.path.isfile(os.path.join(RAIZ, r.lstrip("/") or "index.html")):
            erros.append(f"{nome}: arquivo não existe: {r}")

ids = re.findall(r'\sid="([^"]+)"', pagina)
for i in sorted({i for i in ids if ids.count(i) > 1}):
    erros.append(f"id repetido: {i}")
for a in set(re.findall(r'href="#([^"]+)"', pagina)):
    if a not in ids:
        erros.append(f"âncora sem destino: #{a}")

for bloco in re.findall(r'<script type="application/ld\+json">(.*?)</script>', pagina, flags=re.S):
    try:
        json.loads(bloco)
    except ValueError as e:
        erros.append(f"JSON-LD inválido: {e}")
try:
    man = json.loads(ler("manifest.webmanifest"))
    for ic in man.get("icons", []):
        if not os.path.isfile(os.path.join(RAIZ, ic["src"])):
            erros.append(f"manifest: ícone não existe: {ic['src']}")
except ValueError as e:
    erros.append(f"manifest inválido: {e}")

for tag in re.findall(r"<img\b[^>]*>", pagina):
    if " width=" not in tag or " height=" not in tag:
        erros.append(f"img sem largura/altura: {tag[:80]}")

og = re.search(r'property="og:image" content="https://mercadoapplebrasil\.com\.br/([^"]+)"', pagina)
if not og or not os.path.isfile(os.path.join(RAIZ, og.group(1))):
    erros.append("imagem de compartilhamento (og:image) não existe")

if "--sem-build" not in sys.argv:
    sys.path.insert(0, os.path.join(RAIZ, "tools"))
    import build
    antes_js = sorted(f for f in os.listdir(os.path.join(RAIZ, "assets")) if f.startswith("app.") and f != "app.js")
    build.main()
    depois_js = sorted(f for f in os.listdir(os.path.join(RAIZ, "assets")) if f.startswith("app.") and f != "app.js")
    if ler("index.html") != pagina or antes_js != depois_js:
        erros.append("index.html está desatualizado: rode python3 tools/build.py e publique de novo")

if erros:
    print("\n".join("ERRO  " + e for e in erros))
    sys.exit(1)
print("ok: site conferido")
