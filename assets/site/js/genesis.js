// Genesis: the hero portrait, one particle per day in IT.
// Targets come from a luma map (black = empty), stippled with error diffusion so the
// density follows the light, with extra density on the face. Days settle bottom-up in
// date order, so the vessel fills like sediment and the scale on the glass shows real years.

const Q = 8; // luminance levels per era in the palette
const SEAM = 0.0045; // half-height (portrait units) of the seam line that marks a tint era's edges

const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a.toFixed(3)})`;
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const easeOut = (k) => 1 - Math.pow(1 - k, 3);
function rng(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

function loadLuma(src) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data, n = c.width * c.height, lum = new Float32Array(n);
      for (let i = 0; i < n; i++) lum[i] = d[i * 4] / 255;
      res({ lum, w: c.width, h: c.height });
    };
    img.onerror = rej;
    img.src = src;
  });
}

// Stippling: density map, error diffusion (Floyd-Steinberg), then exactly N points.
function stipple({ lum, w, h }, N) {
  const wt = new Float32Array(w * h);
  let sum = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, l = lum[i];
    if (l < 0.02) continue;
    const ex = (x / w - 0.54) / 0.2, ey = (y / h - 0.285) / 0.185;
    const face = clamp(1 - (ex * ex + ey * ey), 0, 1);
    const fm = Math.sqrt(face);
    // face: steep curve so eyes, brows and mouth read as gaps; body: soft curve + floor for the silhouette
    const v = fm > 0 ? (1 - fm) * (0.05 + 0.95 * Math.pow(l, 1.6)) + fm * 4.2 * Math.pow(l, 1.9) : 0.05 + 0.95 * Math.pow(l, 1.6);
    wt[i] = v; sum += v;
  }
  let k = N / sum;
  for (let it = 0; it < 12; it++) { let s = 0; for (let i = 0; i < wt.length; i++) s += Math.min(1, wt[i] * k); k *= N / s; }
  const D = new Float32Array(w * h);
  for (let i = 0; i < D.length; i++) D[i] = Math.min(1, wt[i] * k);
  const pts = [];
  for (let y = 0; y < h; y++) {
    const ltr = (y & 1) === 0;
    for (let xi = 0; xi < w; xi++) {
      const x = ltr ? xi : w - 1 - xi, i = y * w + x, v = D[i];
      const on = v >= 0.5 ? 1 : 0, err = v - on;
      if (on && lum[i] >= 0.02) pts.push(i);
      const dx = ltr ? 1 : -1;
      if (x + dx >= 0 && x + dx < w) D[i + dx] += err * 7 / 16;
      if (y + 1 < h) {
        if (x - dx >= 0 && x - dx < w) D[i + w - dx] += err * 3 / 16;
        D[i + w] += err * 5 / 16;
        if (x + dx >= 0 && x + dx < w) D[i + w + dx] += err / 16;
      }
    }
  }
  const r = rng(7);
  while (pts.length > N) pts.splice(Math.floor(r() * pts.length), 1);
  while (pts.length < N) pts.push(pts[Math.floor(r() * pts.length)]);
  return pts;
}

export function createGenesis(o) {
  const { glass, canvas, ticks, days: N, eraOf, tel, onDone, fmtDay } = o;
  const LOC = o.locale || 'en-US'; // number format of the page language
  const ctx = canvas.getContext('2d', { alpha: true });
  // Palettes are built once: every fillStyle used per frame is a cached string.
  const { eraRGB: ERA_RGB, coreRGB: CORE_RGB, heatRGB: HEAT, eraIntensity } = o;
  const BASE = [], DIM = [], JBASE = [], JDIM = [], HOT = [], WAVE = [];
  // a tint era (intensity < 1, e.g. maintenance) is drawn in the green of the era before it, at its own intensity;
  // only its seam (see below) keeps the era's own colour
  const TINT = ERA_RGB.map((_, e) => (eraIntensity[e] ?? 1) < 1);
  for (let e = 0; e < ERA_RGB.length; e++) for (let q = 0; q < Q; q++) {
    const l = q / (Q - 1), k = eraIntensity[e] ?? 1;
    const src = TINT[e] && e > 0 ? ERA_RGB[e - 1] : ERA_RGB[e];
    const c = src.map((v) => Math.min(255, v * k * (0.42 + 0.72 * l)));
    BASE.push(rgba(c, 0.62 + 0.38 * l));
    DIM.push(rgba(c, 0.1));
    const j = ERA_RGB[e].map((v) => Math.min(255, v * (0.42 + 0.72 * l)));
    JBASE.push(rgba(j, 0.75 + 0.25 * l));
    JDIM.push(rgba(j, 0.1));
  }
  const colorOf = (i, dim) => (JN[i] ? (dim ? JDIM : JBASE) : dim ? DIM : BASE)[STY[i]];
  for (let i = 0; i < 16; i++) { const T = i / 15; const c = T > 0.5 ? mix(HEAT[1], HEAT[2], (T - 0.5) * 2) : mix(HEAT[0], HEAT[1], T * 2); HOT.push(rgba(c, 0.5 + 0.5 * T)); }
  for (let k = 0; k < CORE_RGB.length; k++) WAVE.push(rgba(CORE_RGB[k], 1), rgba(mix(CORE_RGB[k], [255, 255, 255], 0.15), 0.55));

  const low = () => o.low();
  // struct of arrays
  const TX = new Float32Array(N), TY = new Float32Array(N), L = new Float32Array(N), ED = new Float32Array(N);
  const ERA = new Uint8Array(N), STY = new Uint16Array(N);
  const X = new Float32Array(N), Y = new Float32Array(N), VX = new Float32Array(N), VY = new Float32Array(N);
  const HX = new Float32Array(N), HY = new Float32Array(N), SX = new Float32Array(N), SY = new Float32Array(N);
  const ARR = new Uint8Array(N), JN = new Uint8Array(N); // JN: seam particles, drawn in the era's own colour
  let W = 0, H = 0, DPR = 1, IAR = 0.696, phase = 'idle', raf = 0, t0 = 0, DUR = null, wells = [], visible = true, sleeping = true;
  let lastPhase = '', focus = -1, waveT0 = -1, pendingWave = false, slow = 0, lastTs = 0, ready = false, frameTel = 0, nudged = false;
  const ptr = { x: -1e4, y: -1e4 };
  let yearMarks = [];

  const fit = () => { let h = H * 0.98, w = h * IAR; if (w > W) { w = W; h = W / IAR; } return { x: (W - w) / 2, y: H - h, w, h }; };

  const readyP = loadLuma(o.src).then((map) => {
    IAR = map.w / map.h;
    const pts = stipple(map, N);
    const r = rng(3);
    const cand = pts.map((i) => {
      const px = i % map.w, py = (i / map.w) | 0;
      const x = (px + 0.15 + r() * 0.7) / map.w, y = (py + 0.15 + r() * 0.7) / map.h;
      // Sobel magnitude: contour particles carry the energy wave
      const g = (xx, yy) => map.lum[clamp(yy, 0, map.h - 1) * map.w + clamp(xx, 0, map.w - 1)];
      const gx = g(px + 1, py - 1) + 2 * g(px + 1, py) + g(px + 1, py + 1) - g(px - 1, py - 1) - 2 * g(px - 1, py) - g(px - 1, py + 1);
      const gy = g(px - 1, py + 1) + 2 * g(px, py + 1) + g(px + 1, py + 1) - g(px - 1, py - 1) - 2 * g(px, py - 1) - g(px + 1, py - 1);
      // layers are not ruler-straight: a slow wobble keeps the strata organic
      const key = y + 0.022 * Math.sin(x * 8.5 + 1.3) + 0.012 * Math.sin(x * 21);
      return { x, y, l: map.lum[i], e: Math.min(1, Math.hypot(gx, gy) / 2.2), key };
    });
    cand.sort((a, b) => b.key - a.key); // bottom first: day 0 at the base
    for (let d = 0; d < N; d++) {
      const c = cand[d];
      TX[d] = c.x; TY[d] = c.y; ED[d] = c.e;
      const l = clamp(0.08 + c.l * 1.05, 0, 1); L[d] = l;
      ERA[d] = eraOf(d);
      STY[d] = ERA[d] * Q + Math.round(l * (Q - 1));
    }
    // the seam of a tint era: the particles in one or two rows at its lower and upper edge keep the era's own colour
    for (let e = 0; e < ERA_RGB.length; e++) {
      if (!TINT[e]) continue;
      let s = -1, t = -1;
      for (let d = 0; d < N; d++) if (ERA[d] === e) { if (s < 0) s = d; t = d; }
      if (s < 0) continue;
      for (const b of [s, t]) for (let d = s; d <= t; d++) if (Math.abs(TY[d] - TY[b]) < SEAM) JN[d] = 1;
    }
    // where each even year starts, for the scale on the glass
    yearMarks = [];
    for (let yr = 2018; yr <= 2030; yr += 2) {
      const d = o.dayOf(Date.UTC(yr, 0, 1));
      if (d >= N) break;
      const from = Math.max(0, d), to = Math.min(N, from + 40);
      let s = 0; for (let k = from; k < to; k++) s += TY[k];
      yearMarks.push({ yr, y: s / (to - from) });
    }
    ready = true;
    resize();
  });

  function resize() {
    const b = glass.getBoundingClientRect();
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = b.width; H = b.height;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    if (!ready) return;
    home();
    placeTicks();
    if (phase === 'done' || phase === 'static') { for (let i = 0; i < N; i++) { X[i] = HX[i]; Y[i] = HY[i]; } draw(performance.now()); }
  }
  function home() { const fb = fit(); for (let i = 0; i < N; i++) { HX[i] = fb.x + TX[i] * fb.w; HY[i] = fb.y + TY[i] * fb.h; } }
  function placeTicks() {
    if (!ticks) return;
    const fb = fit();
    ticks.innerHTML = yearMarks.map((m) => `<span style="top:${(((fb.y + m.y * fb.h) / H) * 100).toFixed(2)}%">${String(m.yr).slice(2)}</span>`).join('');
  }
  new ResizeObserver(() => resize()).observe(glass);

  // ---------- drawing ----------
  function sizeOf(i) {
    const face = TY[i] < 0.46;
    let s = (face ? 1.25 : 1.5) + L[i] * (face ? 0.85 : 1.0);
    if (focus === ERA[i]) s = 2.3 + L[i] * 0.6;
    return Math.max(1, Math.round(s * DPR));
  }
  function draw(now) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let wk = -1, front = 0, band = 0.62;
    if (waveT0 >= 0) { wk = Math.max(0, (now - waveT0) / 1800); // rAF time can precede waveT0 by a frame
      if (wk >= 1) { waveT0 = -1; wk = -1; } else front = -0.05 + easeInOut(wk) * (1 + band + 0.1); }
    const fb = fit();
    let last = '';
    for (let i = 0; i < N; i++) {
      let st = colorOf(i, focus >= 0 && ERA[i] !== focus);
      if (wk >= 0) {
        const ny = (HY[i] - fb.y) / fb.h, dd = front - ny; // 0 at the wave front, grows upward
        if (dd > 0 && dd < band) { const nc = CORE_RGB.length, k = Math.min(nc - 1, ((dd / band) * nc) | 0); st = ED[i] > 0.22 ? WAVE[k * 2] : WAVE[k * 2 + 1]; }
      }
      if (st !== last) { ctx.fillStyle = st; last = st; }
      const s = sizeOf(i);
      ctx.fillRect(Math.round(X[i] * DPR - s / 2), Math.round(Y[i] * DPR - s / 2), s, s);
    }
    return wk >= 0;
  }
  const easeInOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

  // ---------- boot ----------
  function setTel(t, Tn, f, day, label) {
    if (++frameTel % 2 && label === undefined) return; // telemetry every other frame
    tel.T.textContent = t.toFixed(2) + ' s';
    tel.K.textContent = f > 0 ? Math.round(3000 * Math.pow(1 - Math.min(f, 1), 2) + 2.7).toLocaleString(LOC) + ' K' : '10^' + Math.round(9 + Tn * 23) + ' K';
    tel.D.textContent = f > 0 ? fmtDay(Math.min(day, N - 1)) : '—';
    tel.N.textContent = (f > 0 ? day : N).toLocaleString(LOC);
  }
  function setPhase(p) { if (lastPhase !== p) { lastPhase = p; tel.P.textContent = o.label(p); o.status(p); } }

  function boot(full) {
    cancelAnimationFrame(raf); sleeping = true;
    if (!ready) { readyP.then(() => boot(full)); return; }
    glass.classList.remove('formed');
    if (low()) { toStatic(); return; }
    const rich = full || o.firstBoot();
    DUR = rich ? { bang: 0.25, plasma: 0.55, form: 1.5, settle: 0.2 } : { bang: 0.06, plasma: 0.14, form: 0.5, settle: 0.1 };
    const r = rng(11);
    for (let i = 0; i < N; i++) {
      X[i] = 0.5 + (r() - 0.5) * 0.01; Y[i] = 0.46 + (r() - 0.5) * 0.01;
      const a = r() * 6.283, s = 0.004 + r() * 0.022;
      VX[i] = Math.cos(a) * s; VY[i] = Math.sin(a) * s * 1.25; ARR[i] = 0;
    }
    wells = [...Array(5)].map((_, k) => ({ x: 0.2 + r() * 0.6, y: 0.2 + r() * 0.6, f: 0.6 + k * 0.3 }));
    phase = 'run'; slow = 0; lastTs = 0; lastPhase = ''; o.onStart();
    t0 = performance.now();
    raf = requestAnimationFrame(run);
  }

  function run(ts) {
    const c0 = performance.now();
    let t = Math.max(0, (ts - t0) / 1000);
    const { bang, plasma, form, settle } = DUR;
    // two slow frames in a row: jump to a compressed nucleosynthesis
    if (slow >= 2 && t < bang + plasma + form * 0.5 && DUR.form > 0.5) {
      DUR = { bang, plasma, form: 0.5, settle: 0.1 }; t0 = ts - (bang + plasma) * 1000; t = bang + plasma; slow = 0;
    }
    const T = Math.max(0, 1 - t / (bang + plasma)), f = Math.max(0, (t - bang - plasma) / DUR.form);
    const fb = fit(), day = Math.floor(Math.min(1, f) * N);
    setPhase(t < bang ? 'expansion' : t < bang + plasma ? 'plasma' : f < 1 ? 'nucleosynthesis' : 'structure');
    setTel(t, T, f, day);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'lighter';
    for (const w of wells) { w.x += Math.cos(t * w.f) * 0.0008; w.y += Math.sin(t * w.f) * 0.0008; }
    // the cloud cools but stays visible while it feeds the portrait
    const hot = HOT[Math.round(Math.max(T, f > 0 ? 0.3 : 0.38) * 15)], travel = 0.16;
    let last = '';
    for (let i = 0; i < N; i++) {
      const born = i / N;
      let st, s, px, py;
      if (f > 0 && born < f) {
        if (!ARR[i]) { ARR[i] = 1; SX[i] = X[i]; SY[i] = Y[i]; }
        const k = Math.min(1, (f - born) / travel), e = easeOut(k);
        const tx = (fb.x + TX[i] * fb.w) / W, ty = (fb.y + TY[i] * fb.h) / H;
        X[i] = SX[i] + (tx - SX[i]) * e; Y[i] = SY[i] + (ty - SY[i]) * e;
        st = k < 0.55 ? HOT[15] : colorOf(i, false);
        s = k < 1 ? 1.8 : 1.4 + L[i] * 0.9;
      } else {
        VX[i] += (Math.random() - 0.5) * 0.0016; VY[i] += (Math.random() - 0.5) * 0.0016;
        if (t > bang) for (const w of wells) { const dx = w.x - X[i], dy = w.y - Y[i], d2 = dx * dx + dy * dy + 0.002; VX[i] += (dx / d2) * 0.000018; VY[i] += (dy / d2) * 0.000018; }
        VX[i] *= 0.965; VY[i] *= 0.965; X[i] += VX[i]; Y[i] += VY[i];
        if (X[i] < 0 || X[i] > 1) VX[i] *= -1;
        if (Y[i] < 0 || Y[i] > 1) VY[i] *= -1;
        st = hot; s = 1.6 + T * 1.4;
      }
      if (st !== last) { ctx.fillStyle = st; last = st; }
      const sp = Math.max(1, Math.round(s * DPR));
      px = X[i] * W * DPR; py = Y[i] * H * DPR;
      ctx.fillRect(Math.round(px - sp / 2), Math.round(py - sp / 2), sp, sp);
    }
    if (t < bang) {
      const g = ctx.createRadialGradient(W * DPR / 2, H * DPR * 0.46, 0, W * DPR / 2, H * DPR * 0.46, Math.min(W, H) * DPR * 0.6 * (t / bang + 0.1));
      g.addColorStop(0, `rgba(255,248,230,${0.9 * (1 - t / bang)})`); g.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.globalCompositeOperation = 'source-over';
    // our own cost per frame: two in a row over budget means this device cannot keep up
    const cost = performance.now() - c0;
    if (++lastTs > 3) slow = cost > 14 ? slow + 1 : 0;
    if (t < bang + plasma + DUR.form + settle) raf = requestAnimationFrame(run);
    else finish();
  }

  function finish() {
    phase = 'done';
    for (let i = 0; i < N; i++) { X[i] = HX[i]; Y[i] = HY[i]; VX[i] = 0; VY[i] = 0; }
    glass.classList.add('formed');
    if (!nudged && !low()) { nudged = true; pulseCores(); } // once per page load
    if (o.hint) showHint(o.hint);
    setPhase('structure');
    tel.T.textContent = (DUR ? DUR.bang + DUR.plasma + DUR.form + DUR.settle : 0).toFixed(2) + ' s';
    tel.K.textContent = '2.7 K'; tel.D.textContent = fmtDay(N - 1); tel.N.textContent = N.toLocaleString(LOC);
    onDone();
    draw(performance.now());
    if (pendingWave) startWave();
  }
  function toStatic() {
    cancelAnimationFrame(raf); sleeping = true; DUR = null;
    finish(); phase = 'static';
  }

  // ---------- the cores invite the scroll: a single micro-pulse on their outlines after the boot ----------
  // The hint text comes from the content key hero.coresHint, passed as createGenesis({ hint }) or via genesis.hint(text).
  // It fills <p id="coreHint" hidden> in the page and shows it.
  function pulseCores() {
    document.querySelectorAll('[data-core]:not(.lit)').forEach((el) => {
      el.classList.add('nudge');
      el.addEventListener('animationend', () => el.classList.remove('nudge'), { once: true });
    });
  }
  function showHint(text) {
    const el = document.getElementById('coreHint');
    if (el && text) { el.textContent = text; el.hidden = false; }
  }

  // ---------- idle: pointer repulsion with a spring, sleeps at rest ----------
  function wake() { if (phase !== 'done' || low() || !sleeping) return; sleeping = false; raf = requestAnimationFrame(idle); }
  function idle(now) {
    if (!visible || document.hidden || phase !== 'done') { sleeping = true; return; }
    let energy = 0;
    const R = 70, R2 = R * R;
    for (let i = 0; i < N; i++) {
      const dx = X[i] - ptr.x, dy = Y[i] - ptr.y, d2 = dx * dx + dy * dy;
      if (d2 < R2) { const f = ((1 - d2 / R2) * 2.2) / Math.sqrt(d2 + 1); VX[i] += dx * f; VY[i] += dy * f; }
      VX[i] += (HX[i] - X[i]) * 0.06; VY[i] += (HY[i] - Y[i]) * 0.06;
      VX[i] *= 0.82; VY[i] *= 0.82; X[i] += VX[i]; Y[i] += VY[i];
      energy += Math.abs(VX[i]) + Math.abs(VY[i]);
    }
    const waving = draw(now);
    if (energy < 0.5 && ptr.x < -1e3 && !waving) {
      for (let i = 0; i < N; i++) { X[i] = HX[i]; Y[i] = HY[i]; }
      draw(now); sleeping = true; return;
    }
    raf = requestAnimationFrame(idle);
  }
  function shock(x, y) {
    if (phase !== 'done' || low()) return;
    for (let i = 0; i < N; i++) {
      const dx = X[i] - x, dy = Y[i] - y, d = Math.hypot(dx, dy) + 1;
      if (d < 140) { const f = ((140 - d) / 140) * 9; VX[i] += (dx / d) * f; VY[i] += (dy / d) * f; }
    }
    wake();
  }
  const local = (e) => { const b = canvas.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
  canvas.addEventListener('pointermove', (e) => { [ptr.x, ptr.y] = local(e); wake(); }, { passive: true });
  canvas.addEventListener('pointerleave', () => { ptr.x = ptr.y = -1e4; });
  canvas.addEventListener('pointercancel', () => { ptr.x = ptr.y = -1e4; });
  canvas.addEventListener('pointerdown', (e) => { const [x, y] = local(e); if (e.pointerType !== 'mouse') shock(x, y); }, { passive: true });

  new IntersectionObserver((es) => {
    visible = es[0].isIntersecting;
    if (visible && pendingWave && phase === 'done') startWave();
    if (visible) wake();
  }).observe(glass);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });

  // ---------- the rare moment: six-core energy sweeps down the contours ----------
  function startWave() {
    if (low()) { pendingWave = false; return; }
    if (!visible || phase !== 'done') { pendingWave = true; return; }
    pendingWave = false; waveT0 = performance.now();
    if (sleeping) wake();
  }

  return {
    ready: readyP,
    boot,
    toStatic: () => { if (ready) toStatic(); else readyP.then(toStatic); },
    setFocus(e) { focus = e; if (phase === 'done' || phase === 'static') draw(performance.now()); },
    hint: showHint,
    wave: startWave,
    get phase() { return phase; },
  };
}
