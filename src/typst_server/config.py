"""Settings and fixed values for typst-server. Override paths with environment variables."""
from __future__ import annotations

import os
import re
from pathlib import Path

PKG = Path(__file__).parent

# Where projects live: one sub-folder per project.
ROOT = Path(os.environ.get("TYPST_FILES", Path.home() / "Documents" / "typst-files")).expanduser()

# Frontend assets and project templates shipped with the package.
STATIC = PKG / "static"
TEMPLATES = Path(os.environ.get("TYPST_TEMPLATES", PKG / "templates")).expanduser()
DEFAULT_TEMPLATE = os.environ.get("TYPST_TEMPLATE", "paper")

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
