// Test bench: upgrade a simulated cluster from v1.24 to v1.30 without dropping requests.
// Model: control plane + three nodes, six pods, three slots per node; the service holds with four pods.

import { numLocale } from './render.js';

const $ = (s) => document.querySelector(s);

export function initBench({ C, collect, motion }) {
  const B = C.bench, L = B.labels, M = B.messages, V0 = B.startVersion, V1 = B.targetVersion, fmt = (s, v) => String(s).replace(/\{(\w+)\}/g, (_, k) => v[k]);
  const LOC = numLocale(C);
  const css = getComputedStyle(document.documentElement), tok = (n) => css.getPropertyValue(n).trim();
  const COL = { rail: tok('--rule-hi'), ok: tok('--ph'), bad: tok('--alarm') };
  const G = { cp: V0, nodes: [], served: 0, dropped: 0, manualDone: false, auto: false, finished: false };
  const PODS = B.nodes.length * 2; // two pods per node at rest, three slots per node
  const live = $('#benchLive'), tell = (t) => { live.textContent = t; };
  const msg = $('#msg'), nodesEl = $('#nodes'), cpBtn = $('#cpUp'), autoBtn = $('#auto');
  const servedEl = $('#served'), droppedEl = $('#dropped'), dropBox = $('#dropBox'), pendEl = $('#pending');
  const wait = (ms) => new Promise((r) => setTimeout(r, motion.low ? 0 : ms));

  // nodes are built once and updated in place, so keyboard focus survives every state change
  const view = B.nodes.map((n, i) => {
    const li = document.createElement('li'); li.className = 'kn';
    li.innerHTML = `<header><span>${n}</span><b></b></header><div class="slots" aria-hidden="true"><i></i><i></i><i></i></div><span class="st"></span>`;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.textContent = L.roll;
    b.addEventListener('click', () => { if (!G.auto) roll(i); });
    li.appendChild(b); nodesEl.appendChild(li);
    return { li, ver: li.querySelector('b'), slots: [...li.querySelectorAll('.slots i')], st: li.querySelector('.st'), btn: b, name: n };
  });

  function say(t, cls = '') { msg.textContent = t; msg.className = 'msg' + (cls ? ' ' + cls : ''); }
  function counters() {
    servedEl.textContent = G.served.toLocaleString(LOC); droppedEl.textContent = G.dropped.toLocaleString(LOC);
    dropBox.classList.toggle('bad', G.dropped > 0);
  }
  function render() {
    $('#cpv').textContent = 'v1.' + G.cp;
    cpBtn.textContent = G.cp >= V1 ? fmt(L.onTarget, { v: V1 }) : fmt(L.upgrade, { v: G.cp + 1 });
    cpBtn.setAttribute('aria-disabled', String(G.cp >= V1 || G.auto));
    $('#jump').setAttribute('aria-disabled', String(G.auto));
    G.nodes.forEach((n, i) => {
      const v = view[i];
      v.li.className = 'kn' + (n.cord ? ' cordoned' : '') + (n.v < G.cp ? ' behind' : '');
      v.ver.textContent = 'v1.' + n.v;
      v.slots.forEach((s, k) => s.classList.toggle('p', k < n.pods));
      v.st.textContent = L.states[n.st] || n.st;
      v.btn.setAttribute('aria-disabled', String(n.v >= G.cp || n.cord || G.auto));
      v.btn.setAttribute('aria-label', L.roll + ': ' + (n.v >= G.cp ? fmt(L.nodeOnAria, { node: v.name, v: n.v }) : fmt(L.rollAria, { node: v.name, v: G.cp }))); // visible text first, for voice control
    });
    const pend = PODS - G.nodes.reduce((s, n) => s + n.pods, 0);
    const behind = G.nodes.some((n) => n.v < G.cp);
    pendEl.textContent = pend > 0 ? fmt(M.pending, { n: pend }) : behind ? M.behind : '';
    pendEl.className = 'pending' + (pend > 0 ? ' bad' : '');
    counters();
  }
  function reset() {
    Object.assign(G, { cp: V0, served: 0, dropped: 0, manualDone: false, auto: false, finished: false, dropWarned: false });
    G.nodes = B.nodes.map(() => ({ v: V0, cord: false, pods: 2, st: 'ready' }));
    autoBtn.hidden = true;
    say(M.start);
    render();
  }
  function reschedule() {
    let missing = PODS - G.nodes.reduce((s, n) => s + n.pods, 0);
    for (const n of G.nodes) while (missing > 0 && !n.cord && n.pods < 3) { n.pods++; missing--; }
  }
  async function roll(i, fast) {
    const n = G.nodes[i];
    if (n.v >= G.cp || n.cord) return;
    n.cord = true; n.st = 'cordoned'; render(); await wait(fast ? 120 : 260);
    n.st = 'draining'; n.pods = 0; G.dropWarned = false; if (!fast) tell(fmt(M.draining, { node: view[i].name })); reschedule(); render(); await wait(fast ? 160 : 420);
    n.st = 'upgrading'; render(); await wait(fast ? 200 : 620);
    n.v = G.cp; n.cord = false; n.st = 'ready'; if (!fast) tell(fmt(M.ready, { node: view[i].name, v: n.v })); reschedule();
    for (const m of G.nodes) if (m !== n && m.pods === 3 && n.pods < 2) { m.pods--; n.pods++; } // rebalance
    render(); await wait(fast ? 0 : 200);
    check();
  }
  function check() {
    if (!G.manualDone && G.cp === V0 + 1 && G.nodes.every((n) => n.v === V0 + 1 && !n.cord)) {
      G.manualDone = true; autoBtn.hidden = false;
      say(M.manualDone, 'done');
    }
    if (!G.finished && G.cp === V1 && G.nodes.every((n) => n.v === V1 && !n.cord)) {
      G.finished = true;
      autoBtn.hidden = true; // the run is over: nothing left to automate
      say(G.dropped === 0 ? M.finishedClean : fmt(M.finishedDrops, { n: G.dropped.toLocaleString(LOC) }), 'done');
      collect();
    }
  }
  cpBtn.addEventListener('click', () => {
    if (G.auto || G.cp >= V1) return;
    if (G.nodes.some((n) => n.v < G.cp)) { say(fmt(M.skewNodes, { v: G.cp }), 'warn'); return; }
    G.cp++; say(fmt(M.cpDone, { v: G.cp })); render();
  });
  $('#jump').addEventListener('click', () => !G.auto && say(M.skewJump, 'warn'));
  autoBtn.addEventListener('click', async () => {
    G.auto = true; autoBtn.hidden = true; render();
    say(M.automating);
    $('#reset').focus();
    while (G.cp < V1 && G.auto) {
      G.cp++; render(); await wait(180);
      for (let i = 0; i < G.nodes.length && G.auto; i++) await roll(i, true);
    }
    if (!G.auto) return; // reset during the run
    G.auto = false; render(); check();
  });
  $('#reset').addEventListener('click', reset);

  /* traffic: one request every 90 ms while the bench is on screen */
  const lane = $('#lane'), lc = lane.getContext('2d');
  let dots = [], lw = 0, lh = 0, dpr = 1, last = 0, on = false, raf = 0;
  function size() {
    const r = lane.getBoundingClientRect(); dpr = Math.min(window.devicePixelRatio || 1, 2);
    lw = r.width; lh = r.height; lane.width = Math.round(lw * dpr); lane.height = Math.round(lh * dpr); lc.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawLane();
  }
  function drawLane() {
    lc.clearRect(0, 0, lw, lh);
    lc.strokeStyle = COL.rail; lc.lineWidth = 1; lc.beginPath();
    lc.moveTo(lw / 2, 0); lc.lineTo(lw / 2, lh * 0.4);
    const nn = B.nodes.length;
    for (let k = 0; k < nn; k++) { const x = ((k + 0.5) * lw) / nn; lc.moveTo(lw / 2, lh * 0.4); lc.lineTo(x, lh * 0.4); lc.lineTo(x, lh); }
    lc.stroke();
  }
  function request() {
    const ready = G.nodes.map((n, i) => (n.pods > 0 && !n.cord ? i : -1)).filter((i) => i >= 0);
    const podsUp = G.nodes.reduce((s, n) => s + n.pods, 0);
    const ok = podsUp >= PODS - 2 && ready.length > 0; // the service holds while at most two pods are missing
    const target = ok ? ready[Math.floor(Math.random() * ready.length)] : Math.floor(Math.random() * B.nodes.length);
    if (ok) G.served++; else G.dropped++;
    if (!ok && !G.dropWarned) { G.dropWarned = true; tell(fmt(M.dropping, { n: PODS - podsUp })); }
    if (!motion.low) dots.push({ tx: ((target + 0.5) * lw) / B.nodes.length, ok, t: 0 });
    counters();
  }
  function tick(ts) {
    if (!on || document.hidden) { raf = 0; return; }
    if (!last) last = ts;
    while (ts - last >= 90) { last += 90; request(); }
    if (motion.low) { if (dots.length) { dots = []; drawLane(); } raf = requestAnimationFrame(tick); return; }
    if (!(G.auto || G.nodes.some((n) => n.cord))) { if (dots.length) { dots = []; drawLane(); } raf = requestAnimationFrame(tick); return; }
    drawLane();
    dots = dots.filter((d) => d.t < 1);
    for (const d of dots) {
      d.t += 0.035; const t = d.t; let x, y;
      if (t < 0.4) { x = lw / 2; y = (t / 0.4) * lh * 0.4; }
      else if (t < 0.7) { x = lw / 2 + (d.tx - lw / 2) * ((t - 0.4) / 0.3); y = lh * 0.4; }
      else { x = d.tx; y = lh * 0.4 + ((t - 0.7) / 0.3) * lh * 0.6; }
      if (!d.ok && t > 0.7) y = lh * 0.4 + (t - 0.7) * 60;
      lc.fillStyle = d.ok ? COL.ok : COL.bad; lc.fillRect(x - 3, y - 1.5, 6, 3);
    }
    raf = requestAnimationFrame(tick);
  }
  const startLoop = () => { if (on && !raf && !document.hidden) { last = 0; raf = requestAnimationFrame(tick); } };
  new IntersectionObserver((es) => { on = es[0].isIntersecting; startLoop(); }).observe($('#bench'));
  document.addEventListener('visibilitychange', startLoop);
  new ResizeObserver(size).observe(lane);

  reset();
  size();
}
