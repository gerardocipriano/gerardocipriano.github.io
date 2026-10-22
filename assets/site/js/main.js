// Project GC · bootstrap: load content, hydrate the pre-rendered page, wire the behaviour.
import { loadContent } from './data-source.js';
import * as R from './render.js';
import { createGenesis } from './genesis.js';
import { initBench } from './bench.js';
import { initLab } from './lab.js';
import { initContact } from './contact.js';
import { initI18n } from './i18n.js';
import { initDashboardViz } from './dashboard-viz.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode: behave like a first visit */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};
const RM = matchMedia('(prefers-reduced-motion: reduce)');
export const motion = {
  get low() { return RM.matches || document.documentElement.dataset.motion === 'low'; },
  get os() { return RM.matches; },
};
const hexRGB = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

/* ---------- hydration: re-render only when the data differs from the pre-render ---------- */
function hydrate(C, D) {
  const root = document.documentElement;
  if (root.dataset.contentHash !== R.hash(C)) {
    for (const [name, fn] of Object.entries(R.SLOTS)) { const el = $(`[data-slot="${name}"]`); if (el) el.innerHTML = fn(C, D); }
    document.title = C.site.title;
    $('meta[name="description"]')?.setAttribute('content', C.site.description);
    const th = $('#gc-theme'), tmp = document.createElement('div'); tmp.innerHTML = R.theme(C);
    if (th) th.replaceWith(tmp.firstChild); else document.head.appendChild(tmp.firstChild);
    root.dataset.contentHash = R.hash(C);
  }
  // values that depend on today's date are refreshed even when the pre-render is current
  $$('[data-c]').forEach((el) => { const n = D.counts[+el.dataset.c].toLocaleString(R.numLocale(C)); el.innerHTML = `${n}<span aria-hidden="true"> ${R.esc(C.hero.daysShort)}</span><span class="sr"> ${R.esc(C.hero.days)}</span>`; });
  $$('[data-months]').forEach((el) => { el.textContent = D.months[+el.dataset.months] + ' ' + C.buildLog.monthsSuffix; });
  $$('.entry').forEach((el, i) => el.style.setProperty('--lvl', D.levels[i] + '%'));
  if (new Date().getHours() < 5) $('#eyebrow').textContent = C.hero.eyebrow + C.hero.nightShift;
}

/* ---------- top bar: section tracking and mobile menu (needs no data) ---------- */
function initNav(nav) {
  const bar = $('#bar');
  const setBarH = () => document.documentElement.style.setProperty('--bar-h', bar.offsetHeight + 'px');
  setBarH(); new ResizeObserver(setBarH).observe(bar);

  const links = $$('.nav-links a, .menu a:not(.lang-link)'); // the language links are not sections: they keep their own aria-current
  const map = {};
  if (nav) nav.forEach((n) => n.covers.forEach((id) => { map[id] = n.id; }));
  else links.forEach((a) => { const id = a.hash.slice(1); map[id] = id; });
  const vis = new Map();
  const setCurrent = (id) => links.forEach((a) => { if (a.getAttribute('href') === '#' + id) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
  const io = new IntersectionObserver((es) => {
    es.forEach((e) => vis.set(e.target.id, e.isIntersecting));
    let best = null, top = Infinity;
    for (const id of Object.keys(map)) { const el = document.getElementById(id); if (!el || !vis.get(id)) continue; const t = Math.abs(el.getBoundingClientRect().top); if (t < top) { top = t; best = id; } }
    setCurrent(best ? map[best] : '');
  }, { rootMargin: '-40% 0px -55% 0px', threshold: [0, 0.01] });
  Object.keys(map).forEach((id) => { const el = document.getElementById(id); if (el) io.observe(el); });

  const btn = $('#menuBtn'), menu = $('#menu'), close = $('#menuClose');
  const openLabel = btn.getAttribute('aria-label'), closeLabel = close.textContent;
  const focusables = () => $$('a, button', menu);
  function open() {
    menu.hidden = false; btn.setAttribute('aria-expanded', 'true'); btn.setAttribute('aria-label', closeLabel);
    $('a', menu).focus();
    document.addEventListener('keydown', onKey); document.addEventListener('pointerdown', onOutside, true);
  }
  function shut(returnFocus = true) {
    if (menu.hidden) return;
    menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-label', openLabel);
    document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onOutside, true);
    if (returnFocus) btn.focus();
  }
  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); shut(); return; }
    if (e.key !== 'Tab') return;
    const f = focusables(), i = f.indexOf(document.activeElement); // recomputed on every Tab
    if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
  }
  function onOutside(e) { if (!menu.contains(e.target) && !btn.contains(e.target)) shut(false); }
  btn.addEventListener('click', () => (menu.hidden ? open() : shut()));
  close.addEventListener('click', () => shut());
  $$('a', menu).forEach((a) => a.addEventListener('click', () => shut(false)));
  matchMedia('(min-width: 900px)').addEventListener('change', (e) => { if (e.matches) shut(false); });
}

