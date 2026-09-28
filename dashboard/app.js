/* ============================================================
   Dashboard — Regresión logística Social Network Ads
   Depende de datos.js, que define MODELO y PUNTOS.
   ============================================================ */

(function () {
  'use strict';

  var B0 = MODELO.intercepto,
      B_EDAD = MODELO.edad,
      B_SAL = MODELO.salario,
      B_GEN = MODELO.genero;

  var genero = 0;            // 0 = Female, 1 = Male

  function el(id) { return document.getElementById(id); }

  var edad = el('edad'), salario = el('salario'), cutoff = el('cutoff');

  function fmtMoney(v) { return '$' + v.toLocaleString('en-US'); }

  function sigmoid(z) { return 1 / (1 + Math.exp(-z)); }

  // Contribución de cada término al logit z
  function termsFor(a, s, g) {
    return [
      { n: 'Intercepto', v: B0 },
      { n: 'Edad',       v: B_EDAD * a },
      { n: 'Salario',    v: B_SAL * s },
      { n: 'Género',     v: B_GEN * g }
    ];
  }

  /* ---------------- barras de contribución ---------------- */

  var termsBox = el('terms');

  function pintarTerminos(ts) {
    var max = 0;
    ts.forEach(function (t) { max = Math.max(max, Math.abs(t.v)); });
    max = max || 1;

    termsBox.innerHTML = '';
    ts.forEach(function (t) {
      var pos = t.v >= 0;
      var w = (Math.abs(t.v) / max) * 50;      // % de media pista

      var row = document.createElement('div');
      row.className = 'term';
      row.innerHTML =
        '<span class="tname">' + t.n + '</span>' +
        '<span class="tbar">' +
          '<span class="tzero" style="left:50%"></span>' +
          '<span class="tseg" style="left:' + (pos ? 50 : 50 - w) + '%;' +
            'width:' + w + '%;' +
            'background:' + (pos ? 'var(--buy)' : 'var(--nobuy)') + '"></span>' +
        '</span>' +
        '<span class="tval">' + (pos ? '+' : '−') + Math.abs(t.v).toFixed(3) + '</span>';
      termsBox.appendChild(row);
    });
  }

  /* ---------------- mapa de dispersión ---------------- */

  var SVG = 'http://www.w3.org/2000/svg';
  var M = { l: 46, r: 12, t: 12, b: 34 }, W = 520, H = 330;
  var PW = W - M.l - M.r, PH = H - M.t - M.b;
  var AX = [16, 62];        // eje x: edad
  var SY = [8, 158];        // eje y: salario en miles

  function px(a) { return M.l + (a - AX[0]) / (AX[1] - AX[0]) * PW; }
  function py(s) { return M.t + PH - (s - SY[0]) / (SY[1] - SY[0]) * PH; }

  var mapa = el('mapa');

  function construirMapa() {
    var f = document.createDocumentFragment();

    function add(tag, attrs, txt, padre) {
      var n = document.createElementNS(SVG, tag);
      for (var k in attrs) { n.setAttribute(k, attrs[k]); }
      if (txt != null) { n.textContent = txt; }
      (padre || f).appendChild(n);
      return n;
    }

    // recorte para que la frontera no se salga del área de dibujo
    var cp = add('clipPath', { id: 'cp' });
    add('rect', { x: M.l, y: M.t, width: PW, height: PH }, null, cp);

    add('rect', { x: M.l, y: M.t, width: PW, height: PH,
                  fill: 'var(--surface-2)', stroke: 'var(--line)', rx: 5 });

    [20, 30, 40, 50, 60].forEach(function (a) {
      add('line', { x1: px(a), y1: M.t, x2: px(a), y2: M.t + PH,
                    stroke: 'var(--line)', 'stroke-width': 1 });
      add('text', { x: px(a), y: M.t + PH + 15,
                    'text-anchor': 'middle', 'class': 'axis' }, a);
    });

    [25, 50, 75, 100, 125, 150].forEach(function (s) {
      add('line', { x1: M.l, y1: py(s), x2: M.l + PW, y2: py(s),
                    stroke: 'var(--line)', 'stroke-width': 1 });
      add('text', { x: M.l - 7, y: py(s) + 3,
                    'text-anchor': 'end', 'class': 'axis' }, s + 'k');
    });

    add('text', { x: M.l + PW / 2, y: H - 4,
                  'text-anchor': 'middle', 'class': 'axttl' }, 'Edad (años)');
    add('text', { x: 13, y: M.t + PH / 2, 'text-anchor': 'middle', 'class': 'axttl',
                  transform: 'rotate(-90 13 ' + (M.t + PH / 2) + ')' },
                  'Salario estimado');

    PUNTOS.forEach(function (p) {
      add('circle', { cx: px(p[0]), cy: py(p[1]), r: 3.1,
                      fill: p[2] ? 'var(--buy)' : 'var(--nobuy)',
                      'fill-opacity': 0.5 });
    });

    add('line', { id: 'frontera', 'clip-path': 'url(#cp)', stroke: 'var(--cut)',
                  'stroke-width': 2.2, 'stroke-dasharray': '7 4',
                  x1: 0, y1: 0, x2: 0, y2: 0 });
    add('circle', { id: 'yo-halo', r: 11, fill: 'none', stroke: 'var(--ink)',
                    'stroke-width': 1, 'stroke-opacity': 0.3, cx: 0, cy: 0 });
    add('circle', { id: 'yo', r: 6, fill: 'var(--surface)', stroke: 'var(--ink)',
                    'stroke-width': 2.5, cx: 0, cy: 0 });

    mapa.appendChild(f);
  }

  function actualizarMapa(a, sMiles, g, c) {
    // La frontera cumple: z = ln(c / (1 - c)), despejando el salario
    var L = Math.log(c / (1 - c));

    function salEn(age) {
      return ((L - B0 - B_EDAD * age - B_GEN * g) / B_SAL) / 1000;
    }

    var fr = el('frontera');
    fr.setAttribute('x1', px(AX[0]));
    fr.setAttribute('y1', py(salEn(AX[0])));
    fr.setAttribute('x2', px(AX[1]));
    fr.setAttribute('y2', py(salEn(AX[1])));

    var x = px(a), y = py(sMiles);
    ['yo', 'yo-halo'].forEach(function (id) {
      el(id).setAttribute('cx', x);
      el(id).setAttribute('cy', y);
    });
  }

  /* ---------------- ciclo principal ---------------- */

  function render() {
    var a = +edad.value, s = +salario.value, c = +cutoff.value;

    el('v-edad').textContent = a + (a === 1 ? ' año' : ' años');
    el('v-salario').textContent = fmtMoney(s);
    el('v-cutoff').textContent = c.toFixed(2);

    var ts = termsFor(a, s, genero);
    var z = ts.reduce(function (acc, t) { return acc + t.v; }, 0);
    var p = sigmoid(z);
    var compra = p >= c;
    var conf = compra ? p : 1 - p;

    el('pct').innerHTML = (p * 100).toFixed(1) + '<small>%</small>';
    el('conf').textContent = (conf * 100).toFixed(1) + ' %';

    el('pill').className = 'pill ' + (compra ? 'buy' : 'nobuy');
    el('pill-txt').textContent = compra ? 'Compra' : 'No compra';

    el('fill').style.width = (p * 100) + '%';
    el('fill').style.background = compra ? 'var(--buy)' : 'var(--nobuy)';
    el('cutline').style.left = (c * 100) + '%';

    var flag = el('cutflag');
    // la etiqueta se mantiene dentro del panel aunque el corte llegue a los extremos
    flag.style.left = Math.min(Math.max(c * 100, 7), 93) + '%';
    flag.textContent = 'corte ' + c.toFixed(2);

    var margen = Math.abs(p - c) * 100;
    el('nota').textContent = compra
      ? 'La probabilidad supera el corte por ' + margen.toFixed(1) +
        ' puntos, así que se clasifica como comprador.'
      : 'La probabilidad queda ' + margen.toFixed(1) +
        ' puntos por debajo del corte, así que se clasifica como no comprador.';

    pintarTerminos(ts);
    el('z-total').textContent = (z >= 0 ? '+' : '−') + Math.abs(z).toFixed(3);
    el('f-out').textContent = p.toFixed(4);

    actualizarMapa(a, s / 1000, genero, c);
  }

  /* ---------------- eventos ---------------- */

  [edad, salario, cutoff].forEach(function (i) {
    i.addEventListener('input', render);
  });

  ['gen-f', 'gen-m'].forEach(function (id) {
    el(id).addEventListener('click', function () {
      genero = +this.dataset.g;
      el('gen-f').setAttribute('aria-pressed', String(genero === 0));
      el('gen-m').setAttribute('aria-pressed', String(genero === 1));
      render();
    });
  });

  Array.prototype.forEach.call(
    document.querySelectorAll('.presets button'),
    function (b) {
      b.addEventListener('click', function () {
        cutoff.value = this.dataset.cut;
        render();
      });
    }
  );

  construirMapa();
  render();
})();
