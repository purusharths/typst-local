# typst-server

A self-hosted Typst editor in the browser with a live preview, like typst.app but running on your own machine. It has no accounts and no cloud.

## Requirements

- [uv](https://docs.astral.sh/uv/) (installs Python 3.14 and the dependencies)
- Optional: the `typst` CLI on your `PATH`, for line and column numbers in error messages

## Run

```sh
uv run typst-server
```

Open <http://localhost:8000>. The server listens on all interfaces, so other devices on your network can use it too.

```sh
uv run typst-server --host 127.0.0.1 --port 9000   # local only, different port
```

## Usage

- The start page lists your projects. Click **+ New project** to create one.
- Each project is a folder in `~/Documents/typst-files/`. The document is compiled from `main.typ`.
- Type in the editor and the preview updates as you go. Errors appear under the preview.
- **PDF** opens the compiled document in a new tab, and **⬇** downloads it.
- In the file sidebar, **+** adds a file and **⇧** uploads one. You can also drag files onto the sidebar or onto a folder.
- 📁 opens a project or file location in your file manager.
- **hide pdf** hides the preview for the current file, and ◐ toggles dark mode.

New projects start from an A4 paper template:

| File | Contents |
| --- | --- |
| `main.typ` | The body text only |
| `housekeeping.typ` | Title, author, date and page setup. Set a field to `""` to hide it. |
| `abstract.typ` | The abstract |
| `refs.bib` | Bibliography entries |
| `figures/` | Images |

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `TYPST_FILES` | `~/Documents/typst-files` | Where projects are stored |
| `TYPST_TEMPLATE` | `paper` | Template used for new projects |
| `TYPST_TEMPLATES` | `src/typst_server/templates` | Folder containing the templates |

To change the default project, edit the files in `src/typst_server/templates/paper/`. The text `{{title}}` is replaced with the project name. Other settings are in `src/typst_server/config.py`.

## Development

- `src/typst_server/app.py` holds the backend, built with FastAPI.
- `src/typst_server/static/` holds the frontend.
- `web/` is only needed to rebuild the bundled CodeMirror editor:

```sh
cd web && npm install && npm run build
```

## Caveats

- There is no authentication. Anyone who can reach the port can read, edit and delete projects.
- Opening the same file in two tabs at once makes them overwrite each other.
