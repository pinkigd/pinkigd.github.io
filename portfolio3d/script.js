(function () {
  'use strict';
  document.documentElement.classList.add('js');
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var PI = Math.PI;

  /* ---------------- Pointer (shared) ---------------- */
  var mouse = { x: 0, y: 0, sx: 0, sy: 0 };
  addEventListener('pointermove', function (e) {
    mouse.x = e.clientX / innerWidth * 2 - 1;
    mouse.y = e.clientY / innerHeight * 2 - 1;
  }, { passive: true });

  /* ---------------- Hero name: split + fit ---------------- */
  var nameEl = $('#name');
  (function splitName() {
    var words = nameEl.textContent.trim().split(/\s+/), html = '', i = 0;
    words.forEach(function (w, wi) {
      html += '<span class="w" aria-hidden="true">';
      w.split('').forEach(function (c) { html += '<span class="ch" style="--i:' + (i++) + '">' + c + '</span>'; });
      html += '</span>';
      if (wi < words.length - 1) html += '<span class="sp" aria-hidden="true"></span>';
    });
    nameEl.innerHTML = html;
  })();
  function fitName() {
    var box = nameEl.parentElement.parentElement;
    var narrow = innerWidth < 640;
    $$('.sp', nameEl).forEach(function (s) { s.style.display = narrow ? 'block' : 'inline-block'; s.style.height = narrow ? '0' : ''; });
    $$('.w', nameEl).forEach(function (w) { w.style.display = narrow ? 'block' : 'inline-block'; });
    nameEl.style.fontSize = '100px';
    var avail = box.clientWidth - parseFloat(getComputedStyle(box).paddingLeft) * 2;
    var w = nameEl.getBoundingClientRect().width;
    if (w > 0) nameEl.style.fontSize = (100 * avail / w * 0.995) + 'px';
  }
  fitName();
  addEventListener('resize', fitName);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitName);

  /* ---------------- 2D line-art (covers, icons, portrait) ---------------- */
  function tubeLoops(o, time) {
    var out = [], N = o.layers, M = 84, e = 2 / o.n;
    for (var i = 0; i < N; i++) {
      var t = i / (N - 1), prof = Math.sin(PI * (0.06 + 0.88 * t));
      var r = 0.28 + 0.72 * Math.pow(prof, 0.7);
      var th = o.twist * (t - 0.5) + time * 0.08, z = (t - 0.5) * o.depth, loop = [];
      for (var j = 0; j <= M; j++) {
        var a = j / M * 2 * PI, c = Math.cos(a), s = Math.sin(a);
        var x = (c < 0 ? -1 : 1) * Math.pow(Math.abs(c), e), y = (s < 0 ? -1 : 1) * Math.pow(Math.abs(s), e);
        var rr = r * (1 + 0.05 * Math.sin(3 * a + t * 7 + time * 0.6));
        loop.push([(x * Math.cos(th) - y * Math.sin(th)) * rr * 1.6, (x * Math.sin(th) + y * Math.cos(th)) * rr * 1.6, z]);
      }
      out.push(loop);
    }
    return out;
  }
  function sphereLoops(o) {
    var out = [], N = o.layers || 14, M = 72, i, j;
    for (i = 1; i < N; i++) {
      var lat = -PI / 2 + PI * i / N, loop = [];
      for (j = 0; j <= M; j++) { var a = j / M * 2 * PI; loop.push([Math.cos(lat) * Math.cos(a) * 1.5, Math.sin(lat) * 1.5, Math.cos(lat) * Math.sin(a) * 1.5]); }
      out.push(loop);
    }
    for (i = 0; i < N; i++) {
      var lon = i / N * PI, loop2 = [];
      for (j = 0; j <= M; j++) { var b = j / M * 2 * PI; loop2.push([Math.cos(b) * Math.cos(lon) * 1.5, Math.sin(b) * 1.5, Math.cos(b) * Math.sin(lon) * 1.5]); }
      out.push(loop2);
    }
    return out;
  }
  function torusLoops(o) {
    var out = [], N = o.layers || 40, M = 40, R = 1.0, r = 0.55;
    for (var i = 0; i < N; i++) {
      var ph = i / N * 2 * PI, loop = [];
      for (var j = 0; j <= M; j++) { var ps = j / M * 2 * PI, q = R + r * Math.cos(ps); loop.push([q * Math.cos(ph) * 1.25, q * Math.sin(ph) * 1.25, r * Math.sin(ps) * 1.25]); }
      out.push(loop);
    }
    return out;
  }
  function drawLoops(ctx, w, h, loops, o) {
    var ry = o.ry || 0, rx = o.rx || 0, S = Math.min(w, h) * (o.size || .3) , cx = w * (o.cx == null ? .5 : o.cx), cy = h * (o.cy == null ? .5 : o.cy);
    var cyw = Math.cos(ry), syw = Math.sin(ry), cxp = Math.cos(rx), sxp = Math.sin(rx);
    ctx.lineWidth = o.lw || 0.7; ctx.lineJoin = 'round';
    loops.forEach(function (loop) {
      var zsum = 0;
      ctx.beginPath();
      loop.forEach(function (p, k) {
        var x1 = p[0] * cyw + p[2] * syw, z1 = -p[0] * syw + p[2] * cyw;
        var y1 = p[1] * cxp - z1 * sxp, z2 = p[1] * sxp + z1 * cxp;
        var f = 9 / (9 - z2); zsum += z2;
        var X = cx + x1 * S * f, Y = cy - y1 * S * f;
        if (k) ctx.lineTo(X, Y); else ctx.moveTo(X, Y);
      });
      var zm = zsum / loop.length;
      ctx.strokeStyle = 'rgba(' + o.color + ',' + (o.alpha * clamp(0.5 + zm * 0.28, 0.18, 1)).toFixed(3) + ')';
      ctx.stroke();
    });
  }
  function prep(canvas) {
    var dpr = Math.min(devicePixelRatio || 1, 2), w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return null;
    if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    var ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    return { ctx: ctx, w: w, h: h };
  }
  var CREAM = '241,237,228', INK = '20,19,18';

  /* ---------------- Projects ---------------- */
  var PROJECTS = [
    { id: 'avenro', name: 'Avenro', title: 'Avenro', up: true, tag: 'Financial clarity, without the spreadsheets.', type: 'Fintech SaaS · Concept', ratio: '1.42 / 1',
      about: 'An AI financial intelligence platform for CFOs and finance teams. The concept explores a landing page and a forecasting product page in a dark purple interface, helping finance teams make sense of cash flow.',
      discipline: 'Fintech SaaS · Concept', role: 'Product design, UI, design system', deliver: 'Landing page · Forecasting product page · Product UI',
      bg: 'radial-gradient(ellipse 62% 78% at 64% 52%, #4b4842 0%, #1d1c19 66%, #141312 100%)', art: { kind: 'tube', n: 5, layers: 46, twist: 2.4, depth: 1.7, rx: .5, ry: -.65, size: .23, cx: .7, cy: .55, color: CREAM, alpha: .62 } },
    { id: 'tidemark', name: 'Tidemark', title: 'Tidemark', up: false, tag: 'Pipeline data. Clear next moves.', type: 'B2B SaaS · Dashboard', ratio: '1.86 / 1',
      about: 'A revenue intelligence dashboard that turns pipeline data into clear next moves. A calm grey-blue interface brings focus to the information teams need to understand their pipeline.',
      discipline: 'B2B SaaS · Dashboard', role: 'Product design, UI, design system', deliver: 'Dashboard design · Product UI · Design system',
      bg: 'radial-gradient(ellipse 60% 80% at 60% 50%, #8c8a84 0%, #64625d 60%, #4c4a46 100%)', art: { kind: 'tube', n: 2.5, layers: 44, twist: 1.1, depth: 1.5, rx: .95, ry: .35, size: .25, cx: .68, cy: .56, color: CREAM, alpha: .55 } },
    { id: 'ferrow', name: 'Ferrow', title: 'Ferrow', up: false, tag: 'Agentic sales, with a clear introduction.', type: 'AI SaaS · Landing page', ratio: '1.2 / 1',
      about: 'A landing page concept for an agentic sales-pipeline product. It introduces an AI that works the pipeline in plain language, then shows what it does step by step.',
      discipline: 'AI SaaS · Landing page', role: 'Product design, UI, front-end build', deliver: 'Landing page design · Front-end build',
      bg: 'radial-gradient(ellipse 66% 70% at 60% 52%, #45423d 0%, #1b1a18 68%)', art: { kind: 'tube', n: 4, layers: 42, twist: 1.7, depth: 1.5, rx: .35, ry: .55, size: .25, cx: .68, cy: .56, color: CREAM, alpha: .58 } },
    { id: 'txplanpro', name: 'TX Plan Pro', title: 'TX Plan Pro', up: false, tag: 'Treatment plans patients understand.', type: 'Healthcare SaaS · Landing page', ratio: '1.5 / 1',
      about: 'A landing page and brand direction for a dental treatment-planning product, written up as a portfolio case study.',
      discipline: 'Healthcare SaaS · Landing page', role: 'Product design, brand direction', deliver: 'Landing page · Brand direction · Case study',
      bg: 'radial-gradient(ellipse 62% 75% at 58% 50%, #3d3f3d 0%, #1a1b1a 70%)', art: { kind: 'tube', n: 3.2, layers: 36, twist: .5, depth: 3.4, rx: .18, ry: .3, size: .23, cx: .7, cy: .56, color: CREAM, alpha: .55 } },
    { id: 'moshla', name: 'Moshla', title: 'moshla.', up: false, it: true, light: true, tag: 'Ice cream, kept simple.', type: 'Ecommerce · Landing page', ratio: '1.28 / 1',
      about: 'An ecommerce landing page concept for an ice cream brand, designed in Figma.',
      discipline: 'Ecommerce · Landing page', role: 'Product design, UI', deliver: 'Landing page · Visual direction',
      bg: 'radial-gradient(ellipse 70% 80% at 50% 45%, #dcd9d1 0%, #bdbab2 100%)', art: { kind: 'moshla' } },
    { id: 'apexlite', name: 'APEX Lite', title: 'APEX Lite', up: true, tag: 'Become your next.', type: 'Mobile app · UI kit', ratio: '1.5 / 1',
      about: 'A fitness app UI kit built in Figma, with a bold dark look and a reusable set of components.',
      discipline: 'Mobile app · UI kit', role: 'Product design, UI', deliver: 'Mobile UI kit · Components',
      bg: 'radial-gradient(ellipse 60% 80% at 68% 50%, #4a4843 0%, #1a1917 70%)', art: { kind: 'torus', layers: 44, rx: .95, ry: .5, size: .21, cx: .74, cy: .56, color: CREAM, alpha: .6 } }
  ];

  function drawCover(canvas, p, tilt, time) {
    var pr = prep(canvas); if (!pr) return;
    var a = p.art, ctx = pr.ctx, w = pr.w, h = pr.h;
    if (a.kind === 'moshla') {
      // pale sun, cone and scoops in fine line-art
      ctx.fillStyle = 'rgba(244,241,234,.9)'; ctx.beginPath(); ctx.arc(w * .68, h * .36, Math.min(w, h) * .2, 0, 2 * PI); ctx.fill();
      ctx.strokeStyle = 'rgba(42,41,37,.75)'; ctx.lineWidth = .9;
      var cx = w * .68 + (tilt ? tilt.x * 8 : 0), base = h * .98, cw = w * .13;
      ctx.beginPath(); ctx.moveTo(cx - cw, h * .66); ctx.lineTo(cx, base); ctx.lineTo(cx + cw, h * .66); ctx.stroke();
      for (var i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(cx + i * cw / 3.4, h * .66 + Math.abs(i) * 2); ctx.lineTo(cx + i * cw * .12, base - 4); ctx.stroke(); }
      for (var k = 0; k < 6; k++) { var yy = h * (.7 + k * .05), half = cw * (1 - (yy - h * .66) / (base - h * .66)); ctx.beginPath(); ctx.moveTo(cx - half, yy); ctx.lineTo(cx + half, yy); ctx.stroke(); }
      [[.0, .58, .17], [-.02, .47, .14]].forEach(function (s, idx) {
        for (var r = 0; r < 14; r++) { ctx.beginPath(); ctx.ellipse(cx + s[0] * w, h * s[1], w * s[2] * (1 - r * .05), w * s[2] * .8 * (1 - r * .03), 0, 0, 2 * PI); ctx.strokeStyle = 'rgba(42,41,37,' + (.65 - r * .03) + ')'; ctx.stroke(); }
      });
      return;
    }
    var o = { n: a.n, layers: a.layers, twist: a.twist, depth: a.depth };
    var loops = a.kind === 'torus' ? torusLoops(a) : tubeLoops(o, time || 0);
    drawLoops(ctx, w, h, loops, { rx: a.rx + (tilt ? tilt.y * .25 : 0), ry: a.ry + (tilt ? tilt.x * .35 : 0) + (time || 0) * .02, size: a.size, cx: a.cx, cy: a.cy, color: a.color, alpha: a.alpha, lw: .7 });
  }

  function buildCover(p, opts) {
    opts = opts || {};
    var el = document.createElement('div');
    el.className = 'cover' + (p.light ? ' light' : '');
    el.style.background = p.bg;
    el.style.aspectRatio = opts.ratio || p.ratio;
    el.innerHTML = '<canvas aria-hidden="true"></canvas><div class="ct"><div class="brand">Pinki Ghosh Dastidar / Product design</div>' +
      '<div class="ttl' + (p.up ? ' up' : '') + (p.it ? ' it' : '') + '">' + p.title + '</div>' +
      '<div class="tg">' + p.tag + '</div><div class="ill">Illustrated cover</div></div><div class="glare"></div>';
    return el;
  }

  var grid = $('#grid'), cards = [];
  PROJECTS.forEach(function (p, i) {
    var b = document.createElement('button');
    b.className = 'card rv'; b.type = 'button'; b.setAttribute('data-cursor', 'View'); b.style.setProperty('--d', (i % 3) * .08 + 's');
    b.setAttribute('aria-label', 'Open ' + p.name + ' project');
    var wrap = document.createElement('div'); wrap.className = 'cover-wrap';
    var cover = buildCover(p);
    var pn = document.createElement('span'); pn.className = 'pn'; pn.textContent = '0' + (i + 1) + ' / 06';
    var view = document.createElement('span'); view.className = 'view'; view.textContent = 'View project ↗';
    cover.appendChild(pn); wrap.appendChild(cover); wrap.appendChild(view);
    var meta = document.createElement('div'); meta.className = 'meta';
    meta.innerHTML = '<span class="n">0' + (i + 1) + '</span><span class="nm">' + p.name + '</span><span class="ty">' + p.type + ' <span class="ar">↗</span></span>';
    b.appendChild(wrap); b.appendChild(meta); grid.appendChild(b);
    var st = { p: p, cover: cover, canvas: $('canvas', cover), wrap: wrap, tilt: { x: 0, y: 0 }, raf: 0, t0: 0 };
    cards.push(st);
    b.addEventListener('click', function () { openDetail(i); });
    b.addEventListener('pointermove', function (e) {
      var r = wrap.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      if (grid.classList.contains('list')) return;
      wrap.style.transform = 'rotateX(' + (-y * 7).toFixed(2) + 'deg) rotateY(' + (x * 9).toFixed(2) + 'deg) translateZ(8px)';
      $('.glare', cover).style.setProperty('--gx', (x + .5) * 100 + '%'); $('.glare', cover).style.setProperty('--gy', (y + .5) * 100 + '%');
      st.tilt.x = x; st.tilt.y = y;
      if (!st.raf && !reduce) st.raf = requestAnimationFrame(function () { st.raf = 0; drawCover(st.canvas, p, st.tilt, (performance.now() - st.t0) / 1000); });
    });
    b.addEventListener('pointerleave', function () { wrap.style.transform = ''; st.tilt = { x: 0, y: 0 }; drawCover(st.canvas, p, null, 0); });
  });
  function drawAllCovers() { cards.forEach(function (c) { drawCover(c.canvas, c.p, null, 0); }); }

  $('#v-grid').addEventListener('click', function () { setView(false); });
  $('#v-list').addEventListener('click', function () { setView(true); });
  function setView(list) {
    grid.classList.toggle('list', list);
    $('#v-grid').setAttribute('aria-pressed', String(!list)); $('#v-list').setAttribute('aria-pressed', String(list));
    cards.forEach(function (c) { c.wrap.style.transform = ''; });
    requestAnimationFrame(drawAllCovers);
  }

  /* ---------------- Detail overlay ---------------- */
  var detail = $('#detail'), current = -1, lastFocus = null;
  function renderDetail(i) {
    var p = PROJECTS[i], prev = PROJECTS[(i + PROJECTS.length - 1) % PROJECTS.length], next = PROJECTS[(i + 1) % PROJECTS.length];
    detail.innerHTML =
      '<div class="bar"><span>Pinki Ghosh Dastidar</span><span class="c">Selected work / 0' + (i + 1) + ' of 06</span><span class="x"><button id="d-close" type="button" style="display:inline-flex;gap:12px;align-items:center">All works <b aria-hidden="true">×</b></button></span></div>' +
      '<div class="wrap"><h2>' + p.name + '</h2>' +
      '<div class="facts"><div><div class="label">About the project</div><p>' + p.about + '</p></div>' +
      '<div class="stack"><div><div class="label">Discipline</div><p>' + p.discipline + '</p></div><div><div class="label">Deliverables</div><p>' + p.deliver + '</p></div></div>' +
      '<div><div class="label">Role</div><p>' + p.role + '</p></div></div>' +
      '<div class="big"></div>' +
      '<div class="next"><button type="button" id="d-prev"><span class="label">← Previous</span><span class="nx">' + prev.name + '</span></button><button type="button" id="d-next"><span class="label">Next →</span><span class="nx">' + next.name + '</span></button></div></div>';
    var cov = buildCover(p, { ratio: 'auto' }); $('.big', detail).appendChild(cov);
    requestAnimationFrame(function () { drawCover($('canvas', cov), p, null, 0); });
    $('#d-close').addEventListener('click', closeDetail);
    $('#d-prev').addEventListener('click', function () { openDetail((i + PROJECTS.length - 1) % PROJECTS.length, true); });
    $('#d-next').addEventListener('click', function () { openDetail((i + 1) % PROJECTS.length, true); });
  }
  function openDetail(i, swap) {
    if (!swap) lastFocus = document.activeElement;
    current = i; cur.classList.remove('big'); renderDetail(i); detail.scrollTop = 0;
    detail.setAttribute('aria-hidden', 'false'); document.body.classList.add('locked');
    requestAnimationFrame(function () { detail.classList.add('open'); var c = $('#d-close'); if (c) c.focus({ preventScroll: true }); });
  }
  function closeDetail() {
    cur.classList.remove('big'); detail.classList.remove('open'); detail.setAttribute('aria-hidden', 'true'); document.body.classList.remove('locked'); current = -1;
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }
  addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { if (current > -1) closeDetail(); else closeMenu(); }
    if (current > -1 && e.key === 'ArrowRight') openDetail((current + 1) % PROJECTS.length, true);
    if (current > -1 && e.key === 'ArrowLeft') openDetail((current + PROJECTS.length - 1) % PROJECTS.length, true);
  });

  /* ---------------- Menu ---------------- */
  var burger = $('#burger'), menu = $('#menu');
  function closeMenu() { menu.hidden = true; burger.setAttribute('aria-expanded', 'false'); burger.setAttribute('aria-label', 'Open menu'); }
  burger.addEventListener('click', function () {
    var open = menu.hidden; menu.hidden = !open; burger.setAttribute('aria-expanded', String(open)); burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  });
  $$('a', menu).forEach(function (a) { a.addEventListener('click', closeMenu); });
  document.addEventListener('click', function (e) { if (!menu.hidden && !menu.contains(e.target) && !burger.contains(e.target)) closeMenu(); });

  /* ---------------- Copy email ---------------- */
  var copyBtn = $('#copy');
  copyBtn.addEventListener('click', function () {
    var done = function () { copyBtn.textContent = 'Copied'; copyBtn.classList.add('done'); setTimeout(function () { copyBtn.textContent = 'Copy'; copyBtn.classList.remove('done'); }, 1800); };
    var fallback = function () {
      var r = document.createRange(); r.selectNodeContents($('.mail a')); var s = getSelection(); s.removeAllRanges(); s.addRange(r);
      copyBtn.textContent = 'Press Ctrl/Cmd+C';
    };
    try { navigator.clipboard.writeText('pinkigd@gmail.com').then(done, fallback); } catch (e) { fallback(); }
  });

  /* ---------------- Icons, tile, portrait, steps ---------------- */
  function drawIcons() {
    $$('canvas[data-ico]').forEach(function (c) {
      var pr = prep(c); if (!pr) return; var k = c.getAttribute('data-ico'), o = { color: CREAM, alpha: .85, size: .3, lw: .8 };
      if (k === 'tube') drawLoops(pr.ctx, pr.w, pr.h, tubeLoops({ n: 5, layers: 22, twist: 2.4, depth: 1.5 }, 0), Object.assign(o, { rx: .5, ry: -.6 }));
      if (k === 'sphere') drawLoops(pr.ctx, pr.w, pr.h, sphereLoops({ layers: 9 }), Object.assign(o, { rx: .35, ry: .5, size: .26 }));
      if (k === 'torus') drawLoops(pr.ctx, pr.w, pr.h, torusLoops({ layers: 22 }), Object.assign(o, { rx: 1, ry: .4, size: .26 }));
    });
    var t = $('#tile-art'); if (t) { var p2 = prep(t); if (p2) drawLoops(p2.ctx, p2.w, p2.h, tubeLoops({ n: 5, layers: 34, twist: 2.2, depth: 1.5 }, 0), { rx: .55, ry: -.6, size: .3, cx: .68, cy: .5, color: CREAM, alpha: .6, lw: .7 }); }
    var pt = $('#portrait-art'); if (pt) { var p3 = prep(pt); if (p3) { drawLoops(p3.ctx, p3.w, p3.h, tubeLoops({ n: 2.2, layers: 46, twist: 1.2, depth: 1.4 }, 0), { rx: .2, ry: .2, size: .38, color: CREAM, alpha: .4, lw: .7 }); } }
  }

  function drawStep(c, kind, hover, time) {
    var pr = prep(c); if (!pr) return; var ctx = pr.ctx, w = pr.w, h = pr.h;
    ctx.fillStyle = '#E5E0D3'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(20,19,18,.04)'; ctx.fillRect(0, 0, w, h);
    ctx.lineWidth = 1;
    if (kind === 'understand') {
      ctx.strokeStyle = 'rgba(20,19,18,.75)';
      for (var i = 0; i < 26; i++) { ctx.beginPath(); ctx.ellipse(w * (.42 + i * .004 * (hover ? 2 : 1)), h * .46, w * (.06 + i * .011), w * (.06 + i * .011) * (.9 - i * .01), 0, 0, 2 * PI); ctx.stroke(); }
      ctx.strokeStyle = '#E5572B'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(w * .66, h * .7); ctx.lineTo(w * .82, h * .86); ctx.stroke();
    } else if (kind === 'structure') {
      var boxes = [[.12, .16, .3, .2], [.58, .16, .3, .2], [.35, .6, .3, .22]];
      ctx.strokeStyle = 'rgba(20,19,18,.8)'; ctx.setLineDash([]);
      boxes.forEach(function (b) { ctx.strokeRect(w * b[0], h * b[1], w * b[2], h * b[3]); ctx.beginPath(); ctx.moveTo(w * (b[0] + .04), h * (b[1] + .06)); ctx.lineTo(w * (b[0] + .2), h * (b[1] + .06)); ctx.moveTo(w * (b[0] + .04), h * (b[1] + .11)); ctx.lineTo(w * (b[0] + .14), h * (b[1] + .11)); ctx.stroke(); });
      ctx.strokeStyle = '#E5572B'; ctx.lineWidth = 1.6; ctx.setLineDash([5, 4]); ctx.lineDashOffset = -(time * 12);
      ctx.beginPath(); ctx.moveTo(w * .42, h * .26); ctx.lineTo(w * .58, h * .26); ctx.moveTo(w * .27, h * .36); ctx.lineTo(w * .27, h * .48); ctx.lineTo(w * .5, h * .48); ctx.lineTo(w * .5, h * .6); ctx.moveTo(w * .73, h * .36); ctx.lineTo(w * .73, h * .48); ctx.lineTo(w * .5, h * .48); ctx.stroke(); ctx.setLineDash([]);
    } else if (kind === 'design') {
      var tiles = [['#141312', -.14, .18, .1], ['#F1EDE4', .02, .3, .3], ['#E5572B', .16, .42, .5]];
      tiles.forEach(function (t, k) { ctx.save(); ctx.translate(w * t[2] + w * .16, h * (.18 + k * .1) + h * .2); ctx.rotate(t[1] + (hover ? k * .04 : 0)); ctx.shadowColor = 'rgba(20,19,18,.3)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 6; ctx.fillStyle = t[0]; ctx.fillRect(-w * .18, -h * .16, w * .36, h * .32); ctx.restore(); });
    } else {
      ctx.fillStyle = 'rgba(20,19,18,.85)';
      var n = 34, bw = w * .014;
      for (var j = 0; j < n; j++) { var x = w * (.14 + j * (.72 / n)), amp = (Math.sin(j * .5) * .5 + .5) * .26 + .04; amp *= 1 + .5 * Math.sin(time * 3 + j * .6) * (hover ? 1 : .3); ctx.fillRect(x, h * .5 - h * amp, bw, h * amp * 2); }
      ctx.fillStyle = '#E5572B'; ctx.fillRect(w * .14, h * .5 - 1, w * .72 * ((Math.sin(time) * .5 + .5) * .6 + .2), 2);
    }
  }
  var steps = $$('canvas[data-step]').map(function (c) { return { c: c, k: c.getAttribute('data-step'), hover: false }; });
  steps.forEach(function (s) {
    var art = s.c.parentElement;
    art.addEventListener('pointermove', function (e) {
      var r = art.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      art.style.transform = 'rotateX(' + (-y * 12).toFixed(1) + 'deg) rotateY(' + (x * 14).toFixed(1) + 'deg) translateZ(10px)'; s.hover = true;
    });
    art.addEventListener('pointerleave', function () { art.style.transform = ''; s.hover = false; });
  });

  /* ---------------- Orbiting words ---------------- */
  var orbitEls = $$('#orbit span'), orbitBox = $('#orbit'), approachVisible = false;
  function orbit(t) {
    var w = orbitBox.clientWidth, h = orbitBox.clientHeight, rx = w * .465, ry = h * .36;
    orbitEls.forEach(function (el, i) {
      var a = t * .00006 * (reduce ? 0 : 1) + i / orbitEls.length * 2 * PI + .5, x = Math.cos(a) * rx, y = Math.sin(a) * ry * .9, z = Math.sin(a);
      var s = .85 + z * .2;
      el.style.transform = 'translate(-50%,-50%) translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) scale(' + s.toFixed(3) + ')';
      el.style.opacity = (.55 + z * .4).toFixed(2);
      el.style.zIndex = z > 0 ? 3 : 0;
    });
  }

  /* ---------------- WebGL sculpture ---------------- */
  var VERT = [
    'uniform float uTime,uMorph,uTwist,uSphere,uDepth,uAmp,uExp;',
    'attribute float aT; attribute float aA;',
    'varying float vA;',
    'void main(){',
    ' float t=aT,a=aA;',
    ' float n=mix(5.0,2.0,uMorph); float p=2.0/n;',
    ' float c=cos(a),s=sin(a);',
    ' vec2 q=vec2(sign(c)*pow(abs(c),p),sign(s)*pow(abs(s),p));',
    ' float prof=sin(3.14159265*(0.06+0.88*t));',
    ' float r=mix(0.28+0.72*pow(prof,0.7),sin(3.14159265*t),uSphere);',
    ' r*=1.0+0.05*uAmp*sin(3.0*a+t*7.0+uTime*0.6);',
    ' float th=uTwist*(t-0.5)*(1.0-uSphere)+uTime*0.08;',
    ' mat2 R=mat2(cos(th),sin(th),-sin(th),cos(th));',
    ' vec2 rq=R*q;',
    ' float z=mix((t-0.5)*uDepth,-cos(3.14159265*t)*1.6,uSphere);',
    ' vec3 pos=vec3(rq*r*1.6,z)*uExp;',
    ' vec4 mv=modelViewMatrix*vec4(pos,1.0);',
    ' float d=clamp((-mv.z-7.2)/4.8,0.0,1.0);',
    ' vA=mix(1.0,0.22,d);',
    ' gl_Position=projectionMatrix*mv;',
    '}'
  ].join('\n');
  var FRAG = 'uniform vec3 uColor; uniform float uOpacity; varying float vA; void main(){ gl_FragColor=vec4(uColor,uOpacity*vA); }';

  function Sculpture(canvas, o) {
    if (!window.THREE) return null;
    var renderer;
    try { renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: 'low-power' }); } catch (e) { return null; }
    renderer.setClearColor(0x000000, 0);
    var scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(32, 1, .1, 60), CAMZ = 9; cam.position.z = CAMZ;
    var mobile = innerWidth < 700, N = mobile ? Math.round(o.layers * .7) : o.layers, M = mobile ? 110 : o.points;
    var count = N * M, aT = new Float32Array(count), aA = new Float32Array(count), idx = [];
    for (var i = 0; i < N; i++) for (var j = 0; j < M; j++) { var k = i * M + j; aT[k] = i / (N - 1); aA[k] = j / M * 2 * PI; idx.push(k, i * M + (j + 1) % M); }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geo.setAttribute('aT', new THREE.BufferAttribute(aT, 1)); geo.setAttribute('aA', new THREE.BufferAttribute(aA, 1)); geo.setIndex(idx);
    var col = new THREE.Color(o.color);
    var mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uMorph: { value: o.morph }, uTwist: { value: o.twist }, uSphere: { value: o.sphere || 0 }, uDepth: { value: o.depth }, uAmp: { value: o.amp == null ? 1 : o.amp }, uExp: { value: 1 }, uColor: { value: col }, uOpacity: { value: o.opacity } },
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false
    });
    var group = new THREE.Group(), mesh = new THREE.LineSegments(geo, mat); mesh.frustumCulled = false; group.add(mesh);
    if (o.mirror) { var m2 = new THREE.LineSegments(geo, mat); m2.frustumCulled = false; m2.rotation.x = PI / 2; group.add(m2); }
    scene.add(group);
    var self = { canvas: canvas, el: canvas.parentElement, o: o, visible: false, born: performance.now(), rot: { x: o.rx, y: o.ry }, w: 0, h: 0 };
    function size() {
      var w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); self.w = w; self.h = h;
      var vh = 2 * Math.tan(cam.fov * PI / 360) * CAMZ, vw = vh * cam.aspect, k = o.size * Math.min(vh, vh * (w / h) * (o.fitW || 1)) / 3.4;
      if (w < 700 && o.sizeM) k = o.sizeM * vh / 3.4;
      group.scale.setScalar(k); group.position.set((w < 700 && o.oxM != null ? o.oxM : o.ox) * vw / 2, (w < 700 && o.oyM != null ? o.oyM : o.oy) * vh / 2, 0);
    }
    size(); addEventListener('resize', size); if ('ResizeObserver' in window) new ResizeObserver(size).observe(canvas);
    self.render = function (now) {
      var t = (now - self.born) / 1000, rect = self.el.getBoundingClientRect(), sp = clamp((innerHeight - rect.top) / (innerHeight + rect.height), 0, 1);
      var intro = o.intro ? clamp(t / 2.6, 0, 1) : 1, ease = 1 - Math.pow(1 - intro, 3);
      var u = mat.uniforms;
      u.uTime.value = reduce ? 0 : t;
      u.uExp.value = o.intro ? .35 + .65 * ease : 1;
      u.uTwist.value = o.twist * (o.intro ? ease : 1) + (o.scrollTwist || 0) * (o.hero ? clamp(-rect.top / rect.height, 0, 1) : sp - .5);
      u.uOpacity.value = o.opacity * (o.intro ? clamp(t / 1.2, 0, 1) : 1);
      var mx = reduce ? 0 : mouse.x, my = reduce ? 0 : mouse.y;
      var tx = o.rx + my * (o.mx || .25) + (o.hero ? clamp(-rect.top / rect.height, 0, 1) * .5 : 0), ty = o.ry + mx * (o.my || .4) + (reduce ? 0 : t * (o.spin || 0)) + (o.hero ? clamp(-rect.top / rect.height, 0, 1) * 1.1 : (sp - .5) * (o.scrollRot || 0));
      self.rot.x = lerp(self.rot.x, tx, .06); self.rot.y = lerp(self.rot.y, ty, .06);
      group.rotation.x = self.rot.x; group.rotation.y = self.rot.y; group.rotation.z = o.rz || 0;
      renderer.render(scene, cam);
    };
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { self.visible = es[0].isIntersecting; }, { rootMargin: '80px' }).observe(self.el); else self.visible = true;
    return self;
  }

  var scenes = [];
  var hero = Sculpture($('#gl-hero'), { layers: 74, points: 170, color: 0x141312, opacity: .92, morph: .08, twist: 2.7, depth: 3.5, size: .64, ox: 0, oy: .1, oxM: 0, oyM: 0, sizeM: .8, rx: .5, ry: -.55, mx: .3, my: .55, spin: .03, intro: true, hero: true, scrollTwist: 1.2 });
  var rings = Sculpture($('#gl-rings'), { layers: 40, points: 150, color: 0x141312, opacity: .34, morph: 1, twist: 0, depth: 1.5, size: 1.05, fitW: .55, ox: 0, oy: 0, rx: 1.05, ry: 0, rz: -.12, mx: .12, my: .25, spin: .04, scrollRot: 1.4, scrollTwist: 0 });
  var globe = Sculpture($('#gl-globe'), { layers: 22, points: 130, color: 0x141312, opacity: .85, morph: 1, sphere: 1, twist: 0, depth: 3, size: .5, ox: .66, oy: .3, oxM: .58, oyM: .5, sizeM: .26, rx: .35, ry: 0, mx: .15, my: .3, spin: .12, mirror: true, amp: 0, scrollTwist: 0 });
  [hero, rings, globe].forEach(function (s) { if (s) scenes.push(s); });
  if (!scenes.length) { /* WebGL unavailable: draw the hero once in 2D */
    var hc = $('#gl-hero'), hp = prep(hc);
    if (hp) drawLoops(hp.ctx, hp.w, hp.h, tubeLoops({ n: 4.5, layers: 60, twist: 2.6, depth: 3.4 }, 0), { rx: .5, ry: -.55, size: .3, cy: .46, color: INK, alpha: .8, lw: .7 });
  }

  /* ---------------- Main loop ---------------- */
  var t0 = performance.now(), stepsVisible = false, worksVisible = false;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { stepsVisible = es[0].isIntersecting; }, { rootMargin: '100px' }).observe($('.steps'));
    new IntersectionObserver(function (es) { approachVisible = es[0].isIntersecting; }, { rootMargin: '100px' }).observe($('.approach'));
  } else { stepsVisible = approachVisible = true; }
  function frame(now) {
    scenes.forEach(function (s) { if (s.visible) s.render(now); });
    if (approachVisible) orbit(now - t0);
    if (stepsVisible) { var tt = (now - t0) / 1000; steps.forEach(function (s) { if (!reduce || !s.done) { drawStep(s.c, s.k, s.hover, tt); s.done = true; } }); }
    // custom cursor
    mouse.sx = lerp(mouse.sx, cx, .25); mouse.sy = lerp(mouse.sy, cy, .25);
    cur.style.transform = 'translate(' + mouse.sx.toFixed(1) + 'px,' + mouse.sy.toFixed(1) + 'px)';
    requestAnimationFrame(frame);
  }
  var cur = $('#cur'), cx = -100, cy = -100;
  addEventListener('pointermove', function (e) { if (e.pointerType === 'touch') return; cx = e.clientX; cy = e.clientY; cur.classList.add('on'); }, { passive: true });
  document.addEventListener('pointerleave', function () { cur.classList.remove('on'); });
  document.addEventListener('pointerover', function (e) {
    var t = e.target.closest ? e.target.closest('[data-cursor],a,button') : null;
    cur.classList.toggle('big', !!(t && t.hasAttribute('data-cursor')));
  });

  /* ---------------- Reveal ---------------- */
  var rv = $$('.rv');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { rootMargin: '0px 0px -8% 0px', threshold: .05 });
    rv.forEach(function (el) { io.observe(el); });
    setTimeout(function () { rv.forEach(function (el) { el.classList.add('in'); }); }, 6000);
  } else { rv.forEach(function (el) { el.classList.add('in'); }); }

  /* ---------------- Boot ---------------- */
  function redraw() { drawAllCovers(); drawIcons(); steps.forEach(function (s) { s.done = false; }); }
  redraw();
  var rt; addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(redraw, 120); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(redraw);
  requestAnimationFrame(frame);
})();
