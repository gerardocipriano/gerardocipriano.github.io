// Animated preview of the opencode mission control dashboard (lab section).
// Usage: initDashboardViz(rootEl, { motion, labels }) returns { destroy() }.
// `motion` is the object from main.js (getter `low`); `labels` is a partial override of DEFAULT_LABELS.

/* Every visible string. The orchestrator moves this into data/content.json.
 * title     header label
 * live      header status, next to the lamp
 * aria      accessible name of the root (role="img")
 * state     badge text per state: run, idle, done, stall, killed
 * notes     one-line alert under a session: stall, killed, resolved
 * ok        tool call that finished
 * waiting   tool line of a session not started yet
 * total     footer label
 * tokens    unit after the token count
 * sessions  four rows: name, and the tool calls in order (Read, Edit, Bash...)
 * Counts (k, $) are symbols, not copy, and stay in the code.
 */
export const DEFAULT_LABELS = {
  title: 'opencode mission control',
  live: 'live',
  aria: 'Animated preview of the opencode dashboard: four coding agent sessions with live tool calls and a running cost. One session stalls, is killed and restarted.',
  state: { run: 'running', idle: 'idle', done: 'done', stall: 'stall', killed: 'killed' },
  notes: {
    stall: 'stall alert · no output for 90 s',
    killed: 'killed · restarting session',
    resolved: 'resolved · session restarted',
  },
  ok: 'ok',
  waiting: 'waiting for prompt',
  total: 'total',
  tokens: 'tok',
  sessions: [
    { name: 'plan-api', calls: ['Read src/routes.ts', 'Edit src/routes.ts', 'Bash npm test', 'Edit src/routes.ts', 'Bash npm test'] },
    { name: 'tf-network', calls: ['Read main.tf', 'Bash terraform plan', 'Edit main.tf', 'Bash terraform plan'] },
    { name: 'docs-sync', calls: ['Grep "TODO"', 'Read README.md', 'Write CHANGELOG.md'] },
    { name: 'release-notes', calls: ['Glob "*.md"', 'Read CHANGELOG.md', 'Bash git log', 'Write RELEASE.md'] },
  ],
};

// Cycle timeline in ms. Each row lists [from, to, state]; the stall is row 1.
const CYCLE = 14000, STEP = 200, SNAP = 6500, RESTART = 9000, STALL_ROW = 1;
const PH = [
  [[0, 12600, 'run'], [12600, CYCLE, 'done']],
  [[0, 5200, 'run'], [5200, 8200, 'stall'], [8200, RESTART, 'killed'], [RESTART, CYCLE, 'run']],
  [[0, 3400, 'idle'], [3400, 11200, 'run'], [11200, CYCLE, 'done']],
  [[0, 6000, 'idle'], [6000, 13400, 'run'], [13400, CYCLE, 'done']],
];
const RATE = [1800, 1400, 2200, 1000]; // tokens per second while running
const USD = 0.000012; // display only

const phase = (i, t) => PH[i].find((p) => t < p[1]) || PH[i][PH[i].length - 1];
const lastRun = (i, t) => PH[i].filter((p) => p[2] === 'run' && p[0] <= t).pop();
// index of the tool call on screen: calls are spread evenly over the last run segment
function callOf(i, t, n) {
  const r = lastRun(i, t);
  if (!r || !n) return null;
  return Math.min(n - 1, Math.floor(((Math.min(t, r[1]) - r[0]) / (r[1] - r[0])) * n));
}
const fmtK = (n) => (n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(Math.round(n)));
const setText = (el, s) => { if (el.textContent !== s) el.textContent = s; };

