# typst-server

A small self-hosted, real-time Typst editor in the browser. Think typst.app, but local, single-user, no auth.

- Projects are folders under `~/Documents/typst-files/<project>/`, each with a `main.typ` entry point.
- Edits are saved to disk and compiled in-process with [typst-py](https://github.com/messense/typst-py) (incremental), so the preview updates as you type.
- Preview is rendered as SVG pages. Errors show line:column diagnostics via the `typst` CLI if installed.
- Landing page lists projects; new projects are scaffolded as an A4 paper:
  - `main.typ` — just the content: `#show: paper`, `#include "abstract.typ"`, sections, `#bibliography`.
  - `housekeeping.typ` — title, author, institution, email, date, plus page/text setup and the title block. Empty fields (`""`) are not rendered.
  - `abstract.typ`, `refs.bib` (dummy entries), and an empty `figures/` folder (drop images onto it in the sidebar).
- CodeMirror 6 editor with Typst highlighting, file sidebar, upload / drag-and-drop for assets, PDF export.
- PDF button opens the compiled PDF in a tab; ⬇ downloads it. 📁 buttons (project, each file, landing cards) open the folder in the file manager on the machine running the server; the full path is shown in the sidebar and copies on click.
- Light theme by default, dark toggle (◐). The PDF preview can be hidden per file ("hide pdf"); the choice is remembered in the browser.

## Run

```sh
uv run typst-server            # http://0.0.0.0:8000  (reachable on your LAN)
uv run typst-server --port 9000 --host 127.0.0.1
```

Set `TYPST_FILES=/some/dir` to change where projects live. `TYPST_TEMPLATES` and `TYPST_TEMPLATE` point at a different templates folder or template name.

## Layout

- `src/typst_server/app.py` — FastAPI app: REST for projects/files, websocket `/ws/<project>` for live compile.
- `src/typst_server/config.py` — paths, allowed file types, project-name rule, compile debounce.
- `src/typst_server/templates/paper/` — the files copied into every new project. Edit them directly; `{{title}}` is replaced with the project name. Empty folders need a `.gitkeep`, which is not copied.
- `src/typst_server/static/` — frontend (`index.html`, `app.js`, `style.css`) plus the prebuilt CodeMirror bundle in `vendor/`.
- `web/` — only needed to rebuild the CodeMirror bundle: `cd web && npm install && npm run build`. `node e2e.mjs` runs a headless Chrome smoke test against a server on port 8765 with a project named `Paper`.

## Notes

- No authentication. Anyone on your network can read, edit and delete projects. Bind to `127.0.0.1` if that is a concern.
- One editor per project; two tabs editing the same file will overwrite each other (KISS for now).
