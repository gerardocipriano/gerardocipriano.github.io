// Data layer: the only module that knows where content comes from.
// Contract: loadContent() resolves to an object valid against /data/schema.json, or rejects.
// The locale picks the file: 'en' -> data/content.json, 'it' -> data/content.it.json.
// Default locale is document.documentElement.lang. To move to another backend (for example
// Firestore), add a provider with the same load() signature and select it in PROVIDER;
// rendering code does not change.

// one content file per locale; the build pre-renders the same pair (see scripts/build.mjs)
export const CONTENT_FILES = { en: '/data/content.json', it: '/data/content.it.json' };

const providers = {
  // static JSON next to the site; same files the build script pre-renders from
  json: { load: async ({ url = CONTENT_FILES.en, timeoutMs = 6000 } = {}) => {
    const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      // no cache option: the request matches the <link rel="preload" as="fetch" crossorigin> in the page, so it is fetched once
      const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: ctrl.signal });
      if (!res.ok) throw new Error(`content: HTTP ${res.status}`);
      return await res.json();
    } finally { clearTimeout(t); }
  } },
};

const PROVIDER = 'json';

// 'it-IT' -> 'it'; anything unknown falls back to English
function localeOf(lang) {
  const code = String(lang || '').split('-')[0].toLowerCase();
  return Object.prototype.hasOwnProperty.call(CONTENT_FILES, code) ? code : 'en';
}

function defaultLang() {
  try { return document.documentElement.lang; } catch { return ''; }
}

function check(c) {
  const need = ['site', 'person', 'links', 'nav', 'career', 'hero', 'cores', 'buildLog', 'bench', 'experiments', 'pods', 'certs', 'contact', 'footer'];
  const miss = need.filter((k) => !(k in (c || {})));
  if (miss.length) throw new Error('content: missing ' + miss.join(', '));
  return c;
}

/** Resolves to the content object for a locale ('en' or 'it'); rejects when the source is
 *  unreachable or invalid. Callers keep the pre-rendered page as the fallback.
 *  opts.locale defaults to document.documentElement.lang; opts.url overrides the file. */
export async function loadContent(opts = {}) {
  const locale = localeOf(opts.locale ?? defaultLang());
  const { locale: _ignored, ...rest } = opts;
  return check(await providers[PROVIDER].load({ url: CONTENT_FILES[locale], ...rest }));
}
