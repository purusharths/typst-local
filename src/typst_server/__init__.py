import argparse
import importlib
import sys
from pathlib import Path

import uvicorn

from . import config


def ask_projects_dir() -> Path:
    """Ask in the terminal where projects should be stored, create the folder, and save the answer."""
    current = config.user_settings().get("projects_dir") or config.PROJECTS_DIR
    print("Where should typst-server store your projects?")
    print("Each project becomes a sub-folder there.")
    while True:
        try:
            answer = input(f"Projects folder [{current}]: ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            raise SystemExit("Setup cancelled. Nothing was saved.")
        path = Path(answer or current).expanduser().resolve()
        if path.exists() and not path.is_dir():
            print(f"{path} exists and is not a folder. Try again.")
            continue
        if not path.exists():
            try:
                ok = input(f"{path} does not exist. Create it? [Y/n] ").strip().lower()
            except (EOFError, KeyboardInterrupt):
                print()
                raise SystemExit("Setup cancelled. Nothing was saved.")
            if ok not in ("", "y", "yes"):
                continue
            try:
                path.mkdir(parents=True)
            except OSError as e:
                print(f"Could not create {path}: {e}")
                continue
        config.save_projects_dir(path)
        print(f"Saved. Projects will be stored in {path}")
        print(f"Settings file: {config.USER_CONFIG}  (run with --setup to change)\n")
        return path


def main() -> None:
    p = argparse.ArgumentParser(description="Typst web server")
    p.add_argument("--host", default="0.0.0.0")
    p.add_argument("--port", type=int, default=8000)
    p.add_argument("--reload", action="store_true")
    p.add_argument("--setup", action="store_true", help="ask again where projects are stored")
    p.add_argument("--projects-dir", metavar="PATH", help="set and save the projects folder without asking")
    a = p.parse_args()

    if a.projects_dir:
        path = Path(a.projects_dir).expanduser().resolve()
        path.mkdir(parents=True, exist_ok=True)
        config.save_projects_dir(path)
        print(f"Saved. Projects will be stored in {path}")
    elif a.setup or config.needs_setup():
        if sys.stdin.isatty():
            ask_projects_dir()
        elif a.setup:
            raise SystemExit("--setup needs an interactive terminal. Use --projects-dir PATH instead.")
        else:
            print(f"typst-server: no projects folder chosen yet, using {config.ROOT}. "
                  "Run `typst-server --setup` in a terminal to choose one.", file=sys.stderr)

    importlib.reload(config)  # pick up the folder that was just saved
    print(f"Projects folder: {config.ROOT}")
    uvicorn.run("typst_server.app:app", host=a.host, port=a.port, reload=a.reload)