/* in-page links scroll smoothly unless motion is reduced; focus moves to the target */
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]'); if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey) return;
  const id = a.getAttribute('href').slice(1), el = id ? document.getElementById(id) : null; if (!el) return;
  e.preventDefault();
  el.scrollIntoView({ behavior: motion.low ? 'auto' : 'smooth', block: 'start' });
  history.pushState(null, '', '#' + id);
  if (!el.hasAttribute('tabindex') && !/^(A|BUTTON|INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) el.setAttribute('tabindex', '-1');
  el.focus({ preventScroll: true });
});

/* ---------- the site, driven by content ---------- */
function start(C) {
  const D = R.derive(C);
  hydrate(C, D);
  initNav(C.nav);

  const H = C.hero, total = C.cores.length;
  const got = new Set();
  let genesis = null, statusLock = false;
  const vs = $('#vstatus');
  const setStatus = (t) => { vs.textContent = t; };

  // hover or focus on a core card outlines its slot in the bar housing
  $$('.core').forEach((card) => {
    const slot = $(`#barHousing [data-core="${card.dataset.core}"]`);
    const on = () => slot?.classList.add('hint'), off = () => slot?.classList.remove('hint');
    card.addEventListener('pointerenter', on); card.addEventListener('pointerleave', off);
  });

  function collect(id) {
    if (got.has(id)) return;
    got.add(id);
    const anim = !motion.low;
    $$(`[data-core="${id}"]`).forEach((el) => {
      el.classList.add('lit');
      if (!anim) return;
      if (el.tagName === 'svg') { el.classList.remove('pop'); void el.getBBox(); el.classList.add('pop'); }
      if (el.classList.contains('core')) { el.style.setProperty('--h', el.offsetHeight + 'px'); el.classList.add('scan'); el.addEventListener('animationend', () => el.classList.remove('scan'), { once: true }); }
    });
    $('#coreCount').textContent = `${got.size}/${total} ${H.coresSuffix}`;
    $('#barHousing').setAttribute('aria-label', R.fmt(H.housingLabel, { n: got.size, total }));
    if (got.size === total) { assembled(); const hint = $('#coreHint'); if (hint) hint.hidden = true; }
  }
  function assembled() {
    $('#brand').classList.add('assembled');
    setStatus(H.status.assembled);
    $('#announce').textContent = H.assembledAnnounce;
    if (store.get('gc-assembled') !== '1') { store.set('gc-assembled', '1'); if (!motion.low && genesis) genesis.wave(); }
  }

  /* hero */
  const lamp = $('#lamp');
  const css = getComputedStyle(document.documentElement);
  // the telemetry readout runs during the boot; afterwards the panel shows the fixed "now running" rows
  const showTel = (on) => { $('#telemetry').hidden = !on; $('#nowRunning').hidden = on; };
  genesis = createGenesis({
    glass: $('#glass'), canvas: $('#cv'), ticks: $('#ticks'), src: H.portraitSample,
    locale: R.numLocale(C),
    days: D.days, eraOf: D.eraOf, fmtDay: D.fmtDay, dayOf: D.dayOf,
    eraRGB: C.career.eras.map((e) => hexRGB(e.color)), eraIntensity: C.career.eras.map((e) => e.intensity ?? 1),
    coreRGB: C.cores.map((c) => hexRGB(c.color)),
    heatRGB: ['--plasma-low', '--plasma-mid', '--plasma-hot'].map((v) => hexRGB(css.getPropertyValue(v).trim())),
    low: () => motion.low,
    firstBoot: () => store.get('gc-boot') !== '1',
    tel: { T: $('#tT'), K: $('#tK'), D: $('#tD'), N: $('#tN'), P: $('#tP') },
    label: (p) => H.status[p] || p,
    status: (p) => { if (!statusLock) setStatus(H.status[p] || p); },
    onStart: () => { lamp.classList.remove('on'); showTel(true); },
    onDone: () => {
      statusLock = false;
      lamp.classList.add('on');
      showTel(false);
      setStatus(got.size === total ? H.status.assembled : H.status.running);
      if (!motion.low) store.set('gc-boot', '1');
    },
  });
  genesis.hint(H.coresHint);
  genesis.boot(false);

  $('#replay').addEventListener('click', () => { if (genesis.phase !== 'run') genesis.boot(true); });
  let taps = 0, tapT = 0; // rare: seven quick taps on the base replay the full ignition
  $('#plateBase').addEventListener('click', () => {
    const n = performance.now(); taps = n - tapT < 600 ? taps + 1 : 1; tapT = n;
    if (taps >= 7 && !motion.low && genesis.phase !== 'run') { taps = 0; statusLock = true; setStatus(H.status.override); genesis.boot(true); }
  });
  const skip = $('#skipanim'), replay = $('#replay');
  const syncSkip = () => {
    skip.hidden = motion.os; replay.hidden = motion.low;
    skip.setAttribute('aria-pressed', String(document.documentElement.dataset.motion === 'low'));
    skip.textContent = document.documentElement.dataset.motion === 'low' ? H.play : H.skip;
  };
  syncSkip();
  skip.addEventListener('click', () => {
    if (document.documentElement.dataset.motion === 'low') {
      delete document.documentElement.dataset.motion; store.del('gc-motion'); syncSkip(); genesis.boot(true);
    } else {
      document.documentElement.dataset.motion = 'low'; store.set('gc-motion', 'low'); syncSkip(); genesis.toStatic(); lowMotionNow();
    }
  });
  RM.addEventListener('change', () => { syncSkip(); if (motion.low) { genesis.toStatic(); lowMotionNow(); } });
  let focus = -1;
  $$('.era').forEach((b) => { b.disabled = false; });
  $$('.era').forEach((b) => b.addEventListener('click', () => {
    const e = +b.dataset.era; focus = focus === e ? -1 : e;
    $$('.era').forEach((x) => x.setAttribute('aria-pressed', String(+x.dataset.era === focus)));
    genesis.setFocus(focus);
  }));

  /* build log: the current follows the scroll */
  const entries = $('#entries'), charge = $('#charge'), items = $$('.entry', entries);
  const benchCores = C.cores.filter((c) => c.source === 'bench').map((c) => c.id);
  let logDone = false;
  const coresOf = (it) => (it.dataset.cores || '').split(' ').filter(Boolean);
  function lightAll() { charge.style.setProperty('--p', '100%'); items.forEach((it) => { it.classList.add('lit'); coresOf(it).forEach(collect); }); logDone = true; }
  function lowMotionNow() { lightAll(); entries.classList.remove('run'); }
  function onScroll() {
    const vh = innerHeight;
    if (!logDone) {
      const b = entries.getBoundingClientRect(), p = Math.max(0, Math.min(1, (vh * 0.62 - b.top) / b.height));
      charge.style.setProperty('--p', (p * 100).toFixed(1) + '%');
      let all = true;
      items.forEach((it) => {
        if (it.classList.contains('lit')) return;
        if (it.getBoundingClientRect().top < vh * 0.62) { it.classList.add('lit'); coresOf(it).forEach(collect); } else all = false;
      });
      if (all && p >= 1) logDone = true;
    }
    if (benchCores.some((id) => !got.has(id)) && $('#bench').getBoundingClientRect().bottom < vh * 0.3) benchCores.forEach(collect);
  }
  if (motion.low) lightAll();
  let q = false;
  addEventListener('scroll', () => { if (!q) { q = true; requestAnimationFrame(() => { q = false; onScroll(); }); } }, { passive: true });
  addEventListener('resize', onScroll, { passive: true });
  onScroll();
  new IntersectionObserver((es) => entries.classList.toggle('run', es[0].isIntersecting && !motion.low)).observe(entries);

  initBench({ C, collect: () => benchCores.forEach(collect), motion });
  initLab({ C, motion });
  initContact({ C, motion });
  const dashboard = $('#agentsViz');
  if (dashboard) initDashboardViz(dashboard, { motion, labels: C.experiments.dashboardViz });

  const s = 'color:#8CF5B0;background:#060B08;font-family:monospace;padding:2px 6px';
  const [plate, ...rest] = C.site.consoleLines || [];
  if (plate) console.log(`%c+${'-'.repeat(plate.length + 4)}+\n|  ${plate}  |\n+${'-'.repeat(plate.length + 4)}+`, s);
  rest.forEach((l) => console.log('%c' + l, 'color:#6FB98E'));
}

initI18n(); // switcher; the first-visit redirect already ran inline in <head>

loadContent().then(start, (err) => {
  // fallback: the pre-rendered page stays as it is; the portrait shows as a still image
  console.warn('[content] could not load, keeping the pre-rendered page:', err.message);
  document.documentElement.classList.add('no-data');
  $('#glass')?.classList.add('formed');
  try { initNav(null); } catch { /* the page still reads without the menu script */ }
});
