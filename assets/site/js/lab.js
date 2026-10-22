// Experiments and sealed pods: promote the freight, the bekky readout, the extraction monitor.

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fmt = (s, v) => String(s).replace(/\{(\w+)\}/g, (_, k) => v[k]);
const hexRGB = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const RM = matchMedia('(prefers-reduced-motion: reduce)');

/* ---------- promote the freight (Kargo, dev → staging → prod) ---------- */
function initFreight(C, motion) {
  const F = C.experiments.freight;
  const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const btn = $('#frBtn'), cube = $('#frCube'), msgEl = $('#frMsg'), cols = $$('#frTrack [data-stage]'), ring = $('.fr-ring');
  const STAGES = F.stages.map((x) => x.name), LAST = STAGES.length;
  let at = 0, busy = false;
  const ms = (v) => (motion.low ? 0 : v);
  const setBusy = (b) => { busy = b; btn.setAttribute('aria-disabled', String(b)); };
  function label() { btn.textContent = at >= LAST ? F.again : fmt(F.button, { stage: STAGES[at] }); }
  function reset() {
    at = 0; cube.style.setProperty('--at', 0); ring.classList.remove('sync');
    cols.forEach((c) => { c.classList.remove('on'); $$('i', c).forEach((i) => i.classList.remove('on')); });
    msgEl.textContent = F.idle; label();
  }
  btn.addEventListener('click', async () => {
    if (busy) return;
    if (at >= LAST) { reset(); return; }
    setBusy(true);
    const stage = at; at++;
    cube.style.setProperty('--at', at);
    msgEl.textContent = fmt(F.moving, { stage: STAGES[stage] });
    await sleep(ms(500));
    const col = cols[stage]; col.classList.add('on');
    for (const pod of $$('.fr-pods i', col)) { pod.classList.add('on'); await sleep(ms(80)); }
    if (stage < LAST - 1) {
      msgEl.textContent = F.verified[stage] || '';
    } else {
      msgEl.textContent = F.syncing;
      ring.classList.add('sync');
      await sleep(ms(800));
      msgEl.innerHTML = `${esc(F.done)} <a href="${esc(F.doneLink.href)}" rel="noopener">${esc(F.doneLink.label)}</a>.`;
    }
    label(); setBusy(false);
  });
  reset();
}

/* ---------- bekky: a cloud of particles is encrypted, deduplicated and condensed into a cipher block ---------- */
// Sizes are read from the content (experiments.bekky.from / to, e.g. "24 GB" and "~100 MB"); the counter animates between them.
function sizeMB(str, fallback) {
  const m = /([\d.,]+)\s*(KB|MB|GB|TB)/i.exec(str || '');
  if (!m) return fallback;
  const mult = { KB: 0.001, MB: 1, GB: 1000, TB: 1e6 }[m[2].toUpperCase()];
  return parseFloat(m[1].replace(',', '.')) * mult;
}
const fmtSize = (mb) => (mb >= 1000 ? (mb / 1000).toFixed(1) + ' GB' : Math.round(mb) + ' MB');

