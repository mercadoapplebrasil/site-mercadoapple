#!/usr/bin/env python3
"""Monta o index.html a partir de tools/index.src.html.

Troca o marcador <!--VITRINE--> pelos cards de produto, com as fotos em WebP
(2 tamanhos) e JPG de reserva, sempre com largura e altura fixas.
Para mudar a vitrine, edite só a lista VITRINE abaixo e rode:  python3 tools/build.py
"""
import html, json, os
from PIL import Image

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# aba, nome, descrição, foto, cor de fundo, tema do texto, encaixe da foto, alvo no montador (categoria, modelo opcional)
VITRINE = [
    ("iphone", "iPhone 18 Pro e 18 Pro Max", "Bordô, Prata, Azul Glacial e Preto", "iphone-18-pro", "#f6f6f8", "claro", "contain", ("iphone", None)),
    ("iphone", "iPhone Air", "O iPhone mais fino que a Apple já fez", "iphone-air", "#fafafa", "claro", "contain", ("iphone", "iPhone Air")),
    ("iphone", "iPhone 17e", "O iPhone novo mais em conta", "iphone-17e", "#ffffff", "claro", "cover-top", ("iphone", "iPhone 17e")),
    ("iphone", "iPhone 16", "Preto, Branco, Rosa, Verde-acinzentado e Ultramarino", "iphone-16", "#f5f5f7", "claro", "contain", ("iphone", "iPhone 16")),
    ("iphone", "iPhone Duo", "O iPhone que dobra", "iphone-duo", "#ffffff", "claro", "cover-top", ("iphone", "iPhone Duo")),
    ("watch", "Apple Watch Series 12", "42 e 46 mm", "watch-series-12", "#000000", "escuro", "contain", ("watch", "Apple Watch Series 12")),
    ("watch", "Apple Watch Ultra", "O mais resistente, pra esporte e aventura", "watch-ultra-4", "#000000", "escuro", "contain", ("watch", "Apple Watch Ultra")),
    ("watch", "Apple Watch SE 3", "40 e 44 mm, ótimo pra começar", "watch-se-3", "#ffffff", "claro", "contain", ("watch", "Apple Watch SE 3")),
    ("airpods", "AirPods Pro 3", "Cancelamento de ruído ativo", "airpods-pro", "#f3f3f5", "claro", "contain", ("airpods", "AirPods Pro 3")),
    ("airpods", "AirPods 5", "Leves, pra usar o dia todo", "airpods-5", "#ffffff", "claro", "contain", ("airpods", "AirPods 5")),
    ("airpods", "AirPods Max", "Som de estúdio, com USB-C", "airpods-max-2", "#ffffff", "claro", "cover-top", ("airpods", "AirPods Max")),
    ("ipad", "iPad Air M4", "11 e 13 polegadas", "ipad-air-m4", "#c9e4ef", "claro", "cover-top", ("ipad", None)),
    ("ipad", "iPad A16", "Azul, Rosa, Amarelo e Prata", "ipad-a16", "#ffffff", "claro", "cover-top", ("ipad", 'iPad A16 11"')),
    ("ipad", "iPad mini", "Cabe numa mão", "ipad-mini", "#f5f5f5", "claro", "cover-top", ("ipad", "iPad mini")),
    ("ipad", "iPad Pro M5", "O iPad mais poderoso", "ipad-pro", "#000000", "escuro", "contain", ("ipad", None)),
    ("ipad", "Apple Pencil", "Pencil Pro e Pencil USB-C", "apple-pencil", "#000000", "escuro", "cover-top", ("ipad", "Apple Pencil")),
    ("mac", "MacBook Air M5", "13 e 15 polegadas", "macbook-air", "#dfecf5", "claro", "cover-top", ("mac", None)),
    ("mac", "MacBook Neo", "O MacBook mais em conta", "macbook-neo", "#f5f5f5", "claro", "cover-top", ("mac", 'MacBook Neo 13"')),
    ("mac", "MacBook Pro", "14 e 16 polegadas, chips M5", "macbook-pro", "#000000", "escuro", "contain", ("mac", None)),
    ("mac", "Mac mini", "Pequeno e potente", "mac-mini-m6", "#f8f7f3", "claro", "contain", ("mac", "Mac mini")),
    ("mais", "Relógios Garmin", "Forerunner, Venu, Vivoactive, Instinct e Fenix", None, None, "texto", None, ("garmin", None)),
    ("mais", "Acessórios", "Carregador, cabo, capinha, película e AirTag", None, None, "texto", None, ("mais", None)),
    ("mais", "Seminovos", "iPhone seminovo com 90 dias de garantia da loja", None, None, "texto", None, ("iphone", "iPhone seminovo")),
]

