"""Settings for typst-server.

Edit the values in the "Folders" section below to change where things live.
Each one can also be overridden for a single run with the environment variable
named next to it, which takes precedence over the value written here.

The projects folder is chosen on first run and saved in USER_CONFIG
(~/.config/typst-server/config.toml). Precedence for the projects folder:
TYPST_FILES, then USER_CONFIG, then PROJECTS_DIR below.
"""
from __future__ import annotations

import os
import re
import tomllib
from pathlib import Path

PKG = Path(__file__).parent

# ---------------------------------------------------------------------------
# Folders. Use an absolute path or one starting with "~".
# ---------------------------------------------------------------------------

# Where projects are stored, one sub-folder per project.   Override: TYPST_FILES
# Also the suggested answer when the first-run prompt asks for a folder.
PROJECTS_DIR = "~/Documents/typst-files"

# Where new-project templates are read from.                Override: TYPST_TEMPLATES
# None means the templates shipped with this package.
TEMPLATES_DIR = None

# Template folder (inside TEMPLATES_DIR) used for new projects.  Override: TYPST_TEMPLATE
DEFAULT_TEMPLATE_NAME = "paper"

# ---------------------------------------------------------------------------
# Resolved values used by the app. No need to edit below this line.
# ---------------------------------------------------------------------------


USER_CONFIG = Path(os.environ.get("XDG_CONFIG_HOME") or "~/.config").expanduser() / "typst-server" / "config.toml"


def _path(env: str, value: str | Path) -> Path:
    return Path(os.environ.get(env) or value).expanduser().resolve()


def user_settings() -> dict:
    """Settings saved by the first-run prompt, or {} if there are none yet."""
    try:
        return tomllib.loads(USER_CONFIG.read_text())
    except FileNotFoundError:
        return {}
    except tomllib.TOMLDecodeError as e:
        raise SystemExit(f"typst-server: cannot read {USER_CONFIG}: {e}")


def needs_setup() -> bool:
    """True when nothing says where projects live yet, so the user should be asked."""
    return not os.environ.get("TYPST_FILES") and "projects_dir" not in user_settings()


def save_projects_dir(path: Path) -> None:
    settings = user_settings() | {"projects_dir": str(path)}
    lines = ["# Written by typst-server. Edit freely, or run `typst-server --setup`."]
    for key, value in settings.items():
        escaped = str(value).replace("\\", "\\\\").replace('"', '\\"')
        lines.append(f'{key} = "{escaped}"')
    USER_CONFIG.parent.mkdir(parents=True, exist_ok=True)
    USER_CONFIG.write_text("\n".join(lines) + "\n")


ROOT = _path("TYPST_FILES", user_settings().get("projects_dir") or PROJECTS_DIR)
TEMPLATES = _path("TYPST_TEMPLATES", TEMPLATES_DIR or PKG / "templates")
DEFAULT_TEMPLATE = os.environ.get("TYPST_TEMPLATE") or DEFAULT_TEMPLATE_NAME
STATIC = PKG / "static"

# Placeholder replaced with the project name in template text files.
TITLE_PLACEHOLDER = "{{title}}"

# Entry point compiled for every project.
MAIN = "main.typ"

# Files with these extensions open in the editor; everything else is treated as binary.
TEXT_EXT = {
    ".typ", ".txt", ".md", ".csv", ".json", ".yaml", ".yml", ".toml",
    ".bib", ".tex", ".svg", ".xml", ".html", ".css", ".js",
}

# Allowed project names.
NAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9 ._-]{0,63}$")

# Debounce before compiling after an edit, in seconds.
COMPILE_DEBOUNCE = 0.12