function initBekky(C, motion) {
  const cv = $('#bekkyCv'); if (!cv) return;
  const B = C.experiments.bekky, ctx = cv.getContext('2d'), css = getComputedStyle(cv);
  const RED = hexRGB(css.getPropertyValue('--core-bak').trim());
  const MID = css.getPropertyValue('--ph-mid').trim(), HI = css.getPropertyValue('--ph-hi').trim();
  const DISP = css.getPropertyValue('--disp').trim() || 'sans-serif', MONO = css.getPropertyValue('--mono').trim() || 'monospace';
  const LW = 280, LH = 180, N = 900, DUR = 2800; // logical units, scaled to the box
  const FROM = sizeMB(B.from, 24000), TO = sizeMB(B.to, 100);
  let s = 5; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const gauss = () => (r() + r() + r() - 1.5) / 1.5;
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
  // the cloud (left) and the cube (right, isometric, three faces of 10x10 points)
  const CX = 80, CY = 104, CB = { x: 216, y: 100, a: 36 };
  const iso = (u, v, w) => [CB.x + (u - v) * CB.a * 0.866, CB.y + (u + v) * CB.a * 0.5 - w * CB.a];
  const TG = [];
  for (let i = 0; i < 10; i++) for (let j = 0; j < 10; j++) {
    const u = (i + 0.5) / 10, v = (j + 0.5) / 10;
    TG.push({ p: iso(u, 1, 1 - v), f: 1 }, { p: iso(1, u, 1 - v), f: 2 }, { p: iso(u, v, 1), f: 0 });
  }
  const P = [];
  for (let i = 0; i < N; i++) {
    P.push({ x0: CX + gauss() * 38, y0: CY + gauss() * 34, ph: r() * 6.283, a: r() * Math.PI, partner: i ^ 1, t: TG[(i >> 1) % TG.length] });
  }
  const SHADE = [[1.25, 0.95], [1, 0.9], [0.72, 0.9]].map(([k, al]) => `rgba(${RED.map((v) => Math.min(255, Math.round(v * k))).join(',')},${al})`);

  let lastK = 0;
  function frame(k) {
    lastK = k;
    ctx.clearRect(0, 0, LW, LH);
    const enc = clamp01((k - 0.18) / 0.2), ded = clamp01((k - 0.4) / 0.2), con = ease(clamp01((k - 0.56) / 0.44));
    // reference outline of the source cloud, fades as the cloud condenses
    ctx.strokeStyle = MID; ctx.lineWidth = 1; ctx.globalAlpha = 0.4 * (1 - con); ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.ellipse(CX, CY, 80, 66, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha = 1;
    for (let i = 0; i < N; i++) {
      const p = P[i], odd = i & 1;
      let x = p.x0 + Math.sin(k * 6 + p.ph) * 1.2, y = p.y0 + Math.cos(k * 5 + p.ph * 1.3) * 1.2, al = 0.85;
      if (odd) {
        if (con > 0) continue; // merged into its partner
        if (ded > 0) { const q = P[p.partner]; x += (q.x0 - x) * ded; y += (q.y0 - y) * ded; al *= 1 - ded; if (al < 0.02) continue; }
      } else if (con > 0) { x += (p.t.p[0] - x) * con; y += (p.t.p[1] - y) * con; }
      if (con >= 1) { ctx.fillStyle = SHADE[p.t.f]; ctx.fillRect(x - 1.6, y - 1.6, 3.2, 3.2); continue; }
      if (enc > 0 && con < 0.5) { // encrypted: each particle becomes a rotated dash
        ctx.fillStyle = `rgba(${RED[0]},${RED[1]},${RED[2]},${al.toFixed(2)})`;
        const len = 1.6 + enc * 2.6;
        ctx.save(); ctx.translate(x, y); ctx.rotate(p.a + enc * 2.2); ctx.fillRect(-len, -0.7, len * 2, 1.4); ctx.restore();
      } else {
        ctx.fillStyle = `rgba(${RED[0]},${RED[1]},${RED[2]},${al.toFixed(2)})`;
        ctx.fillRect(x - 1, y - 1, 2, 2);
      }
    }
    // counter: 24 GB slides down to ~100 MB while the cloud condenses
    const kv = clamp01((k - 0.5) / 0.45), mb = Math.exp(Math.log(FROM) + (Math.log(TO) - Math.log(FROM)) * ease(kv));
    // counter: it runs while the cloud condenses; at rest the source size stays on the left, muted, as the reference
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    const rest = k >= 0.97;
    ctx.globalAlpha = rest ? 0.55 : 1 - clamp01((k - 0.8) / 0.15);
    ctx.fillStyle = rest ? MID : HI; ctx.font = `800 20px ${DISP}`;
    ctx.fillText(rest || kv <= 0 ? B.from : fmtSize(mb), 12, 24);
    ctx.font = `500 11px ${MONO}`; ctx.fillStyle = MID;
    ctx.fillText(rest || kv < 1 ? B.fromSuffix : B.toSuffix, 12, 38);
    ctx.globalAlpha = 1;
    // arrow from the cloud to the cube
    const ar = clamp01((k - 0.5) / 0.2);
    if (ar > 0) {
      ctx.globalAlpha = ar; ctx.strokeStyle = MID; ctx.lineWidth = 1.2; ctx.beginPath();
      ctx.moveTo(160, 100); ctx.lineTo(176, 100); ctx.moveTo(171, 96); ctx.lineTo(176, 100); ctx.lineTo(171, 104); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // cube label, once the block is formed
    const cl = clamp01((con - 0.8) / 0.2);
    if (cl > 0) {
      ctx.globalAlpha = cl; ctx.textAlign = 'center';
      ctx.fillStyle = HI; ctx.font = `800 17px ${DISP}`; ctx.fillText(B.to, CB.x, 158);
      ctx.font = `500 11px ${MONO}`; ctx.fillStyle = MID; ctx.fillText(B.toSuffix, CB.x, 172);
      ctx.globalAlpha = 1;
    }
  }
  // the canvas keeps the logical 280x180 frame at the box width (sharp on HiDPI, capped at 2x)
  function size() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2), w = cv.clientWidth || LW, sc = (w / LW) * dpr;
    cv.width = Math.round(w * dpr); cv.height = Math.round((w * LH / LW) * dpr);
    ctx.setTransform(sc, 0, 0, sc, 0, 0);
  }
  function play() {
    const t0 = performance.now();
    const step = (ts) => {
      if (motion.low) { frame(1); return; }
      const k = clamp01((ts - t0) / DUR);
      frame(k);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  size();
  new ResizeObserver(() => { size(); frame(lastK); }).observe(cv);
  if (motion.low) { frame(1); return; }
  frame(0);
  const io = new IntersectionObserver((es) => {
    if (!es[0].isIntersecting) return;
    io.disconnect(); play();
  }, { threshold: 0.5 });
  io.observe(cv);
}

/* ---------- sealed pods: each tank holds a particle form that matches its theme ---------- */
// The form follows the pod title (content: pods.items[].title); unknown titles take the next form in order.
const POD_FORMS = [
  [/protocol|native|network|jni|kotlin/i, 'lattice'],
  [/llm|\bai\b|model|vision|document/i, 'graph'],
  [/serverless|automation|schedul|workflow/i, 'orbit'],
  [/stack|full|product|app/i, 'slabs'],
  [/pipeline|data|stream|etl/i, 'flow'],
];
const FORM_ORDER = ['lattice', 'graph', 'orbit', 'slabs', 'flow'];
const formFor = (title, i) => (POD_FORMS.find(([re]) => re.test(title)) || [null, FORM_ORDER[i % FORM_ORDER.length]])[1];

// points in [-0.5, 0.5]; spd rotates a point around the centre (rad/s), fl makes it travel along a stream
function podForm(form, seed) {
  let s = seed; const R = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const P = [];
  const add = (x, y, o) => P.push({ x, y, ph: R() * 6.283, ...o });
  const edge = (ax, ay, bx, by, n, o) => { for (let i = 0; i < n; i++) add(ax + ((bx - ax) * i) / n, ay + ((by - ay) * i) / n, o); };
  if (form === 'lattice') { // hexagonal mesh: nodes with dots along the links
    const sp = 0.11, Rr = 2, nodes = new Map(), key = (q, t) => q + ',' + t;
    for (let q = -Rr; q <= Rr; q++) for (let t = -Rr; t <= Rr; t++) if (Math.abs(q + t) <= Rr) nodes.set(key(q, t), [sp * (q + t / 2), sp * t * 0.866]);
    for (const [k, [x, y]] of nodes) {
      const [q, t] = k.split(',').map(Number);
      add(x, y, { b: 1 });
      for (const [dq, dt] of [[1, 0], [0, 1], [-1, 1]]) { const n2 = nodes.get(key(q + dq, t + dt)); if (n2) edge(x, y, n2[0], n2[1], 4, {}); }
    }
  } else if (form === 'graph') { // a model reading a document: nodes joined by links
    const n = 13, pts = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * 6.283 + R() * 0.3, rad = 0.3 + R() * 0.08; pts.push([Math.cos(a) * rad * 1.2, Math.sin(a) * rad]); }
    pts.forEach(([x, y], i) => {
      add(x, y, { b: 1 });
      edge(x, y, pts[(i + 1) % n][0], pts[(i + 1) % n][1], 6, {});
      edge(x, y, pts[(i + 4) % n][0], pts[(i + 4) % n][1], 8, {});
    });
  } else if (form === 'orbit') { // a schedule: rings turning at their own pace, one marker on the outer ring
    for (let i = 0; i < 64; i++) { const a = (i / 64) * 6.283; add(Math.cos(a) * 0.36, Math.sin(a) * 0.36, { spd: 0.07 }); }
    for (let i = 0; i < 28; i++) { const a = (i / 28) * 6.283; add(Math.cos(a) * 0.2, Math.sin(a) * 0.2, { spd: -0.14 }); }
    add(0.36, 0, { b: 1, spd: 0.07 });
    add(0, 0, { b: 1 });
  } else if (form === 'slabs') { // three stacked layers, each a parallelogram with a few points inside
    for (let L = 0; L < 3; L++) {
      const y0 = -0.2 + L * 0.17, w = 0.5 - L * 0.04, sk = 0.1, hg = 0.09, x0 = -w / 2 + (L - 1) * 0.03;
      const c = [[x0, y0], [x0 + w, y0], [x0 + w + sk, y0 + hg], [x0 + sk, y0 + hg]];
      for (let e = 0; e < 4; e++) edge(c[e][0], c[e][1], c[(e + 1) % 4][0], c[(e + 1) % 4][1], 12, {});
      for (let j = 0; j < 8; j++) add(x0 + sk * R() + w * R() * 0.9, y0 + hg * R(), {});
    }
  } else { // flow: three streams of points, read left to right
    for (let st = 0; st < 3; st++) {
      const yb = -0.18 + st * 0.18;
      for (let i = 0; i < 46; i++) add(-0.5 + i / 45, yb, { fl: 1, sp: st * 2.1 });
    }
  }
  return P;
}

function initPods(C, motion) {
  const PM = C.pods.monitor;
  const pods = $$('.spod'), mon = $('#monText'), monId = $('#monId');
  const live = $('#monLive');
  let openIdx = -1, typing = null, typedOnce = false;
  const FINAL = '\n\n' + PM.final;
  function finishTyping() { if (typing) { typing.stop(); } }
  function close(i) {
    const p = pods[i]; p.classList.remove('open', 'vent');
    $('.pstate', p).textContent = C.pods.sealed; $('button', p).setAttribute('aria-pressed', 'false');
  }
  function write(text) {
    const full = text + FINAL;
    live.textContent = full;
    if (motion.low || typedOnce) { mon.textContent = full; return; }
    typedOnce = true;
    mon.setAttribute('aria-hidden', 'true');
    let n = 0, stopped = false, timer = 0;
    const end = () => { stopped = true; clearTimeout(timer); mon.textContent = full; mon.removeAttribute('aria-hidden'); typing = null; };
    typing = { stop: end };
    const step = () => { if (stopped) return; n += 3; mon.textContent = full.slice(0, n); if (n >= full.length) end(); else timer = setTimeout(step, 16); };
    step();
  }

  /* particle forms inside the tanks: they float slowly and light up on Inspect */
  const MIDC = hexRGB(getComputedStyle(document.documentElement).getPropertyValue('--ph-mid').trim());
  const HIC = hexRGB(getComputedStyle(document.documentElement).getPropertyValue('--ph-hi').trim());
  const forms = pods.map((li, i) => {
    const tank = $('.tank', li), title = ($('.pt', li)?.textContent || '').trim();
    const cv = document.createElement('canvas');
    cv.setAttribute('aria-hidden', 'true');
    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:1;pointer-events:none';
    tank.appendChild(cv);
    return { li, cv, ctx: cv.getContext('2d'), w: 1, h: 1, dpr: 1, lit: 0, vis: false, pts: podForm(formFor(title, i), 17 + i * 31) };
  });
  const fit = (f) => {
    const b = f.cv.parentNode.getBoundingClientRect();
    f.dpr = Math.min(window.devicePixelRatio || 1, 2); f.w = b.width || 1; f.h = b.height || 1;
    f.cv.width = Math.round(f.w * f.dpr); f.cv.height = Math.round(f.h * f.dpr);
  };
  function paint(f, t) {
    const { ctx, w, h, dpr, lit: k } = f;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    const sc = Math.min(w, h) * 0.9, cx = w / 2, cy = h * 0.58;
    const c = [0, 1, 2].map((j) => Math.round(MIDC[j] + (HIC[j] - MIDC[j]) * (0.25 + 0.75 * k)));
    ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${(0.62 + 0.38 * k).toFixed(2)})`;
    const sz = 2 + 1.2 * k;
    for (const q of f.pts) {
      let x = q.x, y = q.y;
      if (q.spd && t) { const a = q.spd * t, co = Math.cos(a), si = Math.sin(a); const nx = x * co - y * si; y = x * si + y * co; x = nx; }
      if (q.fl) { if (t) x = ((x + 0.5 + t * 0.02) % 1) - 0.5; y += 0.05 * Math.sin(x * 9 + q.sp); }
      if (t) { x += Math.cos(t * 0.7 + q.ph) * 0.006; y += Math.sin(t * 0.9 + q.ph) * 0.008; }
      const s = q.b ? sz * 1.7 : sz;
      ctx.fillRect(cx + x * sc - s / 2, cy + y * sc - s / 2, s, s);
    }
  }
  let raf = 0;
  const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };
  const T0 = performance.now();
  function tick(now) {
    raf = 0;
    const t = motion.low ? 0 : (now - T0) / 1000;
    let moving = false;
    for (const f of forms) {
      const target = f.li.classList.contains('open') ? 1 : 0;
      f.lit = motion.low ? target : f.lit + (target - f.lit) * 0.08;
      if (Math.abs(target - f.lit) > 0.003) moving = true;
      if (f.vis || motion.low) paint(f, t);
    }
    if (document.hidden || motion.low) return; // motion reduced: one still frame; hidden tab: nothing runs
    const live = forms.some((f) => f.vis);
    if (live || moving) raf = requestAnimationFrame(tick);
  }
  const io = new IntersectionObserver((es) => {
    es.forEach((e) => { const f = forms.find((x) => x.li === e.target); if (f) f.vis = e.isIntersecting; });
    kick();
  }, { rootMargin: '80px 0px' });
  forms.forEach((f) => { fit(f); io.observe(f.li); });
  new ResizeObserver(() => { forms.forEach(fit); kick(); }).observe($('#podList') || pods[0]?.parentNode || document.body);
  document.addEventListener('visibilitychange', kick);
  RM.addEventListener('change', kick);
  new MutationObserver(kick).observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] });
  kick();

  pods.forEach((p, i) => {
    const b = $('button', p);
    b.addEventListener('click', () => {
      if (typing && openIdx === i) { finishTyping(); return; } // second click completes the text
      finishTyping();
      if (openIdx === i) { close(i); openIdx = -1; monId.textContent = PM.idle; mon.textContent = PM.resealed; live.textContent = PM.resealed; kick(); return; }
      if (openIdx >= 0) close(openIdx);
      openIdx = i;
      p.classList.add('open');
      if (!motion.low) { p.classList.remove('vent'); void p.offsetWidth; p.classList.add('vent'); }
      $('.pstate', p).textContent = C.pods.opened; b.setAttribute('aria-pressed', 'true');
      monId.textContent = $('.pn', p).textContent + ' · ' + $('.pt', p).textContent;
      write($('.ptext', p).textContent.trim());
      kick();
    });
  });
}

export function initLab({ C, motion }) {
  initFreight(C, motion);
  initBekky(C, motion);
  initPods(C, motion);
}
