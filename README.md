# site-mercadoapple

Site da Mercado Apple Brasil (mercadoapplebrasil.com.br), publicado pelo GitHub Pages a partir do branch `main`.

## Como mudar o site

1. Edite `tools/index.src.html` (texto e visual), `assets/app.js` (montador, Natal, sons) ou as listas em `tools/build.py` (vitrine e presentes).
2. Rode `python3 tools/build.py`. Ele gera o `index.html`, o `sitemap.xml` e o `assets/app.<hash>.js` minificado.
3. Rode `python3 tools/check.py`. Ele confere arquivos citados, âncoras, dados pro Google e se o build está em dia.
4. Faça o commit e o push. O GitHub repete a conferência a cada push (aba Actions).

Nunca edite o `index.html` nem o `assets/app.<hash>.js` na mão: o build escreve por cima.

## O que protege o site

- O nome do JavaScript muda quando o conteúdo muda, então ninguém fica com versão velha em cache.
- A página só aceita script e conexão do próprio site (Content-Security-Policy).
- Campanhas com data (Natal) ligam e desligam sozinhas pelo relógio de Brasília.
