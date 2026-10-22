#!/usr/bin/env node
// Pre-renders the content files into the pages, between <!--slot:x--> markers.
// No dependencies. Idempotent: run it after every content change, then commit.
//   scripts/template.html  the page structure (source of index.html and it/index.html)
//   data/content.json      English  -> index.html
//   data/content.it.json   Italian  -> it/index.html
//   node scripts/build.mjs          write the pages
//   node scripts/build.mjs --check  exit 1 if the pages are not up to date (for CI)
// index.html is an output: the template is kept apart so {{ui.key}} placeholders survive every build.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const R = await import(pathToFileURL(path.join(root, 'assets/site/js/render.js')).href);
const { LOCALES } = await import(pathToFileURL(path.join(root, 'assets/site/js/i18n.js')).href);
const check = process.argv.includes('--check');

// one content file per locale; the same schema validates both
const FILES = { en: 'content.json', it: 'content.it.json' };
const schema = JSON.parse(await readFile(path.join(root, 'data/schema.json'), 'utf8'));
const CONTENT = {};
const errors = [];

function validate(C, at) {
  // light validation against data/schema.json: required keys at every level that declares them
  const errs = [];
  (function walk(s, v, p) {
    if (s.$ref) s = s.$ref.split('/').slice(1).reduce((o, k) => o[k], schema);
    if (s.type === 'object' && v && typeof v === 'object') {
      for (const k of s.required || []) if (!(k in v)) errs.push(`${p}.${k} is required`);
      for (const [k, sub] of Object.entries(s.properties || {})) if (k in v) walk(sub, v[k], `${p}.${k}`);
    } else if (s.type === 'array' && Array.isArray(v) && s.items) v.forEach((x, i) => walk(s.items, x, `${p}[${i}]`));
    if (s.pattern && typeof v === 'string' && !new RegExp(s.pattern).test(v)) errs.push(`${p} does not match ${s.pattern}`);
  })(schema, C, at);
  return errs;
}

for (const code of Object.keys(LOCALES)) {
  const C = JSON.parse(await readFile(path.join(root, 'data', FILES[code]), 'utf8'));
  CONTENT[code] = C;
  errors.push(...validate(C, `${FILES[code]}:content`));
}
// both files must describe the same site: same top-level sections
const keysEn = Object.keys(CONTENT.en).sort().join(), keysIt = Object.keys(CONTENT.it).sort().join();
if (keysEn !== keysIt) errors.push(`${FILES.it} and ${FILES.en} have different top-level keys`);
if (errors.length) { console.error('content is invalid:\n  ' + errors.join('\n  ')); process.exit(1); }

const EN = CONTENT.en;
const siteUrl = EN.site.url;                                   // site root, with trailing slash
const localeUrl = (code) => new URL(LOCALES[code].path.slice(1), siteUrl).href;
const fill = (html, slots) => {
  for (const [name, out] of Object.entries(slots)) {
    const re = new RegExp(`(<!--slot:${name}-->)[\\s\\S]*?(<!--/slot:${name}-->)`);
    if (!re.test(html)) throw new Error(`slot ${name} not found`);
    html = html.replace(re, (_, a, b) => `${a}${out}${b}`);
  }
  return html;
};

// first visit only, before first paint: the browser language picks the page. A saved choice (gc-lang) or a
// redirect already made in this session (gc-lang-hop) stops it, so it can never loop. Hash and query are kept.
function redirectScript(code) {
  const paths = Object.fromEntries(Object.entries(LOCALES).map(([c, v]) => [c, v.path]));
  return `<script>
(function () {
  try {
    var cur = ${JSON.stringify(code)}, paths = ${JSON.stringify(paths)}, hop = 'gc-lang-hop';
    if (localStorage.getItem('gc-lang') || sessionStorage.getItem(hop)) return;
    var langs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ''];
    var want = 'en';
    for (var i = 0; i < langs.length; i++) { var c = String(langs[i] || '').split('-')[0].toLowerCase(); if (c === 'it' || c === 'en') { want = c; break; } }
    if (want === cur) return;
    sessionStorage.setItem(hop, '1');
    location.replace(paths[want] + location.search + location.hash);
  } catch (e) { /* storage blocked: stay on this page */ }
})();
</script>`;
}

