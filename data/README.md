# data

Content of the site, one file per language. Both files follow `schema.json`.

| File | Language | Page | Loaded in the browser from |
|---|---|---|---|
| `content.json` | English (`en`) | `/` (`index.html`) | `/data/content.json` |
| `content.it.json` | Italian (`it`) | `/it/` (`it/index.html`) | `/data/content.it.json` |
| `schema.json` | contract for both files | | |

- Both files must have the same top-level sections. The build fails if they differ.
- `site.lang` is informative. The build sets `<html lang>` and `og:locale` from the page's language.
- Edit a file, then run `node scripts/build.mjs`. Commit the files it writes with the content change.
- Italian copy is written for an Italian reader, not translated word by word. Technical terms stay in English.