export function initDashboardViz(root, { motion = {}, labels = {} } = {}) {
  const D = DEFAULT_LABELS;
  const L = { ...D, ...labels, state: { ...D.state, ...labels.state }, notes: { ...D.notes, ...labels.notes } };
  const isLow = () => !!(motion.low || motion.reduced);
  const mk = (tag, cls, txt) => { const n = document.createElement(tag); n.className = cls; if (txt) n.textContent = txt; return n; };

  /* DOM, built once. Text is set with textContent only. */
  root.classList.add('dv');
  root.setAttribute('role', 'img');
  root.setAttribute('aria-label', L.aria);
  const head = mk('div', 'dv-head'), lamp = mk('span', 'dv-lamp');
  head.append(lamp, mk('span', 'dv-title', L.title), mk('span', 'dv-live', L.live));
  const list = mk('div', 'dv-list');
  const rows = L.sessions.slice(0, 4).map((s) => {
    const row = mk('div', 'dv-row');
    const c = { rl: mk('span', 'dv-rl'), name: mk('span', 'dv-name', s.name), badge: mk('span', 'dv-badge'), tool: mk('span', 'dv-tool'), meter: mk('span', 'dv-meter'), note: mk('span', 'dv-note') };
    row.append(c.rl, c.name, c.badge, c.tool, c.meter, c.note);
    list.append(row);
    return { row, ...c };
  });
  const totalEl = mk('span', 'dv-total');
  const foot = mk('div', 'dv-foot', null);
  foot.append(mk('span', '', L.total), totalEl);
  root.replaceChildren(head, list, foot);

  /* state: t is the position in the cycle, toks the tokens counted per row */
  let t = 0, low = null, inView = false, timer = 0, last = 0, io = null;
  const toks = [0, 0, 0, 0];

  function advance(ms) {
    for (let i = 0; i < rows.length; i++) if (phase(i, t)[2] === 'run') toks[i] += (RATE[i] * ms) / 1000;
    t += ms;
    if (t >= CYCLE) { t -= CYCLE; toks.fill(0); }
  }

  function paint() {
    let sum = 0;
    rows.forEach((r, i) => {
      const st = phase(i, t)[2], calls = L.sessions[i].calls;
      const k = callOf(i, t, calls.length);
      const alert = st === 'stall' || st === 'killed' ? st : (i === STALL_ROW && t >= RESTART ? 'resolved' : '');
      setText(r.tool, k == null ? L.waiting : `${calls[k]}  ${st === 'done' ? L.ok : L.state[st]}`);
      setText(r.badge, L.state[st]);
      setText(r.note, alert ? L.notes[alert] : '');
      setText(r.meter, `${fmtK(toks[i])} ${L.tokens}`);
      r.row.dataset.st = st;
      r.row.dataset.alert = alert;
      sum += toks[i];
    });
    setText(totalEl, `${fmtK(sum)} ${L.tokens} · $${(sum * USD).toFixed(2)}`);
    root.dataset.run = timer ? '1' : '0';
  }

  function tick() {
    if (isLow()) { sync(); return; } // motion switched on while running: sync stops and snaps
    const now = performance.now(), dt = Math.min(now - last, 500);
    last = now;
    advance(dt);
    paint();
  }
  function start() { if (timer) return; last = performance.now(); timer = setInterval(tick, STEP); }
  function stop() { if (timer) { clearInterval(timer); timer = 0; } }

  // Decides run / pause / static. Runs on init, viewport change, tab change and motion change.
  function sync() {
    const lo = isLow();
    if (lo !== low) {
      low = lo; t = 0; toks.fill(0);
      if (lo) for (let s = 0; s < SNAP; s += 50) advance(50); // reduced motion: representative frame with the alert
    }
    if (lo || !inView || document.hidden) stop(); else start();
    paint();
  }

  const onVis = () => sync();
  document.addEventListener('visibilitychange', onVis);
  // the site's "skip the animation" toggle sets data-motion on <html>; the OS setting fires a media change
  const mo = new MutationObserver(sync);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] });
  const rm = matchMedia('(prefers-reduced-motion: reduce)');
  rm.addEventListener('change', sync);

  if ('IntersectionObserver' in window) {
    io = new IntersectionObserver(([e]) => { inView = e.isIntersecting; sync(); }, { threshold: 0.2 });
    io.observe(root);
  } else { inView = true; }
  sync();

  return {
    destroy() {
      stop();
      io?.disconnect();
      mo.disconnect();
      rm.removeEventListener('change', sync);
      document.removeEventListener('visibilitychange', onVis);
      root.replaceChildren();
      root.classList.remove('dv');
      root.removeAttribute('role');
      root.removeAttribute('aria-label');
    },
  };
}
