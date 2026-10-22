// Rendering: pure functions from the content object to HTML strings.
// Shared by the build script (node, pre-render into index.html) and the browser (hydration
// when the data source returns different content). No DOM access in this module.
import { renderLangSwitch } from './i18n.js';

export const numLocale = (C) => (C.site.lang === 'it' ? 'it-IT' : 'en-US');

export const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const fmt = (s, vars = {}) => String(s).replace(/\{(\w+)\}/g, (_, k) => (k in vars ? vars[k] : `{${k}}`));
const ext = (href) => (/^https?:/.test(href) ? ' rel="noopener"' : '');
const pdf = (href) => (/\.pdf$/i.test(href) ? ' type="application/pdf"' : '');

/* ---------- dates and derived numbers ---------- */
export const DAY = 864e5;
export function utc(s) { const [y, m = 1, d = 1] = String(s).split('-').map(Number); return Date.UTC(y, m - 1, d); }
export function todayUTC(now = new Date()) { return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()); }
const mmyyyy = (s) => { const [y, m] = String(s).split('-'); return `${m}/${y}`; };

export function derive(C, now = new Date()) {
  const today = todayUTC(now), start = utc(C.career.start);
  const days = Math.max(1, Math.round((today - start) / DAY));
  const eraFrom = C.career.eras.map((e) => utc(e.from));
  const eraOf = (d) => { const t = start + d * DAY; for (let i = eraFrom.length - 1; i >= 0; i--) if (t >= eraFrom[i]) return i; return 0; };
  const counts = C.career.eras.map(() => 0);
  for (let d = 0; d < days; d++) counts[eraOf(d)]++;
  const months = C.buildLog.entries.map((e) => {
    const [fy, fm] = e.from.split('-').map(Number);
    if (e.to) { const [ty, tm] = e.to.split('-').map(Number); return (ty * 12 + tm) - (fy * 12 + fm) + 1; }
    return Math.max(1, Math.round((today - utc(e.from)) / (DAY * 30.44)));
  });
  const maxM = Math.max(...months);
  const fmtDay = (d) => { const t = new Date(start + d * DAY); return String(t.getUTCMonth() + 1).padStart(2, '0') + '/' + t.getUTCFullYear(); };
  return { today, start, days, eraOf, counts, months, levels: months.map((m) => Math.round((m / maxM) * 100)), fmtDay, dayOf: (t) => Math.round((t - start) / DAY) };
}

export function hash(C) { // FNV-1a over the canonical JSON: tells the runtime whether the pre-render is current
  const s = JSON.stringify(C); let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}

