# gerardocipriano.github.io

Personal site of Gerardo Cipriano, cloud engineer: <https://gerardocipriano.github.io>.

Static site on GitHub Pages (branch `master`). Vanilla HTML, CSS and ES modules. No runtime libraries, no bundler.

## How content works

All text, dates, links, certifications and core colours live in `data/content.json`.
The contract is `data/schema.json` (JSON Schema).
The HTML only holds structure and empty slots (`<!--slot:name-->…<!--/slot:name-->`).

1. `scripts/build.mjs` reads `data/content.json` (en) and `data/content.it.json` (it), fills `scripts/template.html` and writes `index.html`, `it/index.html` and `404.html`. Never edit those three by hand.
   Crawlers and visitors without JavaScript get the complete page.
2. In the browser, `assets/site/js/data-source.js` loads the same content through `loadContent()`.
3. `assets/site/js/main.js` compares the content hash with the one stamped by the build (`data-content-hash`).
   If they differ, it re-renders the slots with the same functions (`assets/site/js/render.js`).
4. If the content cannot be loaded, the pre-rendered page stays as it is.
   The games are hidden and the portrait shows as a still image.

## Edit the content

```sh
# 1. edit data/content.json
node scripts/build.mjs          # validates against data/schema.json and writes the pages
node scripts/build.mjs --check  # exit 1 if a page is out of date
git add -A && git commit
```

Node 18 or newer, no dependencies. Values computed from today's date are refreshed in the browser:
days per era, months in the current role, the particle count.
The pre-rendered page shows them as of the last build.

## Adding a new job

1. In `data/content.json` and `data/content.it.json`, close the current entry in `buildLog.entries`: set its `"to"` to the end month (`"YYYY-MM"`).
2. Add the new entry to both files, same position in the list: `"id": "gcv4"`, `"from"`, `"to": null`, `title`, `org`, `text`, `module`. Do not write a version: the id is the version (`gcv4` shows as `GC-v4`).
3. Optional, same in both files: a new era in `career.eras` (a colour and a start month), and a new core in `cores` with `"source": "gcv4"` (the entry that lights it).
4. `node scripts/build.mjs`, then `node scripts/build.mjs --check`. The build fails if two entries are open, if the current entry has no `gcN` id, or if a core points at an entry that does not exist.
5. Commit the two content files and the pages the build wrote (`index.html`, `it/index.html`, `404.html` if changed).

Derived from the data, no edit needed:

- The version in the hero eyebrow, the version plate and the status line: `{version}` and `{versionId}`, from the open entry (no `to`).
- The `current` label after that entry: `buildLog.currentLabel`.
- The core count in the hint and the announcement: `{lit}` (cores collected) and `{total}` (cores in `cores`).
- The label of each core, `Core · from GC-vN`: from its `source` entry. A gap (such as a maintenance window) shows the next release.
- The `current` styling of the entry, and months per entry.

Not derived, write by hand when it changes:

- `hero.nowRunning` (role, stack, certifications), shown as "Now running".
- Numbers in the narrative texts (for example "three years in cloud", "eight in IT", the key figures in `spec`).

The placeholders are filled by `fmt()` in `assets/site/js/render.js`, in the build and in the browser, the same as `{n}` and `{total}` elsewhere.

## Change the data source

`data-source.js` is the only module that knows where content comes from.
Add a provider with the same `load()` shape (for example Firestore) and select it in `PROVIDER`.
The provider must resolve to an object valid against `data/schema.json`.
Rendering and behaviour do not change.

## Run it locally

```sh
python3 -m http.server 8000   # from the repo root, then open http://localhost:8000
```

A server is needed: the particle portrait reads an image into a canvas, which fails from `file://`.

## Layout

| Path | Content |
|---|---|
| `scripts/template.html` | page structure and slots; `index.html`, `it/index.html` and `404.html` are build output |
| `data/content.json`, `data/schema.json` | content and its contract |
| `assets/site/site.css` | styles and design tokens; core colours come from the data |
| `assets/site/js/` | `main.js` bootstrap, `render.js` templates, `data-source.js`, `genesis.js` particle portrait, `bench.js` upgrade game, `lab.js` freight, bekky and pods, `contact.js` form |
| `assets/site/img/` | portrait sample and duotone, favicons, og-image |
| `assets/docs/` | CVs (PDF) |
| `scripts/build.mjs` | pre-render and validation |
| `scripts/og.html` | source of `og-image.png`: serve the repo, open it at 1200x630, screenshot |

The contact form posts to Web3Forms with a public access key. No email address is in the code.
There are no cookies and no analytics.
