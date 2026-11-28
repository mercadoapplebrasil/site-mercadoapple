/* Mercado Apple Brasil: vitrine, montador de orçamento e mensagem de WhatsApp.
   O site não mostra preço: tudo termina numa mensagem pronta pro WhatsApp da loja.
   Para mudar modelos do montador, edite só CATALOGO. Para mudar a vitrine, edite tools/build.py. */
(function () {
  "use strict";

  var FONE = "5519998899974";
  // Natal em horário de Brasília: até 16/12 vale "peça e receba antes do Natal"; até 24/12, presente de última hora.
  // Depois do Natal a faixa e a seção de presentes somem sozinhas.
  var NATAL_PRAZO = Date.parse("2026-12-16T23:59:59-03:00");
  var NATAL_FIM = Date.parse("2026-12-24T23:59:59-03:00");
  var CHAVE = "ma-pedido-v1";

  function natalFase() { var a = Date.now(); return a <= NATAL_PRAZO ? 1 : a <= NATAL_FIM ? 2 : 0; }
  var calmo = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  function $(id) { return document.getElementById(id); }
  function rolar(el, bloco) { if (el) el.scrollIntoView({ behavior: calmo ? "auto" : "smooth", block: bloco || "start" }); }

  // ---------- Som e movimento: curtos, só em resposta a um toque. Respeitam "reduzir movimento" e,
  // no iPhone, a chave do silencioso (o som do navegador fica mudo com ela).
  var Som = (function () {
    var ctx = null, ligado = true;
    try { ligado = localStorage.getItem("ma-som") !== "0"; } catch (e) { /* segue com som */ }
    function ac() {
      if (!ctx) {
        var C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
        try { if (navigator.audioSession) navigator.audioSession.type = "ambient"; } catch (e) { /* opcional */ }
        try { ctx = new C(); } catch (e) { return null; }
      }
      if (ctx.state === "suspended" && ctx.resume) ctx.resume();
      return ctx;
    }
    function tom(f0, f1, dur, tipo, vol, atraso) {
      var c = ac(); if (!c) return;
      var t = c.currentTime + (atraso || 0), o = c.createOscillator(), g = c.createGain();
      o.type = tipo || "sine"; o.frequency.setValueAtTime(f0, t);
      if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + 0.03);
    }
    function sopro(dur, vol) {
      var c = ac(); if (!c) return;
      var t = c.currentTime, n = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
      for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      var s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = buf; f.type = "bandpass"; f.Q.value = 0.9;
      f.frequency.setValueAtTime(450, t); f.frequency.exponentialRampToValueAtTime(3800, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.35); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f); f.connect(g); g.connect(c.destination); s.start(t); s.stop(t + dur);
    }
    // Escala pentatônica: cada item que entra no pedido sobe uma nota.
    var NOTAS = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51];
    function tocar(fn) { if (!ligado) return; try { fn(); } catch (e) { /* som nunca trava o pedido */ } }
    return {
      ligado: function () { return ligado; },
      ligar: function (v) { ligado = v; try { localStorage.setItem("ma-som", v ? "1" : "0"); } catch (e) { /* ok */ } },
      poe: function (n) {
        tocar(function () {
          var f = NOTAS[Math.max(0, Math.min(n - 1, NOTAS.length - 1))];
          tom(f * 0.8, f, 0.09, "triangle", 0.09); tom(f * 2, 0, 0.16, "sine", 0.03, 0.03);
          if (navigator.vibrate) navigator.vibrate(8);
        });
      },
      tira: function () { tocar(function () { tom(620, 300, 0.13, "triangle", 0.07); }); },
      toque: function () { tocar(function () { tom(1500, 0, 0.035, "triangle", 0.035); }); },
      envia: function () { tocar(function () { sopro(0.22, 0.06); tom(783.99, 0, 0.14, "sine", 0.07, 0.07); tom(1174.66, 0, 0.22, "sine", 0.06, 0.15); }); },
      limpa: function () { tocar(function () { tom(880, 196, 0.32, "triangle", 0.06); }); }
    };
  })();
  function bump(el, cls) {
    cls = cls || "bump"; if (!el || calmo) return;
    el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
  }
  // Onde o elemento fica quando a barra termina de subir (o getBoundingClientRect pegaria a barra no meio da animação).
  function caixaFinal(el) {
    var x = 0, y = 0, n = el, fixo = false;
    while (n) { x += n.offsetLeft; y += n.offsetTop; if (getComputedStyle(n).position === "fixed") { fixo = true; break; } n = n.offsetParent; }
    if (!fixo) { x -= window.scrollX; y -= window.scrollY; }
    return { left: x, top: y, width: el.offsetWidth, height: el.offsetHeight, bottom: y + el.offsetHeight };
  }
  // Um pontinho voa do botão tocado até o pedido (balão do WhatsApp ou barra de baixo), em arco.
  function voar(r, para, semBump) {
    if (calmo || !r || !para || !document.body.animate) return;
    var b = para.closest && para.closest(".barra") ? caixaFinal(para) : para.getBoundingClientRect();
    if (!b.width || b.bottom < 0 || b.top > window.innerHeight) return;
    var x0 = r.left + r.width / 2, y0 = r.top + r.height / 2, x1 = b.left + Math.min(b.width / 2, 48), y1 = b.top + Math.min(b.height / 2, 24);
    var my = Math.min(y0, y1) - 90, p = document.createElement("i"), q = document.createElement("i");
    p.className = "voo"; q.className = "vooPonto"; p.setAttribute("aria-hidden", "true"); p.appendChild(q); document.body.appendChild(p);
    p.animate([{ transform: "translateX(" + x0 + "px)" }, { transform: "translateX(" + x1 + "px)" }], { duration: 560, easing: "cubic-bezier(.4,0,.6,1)", fill: "forwards" });
    q.animate([
      { transform: "translateY(" + y0 + "px) scale(1)", easing: "cubic-bezier(.2,.7,.4,1)" },
      { transform: "translateY(" + my + "px) scale(1.15)", offset: 0.42, easing: "cubic-bezier(.6,0,.8,.4)" },
      { transform: "translateY(" + y1 + "px) scale(.35)", opacity: 0.35 }
    ], { duration: 560, fill: "forwards" }).onfinish = function () { p.remove(); if (!semBump) bump(para); };
  }

  // ---------- Catálogo do montador (sem preço; o orçamento sai pelo WhatsApp)
  var GB3 = ["256GB", "512GB", "1TB"], GB4 = ["256GB", "512GB", "1TB", "2TB"];
  var CATALOGO = [
    { id: "iphone", nome: "iPhone", desc: "Linha 18, 17, Air, Duo e seminovos", pergunta: "Qual iPhone você quer?", opRot: "quantos GB?", modelos: [
      { n: "iPhone Duo", ops: GB4 }, { n: "iPhone 18 Pro Max", ops: GB4 }, { n: "iPhone 18 Pro", ops: GB4 }, { n: "iPhone Air", ops: GB3 },
      { n: "iPhone 17 Pro Max", ops: GB4 }, { n: "iPhone 17 Pro", ops: GB3 }, { n: "iPhone 17", ops: ["256GB", "512GB"] }, { n: "iPhone 17e", ops: ["256GB", "512GB"] },
      { n: "iPhone 16", ops: ["128GB", "256GB", "512GB"] }, { n: "iPhone 16e", ops: ["128GB", "256GB", "512GB"] }, { n: "iPhone 15", ops: ["128GB", "256GB", "512GB"] },
      { n: "iPhone seminovo" }, { n: "Ainda não sei, quero ajuda", ajuda: true }] },
    { id: "ipad", nome: "iPad", desc: "iPad, mini, Air, Pro e Pencil", pergunta: "Qual iPad você quer?", opRot: "quantos GB?", modelos: [
      { n: "iPad A16 11\"", ops: ["128GB", "256GB", "512GB"] }, { n: "iPad mini", ops: ["128GB", "256GB", "512GB"] },
      { n: "iPad Air M4 11\"", ops: ["128GB", "256GB", "512GB", "1TB"] }, { n: "iPad Air M4 13\"", ops: ["128GB", "256GB", "512GB", "1TB"] },
      { n: "iPad Pro M5 11\"", ops: GB4 }, { n: "iPad Pro M5 13\"", ops: GB4 },
      { n: "Apple Pencil", ops: ["Pencil Pro", "Pencil USB-C"] }, { n: "Magic Keyboard para iPad" }, { n: "Ainda não sei, quero ajuda", ajuda: true }] },
    { id: "mac", nome: "Mac", desc: "MacBook, Mac mini e iMac", pergunta: "Qual Mac você quer?", opRot: "qual configuração?", modelos: [
      { n: "MacBook Neo 13\"", ops: ["8GB · 256GB", "Outra configuração"] },
      { n: "MacBook Air M5 13\"", ops: ["16GB · 512GB", "16GB · 1TB", "24GB · 1TB"] },
      { n: "MacBook Air M5 15\"", ops: ["16GB · 512GB", "Outra configuração"] },
      { n: "MacBook Pro 14\"", ops: ["M5 · 16GB · 1TB", "M5 · 32GB · 1TB", "M5 Pro · 24GB · 1TB", "M5 Pro · 24GB · 2TB"] },
      { n: "MacBook Pro 16\"", ops: ["M5 Pro · 24GB · 1TB", "M5 Pro · 48GB · 1TB", "M5 Max · 36GB · 2TB"] },
      { n: "Mac mini", ops: ["M6 · 16GB · 256GB", "M4 · 16GB · 512GB", "Outra configuração"] },
      { n: "iMac" }, { n: "Mac Studio" }, { n: "Ainda não sei, quero ajuda", ajuda: true }] },
    { id: "watch", nome: "Apple Watch", desc: "SE, Series e Ultra", pergunta: "Qual Apple Watch você quer?", opRot: "qual tamanho?", modelos: [
      { n: "Apple Watch SE 3", ops: ["40mm", "44mm"] }, { n: "Apple Watch Series 12", ops: ["42mm", "46mm"] }, { n: "Apple Watch Ultra" },
      { n: "Apple Watch seminovo" }, { n: "Ainda não sei, quero ajuda", ajuda: true }] },
    { id: "airpods", nome: "AirPods", desc: "AirPods, Pro e Max", pergunta: "Qual AirPods você quer?", modelos: [
      { n: "AirPods 4" }, { n: "AirPods 5" }, { n: "AirPods Pro 3" }, { n: "AirPods Max" }] },
    { id: "garmin", nome: "Garmin", desc: "Forerunner, Venu, Instinct e Fenix", pergunta: "Qual Garmin você quer?", opRot: "qual versão?", modelos: [
      { n: "Forerunner 55" }, { n: "Forerunner 165", ops: ["Normal", "Music"] }, { n: "Forerunner 170", ops: ["Normal", "Music"] },
      { n: "Forerunner 265", ops: ["265 (46mm)", "265S (42mm)"] }, { n: "Forerunner 570", ops: ["42mm", "47mm"] },
      { n: "Forerunner 965" }, { n: "Forerunner 970" }, { n: "Vivoactive 6" }, { n: "Venu 4", ops: ["41mm", "45mm"] },
      { n: "Instinct 3", ops: ["Solar", "AMOLED"] }, { n: "Fenix 8", ops: ["43mm", "47mm", "51mm"] },
      { n: "Ainda não sei, quero ajuda", ajuda: true }] },
    { id: "mais", nome: "Acessórios", desc: "Carregador, cabo, capinha e mais", pergunta: "O que você precisa?", opRot: "qual?", modelos: [
      { n: "Carregador USB-C" }, { n: "Cabo", ops: ["USB-C para USB-C", "USB-C para Lightning"] }, { n: "Capinha" }, { n: "Película" }, { n: "AirTag" },
      { n: "Magic Mouse" }, { n: "Magic Keyboard" }, { n: "Troca de bateria ou tela" }] }
  ];
  var PARCELAS = [6, 10, 12, 18, 21];

  // iPhones aceitos na avaliação de troca, com capacidades e cores oficiais (fonte: support.apple.com/pt-br/108044)
  var APPLE = {
    "iPhone 11": [["64GB", "128GB", "256GB"], ["Roxo", "Verde", "Amarelo", "Preto", "Branco", "(PRODUCT)RED"]],
    "iPhone 11 Pro": [["64GB", "256GB", "512GB"], ["Prateado", "Cinza-espacial", "Dourado", "Verde-meia-noite"]],
    "iPhone 11 Pro Max": [["64GB", "256GB", "512GB"], ["Prateado", "Cinza-espacial", "Dourado", "Verde-meia-noite"]],
    "iPhone 12 mini": [["64GB", "128GB", "256GB"], ["Preto", "Branco", "(PRODUCT)RED", "Verde", "Azul", "Roxo"]],
    "iPhone 12": [["64GB", "128GB", "256GB"], ["Preto", "Branco", "(PRODUCT)RED", "Verde", "Azul", "Roxo"]],
    "iPhone 12 Pro": [["128GB", "256GB", "512GB"], ["Prateado", "Grafite", "Dourado", "Azul-Pacífico"]],
    "iPhone 12 Pro Max": [["128GB", "256GB", "512GB"], ["Prateado", "Grafite", "Dourado", "Azul-Pacífico"]],
    "iPhone 13 mini": [["128GB", "256GB", "512GB"], ["(PRODUCT)RED", "Estelar", "Meia-noite", "Azul", "Rosa", "Verde"]],
    "iPhone 13": [["128GB", "256GB", "512GB"], ["(PRODUCT)RED", "Estelar", "Meia-noite", "Azul", "Rosa", "Verde"]],
    "iPhone 13 Pro": [["128GB", "256GB", "512GB", "1TB"], ["Grafite", "Dourado", "Prateado", "Azul-Sierra", "Verde-alpino"]],
    "iPhone 13 Pro Max": [["128GB", "256GB", "512GB", "1TB"], ["Grafite", "Dourado", "Prateado", "Azul-Sierra", "Verde-alpino"]],
    "iPhone SE (3ª geração)": [["64GB", "128GB", "256GB"], ["(PRODUCT)RED", "Estelar", "Meia-noite"]],
    "iPhone 14": [["128GB", "256GB", "512GB"], ["Meia-noite", "Estelar", "(PRODUCT)RED", "Azul", "Roxo", "Amarelo"]],
    "iPhone 14 Plus": [["128GB", "256GB", "512GB"], ["Meia-noite", "Estelar", "(PRODUCT)RED", "Azul", "Roxo", "Amarelo"]],
    "iPhone 14 Pro": [["128GB", "256GB", "512GB", "1TB"], ["Prateado", "Dourado", "Preto-espacial", "Roxo-profundo"]],
    "iPhone 14 Pro Max": [["128GB", "256GB", "512GB", "1TB"], ["Prateado", "Dourado", "Preto-espacial", "Roxo-profundo"]],
    "iPhone 15": [["128GB", "256GB", "512GB"], ["Preto", "Azul", "Verde", "Amarelo", "Rosa"]],
    "iPhone 15 Plus": [["128GB", "256GB", "512GB"], ["Preto", "Azul", "Verde", "Amarelo", "Rosa"]],
    "iPhone 15 Pro": [["128GB", "256GB", "512GB", "1TB"], ["Titânio preto", "Titânio branco", "Titânio azul", "Titânio natural"]],
    "iPhone 15 Pro Max": [["256GB", "512GB", "1TB"], ["Titânio preto", "Titânio branco", "Titânio azul", "Titânio natural"]],
    "iPhone 16e": [["128GB", "256GB", "512GB"], ["Preto", "Branco"]],
    "iPhone 16": [["128GB", "256GB", "512GB"], ["Preto", "Branco", "Rosa", "Verde-acinzentado", "Ultramarino"]],
    "iPhone 16 Plus": [["128GB", "256GB", "512GB"], ["Preto", "Branco", "Rosa", "Verde-acinzentado", "Ultramarino"]],
    "iPhone 16 Pro": [["128GB", "256GB", "512GB", "1TB"], ["Titânio preto", "Titânio branco", "Titânio natural", "Titânio-deserto"]],
    "iPhone 16 Pro Max": [["256GB", "512GB", "1TB"], ["Titânio preto", "Titânio branco", "Titânio natural", "Titânio-deserto"]],
    "iPhone 17e": [["256GB", "512GB"], ["Preto", "Branco", "Rosa-pálido"]],
    "iPhone 17": [["256GB", "512GB"], ["Preto", "Branco", "Azul-névoa", "Sálvia", "Lavanda"]],
    "iPhone Air": [["256GB", "512GB", "1TB"], ["Preto-espacial", "Branco-nuvem", "Dourado-claro", "Azul-céu"]],
    "iPhone 17 Pro": [["256GB", "512GB", "1TB"], ["Prateado", "Laranja-cósmico", "Azul-intenso"]],
    "iPhone 17 Pro Max": [["256GB", "512GB", "1TB", "2TB"], ["Prateado", "Laranja-cósmico", "Azul-intenso"]],
    "iPhone 18 Pro": [["256GB", "512GB", "1TB", "2TB"], ["Preto", "Prateado", "Glacial", "Bordô"]],
    "iPhone 18 Pro Max": [["256GB", "512GB", "1TB", "2TB"], ["Preto", "Prateado", "Glacial", "Bordô"]],
    "iPhone Duo": [["256GB", "512GB", "1TB", "2TB"], ["Céu noturno", "Branco-estrela"]]
  };
  var CORES_GERAL = ["Preto", "Branco", "Prateado", "Dourado", "Azul", "Verde", "Rosa", "Roxo", "Vermelho", "Amarelo"];

  // ---------- Estado
  var escolhidos = [];             // itens {n, cat, base}
  var pag = "pix", vezes = 12, meio = "Maquininha na loja", aberta = null, modeloAberto = null;
  var troca = { on: false, gb: "", face: "", estado: "", reparo: "" };

  var elCats = $("cats"), elMod = $("modelos"), elVazio = $("vazio"), elTitulo = $("tituloModelos"),
      elEnviar = $("enviar"), elNome = $("nome"), elBalao = $("balao"), elTexto = $("waTexto");

  function catPorId(id) { return CATALOGO.filter(function (c) { return c.id === id; })[0]; }
  function nomeItem(m, cat) { return m.ajuda ? cat.nome + " (quero ajuda pra escolher)" : m.n; }
  function pos(nome) { for (var i = 0; i < escolhidos.length; i++) if (escolhidos[i].n === nome) return i; return -1; }
  function botao(cls, txt, on) {
    var b = document.createElement("button"); b.type = "button"; b.className = cls; b.textContent = txt;
    b.setAttribute("aria-pressed", on ? "true" : "false"); return b;
  }
  function temIphone() { return escolhidos.some(function (i) { return i.cat === "iphone"; }); }

  // ---------- Desenho
  function desenharCats() {
    elCats.innerHTML = "";
    CATALOGO.forEach(function (cat) {
      var n = escolhidos.filter(function (i) { return i.cat === cat.id; }).length;
      var b = botao("cat", "", aberta === cat.id);
      var t = document.createElement("b"); t.textContent = cat.nome;
      var s = document.createElement("span"); s.textContent = n ? n + (n > 1 ? " escolhidos" : " escolhido") : cat.desc; if (n) s.className = "n";
      b.appendChild(t); b.appendChild(s);
      b.addEventListener("click", function () { Som.toque(); aberta = cat.id; modeloAberto = null; desenharCats(); desenharModelos(); rolar($("passo2")); });
      elCats.appendChild(b);
    });
  }

  function desenharModelos() {
    var cat = catPorId(aberta), elOp = $("opcoes");
    elMod.innerHTML = ""; elOp.hidden = true;
    if (!cat) { elVazio.hidden = false; elTitulo.textContent = "Qual modelo?"; return; }
    elVazio.hidden = true; elTitulo.textContent = cat.pergunta;
    cat.modelos.forEach(function (m) {
      var nome = nomeItem(m, cat);
      var marcado = m.ops ? escolhidos.some(function (i) { return i.base === m.n; }) : pos(nome) > -1;
      var b = botao("chip", m.n, marcado);
      if (m.ops) {
        b.setAttribute("aria-expanded", modeloAberto === m.n ? "true" : "false");
        if (modeloAberto === m.n) b.className += " aberto";
        b.addEventListener("click", function () {
          Som.toque(); modeloAberto = modeloAberto === m.n ? null : m.n; desenharModelos();
          if (modeloAberto) rolar($("opcoes"), "nearest");
        });
      } else {
        b.setAttribute("data-nome", nome);
        b.addEventListener("click", function () { var r = b.getBoundingClientRect(); modeloAberto = null; alternar(nome, cat, m.n, r); });
      }
      elMod.appendChild(b);
    });
    var m = cat.modelos.filter(function (x) { return x.n === modeloAberto; })[0];
    if (m) {
      elOp.hidden = false;
      $("opTitulo").textContent = m.n + ": " + (cat.opRot || "qual?");
      var elC = $("opChips"); elC.innerHTML = "";
      m.ops.forEach(function (op) {
        var nome = m.n + " " + op, b = botao("chip", op, pos(nome) > -1);
        b.setAttribute("data-nome", nome);
        b.addEventListener("click", function () { alternar(nome, cat, m.n, b.getBoundingClientRect()); });
        elC.appendChild(b);
      });
    }
  }

  function alvo() { if (waNaTela) return elBalao; var b = $("barra"); return b && !b.hidden ? $("barraQtd") : null; }
  function alternar(nome, cat, base, r) {
    var i = pos(nome);
    if (i > -1) escolhidos.splice(i, 1); else escolhidos.push({ n: nome, cat: cat.id, base: base });
    desenharCats(); desenharModelos(); atualizar(i < 0);
    if (i > -1) { Som.tira(); return; }
    Som.poe(escolhidos.length);
    [].forEach.call(document.querySelectorAll("#modelos .chip, #opChips .chip"), function (x) { if (x.getAttribute("data-nome") === nome) bump(x, "tique"); });
    voar(r, alvo(), waNaTela);
  }

  function desenharVezes() {
    var el = $("vezes"); el.innerHTML = "";
    PARCELAS.forEach(function (n) {
      var b = botao("chip", n + "x", vezes === n);
      b.addEventListener("click", function () { Som.toque(); vezes = n; desenharVezes(); atualizar(); });
      el.appendChild(b);
    });
  }

  function marcarGrupo(id, attr, valor) {
    [].forEach.call($(id).children, function (x) { x.setAttribute("aria-pressed", x.getAttribute(attr) === valor ? "true" : "false"); });
  }

  // ---------- Troca
  Object.keys(APPLE).concat(["Outro modelo"]).forEach(function (m) {
    var o = document.createElement("option"); o.textContent = m; $("tModelo").appendChild(o);
  });
  function preencherCores(manter) {
    var s = $("tCor"), modelo = $("tModelo").value;
    s.innerHTML = "";
    var o = document.createElement("option"); o.value = ""; o.textContent = modelo ? "Escolha a cor" : "Escolha o modelo antes"; s.appendChild(o);
    if (!modelo) return;
    (APPLE[modelo] ? APPLE[modelo][1] : CORES_GERAL).concat(["Outra cor"]).forEach(function (c) {
      var x = document.createElement("option"); x.textContent = c; s.appendChild(x);
    });
    if (manter) s.value = manter;
  }
  function preencherGb(manter) {
    var g = document.querySelector('#trocaForm [data-grupo="gb"]'), modelo = $("tModelo").value;
    var lista = APPLE[modelo] ? APPLE[modelo][0] : ["64GB", "128GB", "256GB", "512GB", "1TB"];
    g.innerHTML = ""; troca.gb = lista.indexOf(manter) > -1 ? manter : "";
    lista.forEach(function (x) { g.appendChild(botao("chip", x, x === troca.gb)); });
  }
  function linhasTroca() {
    if (!troca.on || !temIphone()) return [];
    var modelo = $("tModelo").value, cor = $("tCor").value.trim(), bat = $("tBat").value.trim();
    var l = [[modelo || "Modelo a informar", troca.gb, cor].filter(Boolean).join(" · ")];
    if (bat) l.push("Bateria: " + bat + "%");
    if (troca.face) l.push("Face ID: " + troca.face.toLowerCase());
    if (troca.estado) l.push("Tela e traseira: " + troca.estado.toLowerCase());
    if (troca.reparo) l.push("Reparo: " + troca.reparo.toLowerCase());
    return l;
  }
  function abrirTroca(on) {
    troca.on = on;
    $("trocaBtn").setAttribute("aria-pressed", on ? "true" : "false");
    $("trocaBtn").setAttribute("aria-expanded", on ? "true" : "false");
    $("trocaForm").hidden = !on;
  }

  // ---------- Mensagem (mesmo formato que a loja já recebe)
  function mensagem() {
    var nome = elNome.value.trim();
    var l = ["Olá! Vim pelo site e quero um orçamento" + (natalFase() ? " pro Natal" : "") + (nome ? ". Meu nome é " + nome + "." : ":"), ""];
    escolhidos.forEach(function (i) { l.push("• " + i.n); });
    l.push("");
    l.push(pag === "pix" ? "Pagamento: Pix" : "Pagamento: cartão em " + vezes + "x, " + meio.toLowerCase());
    var lt = linhasTroca();
    if (lt.length) { l.push("", "Tenho um iPhone para dar na troca:"); lt.forEach(function (x) { l.push("• " + x); }); }
    return l.join("\n");
  }

  var fmtHora = null; // criar o formatador custa caro em celular simples: cria uma vez só
  function horaSP() {
    try { fmtHora = fmtHora || new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }); return fmtHora.format(new Date()); }
    catch (e) { var d = new Date(); return ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2); }
  }

  function atualizar(animar) {
    $("wa").classList.remove("enviado");
    $("blocoTroca").hidden = !temIphone();
    var n = escolhidos.length;
    if (n) {
      elTexto.textContent = mensagem();
      elBalao.classList.remove("vazio");
    } else {
      elTexto.textContent = "Escolha os produtos e a sua mensagem se monta aqui.";
      elBalao.classList.add("vazio");
    }
    if (n) $("waHora").textContent = horaSP();
    if (animar && !calmo) { elBalao.classList.remove("novo"); void elBalao.offsetWidth; elBalao.classList.add("novo"); }
    elEnviar.disabled = !n;
    $("limpar").hidden = !n;
    $("barraQtd").textContent = n + (n > 1 ? " itens no pedido" : " item no pedido");
    $("barraItens").textContent = escolhidos.map(function (i) { return i.n; }).join(", ");
    barra();
    salvar();
  }

  function enviar() {
    if (!escolhidos.length) return;
    Som.envia(); bump($("wa"), "enviado");
    window.location.href = "https://wa.me/" + FONE + "?text=" + encodeURIComponent(mensagem());
  }

  // ---------- Guarda o pedido no aparelho (volta do Instagram e continua de onde parou)
  function nomesValidos() {
    var s = {};
    CATALOGO.forEach(function (cat) {
      cat.modelos.forEach(function (m) {
        if (m.ops) m.ops.forEach(function (op) { s[m.n + " " + op] = { cat: cat.id, base: m.n }; });
        else s[nomeItem(m, cat)] = { cat: cat.id, base: m.n };
      });
    });
    return s;
  }
  function salvar() {
    try {
      localStorage.setItem(CHAVE, JSON.stringify({
        e: escolhidos.map(function (i) { return i.n; }), p: pag, v: vezes, mi: meio, no: elNome.value,
        t: { on: troca.on, mo: $("tModelo").value, gb: troca.gb, cor: $("tCor").value, bat: $("tBat").value, face: troca.face, estado: troca.estado, reparo: troca.reparo }
      }));
    } catch (e) { /* navegação privada: segue sem guardar */ }
  }
  function carregar() {
    var s;
    try { s = JSON.parse(localStorage.getItem(CHAVE) || "null"); } catch (e) { s = null; }
    if (!s) return;
    var validos = nomesValidos();
    (s.e || []).forEach(function (n) { if (validos[n] && pos(n) < 0) escolhidos.push({ n: n, cat: validos[n].cat, base: validos[n].base }); });
    if (s.p === "cartao" || s.p === "pix") pag = s.p;
    if (PARCELAS.indexOf(s.v) > -1) vezes = s.v;
    if (s.mi === "Maquininha na loja" || s.mi === "Link de pagamento") meio = s.mi;
    if (typeof s.no === "string") elNome.value = s.no.slice(0, 60);
    var t = s.t || {};
    if (t.mo && (APPLE[t.mo] || t.mo === "Outro modelo")) { $("tModelo").value = t.mo; preencherCores(t.cor); preencherGb(t.gb); }
    if (typeof t.bat === "string") $("tBat").value = t.bat.slice(0, 3);
    ["face", "estado", "reparo"].forEach(function (k) {
      if (!t[k]) return;
      [].forEach.call(document.querySelectorAll('#trocaForm [data-grupo="' + k + '"] .chip'), function (b) {
        if (b.textContent === t[k]) { b.setAttribute("aria-pressed", "true"); troca[k] = t[k]; }
      });
    });
    if (t.on) abrirTroca(true);
  }
  function limpar() {
    Som.limpa();
    escolhidos = []; pag = "pix"; vezes = 12; meio = "Maquininha na loja"; aberta = null; modeloAberto = null;
    troca = { on: false, gb: "", face: "", estado: "", reparo: "" };
    elNome.value = ""; $("tModelo").value = ""; $("tBat").value = ""; preencherCores(); preencherGb();
    [].forEach.call(document.querySelectorAll('#trocaForm [data-grupo] .chip'), function (b) { b.setAttribute("aria-pressed", "false"); });
    abrirTroca(false); marcarGrupo("pag", "data-pag", pag); marcarGrupo("meio", "data-meio", meio);
    $("blocoCartao").hidden = true; desenharVezes(); desenharCats(); desenharModelos(); atualizar();
    rolar($("orcamento"));
  }

  // ---------- Barra fixa do pedido e atalho do WhatsApp
  var waNaTela = false, montadorNaTela = false;
  function barra() {
    var mostrar = escolhidos.length > 0 && !waNaTela;
    $("barra").hidden = !mostrar;
    $("fab").classList.toggle("some", mostrar || montadorNaTela);
  }
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (es) { waNaTela = es[0].isIntersecting; barra(); }, { threshold: 0.35 }).observe($("wa"));
    new IntersectionObserver(function (es) { montadorNaTela = es[0].isIntersecting; barra(); }, { rootMargin: "-30% 0px -30% 0px" }).observe($("orcamento"));
  }
  $("barraBtn").addEventListener("click", function (e) { e.preventDefault(); rolar($("wa"), "center"); });

  // ---------- Eventos do montador
  function grupo(id, attr, aoMudar) {
    $(id).addEventListener("click", function (e) {
      var b = e.target.closest(".chip"); if (!b) return;
      Som.toque(); marcarGrupo(id, attr, b.getAttribute(attr)); aoMudar(b.getAttribute(attr)); atualizar();
    });
  }
  grupo("pag", "data-pag", function (v) { pag = v; $("blocoCartao").hidden = v !== "cartao"; });
  grupo("meio", "data-meio", function (v) { meio = v; });
  $("trocaBtn").addEventListener("click", function () { Som.toque(); abrirTroca(!troca.on); atualizar(); });
  $("tModelo").addEventListener("change", function () { preencherCores(); preencherGb(); atualizar(); });
  [].forEach.call(document.querySelectorAll("#trocaForm [data-grupo]"), function (g) {
    g.addEventListener("click", function (e) {
      var b = e.target.closest(".chip"); if (!b) return;
      var k = g.getAttribute("data-grupo"), jaEra = b.getAttribute("aria-pressed") === "true";
      [].forEach.call(g.children, function (x) { x.setAttribute("aria-pressed", "false"); });
      if (!jaEra) b.setAttribute("aria-pressed", "true");
      Som.toque(); troca[k] = jaEra ? "" : b.textContent; atualizar();
    });
  });
  ["tCor", "tBat", "nome"].forEach(function (id) { $(id).addEventListener("input", function () { atualizar(); }); });
  elEnviar.addEventListener("click", enviar);
  $("limpar").addEventListener("click", limpar);

  // ---------- Vitrine: abas e cards que levam ao montador
  var abas = [].slice.call(document.querySelectorAll('[role="tab"]'));
  function abrirAba(t, foco) {
    abas.forEach(function (x) {
      var on = x === t;
      x.setAttribute("aria-selected", on ? "true" : "false"); x.tabIndex = on ? 0 : -1;
      $(x.getAttribute("aria-controls")).hidden = !on;
    });
    pilula(t);
    if (foco) t.focus();
  }
  var tabl = document.querySelector(".abas"), fundo = tabl ? tabl.querySelector(".abaFundo") : null;
  function pilula(t) {
    if (!fundo || !t || !t.offsetWidth) return;
    fundo.style.width = t.offsetWidth + "px"; fundo.style.height = t.offsetHeight + "px";
    fundo.style.transform = "translate(" + t.offsetLeft + "px," + t.offsetTop + "px)";
    tabl.classList.add("pilula");
  }
  function abaAtual() { return abas.filter(function (x) { return x.getAttribute("aria-selected") === "true"; })[0]; }
  // Mede a aba só quando o navegador estiver livre: medir na carga trava o primeiro toque em celular simples.
  (window.requestIdleCallback || function (f) { return setTimeout(f, 300); })(function () {
    pilula(abaAtual());
    requestAnimationFrame(function () { requestAnimationFrame(function () { if (tabl) tabl.classList.add("pronta"); }); });
  });
  var rz = 0;
  window.addEventListener("resize", function () { cancelAnimationFrame(rz); rz = requestAnimationFrame(function () { pilula(abaAtual()); }); });
  abas.forEach(function (t, i) {
    t.addEventListener("click", function () { if (t.getAttribute("aria-selected") !== "true") Som.toque(); abrirAba(t); });
    t.addEventListener("keydown", function (e) {
      var j = -1;
      if (e.key === "ArrowRight") j = (i + 1) % abas.length;
      else if (e.key === "ArrowLeft") j = (i - 1 + abas.length) % abas.length;
      else if (e.key === "Home") j = 0;
      else if (e.key === "End") j = abas.length - 1;
      if (j > -1) { e.preventDefault(); abrirAba(abas[j], true); }
    });
  });
  [].forEach.call(document.querySelectorAll(".cBtn"), function (b) {
    b.addEventListener("click", function () {
      var cat = catPorId(b.getAttribute("data-cat")), modelo = b.getAttribute("data-m");
      if (!cat) return;
      aberta = cat.id; modeloAberto = null;
      var m = modelo ? cat.modelos.filter(function (x) { return x.n === modelo; })[0] : null;
      var add = false;
      if (m && m.ops) modeloAberto = m.n;
      else if (m && pos(nomeItem(m, cat)) < 0) { escolhidos.push({ n: nomeItem(m, cat), cat: cat.id, base: m.n }); add = true; }
      desenharCats(); desenharModelos(); atualizar(add);
      if (add) Som.poe(escolhidos.length); else Som.toque();
      rolar(modeloAberto ? $("opcoes") : $("passo2"), modeloAberto ? "center" : "start");
    });
  });

  // ---------- Botão de som (fica guardado no aparelho)
  (function () {
    var el = $("som"); if (!el) return;
    function marcar() { var on = Som.ligado(); el.setAttribute("aria-pressed", on ? "true" : "false"); el.title = on ? "Desligar os sons" : "Ligar os sons"; }
    marcar();
    el.addEventListener("click", function () { Som.ligar(!Som.ligado()); marcar(); Som.toque(); });
  })();

  // ---------- Natal: a faixa muda de fase sozinha (dias até 16/12, depois última hora) e some depois do Natal
  (function () {
    var bar = $("natal"), tit = $("natalTit"), rel = $("natalRel"), sec = $("presentes");
    if (!bar) return;
    var f = natalFase();
    if (!f) { bar.hidden = true; if (sec) sec.hidden = true; return; }
    if (f === 2) {
      tit.textContent = "Presente de última hora? Chame no WhatsApp";
      rel.textContent = "Até 24/12, com embrulho na hora";
      bar.href = "https://wa.me/" + FONE + "?text=" + encodeURIComponent("Olá! Vim pelo site e quero um presente de Natal de última hora.");
      if ($("natalNota")) $("natalNota").textContent = "Presente de última hora: chame no WhatsApp pra ver o que tem a pronta entrega até 24/12. Todo presente sai embrulhado, com cartão de Natal.";
      return;
    }
    // Dias de calendário até 16/12, no fuso de Brasília. Não é urgente: espera o navegador ficar livre.
    (window.requestIdleCallback || function (fn) { return setTimeout(fn, 300); })(function () {
      try {
        var hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
        var dias = Math.round((Date.parse("2026-12-16") - Date.parse(hoje)) / 86400000);
        rel.textContent = dias > 1 ? "Faltam " + dias + " dias" : dias === 1 ? "Falta 1 dia" : "Último dia";
      } catch (e) { /* fica "Embrulho de presente grátis" */ }
    });
  })();

  // ---------- Loja aberta ou fechada agora (horário de Brasília)
  (function () {
    var alvo = $("status"); if (!alvo || !window.Intl) return;
    var DIAS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    var fmt = null;
    function agora() {
      var o = {};
      fmt = fmt || new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short", hour: "numeric", minute: "numeric", hour12: false });
      fmt.formatToParts(new Date()).forEach(function (p) { o[p.type] = p.value; });
      return { d: DIAS[o.weekday], min: (parseInt(o.hour, 10) % 24) * 60 + parseInt(o.minute, 10) };
    }
    function faixa(d) { return d === 0 ? [540, 780] : [540, 1260]; }
    function h(m) { return Math.floor(m / 60) + "h"; }
    function tic() {
      var a = agora(), f = faixa(a.d), aberto = a.min >= f[0] && a.min < f[1];
      alvo.textContent = aberto ? "Aberto agora, fecha às " + h(f[1])
        : a.min < f[0] ? "Fechado agora, abre hoje às " + h(f[0])
        : "Fechado agora, abre amanhã às " + h(faixa((a.d + 1) % 7)[0]);
      alvo.classList.toggle("aberto", aberto);
    }
    // Não é urgente: calcula quando o navegador estiver livre, pra não atrasar o primeiro toque.
    (window.requestIdleCallback || function (f) { return setTimeout(f, 300); })(function () {
      try { tic(); setInterval(tic, 60000); } catch (e) { /* fica o horário fixo */ }
    });
  })();

  // ---------- Início
  carregar();
  if (!document.querySelector('#trocaForm [data-grupo="gb"]').children.length) preencherGb();
  marcarGrupo("pag", "data-pag", pag); marcarGrupo("meio", "data-meio", meio);
  $("blocoCartao").hidden = pag !== "cartao";
  desenharCats(); desenharVezes(); desenharModelos(); atualizar();
})();
