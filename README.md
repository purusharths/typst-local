# typst-server

A self-hosted Typst editor in the browser with a live preview, like typst.app but running on your own machine. It has no accounts and no cloud.

## Requirements

- Python 3.14 or newer, plus either [uv](https://docs.astral.sh/uv/) or pip
- Optional: the `typst` CLI on your `PATH`, for line and column numbers in error messages

## Run

```sh
uv run typst-server
```

On the first run, the server asks in the terminal where to store projects. Press Enter to accept the suggested folder, or type another path. The answer is saved and not asked again.

Open <http://localhost:8000>. The server listens on all interfaces, so other devices on your network can use it too.

```sh
uv run typst-server --host 127.0.0.1 --port 9000   # local only, different port
uv run typst-server --setup                          # choose the projects folder again
uv run typst-server --projects-dir ~/Sync/typst      # set the projects folder without a prompt
```

## Usage

- The start page lists your projects. Click **+ New project** to create one.
- Each project is a folder inside the projects folder, `~/Documents/typst-files/` by default. The document is compiled from `main.typ`.
- Type in the editor and the preview updates as you go. Errors appear under the preview.
- The **PDF** button opens the compiled document in a new tab. The download button next to it saves it.
- In the file sidebar, the add button creates a file and the upload button uploads one. You can also drag files onto the sidebar or onto a folder.
- Folders in the sidebar fold and unfold on click.
- The folder button opens a project or file location in your file manager. The full project path is shown in the sidebar and copies on click.
- **hide pdf** hides the preview for the current file. The theme button switches between light and dark.

New projects start from an A4 paper template:

| File | Contents |
| --- | --- |
| `main.typ` | The body text only |
| `housekeeping.typ` | Title, author, date and page setup. Set a field to `""` to hide it. |
| `abstract.typ` | The abstract |
| `refs.bib` | Bibliography entries |
| `figures/` | Images |

## Configuration

The projects folder is decided in this order:

1. The `TYPST_FILES` environment variable, if set.
2. The folder chosen at first run, saved in `~/.config/typst-server/config.toml`.
3. `PROJECTS_DIR` in `src/typst_server/config.py`, which is also the suggested answer at first run.

Other folder settings are at the top of `src/typst_server/config.py`:

| Setting | Default | Environment variable | Purpose |
| --- | --- | --- | --- |
| `PROJECTS_DIR` | `~/Documents/typst-files` | `TYPST_FILES` | Where projects are stored |
| `TEMPLATES_DIR` | the bundled `templates/` folder | `TYPST_TEMPLATES` | Where new-project templates are read from |
| `DEFAULT_TEMPLATE_NAME` | `paper` | `TYPST_TEMPLATE` | Template used for new projects |

An environment variable overrides the setting for one run. Restart the server after editing `config.py`.

```sh
TYPST_FILES=~/Sync/typst uv run typst-server
```

To change the default project, edit the files in `src/typst_server/templates/paper/`. The text `{{title}}` is replaced with the project name.

## Development

### With uv

```sh
uv sync                          # create .venv and install dependencies
uv run typst-server --reload     # restart the server when Python files change
```

### With plain Python

```sh
python3.14 -m venv .venv
source .venv/bin/activate
pip install -e .                 # editable install: code changes apply without reinstalling
python -m typst_server --reload  # same as the typst-server command
```

`--reload` restarts the server when Python code changes. Frontend files in `static/` need only a browser reload.

### Where things are

- `src/typst_server/app.py` holds the backend, built with FastAPI.
- `src/typst_server/config.py` holds the settings.
- `src/typst_server/static/` holds the frontend.
- `src/typst_server/templates/` holds the new-project templates.
- `web/` is only needed to rebuild the bundled CodeMirror editor:

```sh
cd web && npm install && npm run build
```

## Caveats

- There is no authentication. Anyone who can reach the port can read, edit and delete projects.
- Opening the same file in two tabs at once makes them overwrite each other.
