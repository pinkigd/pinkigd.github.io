(function () {
  'use strict';
  var root = document.documentElement; root.classList.add('js');
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var PI = Math.PI, FG = '237,235,230', INKC = '10,10,11';
  var mouse = { x: 0, y: 0 };
  addEventListener('pointermove', function (e) { mouse.x = e.clientX / innerWidth * 2 - 1; mouse.y = e.clientY / innerHeight * 2 - 1; }, { passive: true });

  /* ---------- Preloader: the P draws itself, then the curtain lifts ---------- */
  if (!reduce) {
    var pre = document.createElement('div'); pre.className = 'pre'; pre.setAttribute('aria-hidden', 'true');
    pre.innerHTML = '<svg viewBox="-.1 -.1 2.3 3.35"><path class="fl" fill-rule="evenodd" d="M0 0H1.5A1 1 0 0 1 1.5 2H.85V3.15H0Z M.85 .75H1.5A.25 .25 0 0 1 1.5 1.25H.85Z"/><path class="st" pathLength="20" d="M0 0H1.5A1 1 0 0 1 1.5 2H.85V3.15H0Z M.85 .75H1.5A.25 .25 0 0 1 1.5 1.25H.85Z"/></svg>';
    document.body.appendChild(pre); setTimeout(function () { pre.remove(); }, 2300);
  }

  /* ---------- Word-by-word reveal ---------- */
  var revealEls = $$('[data-reveal]').map(function (el) {
    var words = el.textContent.trim().split(/\s+/); el.innerHTML = '';
    var spans = words.map(function (w, i) { var s = document.createElement('span'); s.className = 'w'; s.textContent = w; el.appendChild(s); if (i < words.length - 1) el.appendChild(document.createTextNode(' ')); return s; });
    var hl = el.getAttribute('data-hl');
    if (hl) hl.split('|').forEach(function (ph) {
      var pw = ph.trim().split(/\s+/), clean = function (t) { return t.replace(/[^\w-]/g, '').toLowerCase(); };
      for (var i = 0; i + pw.length <= words.length; i++) {
        var ok = pw.every(function (q, k) { return clean(words[i + k]) === clean(q); });
        if (ok) for (var k = 0; k < pw.length; k++) spans[i + k].classList.add('hl');
      }
    });
    return { el: el, spans: spans };
  });
  function updateReveal() {
    var vh = innerHeight;
    revealEls.forEach(function (o) {
      var r = o.el.getBoundingClientRect(), p = clamp((vh * .82 - r.top) / (vh * .5 + r.height * .4), 0, 1), n = o.spans.length;
      if (reduce) p = 1;
      o.spans.forEach(function (s, i) { s.classList.toggle('on', i < Math.round(p * n * 1.05)); });
    });
  }

  /* ---------- 2D line art ---------- */
  function tubeLoops(o, time) {
    var out = [], N = o.layers, M = 84, e = 2 / o.n;
    for (var i = 0; i < N; i++) {
      var t = i / (N - 1), prof = Math.sin(PI * (0.06 + 0.88 * t)), r = 0.28 + 0.72 * Math.pow(prof, 0.7);
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
  function torusLoops(o) {
    var out = [], N = o.layers || 40, M = 40, R = 1.0, r = .55;
    for (var i = 0; i < N; i++) { var ph = i / N * 2 * PI, loop = []; for (var j = 0; j <= M; j++) { var ps = j / M * 2 * PI, q = R + r * Math.cos(ps); loop.push([q * Math.cos(ph) * 1.25, q * Math.sin(ph) * 1.25, r * Math.sin(ps) * 1.25]); } out.push(loop); }
    return out;
  }
  function drawLoops(ctx, w, h, loops, o) {
    var ry = o.ry || 0, rx = o.rx || 0, S = Math.min(w, h) * (o.size || .3), cx = w * (o.cx == null ? .5 : o.cx), cy = h * (o.cy == null ? .5 : o.cy);
    var cyw = Math.cos(ry), syw = Math.sin(ry), cxp = Math.cos(rx), sxp = Math.sin(rx);
    ctx.lineWidth = o.lw || .7; ctx.lineJoin = 'round';
    loops.forEach(function (loop) {
      var zsum = 0; ctx.beginPath();
      loop.forEach(function (p, k) {
        var x1 = p[0] * cyw + p[2] * syw, z1 = -p[0] * syw + p[2] * cyw, y1 = p[1] * cxp - z1 * sxp, z2 = p[1] * sxp + z1 * cxp, f = 9 / (9 - z2); zsum += z2;
        var X = cx + x1 * S * f, Y = cy - y1 * S * f; if (k) ctx.lineTo(X, Y); else ctx.moveTo(X, Y);
      });
      ctx.strokeStyle = 'rgba(' + o.color + ',' + (o.alpha * clamp(.5 + zsum / loop.length * .28, .18, 1)).toFixed(3) + ')'; ctx.stroke();
    });
  }
  function prep(canvas) {
    var dpr = Math.min(devicePixelRatio || 1, 2), w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return null;
    if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    var ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h); return { ctx: ctx, w: w, h: h };
  }

  /* ---------- Projects ---------- */
  var ONDREL_IMG = 'images/ondrel.jpg';
  var FERROW_IMG = 'images/ferrow.jpg';
  var TIDE_IMG = 'images/tide.jpg';
  var PIXEL_IMG = 'images/pixel.jpg';
  var AVENRO_IMG = 'images/avenro.jpg';
  var APEX_IMG = 'images/apex.jpg';
  var PROJECTS = [
    { name: 'Avenro', title: 'Avenro', img: AVENRO_IMG, iar: '1500 / 1331', up: true, tag: 'Financial clarity, without the spreadsheets.', type: 'Fintech SaaS · Concept', ratio: '5 / 4',
      about: 'An AI financial intelligence platform concept for finance teams. The design brings cash flow, spending, runway, and forecasts into one clear view, helping teams understand their finances and plan ahead.',
      discipline: 'Fintech · B2B SaaS · Concept', role: 'Product design · UI design · Design system', deliver: 'Landing page · Financial dashboard · Data visualization · Mobile UI',
      bg: 'radial-gradient(ellipse 62% 78% at 64% 52%, #4b4842 0%, #1d1c19 66%, #141312 100%)', art: { kind: 'tube', n: 5, layers: 46, twist: 2.4, depth: 1.7, rx: .5, ry: -.65, size: .32, cx: .66, cy: .58, alpha: .62 } },
    { name: 'Tidemark', title: 'Tidemark', url: 'https://tidemark-jade.vercel.app/', img: TIDE_IMG, iar: '1464 / 988', tag: 'Pipeline data. Clear next moves.', type: 'B2B SaaS · Dashboard', ratio: '3 / 2',
      about: 'A revenue intelligence platform concept for SaaS teams. The dashboard brings recurring revenue, customer retention, and at-risk accounts into one clear view, helping teams track growth and prioritize action.',
      discipline: 'B2B SaaS · Revenue Analytics · Concept', role: 'Product design, UI, design system', deliver: 'Revenue dashboard · Data visualization · Product UI',
      bg: 'radial-gradient(ellipse 60% 80% at 60% 50%, #8c8a84 0%, #64625d 60%, #4c4a46 100%)', art: { kind: 'tube', n: 2.5, layers: 44, twist: 1.1, depth: 1.5, rx: .95, ry: .35, size: .3, cx: .62, cy: .6, alpha: .55 } },
    { name: 'Ferrow', title: 'Ferrow', url: 'https://ferrow-landingpage.vercel.app/', img: FERROW_IMG, iar: '1600 / 1121', tag: 'AI Revenue Pipeline SaaS', type: 'AI Revenue Pipeline SaaS', ratio: '4 / 3',
      about: 'An AI-powered B2B SaaS platform designed to help revenue teams automate pipeline workflows, manage deals, and turn sales data into clear, actionable insights.',
      discipline: 'Product Design · SaaS UX · UI Design · Visual Design', role: 'Product Designer · UI/UX Designer', deliver: 'UX Architecture · User Flows · Dashboard UI · Responsive Website · Interactive Prototype · Design System',
      bg: 'radial-gradient(ellipse 66% 70% at 60% 52%, #45423d 0%, #1b1a18 68%)', art: { kind: 'tube', n: 4, layers: 42, twist: 1.7, depth: 1.5, rx: .35, ry: .55, size: .3, cx: .62, cy: .6, alpha: .58 } },
    { name: 'TX Plan Pro', title: 'TX Plan Pro', tag: 'Treatment plans patients understand.', type: 'Healthcare SaaS · Landing page', ratio: '1 / 1.08',
      about: 'A landing page and brand direction for a dental treatment-planning product, written up as a portfolio case study.',
      discipline: 'Healthcare SaaS · Landing page', role: 'Product design, brand direction', deliver: 'Landing page · Brand direction · Case study',
      bg: 'radial-gradient(ellipse 62% 75% at 58% 50%, #3d3f3d 0%, #1a1b1a 70%)', art: { kind: 'tube', n: 3.2, layers: 36, twist: .5, depth: 3.4, rx: .18, ry: .3, size: .3, cx: .64, cy: .6, alpha: .55 } },
    { name: 'Moshla', title: 'moshla.', itl: true, light: true, tag: 'Ice cream, kept simple.', type: 'Ecommerce · Landing page', ratio: '5 / 6',
      about: 'An ecommerce landing page concept for an ice cream brand, designed in Figma.',
      discipline: 'Ecommerce · Landing page', role: 'Product design, UI', deliver: 'Landing page · Visual direction',
      bg: 'radial-gradient(ellipse 70% 80% at 50% 45%, #dcd9d1 0%, #bdbab2 100%)', art: { kind: 'moshla' } },
    { name: 'APEX Lite', title: 'APEX Lite', url: 'https://www.figma.com/design/yT1j0JrsVecujnMjheueEx/APEX-%E2%80%94-Fitness-App-UI-Kit?node-id=409-7482&t=RSl0UTvrqzcdXwh1-1', img: APEX_IMG, iar: '1400 / 1172', up: true, tag: 'Become your next.', type: 'Mobile app · UI kit', ratio: '6 / 5',
      about: 'A mobile UI kit for an AI-powered fitness and performance app that personalizes workouts, nutrition, and recovery. Designed in Figma with a cinematic dark visual style, ember-orange accents, and athlete photography, covering the full journey from onboarding to daily training.',
      discipline: 'Fitness app · Mobile UI kit', role: 'Product design · UI design · Design system', deliver: 'Splash and onboarding · Auth flow · 8-step personalization setup · Workout, nutrition and recovery screens · Component library',
      bg: 'radial-gradient(ellipse 60% 80% at 68% 50%, #4a4843 0%, #1a1917 70%)', art: { kind: 'torus', layers: 44, rx: .95, ry: .5, size: .26, cx: .7, cy: .6, alpha: .6 } },
    { name: "Capy's Vault", title: "Capy's Vault", tag: 'A calmer way to run a casino floor.', type: 'iGaming · Dashboard', ratio: '1 / 1',
      about: 'An iGaming casino dashboard concept built around a capybara mascot, designed in Figma.',
      discipline: 'iGaming · Dashboard', role: 'Product design, UI, mascot direction', deliver: 'Dashboard design · Mascot · Product UI',
      bg: 'radial-gradient(ellipse 62% 78% at 40% 52%, #48453f 0%, #1d1c19 68%, #131211 100%)', art: { kind: 'torus', layers: 40, rx: .6, ry: .9, size: .24, cx: .62, cy: .62, alpha: .58 } },
    { name: 'PixelPilot', title: 'PixelPilot', url: 'https://pixel-pilot-ten.vercel.app/', img: PIXEL_IMG, iar: '1600 / 901', up: true, tag: 'An AI SaaS site, ready to ship.', type: 'AI SaaS · Website UI kit', ratio: '16 / 9',
      about: 'A website UI kit for an AI-powered design platform that turns ideas into editable interfaces. Designed in Figma with a dark visual style, interactive product previews, and responsive desktop and mobile layouts.',
      discipline: 'AI SaaS · Website UI kit', role: 'Product design · UI design · Design system', deliver: 'Landing page · Product page · Features · Pricing · Mobile layouts',
      bg: 'radial-gradient(ellipse 64% 72% at 66% 48%, #4d4a44 0%, #1c1b19 68%)', art: { kind: 'tube', n: 3.6, layers: 40, twist: 1.4, depth: 1.6, rx: .7, ry: -.4, size: .3, cx: .6, cy: .58, alpha: .58 } },
    { name: 'Ondrel', title: 'Ondrel', url: 'https://ondrel-psi.vercel.app/#hero', img: ONDREL_IMG, iar: '1600 / 783', tag: 'Clarity, structure, visual storytelling.', type: 'B2B SaaS · Website', ratio: '16 / 9',
      about: 'A modern B2B software website built around clarity, structure and strong visual storytelling.',
      discipline: 'UI/UX · Web Design · Visual Design', role: 'Product & Visual Designer', deliver: 'UX Flow · UI Design · Prototype · Responsive Screens · Design System',
      bg: 'radial-gradient(ellipse 60% 76% at 56% 54%, #42403b 0%, #191817 70%)', art: { kind: 'tube', n: 2.8, layers: 38, twist: .9, depth: 1.8, rx: .4, ry: .7, size: .3, cx: .64, cy: .6, alpha: .55 } },
    { name: 'Bongbuzzz', title: 'Bongbuzzz', tag: 'Bangla lettering with attitude.', type: 'Branding · Bangla lettering', ratio: '1 / 1.08',
      about: 'A Bangla brand direction for streetwear and visuals, with a brand board and a Bangla lettering approach, developed in Figma.',
      discipline: 'Branding · Bangla lettering', role: 'Brand direction, lettering', deliver: 'Brand board · Lettering direction',
      bg: 'radial-gradient(ellipse 66% 70% at 44% 50%, #4a463f 0%, #1b1a17 70%)', art: { kind: 'tube', n: 4.4, layers: 44, twist: 2.0, depth: 1.4, rx: .25, ry: .8, size: .3, cx: .62, cy: .6, alpha: .6 } }
  ];
  var NP = PROJECTS.length, pad = function (n) { return (n < 10 ? '0' : '') + n; };
  function drawCover(canvas, p, tilt, time) {
    if (!canvas) return;
    var pr = prep(canvas); if (!pr) return; var a = p.art, ctx = pr.ctx, w = pr.w, h = pr.h;
    if (a.kind === 'moshla') {
      ctx.fillStyle = 'rgba(244,241,234,.9)'; ctx.beginPath(); ctx.arc(w * .66, h * .36, Math.min(w, h) * .2, 0, 2 * PI); ctx.fill();
      ctx.strokeStyle = 'rgba(42,41,37,.75)'; ctx.lineWidth = .9;
      var cx = w * .66 + (tilt ? tilt.x * 8 : 0), base = h * .98, cw = w * .13;
      ctx.beginPath(); ctx.moveTo(cx - cw, h * .66); ctx.lineTo(cx, base); ctx.lineTo(cx + cw, h * .66); ctx.stroke();
      for (var i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(cx + i * cw / 3.4, h * .66 + Math.abs(i) * 2); ctx.lineTo(cx + i * cw * .12, base - 4); ctx.stroke(); }
      [[.0, .58, .17], [-.02, .47, .14]].forEach(function (s) { for (var r = 0; r < 14; r++) { ctx.beginPath(); ctx.ellipse(cx + s[0] * w, h * s[1], w * s[2] * (1 - r * .05), w * s[2] * .8 * (1 - r * .03), 0, 0, 2 * PI); ctx.strokeStyle = 'rgba(42,41,37,' + (.65 - r * .03) + ')'; ctx.stroke(); } });
      return;
    }
    if (a.kind === 'apexui') {
      // a small fitness-app screen in fine line-art: phone frame, activity rings, list rows
      var tx = tilt ? tilt.x * 6 : 0, ty = tilt ? tilt.y * 6 : 0;
      var pw = w * .64, ph = Math.min(h * .66, pw * 2.05), px = (w - pw) / 2 + tx, py = h * .07 + ty, rr = pw * .16;
      var rrect = function (x, y, ww, hh, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + ww, y, x + ww, y + hh, r); ctx.arcTo(x + ww, y + hh, x, y + hh, r); ctx.arcTo(x, y + hh, x, y, r); ctx.arcTo(x, y, x + ww, y, r); ctx.closePath(); };
      ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(237,235,230,.55)'; ctx.fillStyle = 'rgba(237,235,230,.045)';
      rrect(px, py, pw, ph, rr); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(237,235,230,.5)'; rrect(px + pw * .36, py + ph * .025, pw * .28, ph * .02, ph * .01); ctx.fill();
      var rcx = px + pw / 2, rcy = py + ph * .3, R = pw * .32;
      [[1, .78, '#E5572B'], [.76, .55, 'rgba(237,235,230,.85)'], [.52, .38, 'rgba(237,235,230,.5)']].forEach(function (r, k) {
        ctx.lineWidth = k === 0 ? 2.4 : 1.6; ctx.strokeStyle = 'rgba(237,235,230,.14)'; ctx.beginPath(); ctx.arc(rcx, rcy, R * r[0], 0, 2 * PI); ctx.stroke();
        ctx.strokeStyle = r[2]; ctx.beginPath(); ctx.arc(rcx, rcy, R * r[0], -PI / 2, -PI / 2 + 2 * PI * r[1]); ctx.stroke();
      });
      ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(237,235,230,.45)';
      for (var q = 0; q < 3; q++) {
        var ry0 = py + ph * (.55 + q * .12);
        ctx.beginPath(); ctx.arc(px + pw * .16, ry0 + ph * .035, pw * .05, 0, 2 * PI); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(px + pw * .28, ry0 + ph * .02); ctx.lineTo(px + pw * (.72 - q * .1), ry0 + ph * .02); ctx.moveTo(px + pw * .28, ry0 + ph * .05); ctx.lineTo(px + pw * (.5 - q * .06), ry0 + ph * .05); ctx.stroke();
      }
      return;
    }
    var loops = a.kind === 'torus' ? torusLoops(a) : tubeLoops(a, time || 0);
    drawLoops(ctx, w, h, loops, { rx: a.rx + (tilt ? tilt.y * .25 : 0), ry: a.ry + (tilt ? tilt.x * .35 : 0), size: a.size, cx: a.cx, cy: a.cy, color: FG, alpha: a.alpha, lw: .7 });
  }
  function buildCover(p, ratio, idx) {
    var el = document.createElement('div'); el.className = 'cover' + (p.light ? ' light' : ''); el.style.background = p.bg; if (ratio) el.style.aspectRatio = ratio;
    if (p.img) { el.classList.add('shot'); el.innerHTML = '<img src="' + p.img + '" alt="' + p.name + ' website preview" draggable="false">' + (idx != null ? '<span class="pn">' + pad(idx + 1) + ' / ' + pad(NP) + '</span>' : ''); return el; }
    el.innerHTML = '<canvas aria-hidden="true"></canvas>' + (idx != null ? '<span class="pn">' + pad(idx + 1) + ' / ' + pad(NP) + '</span>' : '') + '<div class="ct"><div class="brand">Pinki Ghosh Dastidar / Product design</div><div class="ttl' + (p.up ? ' up' : '') + (p.itl ? ' itl' : '') + '">' + p.title + '</div><div class="tg">' + p.tag + '</div><div class="ill">Illustrated cover</div></div>';
    return el;
  }
  var strip = $('#strip'), covers = [], dy = [0, 56, 16, 76, 8, 44, 24, 68, 12, 52], rot = [-1.6, 1.2, -.8, 1.6, -1.2, .8, -1, 1.4, -.6, 1];
  var arOf = function (r) { var q = String(r || '1 / 1').split('/'); return (parseFloat(q[0]) / parseFloat(q[1])) || 1; };
  PROJECTS.forEach(function (p, i) {
    var b = document.createElement('button'); b.type = 'button'; b.className = 'pcard'; b.setAttribute('data-cursor', 'View'); b.setAttribute('aria-label', 'Open ' + p.name);
    b.style.setProperty('--dy', dy[i] + 'px'); b.style.setProperty('--rot', rot[i] + 'deg'); b.style.setProperty('--ar', arOf(p.ratio));
    var pw = document.createElement('div'); pw.className = 'pw';
    var cov = buildCover(p, p.ratio, i); pw.appendChild(cov);
    var chip = document.createElement('span'); chip.className = 'pchip'; chip.setAttribute('aria-hidden', 'true'); chip.innerHTML = 'View the project &nearr;'; pw.appendChild(chip);
    var m = document.createElement('div'); m.className = 'pmeta'; m.innerHTML = '<b>' + p.name + ' <i>(' + pad(i + 1) + ')</i></b><span>' + p.type + '</span>'; pw.appendChild(m);
    b.appendChild(pw);
    strip.appendChild(b); covers.push({ p: p, canvas: $('canvas', cov) });
    b.addEventListener('click', function () { if (dragged) { dragged = false; return; } openDetail(i); });
  });
  function drawAllCovers() { covers.forEach(function (c) { drawCover(c.canvas, c.p, null, 0); }); }
  // Works: pinned horizontal travel on desktop; swipeable strip when flat (mobile / reduced motion)
  var wSec = $('#work'), wBox = $('#wBox'), wCount = $('#wCount'), pcards = $$('.pcard'), worksFlat = null, wP = null, wLast = performance.now(), wMax = 0, wLeft = [], wWid = [];
  $('#wAll').addEventListener('click', function () { openDetail(0); });
  var down = false, sx = 0, sl = 0, dragged = false;
  strip.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse' || !worksFlat) return; down = true; dragged = false; sx = e.clientX; sl = strip.scrollLeft; });
  addEventListener('pointermove', function (e) { if (!down) return; var dx = e.clientX - sx; if (Math.abs(dx) > 5) { dragged = true; strip.classList.add('drag'); } if (dragged) strip.scrollLeft = sl - dx; });
  addEventListener('pointerup', function () { down = false; strip.classList.remove('drag'); setTimeout(function () { dragged = false; }, 0); });
  strip.addEventListener('scroll', function () { if (!worksFlat) return; var p = strip.scrollLeft / Math.max(1, strip.scrollWidth - strip.clientWidth); wCount.textContent = pad(Math.round(p * (NP - 1)) + 1) + ' / ' + pad(NP); }, { passive: true });
  function layoutWorks() {
    var flat = innerWidth <= 900 || reduce;
    if (flat !== worksFlat) {
      worksFlat = flat; wSec.classList.toggle('flat', flat);
      if (flat) { strip.style.transform = ''; pcards.forEach(function (c) { c.firstChild.style.removeProperty('--sc'); }); }
    }
    if (flat) { wBox.style.height = ''; return; }
    wBox.style.height = '';
    var g = parseFloat(getComputedStyle(strip).paddingLeft) || 0, last = pcards[pcards.length - 1];
    wLeft = pcards.map(function (c) { return c.offsetLeft; }); wWid = pcards.map(function (c) { return c.offsetWidth; });
    wMax = Math.max(0, last.offsetLeft + last.offsetWidth + g - innerWidth);
    wBox.style.height = Math.round(innerHeight + wMax * 2.1 + innerHeight * .55) + 'px';
  }
  function updateWorks() {
    if (worksFlat) return;
    var r = wBox.getBoundingClientRect(), total = Math.max(1, wBox.offsetHeight - innerHeight), tgt = clamp(-r.top / (total - innerHeight * .55), 0, 1), now = performance.now(), dt = Math.min(.1, (now - wLast) / 1000);
    wLast = now; if (wP === null) wP = tgt; wP += (tgt - wP) * (1 - Math.exp(-dt * 5.5)); if (Math.abs(tgt - wP) < .00005) wP = tgt;
    var p = wP, x = p * wMax;
    strip.style.transform = 'translate3d(' + (-x).toFixed(2) + 'px,0,0)';
    var focus = innerWidth * (.12 + .76 * p), best = 0, bd = 1e9;
    pcards.forEach(function (c, i) {
      var cx = wLeft[i] + wWid[i] / 2 - x, d = Math.abs(cx - focus);
      if (d < bd) { bd = d; best = i; }
      c.firstChild.style.setProperty('--sc', (1 + .1 * clamp(1 - d / (innerWidth * .34), 0, 1)).toFixed(4));
    });
    var t = pad(best + 1) + ' / ' + pad(NP); if (wCount.textContent !== t) wCount.textContent = t;
  }
  layoutWorks(); addEventListener('resize', function () { clearTimeout(layoutWorks.t); layoutWorks.t = setTimeout(layoutWorks, 120); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layoutWorks);
  addEventListener('load', layoutWorks);

  /* ---------- Hero bento ---------- */
  var BENTO = [
    { k: 'stat', cls: 't1 v', big: '06', txt: '<em>Related expertise</em>UI design, AI Visuals, Motion Graphics, No Code, Branding', href: '#services' },
    { k: 'proj', cls: 't2 fit dk', i: 0, lbl: 'Fintech SaaS' },
    { k: 'proj', cls: 't3', i: 8, lbl: 'Web design' },
    { k: 'proj', cls: 't4 fit', i: 2, lbl: 'AI Revenue Pipeline SaaS' },
    { k: 'note', cls: 't5', big: 'Dashboards, onboarding and AI features', txt: 'What I design ↗', href: '#services' },
    { k: 'proj', cls: 't6', i: 5, lbl: 'UX/UI' },
    { k: 'stat', cls: 't7 l', big: '10', txt: 'Featured selection 10&nbsp;projects', href: '#work' }
  ];
  var bento = $('#bento'), bentoArt = [];
  BENTO.forEach(function (d, n) {
    var el;
    if (d.k === 'proj') {
      var p = PROJECTS[d.i]; el = document.createElement('button'); el.type = 'button'; el.setAttribute('aria-label', 'Open ' + p.name);
      if (p.img) {
        el.style.background = '#0a0a0b'; el.classList.add('shot'); el.innerHTML = '<img src="' + p.img + '" alt="" draggable="false"><div class="lb"><b>' + p.name + '</b><span>' + (d.lbl || p.type) + '</span></div>';
        el.addEventListener('click', function () { openDetail(d.i); });
        el.className = 'btile shot ' + d.cls; el.style.setProperty('--i', n); el.setAttribute('data-cursor', 'View'); bento.appendChild(el); return;
      }
      el.style.background = p.bg; el.innerHTML = '<canvas aria-hidden="true"></canvas><div class="lb"><b' + (d.up ? ' class="up"' : '') + '>' + p.name + '</b><span>' + (d.lbl || p.type) + '</span></div>';
      el.addEventListener('click', function () { openDetail(d.i); });
      var cv = $('canvas', el), tilt = { x: 0, y: 0 }, raf = 0, fake = { art: d.art };
      bentoArt.push(function () { drawCover(cv, fake, null, 0); });
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect(); tilt.x = (e.clientX - r.left) / r.width - .5; tilt.y = (e.clientY - r.top) / r.height - .5;
        if (!raf && !reduce) raf = requestAnimationFrame(function () { raf = 0; drawCover(cv, fake, tilt, 0); });
      });
      el.addEventListener('pointerleave', function () { drawCover(cv, fake, null, 0); });
    } else {
      el = document.createElement('a'); el.href = d.href;
      if (d.k === 'stat') el.innerHTML = '<div class="in"><b>' + d.big + '</b><span>' + d.txt + '</span></div>';
      else el.innerHTML = '<div class="in"><b>' + d.big + '</b><span>' + d.txt + '</span></div>';
    }
    el.className = 'btile ' + (d.k === 'proj' ? '' : d.k + ' ') + d.cls; el.style.setProperty('--i', n); el.setAttribute('data-cursor', 'View');
    bento.appendChild(el);
  });
  function drawBento() { bentoArt.forEach(function (f) { f(); }); }

  /* ---------- Detail overlay ---------- */
  var detail = $('#detail'), current = -1, lastFocus = null;
  function renderDetail(i) {
    var p = PROJECTS[i], prev = PROJECTS[(i + NP - 1) % NP], next = PROJECTS[(i + 1) % NP];
    detail.innerHTML = '<div class="bar"><span>Pinki Ghosh Dastidar</span><span class="c">Selected work / ' + pad(i + 1) + ' of ' + pad(NP) + '</span><span class="x"><button id="d-close" type="button" style="display:inline-flex;gap:12px;align-items:center;letter-spacing:.14em;text-transform:uppercase">All works <b aria-hidden="true">×</b></button></span></div>' +
      '<h2 class="big">' + p.name + '</h2>' +
      '<div class="facts"><div><div class="lab">About the project</div><p>' + p.about + '</p></div><div class="stack"><div><div class="lab">Discipline</div><p>' + p.discipline + '</p></div><div><div class="lab">Deliverables</div><p>' + p.deliver + '</p></div></div><div><div class="lab">Role</div><p>' + p.role + '</p>' + (p.url ? '<a class="live" href="' + p.url + '" target="_blank" rel="noopener">' + (/figma\.com/.test(p.url) ? 'View in Figma' : 'View live site') + ' &#8599;</a>' : '') + '</div></div>' +
      '<div class="bigcov"></div>' +
      '<div class="next"><button type="button" id="d-prev"><span class="lab">← Previous</span><span class="nx">' + prev.name + '</span></button><button type="button" id="d-next"><span class="lab">Next →</span><span class="nx">' + next.name + '</span></button></div>';
    var cov = buildCover(p, null, null); $('.bigcov', detail).appendChild(cov); if (p.img && p.iar) $('.bigcov', detail).style.aspectRatio = p.iar;
    requestAnimationFrame(function () { drawCover($('canvas', cov), p, null, 0); });
    $('#d-close').addEventListener('click', closeDetail);
    $('#d-prev').addEventListener('click', function () { openDetail((i + NP - 1) % NP, true); });
    $('#d-next').addEventListener('click', function () { openDetail((i + 1) % NP, true); });
  }
  function openDetail(i, swap) {
    if (!swap) lastFocus = document.activeElement; current = i; cur.classList.remove('big'); renderDetail(i); detail.scrollTop = 0;
    detail.setAttribute('aria-hidden', 'false'); document.body.classList.add('locked');
    requestAnimationFrame(function () { detail.classList.add('open'); var c = $('#d-close'); if (c) c.focus({ preventScroll: true }); });
  }
  function closeDetail() {
    cur.classList.remove('big'); detail.classList.remove('open'); detail.setAttribute('aria-hidden', 'true'); document.body.classList.remove('locked'); current = -1;
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }
  addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && current > -1) closeDetail();
    if (current > -1 && e.key === 'ArrowRight') openDetail((current + 1) % NP, true);
    if (current > -1 && e.key === 'ArrowLeft') openDetail((current + NP - 1) % NP, true);
  });
  $$('[data-open]').forEach(function (a) { a.addEventListener('click', function (e) { e.preventDefault(); openDetail(+a.getAttribute('data-open')); }); });

  /* ---------- Method: process staircase ---------- */
  var box = $('#methodBox'), pin = $('.pin', box), stages = $$('.stage', box), mSt = $('#mStages'), mBase = $('#mBase'), mFill = $('#mFill'), mHead = $('#mHead'), tlg = $$('.mtl .g', box), capN = $('#capN'), capT = $('#capT'), capS = $('#capS');
  var MN = [['Understand', 'Discovery'], ['Structure', 'Flows'], ['Design', 'Interface'], ['Prove', 'Validation']], wasFlat = null, mT = 0, mLast = performance.now(), mLen = 0, mC = 0, mS = 0, mA = -1;
  function layoutMethod() {
    if (wasFlat) return;
    var w = mSt.clientWidth, c = w / 4, sy = stages[1].offsetTop - stages[0].offsetTop, d = 'M0 .5 H' + c;
    for (var i = 1; i < 4; i++) d += ' V' + (i * sy + .5) + ' H' + ((i + 1) * c);
    mBase.setAttribute('d', d); mFill.setAttribute('d', d); mLen = mBase.getTotalLength(); mC = c; mS = sy;
    mFill.style.strokeDasharray = mLen;
  }
  stages.forEach(function (st, i) {
    var go = function () {
      if (wasFlat) { st.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' }); return; }
      var top = box.getBoundingClientRect().top + scrollY, total = box.offsetHeight - innerHeight;
      scrollTo({ top: top + ((i + .9) / 4) * total, behavior: reduce ? 'auto' : 'smooth' });
    };
    st.addEventListener('click', go);
    st.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
  });
  if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { pin.classList.toggle('go', es[0].isIntersecting); }, { threshold: .01, rootMargin: '0px 0px -12% 0px' }).observe(pin); else pin.classList.add('go');
  function updateMethod() {
    var flat = innerWidth <= 900 || reduce;
    if (flat !== wasFlat) { wasFlat = flat; box.classList.toggle('flat', flat); if (!flat) layoutMethod(); }
    if (flat || !mLen) { if (!flat) layoutMethod(); return; }
    var r = box.getBoundingClientRect(), total = Math.max(1, box.offsetHeight - innerHeight), T = clamp(-r.top / total, 0, 1);
    var now = performance.now(), dt = Math.min(.1, (now - mLast) / 1000); mLast = now;
    mT += (T - mT) * (1 - Math.exp(-dt * 7)); if (Math.abs(T - mT) < .0002) mT = T;
    var T4 = clamp(mT * 4, 0, 3.9999), a = Math.floor(T4), e = clamp((T4 - a) / .85, 0, 1); e = e * e * (3 - 2 * e);
    var d = Math.min(mLen, (a + e) * (mC + mS)), pt = mBase.getPointAtLength(d);
    mFill.style.strokeDashoffset = (mLen - d).toFixed(2); mHead.setAttribute('cx', pt.x.toFixed(2)); mHead.setAttribute('cy', pt.y.toFixed(2));
    if (a !== mA) {
      mA = a;
      stages.forEach(function (st, i) { st.classList.toggle('on', i === a); st.classList.toggle('done', i < a); });
      tlg.forEach(function (g, i) { g.classList.toggle('on', i === a); });
      capN.textContent = 'Step 0' + (a + 1); capT.textContent = MN[a][0]; capS.textContent = MN[a][1];
    }
  }
  layoutMethod(); addEventListener('resize', function () { clearTimeout(layoutMethod.t); layoutMethod.t = setTimeout(layoutMethod, 120); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layoutMethod);
  addEventListener('load', layoutMethod);

  /* ---------- Services focus ---------- */
  var svc = $$('#svc article');
  function updateServices() {
    var mid = innerHeight * .5, best = -1, bd = 1e9;
    svc.forEach(function (a, i) { var r = a.getBoundingClientRect(), d = Math.abs(r.top + r.height / 2 - mid); if (r.bottom > 0 && r.top < innerHeight && d < bd) { bd = d; best = i; } });
    svc.forEach(function (a, i) { a.classList.toggle('on', i === best || reduce); });
  }

  /* ---------- Copy email ---------- */
  var copyBtn = $('#copy');
  copyBtn.addEventListener('click', function () {
    var done = function () { copyBtn.textContent = 'Copied'; copyBtn.classList.add('done'); setTimeout(function () { copyBtn.textContent = 'Copy'; copyBtn.classList.remove('done'); }, 1800); };
    var fallback = function () { var r = document.createRange(); r.selectNodeContents($('.mail a')); var s = getSelection(); s.removeAllRanges(); s.addRange(r); copyBtn.textContent = 'Ctrl/Cmd + C'; };
    try { navigator.clipboard.writeText('pinkigd@gmail.com').then(done, fallback); } catch (e) { fallback(); }
  });

  /* ---------- Cursor ---------- */
  var cur = $('#cur'), cx = -100, cy = -100, sx2 = -100, sy2 = -100;
  addEventListener('pointermove', function (e) { if (e.pointerType === 'touch') return; cx = e.clientX; cy = e.clientY; cur.classList.add('on'); }, { passive: true });
  document.addEventListener('pointerleave', function () { cur.classList.remove('on'); });
  document.addEventListener('pointerover', function (e) { var t = e.target.closest ? e.target.closest('[data-cursor]') : null; cur.classList.toggle('big', !!t && (t.classList.contains('pcard') || t.classList.contains('btile'))); });

  /* ---------- Reveal on scroll ---------- */
  var rv = $$('.rv');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { rootMargin: '0px 0px -6% 0px', threshold: .05 });
    rv.forEach(function (el) { io.observe(el); }); setTimeout(function () { rv.forEach(function (el) { el.classList.add('in'); }); }, 6000);
  } else { rv.forEach(function (el) { el.classList.add('in'); }); }

  /* ---------- Loop ---------- */
  var t0 = performance.now(), methodVisible = false, drawnStatic = false;
  if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { methodVisible = es[0].isIntersecting; }, { rootMargin: '100px' }).observe(box); else methodVisible = true;
  function frame(now) {
    updateReveal(); updateWorks(); updateMethod(); updateServices();
    sx2 = lerp(sx2, cx, .22); sy2 = lerp(sy2, cy, .22); cur.style.transform = 'translate(' + sx2.toFixed(1) + 'px,' + sy2.toFixed(1) + 'px)';
    requestAnimationFrame(frame);
  }
  function redraw() { drawAllCovers(); drawBento(); }
  redraw(); addEventListener('resize', function () { clearTimeout(redraw.t); redraw.t = setTimeout(redraw, 120); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(redraw);
  requestAnimationFrame(frame);
})();