ABAS = [("iphone", "iPhone"), ("watch", "Apple Watch"), ("airpods", "AirPods"), ("ipad", "iPad"), ("mac", "Mac"), ("mais", "Garmin e mais")]


def esc(s):
    return html.escape(s, quote=True)


def foto(nome, fit, primeira):
    im = Image.open(os.path.join(RAIZ, "img", nome + ".jpg"))
    w, h = im.size
    cls = "corta" if fit == "cover-top" else ""
    carregar = 'fetchpriority="high"' if primeira else 'loading="lazy"'
    return (
        f'<picture><source type="image/webp" srcset="img/w/{nome}-480.webp 480w, img/w/{nome}-960.webp {min(960, w)}w" '
        f'sizes="(min-width: 980px) 260px, 78vw">'
        f'<img src="img/{nome}.jpg" alt="" width="{w}" height="{h}" {carregar} decoding="async"'
        f'{(" class=" + chr(34) + cls + chr(34)) if cls else ""}></picture>'
    )


def card(item, primeira):
    aba, nome, desc, img, bg, tema, fit, (cat, modelo) = item
    alvo = f'data-cat="{cat}"' + (f' data-m="{esc(modelo)}"' if modelo else "")
    if tema == "texto":
        return (f'<article class="card texto"><div class="cTxt"><h3>{esc(nome)}</h3><p>{esc(desc)}</p>'
                f'<button type="button" class="cBtn" {alvo}>Montar orçamento</button></div></article>')
    return (f'<article class="card {tema}" style="--bg:{bg}"><div class="cFoto">{foto(img, fit, primeira)}'
            f'<span class="selo">Preço de Black</span></div>'
            f'<div class="cTxt"><h3>{esc(nome)}</h3><p>{esc(desc)}</p>'
            f'<button type="button" class="cBtn" {alvo}>Montar orçamento</button></div></article>')


def vitrine():
    tabs, paineis = [], []
    for i, (aba, rot) in enumerate(ABAS):
        sel = "true" if i == 0 else "false"
        tabs.append(f'<button type="button" role="tab" id="t-{aba}" aria-controls="p-{aba}" aria-selected="{sel}"'
                    f'{"" if i == 0 else " tabindex=" + chr(34) + "-1" + chr(34)}>{rot}</button>')
        itens = [card(v, i == 0 and k == 0) for k, v in enumerate(x for x in VITRINE if x[0] == aba)]
        paineis.append(f'<div class="trilho" role="tabpanel" id="p-{aba}" aria-labelledby="t-{aba}" tabindex="0"'
                       f'{"" if i == 0 else " hidden"}>{"".join(itens)}</div>')
    return (f'<div class="abas" role="tablist" aria-label="Categorias de produto">{"".join(tabs)}</div>'
            + "".join(paineis))


def main():
    src = open(os.path.join(RAIZ, "tools", "index.src.html"), encoding="utf-8").read()
    out = src.replace("<!--VITRINE-->", vitrine())
    open(os.path.join(RAIZ, "index.html"), "w", encoding="utf-8").write(out)
    print("index.html:", len(out.encode()), "bytes")


if __name__ == "__main__":
    main()