/* ---------- small parts ---------- */
export const gem = (id) => `<svg class="gem" data-core="${esc(id)}" viewBox="0 0 16 26" aria-hidden="true" focusable="false"><polygon class="f" points="8,0 15,6 15,20 8,26 1,20 1,6"/><polygon class="hl" points="8,0 15,6 8,9 1,6"/><polygon class="sh" points="8,9 15,6 15,20 8,26"/></svg>`;
export const housing = (C) => C.cores.map((c) => gem(c.id)).join('');
const secH = (n, id, title) => `<header class="sec-h"><span class="n" aria-hidden="true">${esc(n)}</span><h2 id="${id}">${esc(title)}</h2></header>`;
const ic = (name) => `<svg class="ic" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const a = (l, cls = '', extra = '') => `<a${cls ? ` class="${cls}"` : ''} href="${esc(l.href)}"${ext(l.href)}${pdf(l.href)}${extra}>${esc(l.label)}</a>`;

/* ---------- head ---------- */
export function theme(C) {
  const vars = [...C.cores.map((c) => `--core-${c.id}:${c.color}`), ...C.career.eras.map((e, i) => `--era-${i}:${e.color}`)].join(';');
  const rules = C.cores.map((c) => `[data-core="${c.id}"]{--c:var(--core-${c.id})}`).join('') + C.career.eras.map((_, i) => `[data-era="${i}"]{--c:var(--era-${i})}`).join('');
  return `<style id="gc-theme">:root{${vars}}${rules}</style>`;
}
export function jsonld(C) {
  const P = C.person;
  const ld = {
    '@context': 'https://schema.org', '@type': 'Person', name: P.name, url: C.site.url,
    image: new URL(C.site.og.image, C.site.url).href, jobTitle: P.jobTitle, description: P.description,
    worksFor: { '@type': 'Organization', name: P.worksFor },
    alumniOf: P.alumniOf ? { '@type': 'CollegeOrUniversity', name: P.alumniOf } : undefined,
    homeLocation: { '@type': 'Place', name: P.homeLocation },
    knowsLanguage: P.knowsLanguage, knowsAbout: P.knowsAbout,
    sameAs: [C.links.linkedin.href, C.links.github.href],
    hasCredential: C.certs.items.map((c) => ({
      '@type': 'EducationalOccupationalCredential', name: c.name + (c.code ? ` (${c.code})` : ''), credentialCategory: 'Professional certification',
      recognizedBy: { '@type': 'Organization', name: c.issuer }, ...(c.verify ? { url: c.verify.href } : {}),
    })),
  };
  return `<script type="application/ld+json">${JSON.stringify(ld, null, 1).replace(/</g, '\\u003c')}</script>`;
}
export function head(C) {
  const S = C.site, img = new URL(S.og.image, S.url).href;
  return [
    `<title>${esc(S.title)}</title>`,
    `<meta name="description" content="${esc(S.description)}">`,
    `<link rel="canonical" href="${esc(S.url)}">`,
    `<meta name="author" content="${esc(C.person.name)}">`,
    `<meta property="og:type" content="profile">`,
    `<meta property="og:site_name" content="${esc(C.person.name)}">`,
    `<meta property="og:title" content="${esc(S.og.title)}">`,
    `<meta property="og:description" content="${esc(S.og.description)}">`,
    `<meta property="og:url" content="${esc(S.url)}">`,
    `<meta property="og:image" content="${esc(img)}">`,
    `<meta property="og:image:width" content="${S.og.imageWidth}">`,
    `<meta property="og:image:height" content="${S.og.imageHeight}">`,
    `<meta property="og:image:alt" content="${esc(S.og.imageAlt)}">`,
    `<meta property="og:locale" content="${esc(S.locale)}">`,
    `<meta property="profile:first_name" content="${esc(C.person.givenName)}">`,
    `<meta property="profile:last_name" content="${esc(C.person.familyName)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(S.og.title)}">`,
    `<meta name="twitter:description" content="${esc(S.og.description)}">`,
    `<meta name="twitter:image" content="${esc(img)}">`,
    theme(C),
    jsonld(C),
  ].join('\n');
}

/* ---------- body slots ---------- */
const navList = (C) => C.nav.map((n) => `<li><a href="#${esc(n.id)}">${esc(n.label)}</a></li>`).join('');

export function bar(C) {
  return `<a class="brand" href="#top" id="brand" aria-label="${esc(C.site.brand)}, ${esc(C.ui.backToTop)}"><span class="lamp" id="lamp" aria-hidden="true"></span><span aria-hidden="true">${esc(C.site.brand)}</span></a>
  <span class="housing bar-housing" id="barHousing" role="img" aria-label="${esc(fmt(C.hero.housingLabel, { n: 0, total: C.cores.length }))}">${housing(C)}</span>
  <nav class="nav" aria-label="${esc(C.ui.sections)}"><ul class="nav-links" id="navLinks">${navList(C)}</ul></nav>
  ${renderLangSwitch(C.site.lang, C.ui.language, ' lang-switch-bar')}
  <a class="btn bar-cv" href="${esc(C.links.cv.href)}"${pdf(C.links.cv.href)}>${esc(C.links.cv.short)}<span class="sr"> (${esc(C.links.cv.pdf)})</span></a>
  <button class="menu-btn" id="menuBtn" type="button" aria-label="${esc(C.site.menuLabel)}" aria-expanded="false" aria-controls="menu"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>`;
}
export function menu(C) {
  return `<ul>${navList(C)}</ul>${renderLangSwitch(C.site.lang, C.ui.language, ' lang-switch-menu')}<button class="btn menu-close" id="menuClose" type="button">${esc(C.site.menuClose)}</button>`;
}

export function hero(C, D) {
  const H = C.hero, [first, ...rest] = C.person.name.split(' ');
  const eras = C.career.eras.map((e, i) => `<li><button class="era" type="button" data-era="${i}" disabled aria-pressed="false"><i aria-hidden="true"></i>${esc(e.label)}<small data-c="${i}">${D.counts[i].toLocaleString(numLocale(C))}<span aria-hidden="true"> ${esc(C.hero.daysShort)}</span><span class="sr"> ${esc(C.hero.days)}</span></small></button></li>`).join('');
  const T = H.telemetry;
  const now = H.nowRunning.rows.map((r) => `<dt>${esc(r.label)}</dt><dd>${esc(r.value)}</dd>`).join('');
  return `<div class="plate"><h1 id="name"><span class="first">${esc(first)}</span> <span class="last">${esc(rest.join(' '))}</span></h1></div>
  <div class="h-copy">
    <p class="eyebrow" id="eyebrow">${esc(H.eyebrow)}</p>
    <h2 class="h-sub">${esc(H.subtitle)}</h2>
    <p class="h-text">${esc(H.text)}</p>
    <div class="h-cta"><a class="btn primary" href="${esc(H.primary.href)}">${esc(H.primary.label)}</a>${a(C.links.cv, 'btn')}</div>
    <p class="h-links">${a(C.links.linkedin)}<span aria-hidden="true">·</span>${a(C.links.github)}</p>
    <button class="skipanim" id="skipanim" type="button" aria-pressed="false">${esc(H.skip)}</button>
  </div>
  <div class="vessel" id="vessel">
    <div class="cap top" aria-hidden="true"></div>
    <div class="glass" id="glass" role="img" aria-label="${esc(H.portraitLabel)}">
      <picture>
        <source type="image/avif" srcset="/assets/site/img/portrait-duo-420.avif 420w, /assets/site/img/portrait-duo-840.avif 840w" sizes="(min-width: 900px) 460px, 70vw">
        <source type="image/webp" srcset="/assets/site/img/portrait-duo-420.webp 420w, /assets/site/img/portrait-duo-840.webp 840w" sizes="(min-width: 900px) 460px, 70vw">
        <img src="/assets/site/img/portrait-duo-420.jpg" width="420" height="603" alt="" decoding="async">
      </picture>
      <canvas id="cv" aria-hidden="true"></canvas>
    </div>
    <div class="v-status" id="vstatus" aria-hidden="true">${esc(H.status.standby)}</div>
    <button class="v-replay" id="replay" type="button"><span>${esc(H.replay)}</span></button>
    <div class="ticks" id="ticks" aria-hidden="true"></div>
    <div class="cap bot" id="plateBase"><span class="v-id" aria-hidden="true">${esc(H.versionId)}</span><span class="housing" id="housing" aria-hidden="true">${housing(C)}</span><em id="coreCount" aria-hidden="true">0/${C.cores.length} ${esc(H.coresSuffix)}</em></div>
    <p class="core-hint" id="coreHint" hidden>${esc(H.coresHint)}</p>
  </div>
  <div class="h-read">
    <h3 class="panel-t">${esc(H.telemetryTitle)}</h3>
    <dl class="kv" id="telemetry" aria-hidden="true" hidden>
      <dt>${esc(T.t)}</dt><dd id="tT">2.50 s</dd><dt>${esc(T.temp)}</dt><dd id="tK">2.7 K</dd><dt>${esc(T.date)}</dt><dd id="tD">${esc(D.fmtDay(D.days - 1))}</dd>
      <dt>${esc(T.particles)}</dt><dd id="tN">${D.days.toLocaleString(numLocale(C))}</dd><dt>${esc(T.phase)}</dt><dd id="tP">${esc(H.status.structure)}</dd>
    </dl>
    <dl class="kv now" id="nowRunning">${now}</dl>
    <h3 class="panel-t" id="comp-h">${esc(H.compositionTitle)}</h3>
    <ul class="eras" aria-labelledby="comp-h">${eras}</ul>
    <p class="note">${esc(H.note)}</p>
  </div>`;
}

export function spec(C) {
  return `<dl class="spec">${C.spec.items.map((s) => `<div><dt>${esc(s.label)}</dt><dd><b>${esc(s.value)}</b><span>${esc(s.caption)}</span></dd></div>`).join('')}</dl>
  <p class="spec-foot">${esc(C.spec.foot)}</p>`;
}

const chips = (C, ids) => ids.length ? `<p class="chips">${ids.map((id) => { const c = C.cores.find((x) => x.id === id); return `<span class="chip" data-core="${esc(id)}">${gem(id)}<span><small>${esc(C.coreChipLabel)}</small><br>${esc(c.name)}</span></span>`; }).join('')}</p>` : '';

export function log(C, D) {
  const L = C.buildLog, B = C.bench, Lb = B.labels;
  const entries = L.entries.map((e, i) => {
    const cores = C.cores.filter((c) => c.source === e.id).map((c) => c.id);
    const cls = ['entry', e.kind || ''].filter(Boolean).join(' ');
    const dates = `${mmyyyy(e.from)} – ${e.to ? mmyyyy(e.to) : esc(L.presentLabel)}`;
    return `<li class="${cls}" data-entry="${esc(e.id)}"${cores.length ? ` data-cores="${cores.join(' ')}"` : ''} style="--lvl:${D.levels[i]}%">
        <div class="node" aria-hidden="true"><div class="pod"><div class="liq"></div></div><span class="pod-cap" data-months="${i}">${D.months[i]} ${esc(L.monthsSuffix)}</span></div>
        <div class="e-body">
          <p class="e-ver">${esc(e.version)}</p>
          <h3>${esc(e.title)}</h3>
          <p class="e-meta">${dates} · ${esc(e.org)}</p>
          <p>${esc(e.text)}</p>
          <p class="module"><small>${esc(L.moduleLabel)}</small> <code>${esc(e.module)}</code></p>
          ${chips(C, cores)}
        </div>
      </li>`;
  }).join('\n      ');
  return `${secH(L.number, 'log-h', L.title)}
  <p class="lede">${esc(L.lede)}</p>
  <div class="entries" id="entries">
    <div class="rail" aria-hidden="true"><div class="charge" id="charge"></div></div>
    <ol class="list">
      ${entries}
    </ol>
    <p class="next"><b>${esc(L.next.command)}</b> → <span class="cursor">${esc(L.next.status)}</span></p>
  </div>
  <div class="bench" id="bench" role="region" aria-labelledby="bench-h">
    <div class="bench-h"><h3 id="bench-h">${esc(B.title)}</h3><span class="sim">${esc(B.badge)}</span></div>
    <div class="bench-b">
      <div class="stage">
        <div class="cp" id="cp"><div><small>${esc(Lb.controlPlane)}</small><b id="cpv">v1.${B.startVersion}</b></div>
          <div class="cp-actions"><button class="btn primary" id="cpUp" type="button">${esc(fmt(Lb.upgrade, { v: B.startVersion + 1 }))}</button><button class="btn" id="jump" type="button">${esc(fmt(Lb.jump, { v: B.targetVersion }))}</button></div></div>
        <canvas class="lane" id="lane" aria-hidden="true"></canvas>
        <ul class="nodes" id="nodes" aria-label="${esc(Lb.nodesAria)}"></ul>
        <p class="pending" id="pending"></p>
      </div>
      <div class="side">
        <div class="ctr"><div><small>${esc(Lb.served)}</small><b id="served">0</b></div><div class="drop" id="dropBox"><small>${esc(Lb.dropped)}</small><b id="dropped">0</b></div></div>
        <p class="msg" id="msg" role="status" aria-live="polite">${esc(B.messages.start)}</p>
        <p class="sr" id="benchLive" role="status" aria-live="polite"></p>
        <button class="btn" id="auto" type="button" hidden>${esc(Lb.auto)}</button>
        <button class="btn" id="reset" type="button">${esc(Lb.reset)}</button>
        <p class="static-note">${esc(B.note)}</p>
      </div>
    </div>
  </div>`;
}

export function modules(C) {
  const M = C.modules;
  const cards = C.cores.map((c) => `<li class="core" data-core="${esc(c.id)}"><header>${gem(c.id)}<div><span class="k">${esc(fmt(C.coreFromLabel, { from: c.from }))}</span><h3>${esc(c.name)}</h3></div></header><p>${esc(c.text)}</p><p class="proof">${esc(c.proof)}</p></li>`).join('\n    ');
  return `${secH(M.number, 'mod-h', M.title)}
  <p class="lede">${esc(M.lede)}</p>
  <ul class="cores" id="cores">
    ${cards}
  </ul>
  <p class="also">${esc(M.also)}</p>`;
}

function freight(C) {
  const F = C.experiments.freight;
  const cols = F.stages.map((s, i) => `<div class="fr-col" data-stage="${i}"><span class="fr-name">${esc(s.name)}</span><span class="fr-sub">${esc(s.sub)}</span><span class="fr-pods">${'<i></i>'.repeat(s.replicas)}</span>${i === F.stages.length - 1 ? '<svg class="fr-ring" viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15" class="bg"/><circle cx="18" cy="18" r="15" class="fg" pathLength="100"/></svg>' : ''}</div>`).join('');
  return `<div class="xp-vis freight" id="freight">
      <p class="vis-t">${esc(F.title)} <span class="sim">${esc(F.badge)}</span></p>
      <div class="fr-track" id="frTrack"><div class="fr-col fr-wh"><span class="fr-name">${esc(F.warehouse)}</span><span class="fr-sub">${esc(F.warehouseSub)}</span></div>${cols}<div class="fr-cube" id="frCube" aria-hidden="true"><i></i></div></div>
      <p class="fr-msg" id="frMsg" role="status" aria-live="polite">${esc(F.idle)}</p>
      <p class="fr-actions"><button class="btn primary" id="frBtn" type="button">${esc(fmt(F.button, { stage: F.stages[0].name }))}</button></p>
    </div>`;
}
function bekky(C) {
  const K = C.experiments.bekky;
  return `<div class="xp-vis bekky" id="bekky">
      <canvas id="bekkyCv" width="280" height="180" aria-hidden="true"></canvas>
      <p class="sr">${esc(K.from)} ${esc(K.fromSuffix)} ${esc(K.joiner)} ${esc(K.to)} ${esc(K.toSuffix)}</p>
      <p class="readout-note">${esc(K.note)} · <span>${esc(K.caption)}</span></p>
    </div>`;
}
function schematic(C) {
  const S = C.experiments.schematic, B = S.boxes;
  return `<figure class="xp-vis schematic">
      <svg viewBox="0 0 320 216" role="img" aria-labelledby="sch-t">
        <title id="sch-t">${esc(S.title)}</title>
        <rect class="sch-frame" x="4" y="6" width="312" height="200"/>
        <g class="sch-line"><rect x="16" y="88" width="56" height="40"/><rect x="112" y="88" width="72" height="40"/><rect x="228" y="56" width="76" height="40"/><rect x="228" y="140" width="76" height="40"/><rect x="232" y="144" width="76" height="40" class="ghost"/><rect x="112" y="16" width="72" height="34"/><path d="M72 108h40M184 100l44-24M184 116l44 36M148 50v38"/><path class="dash" d="M266 96v44"/></g>
        <g class="sch-txt"><text x="44" y="112">${esc(B.users)}</text><text x="148" y="106">${esc(B.lb[0])}</text><text x="148" y="119">${esc(B.lb[1])}</text><text x="266" y="80">${esc(B.run)}</text><text x="266" y="158">${esc(B.sql[0])}</text><text x="266" y="171">${esc(B.sql[1])}</text><text x="148" y="37">${esc(B.build)}</text></g>
        <g class="sch-call"><circle cx="112" cy="146" r="8"/><text x="112" y="149">1</text><path d="M112 138v-10"/><circle cx="214" cy="40" r="8"/><text x="214" y="43">2</text><path d="M222 44l8 10"/><circle cx="214" cy="200" r="8"/><text x="214" y="203">3</text><path d="M222 196l8-10"/><circle cx="92" cy="30" r="8"/><text x="92" y="33">4</text><path d="M100 32h10"/><circle cx="36" cy="206" r="8"/><text x="36" y="209">5</text></g>
      </svg>
      <figcaption><ol class="sch-legend">${S.legend.map((l) => `<li>${esc(l)}</li>`).join('')}</ol></figcaption>
    </figure>`;
}
// the opencode dashboard is drawn by assets/site/js/dashboard-viz.js into this empty container (see main.js)
const agents = () => '<div class="xp-vis agents" id="agentsViz"></div>';
const VISUALS = { freight, bekky, schematic, agents };

// case files: problem, constraint, decision, result per case; the labels come from caseFiles.labels
export function cases(C) {
  const K = C.caseFiles, Lb = K.labels;
  const items = K.items.map((c, i) => `<article class="case" aria-labelledby="case-${i}-h">
      <p class="case-n" aria-hidden="true">${String(i + 1).padStart(2, '0')}</p>
      <h3 id="case-${i}-h">${esc(c.title)}</h3>
      <dl class="case-dl">
        <div><dt>${esc(Lb.context)}</dt><dd>${esc(c.context)}</dd></div>
        <div><dt>${esc(Lb.constraint)}</dt><dd>${esc(c.constraint)}</dd></div>
        <div><dt>${esc(Lb.decision)}</dt><dd>${esc(c.decision)}</dd></div>
        <div class="case-result"><dt>${esc(Lb.result)}</dt><dd>${esc(c.result)}</dd></div>
      </dl>
    </article>`).join('\n    ');
  return `${secH(K.number, 'cases-h', K.title)}
  <p class="lede">${esc(K.lede)}</p>
  <div class="case-list">
    ${items}
  </div>`;
}

export function experiments(C) {
  const X = C.experiments;
  const cards = X.featured.map((f, i) => `<article class="xp" aria-labelledby="xp${i}-h">
    <div class="xp-text">
      <p class="xp-meta">${esc(f.meta)}</p>
      <h3 id="xp${i}-h">${esc(f.title)}</h3>
      <p>${esc(f.text)}</p>
      <ul class="tags" aria-label="${esc(X.tagsLabel)}">${f.tags.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
      <p class="xp-cta">${f.actions.map((x) => a(x, x.primary ? 'btn primary' : 'btn', ` aria-describedby="xp${i}-h"`)).join('')}</p>
    </div>
    ${VISUALS[f.visual] ? VISUALS[f.visual](C) : ''}
  </article>`).join('\n  ');
  return `${secH(X.number, 'exp-h', X.title)}
  <p class="lede">${esc(X.lede)}</p>
  ${cards}
  <h3 class="side-h">${esc(X.sideTitle)}</h3>
  <ul class="side-grid">${X.side.map((s) => `<li><a href="${esc(s.href)}"${ext(s.href)}><b>${esc(s.name)}</b><span>${esc(s.text)}</span></a></li>`).join('')}</ul>
  <p class="more"><a href="${esc(X.more.href)}"${ext(X.more.href)}>${esc(X.more.label)} ${ic('arrow')}</a></p>`;
}

export function pods(C) {
  const P = C.pods;
  const items = P.items.map((p, i) => {
    const n = String(i + 1).padStart(2, '0');
    return `<li class="spod" data-pod="${i}"><div class="tank" aria-hidden="true"><span class="tcap">${n}</span><span class="tliq"></span><span class="bub"></span><span class="bub"></span><span class="bub"></span><span class="bub"></span></div>
      <h3 class="tag-plate"><span class="pn">${esc(P.podLabel)} ${n}</span> <span class="pt">${esc(p.title)}</span></h3><p class="psrc"><span class="pstate">${esc(P.sealed)}</span> · ${esc(P.disclaimer)}</p>
      <button class="btn" type="button" aria-pressed="false" aria-controls="monitor">${esc(P.inspect)}<span class="sr"> ${esc(P.podLabel)} ${n}</span></button>
      <p class="ptext" hidden>${esc(p.text)}</p></li>`;
  }).join('\n    ');
  return `${secH(P.number, 'pods-h', P.title)}
  <p class="lede">${esc(P.lede)}</p>
  <ul class="pods" id="podList" style="--pods:${P.items.length}">
    ${items}
  </ul>
  <div class="monitor" id="monitor"><p class="mon-h"><span>${esc(P.monitor.title)}</span><span id="monId">${esc(P.monitor.idle)}</span></p><p class="mon-t" id="monText">${esc(P.monitor.intro)}</p>
        <p class="sr" id="monLive" role="status" aria-live="polite"></p>
      </div>
  <noscript><style>.ptext[hidden]{display:block!important}</style></noscript>`;
}

export function certs(C) {
  const K = C.certs;
  const items = K.items.map((c) => `<li class="cal">
      <p class="cal-sn">${esc(c.serial)}</p>
      <h3>${esc(c.name)}${c.code ? ` <span class="nowrap">(${esc(c.code)})</span>` : ''}</h3>
      <p class="cal-v">${esc(c.validity)}</p>
      <p class="cal-by">${c.verify ? `<a class="cal-btn" href="${esc(c.verify.href)}"${ext(c.verify.href)}>${esc(c.verify.label)}<span class="sr"> ${esc(c.verify.srLabel)}</span></a>` : esc(c.issuedBy || '')}</p>
    </li>`).join('\n    ');
  return `${secH(K.number, 'certs-h', K.title)}
  <p class="lede">${esc(K.lede)}</p>
  <ul class="labels">
    ${items}
  </ul>
  <p class="earlier">${esc(K.earlier)}</p>
  <ul class="edu">${K.education.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>`;
}

export function contact(C) {
  const K = C.contact, F = K.form, f = F.fields;
  const field = (id, name, el, hint = '') => `<div class="field">
          <label for="f-${id}">${esc(f[name].label)}</label>
          ${hint}
          ${el}
          <p class="err" id="e-${id}" hidden>${ic('alert')}<span></span></p>
        </div>`;
  const links = K.links.map((l) => { const L = C.links[l.ref]; const sub = l.sub ? C.links[l.sub] : null;
    return `<li><a href="${esc(L.href)}"${ext(L.href)}${pdf(L.href)}>${ic(l.icon)}<span>${esc(l.label)}</span></a>${sub ? `\n        <a class="sub" href="${esc(sub.href)}"${pdf(sub.href)}>${esc(sub.label)}</a>` : ''}</li>`; }).join('\n      ');
  return `${secH(K.number, 'contact-h', K.title)}
  <p class="lede">${esc(K.lede)}</p>
  <div class="contact-b">
    <div class="channel" id="channel">
      <p class="ch-h"><span>${esc(K.channel)}</span><span id="chState" role="status">${esc(K.states.open)}</span></p>
      <form class="form" id="form" action="${esc(F.endpoint)}" method="POST" novalidate>
        <input type="hidden" name="access_key" value="${esc(F.accessKey)}">
        <input type="hidden" name="subject" value="${esc(F.subject)}">
        <input type="hidden" name="from_name" value="${esc(F.fromName)}">
        <input type="hidden" name="redirect" value="${esc(F.redirect)}">
        <div class="hp" aria-hidden="true"><label>${esc(F.honeypot)} <input type="checkbox" name="botcheck" tabindex="-1" autocomplete="off"></label></div>
        <p class="privacy" id="f-note">${esc(F.note)}</p>
        ${field('name', 'name', `<input id="f-name" name="name" type="text" autocomplete="name" placeholder="${esc(f.name.placeholder)}" required maxlength="${f.name.max}" aria-describedby="e-name">`)}
        ${field('email', 'email', `<input id="f-email" name="email" type="email" autocomplete="email" inputmode="email" placeholder="${esc(f.email.placeholder)}" required maxlength="${f.email.max}" aria-describedby="e-email">`)}
        ${field('msg', 'message', `<textarea id="f-msg" name="message" rows="6" placeholder="${esc(f.message.placeholder)}" required minlength="${f.message.min}" maxlength="${f.message.max}" aria-describedby="f-msg-hint e-msg"></textarea>`, `<p class="privacy" id="f-msg-hint">${esc(f.message.hint)}</p>`)}
        <p class="form-err" id="formErr" role="alert" hidden>${esc(F.error)} <a href="${esc(C.links.linkedin.href)}" rel="noopener">${esc(C.links.linkedin.label)}</a>.</p>
        <button class="btn primary send" id="send" type="submit"><span class="send-t">${esc(F.send)}</span><span class="busy-bar" aria-hidden="true"></span></button>
        <p class="privacy">${esc(F.privacy)}</p>
      </form>
      <div class="sent" id="sent" hidden><p class="sent-t" id="sentMsg" tabindex="-1">${esc(F.success)}</p><button class="btn" id="again" type="button">${esc(F.again)}</button></div>
      <svg class="pulse" id="pulse" aria-hidden="true" preserveAspectRatio="none"><rect x="1" y="1" pathLength="100"/></svg>
    </div>
    <ul class="links">
      ${links}
    </ul>
  </div>`;
}

export function footer(C) {
  return `<p>${esc(C.footer.text)}</p><span class="housing" id="footHousing" aria-hidden="true">${housing(C)}</span><a href="#top" class="totop">${esc(C.footer.top)}</a>`;
}

export function notFound(C, base = '/', h = 'h1') {
  const N = C.notFound;
  return `<p class="eyebrow">${esc(N.eyebrow)}</p>
  <${h}>${esc(N.heading[0])} <span>${esc(N.heading[1])}</span></${h}>
  <p>${esc(N.text)}</p>
  <p class="h-cta"><a class="btn primary" href="${esc(base)}">${esc(N.home)}</a><a class="btn" href="${esc(N.secondary.href)}">${esc(N.secondary.label)}</a></p>`;
}

// slot name -> renderer, in document order
const skip = (C) => esc(C.site.skipLink);
export const SLOTS = { skip, bar, menu, hero, spec, log, cases, modules, experiments, pods, certs, contact, footer };