// head for one language: canonical, og:url and og:locale are its own; hreflang links point to both pages
function localizedHead(code, C) {
  const own = localeUrl(code);
  let h = redirectScript(code) + '\n' + R.head(C);
  const swap = (re, fn) => {
    if (!re.test(h)) throw new Error(`head: ${re} not found`);
    h = h.replace(re, (m) => fn(m));
  };
  swap(/<link rel="canonical" href="[^"]*">/, () => `<link rel="canonical" href="${R.esc(own)}">`);
  swap(/<meta property="og:url" content="[^"]*">/, () => `<meta property="og:url" content="${R.esc(own)}">`);
  swap(/<meta property="og:locale" content="[^"]*">/, () => `<meta property="og:locale" content="${LOCALES[code].ogLocale}">`);
  const ogAlt = Object.keys(LOCALES).filter((c) => c !== code).map((c) => `<meta property="og:locale:alternate" content="${LOCALES[c].ogLocale}">`);
  swap(/<meta property="og:locale" content="[^"]*">/, (m) => [m, ...ogAlt].join('\n'));
  const hreflang = [
    ...Object.keys(LOCALES).map((c) => `<link rel="alternate" hreflang="${c}" href="${R.esc(localeUrl(c))}">`),
    `<link rel="alternate" hreflang="x-default" href="${R.esc(localeUrl('en'))}">`,
  ];
  swap(/<link rel="canonical" href="[^"]*">/, (m) => [m, ...hreflang].join('\n'));
  return h;
}

// one page per locale, same template; the build fills slots and sets lang, hash and content file
function indexFor(code, template) {
  const C = CONTENT[code], D = R.derive(C);
  const slots = Object.fromEntries(Object.entries(R.SLOTS).map(([k, fn]) => [k, fn(C, D)]));
  slots.head = localizedHead(code, C);
  return fill(template, slots)
    .replace(/\{\{ui\.(\w+)\}\}/g, (m, k) => (k in C.ui ? R.esc(C.ui[k]) : m))
    .replace(/<html[^>]*>/, `<html lang="${R.esc(code)}" data-content-hash="${R.hash(C)}">`)
    .replace(/href="\/data\/content(?:\.[a-z]+)?\.json"/g, `href="/data/${FILES[code]}"`);
}

const INDEX_TEMPLATE = await readFile(path.join(root, 'scripts/template.html'), 'utf8');
const jobs = [
  { file: 'index.html', make: () => indexFor('en', INDEX_TEMPLATE) },
  { file: 'it/index.html', make: () => indexFor('it', INDEX_TEMPLATE) },
  { file: '404.html', make: (before) => fill(before, {
    head404: `<title>${R.esc(EN.notFound.title)}</title>\n<script>\n  // pages of the old site now live as sections of the home page\n  (function () { var m = ${JSON.stringify(EN.notFound.redirects)}; var k = location.pathname.replace(/^\\/+|\\/+$/g, '').replace(/\\.html$/, '').toLowerCase(); if (m[k]) location.replace('/' + m[k]); })();\n</script>`,
    skip: R.esc(EN.site.skipLink),
    brand404: `<a class="brand" href="/"><span class="lamp" aria-hidden="true"></span>${R.esc(EN.site.brand)}</a>`,
    // bilingual, static: English first, Italian below with its own links
    notfound: `${R.notFound(EN)}\n  <div class="lost-it" lang="it">${R.notFound(CONTENT.it, '/it/', 'h2')}</div>`,
  }).replace(/<html[^>]*>/, `<html lang="${R.esc(EN.site.lang)}">`) },
  { file: 'site.webmanifest', make: () => JSON.stringify({
    name: EN.site.og.title, short_name: EN.site.brand, start_url: '/', display: 'browser',
    background_color: '#060B08', theme_color: '#060B08',
    icons: [192, 512].map((n) => ({ src: `/assets/site/img/icon-${n}.png`, sizes: `${n}x${n}`, type: 'image/png' })),
  }, null, 2) + '\n' },
];

let stale = 0;
for (const job of jobs) {
  const p = path.join(root, job.file);
  const before = await readFile(p, 'utf8').catch(() => null);
  const after = job.make(before ?? '');
  if (before === after) { console.log(`${job.file}: up to date`); continue; }
  stale++;
  if (check) console.log(`${job.file}: ${before === null ? 'missing' : 'out of date'}`);
  else {
    await mkdir(path.dirname(p), { recursive: true });
    await writeFile(p, after);
    console.log(`${job.file}: written (${(after.length / 1024).toFixed(1)} KB)`);
  }
}
if (check && stale) process.exit(1);
