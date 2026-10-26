"""Typst live-preview web server.

Projects live in ~/Documents/typst-files/<project>/ with a main.typ entry point.
Edits arrive over a websocket, are written to disk and compiled in-process with
typst-py (incremental), and SVG pages are pushed back to the browser.
"""
from __future__ import annotations

import asyncio
import base64
import os
import shutil
import subprocess
import tempfile
from pathlib import Path

import typst
from fastapi import FastAPI, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .config import (COMPILE_DEBOUNCE, DEFAULT_TEMPLATE, MAIN, NAME_RE, ROOT, STATIC,
                     TEMPLATES, TEXT_EXT, TITLE_PLACEHOLDER)

ROOT.mkdir(parents=True, exist_ok=True)
app = FastAPI(title="typst-server")


def scaffold(d: Path, title: str, template: str = DEFAULT_TEMPLATE) -> None:
    """Copy a template folder into a new project, filling in the title."""
    src = TEMPLATES / template
    for p in sorted(src.rglob("*")):
        rel = p.relative_to(src)
        if p.name == ".gitkeep":
            continue
        dest = d / rel
        if p.is_dir():
            dest.mkdir(parents=True, exist_ok=True)
        elif p.suffix.lower() in TEXT_EXT:
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_text(p.read_text().replace(TITLE_PLACEHOLDER, title))
        else:
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(p, dest)


# ---------- helpers ----------

def project_dir(name: str) -> Path:
    if not NAME_RE.match(name):
        raise HTTPException(400, "invalid project name")
    d = ROOT / name
    if not d.is_dir():
        raise HTTPException(404, "project not found")
    return d


def safe_path(proj: Path, rel: str) -> Path:
    p = (proj / rel).resolve()
    if not p.is_relative_to(proj.resolve()) or p == proj.resolve():
        raise HTTPException(400, "invalid path")
    return p


def list_files(proj: Path) -> list[dict]:
    out = []
    for p in sorted(proj.rglob("*")):
        rel = p.relative_to(proj)
        if any(part.startswith(".") for part in rel.parts):
            continue
        if p.is_dir():
            out.append({"path": rel.as_posix() + "/", "dir": True})
        elif p.is_file():
            out.append({"path": rel.as_posix(), "size": p.stat().st_size, "text": p.suffix.lower() in TEXT_EXT})
    return out


def diagnostics(proj: Path) -> str:
    """Run the typst CLI only on failure, to get line/column diagnostics."""
    if not shutil.which("typst"):
        return ""
    with tempfile.TemporaryDirectory() as td:
        r = subprocess.run(
            ["typst", "compile", "--root", ".", "--diagnostic-format", "short",
             MAIN, os.path.join(td, "o.pdf")],
            cwd=proj, capture_output=True, text=True, timeout=30)
    return r.stderr.strip()


class Session:
    """One compiler per websocket connection; compiles are debounced and coalesced."""

    def __init__(self, ws: WebSocket, proj: Path):
        self.ws, self.proj = ws, proj
        self.compiler = typst.Compiler(str(proj / MAIN), root=str(proj))
        self.dirty = asyncio.Event()
        self.seq = 0

    async def run(self):
        while True:
            await self.dirty.wait()
            await asyncio.sleep(COMPILE_DEBOUNCE)  # coalesce fast keystrokes
            self.dirty.clear()
            seq = self.seq
            msg = await asyncio.to_thread(self.compile)
            msg["seq"] = seq
            await self.ws.send_json(msg)

    def compile(self) -> dict:
        try:
            out = self.compiler.compile(format="svg")
        except typst.TypstError as e:
            diag = diagnostics(self.proj) or str(e)
            return {"type": "error", "message": diag}
        except Exception as e:  # noqa: BLE001
            return {"type": "error", "message": f"{type(e).__name__}: {e}"}
        pages = out if isinstance(out, list) else [out]
        return {"type": "pages", "pages": [base64.b64encode(p).decode() for p in pages]}


# ---------- REST ----------

class NewProject(BaseModel):
    name: str


@app.get("/api/projects")
def projects():
    items = []
    for d in ROOT.iterdir():
        if d.is_dir() and not d.name.startswith("."):
            m = d / MAIN
            items.append({"name": d.name, "mtime": (m if m.exists() else d).stat().st_mtime})
    return sorted(items, key=lambda x: -x["mtime"])


@app.post("/api/projects", status_code=201)
def create_project(body: NewProject):
    name = body.name.strip()
    if not NAME_RE.match(name):
        raise HTTPException(400, "name may contain letters, digits, space, . _ -")
    d = ROOT / name
    if d.exists():
        raise HTTPException(409, "project exists")
    d.mkdir()
    scaffold(d, name)
    return {"name": name}


@app.delete("/api/projects/{name}", status_code=204)
def delete_project(name: str):
    shutil.rmtree(project_dir(name))
    return Response(status_code=204)


@app.post("/api/projects/{name}/rename")
def rename_project(name: str, body: NewProject):
    new = body.name.strip()
    if not NAME_RE.match(new):
        raise HTTPException(400, "invalid name")
    if (ROOT / new).exists():
        raise HTTPException(409, "project exists")
    project_dir(name).rename(ROOT / new)
    return {"name": new}


@app.get("/api/projects/{name}/files")
def files(name: str):
    return list_files(project_dir(name))


@app.get("/api/projects/{name}/file")
def read_file(name: str, path: str):
    p = safe_path(project_dir(name), path)
    if not p.is_file():
        raise HTTPException(404, "file not found")
    if p.suffix.lower() in TEXT_EXT:
        return {"path": path, "content": p.read_text(errors="replace"), "text": True}
    return FileResponse(p)


@app.delete("/api/projects/{name}/file", status_code=204)
def delete_file(name: str, path: str):
    p = safe_path(project_dir(name), path)
    if p.name == MAIN and p.parent == project_dir(name):
        raise HTTPException(400, "cannot delete main.typ")
    if p.is_dir():
        shutil.rmtree(p)
    elif p.is_file():
        p.unlink()
    return Response(status_code=204)


@app.post("/api/projects/{name}/upload")
async def upload(name: str, files: list[UploadFile], dir: str = ""):
    proj = project_dir(name)
    saved = []
    for f in files:
        rel = (Path(dir) / Path(f.filename or "file").name).as_posix()
        p = safe_path(proj, rel)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(await f.read())
        saved.append(rel)
    return {"saved": saved}


@app.post("/api/projects/{name}/newfile")
def new_file(name: str, body: dict):
    proj = project_dir(name)
    p = safe_path(proj, body.get("path", ""))
    if p.exists():
        raise HTTPException(409, "exists")
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text("")
    return {"path": p.relative_to(proj).as_posix()}


@app.get("/api/projects/{name}/pdf")
def pdf(name: str, download: bool = False):
    proj = project_dir(name)
    try:
        data = typst.compile(str(proj / MAIN), root=str(proj), format="pdf")
    except typst.TypstError as e:
        raise HTTPException(422, diagnostics(proj) or str(e))
    disp = "attachment" if download else "inline"
    return Response(data, media_type="application/pdf",
                    headers={"Content-Disposition": f'{disp}; filename="{name}.pdf"'})


@app.get("/api/projects/{name}/location")
def location(name: str, path: str = ""):
    """Absolute path of the project (or of a file in it)."""
    proj = project_dir(name)
    p = safe_path(proj, path) if path else proj
    return {"path": str(p), "dir": str(p if p.is_dir() else p.parent)}


@app.post("/api/projects/{name}/reveal")
def reveal(name: str, path: str = ""):
    """Open the project folder (or the folder containing `path`) in the file manager on the server machine."""
    proj = project_dir(name)
    p = safe_path(proj, path) if path else proj
    folder = p if p.is_dir() else p.parent
    opener = next((o for o in ("xdg-open", "open", "explorer") if shutil.which(o)), None)
    if not opener:
        raise HTTPException(501, "no file manager opener found on the server")
    subprocess.Popen([opener, str(folder)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
    return {"opened": str(folder)}


# ---------- websocket ----------

@app.websocket("/ws/{name}")
async def ws(ws: WebSocket, name: str):
    await ws.accept()
    try:
        proj = project_dir(name)
    except HTTPException as e:
        await ws.send_json({"type": "error", "message": e.detail})
        await ws.close()
        return
    s = Session(ws, proj)
    task = asyncio.create_task(s.run())
    s.dirty.set()  # initial render
    try:
        while True:
            m = await ws.receive_json()
            if m.get("type") == "edit":
                p = safe_path(proj, m["path"])
                await asyncio.to_thread(p.write_text, m["content"])
                s.seq = m.get("seq", s.seq + 1)
                s.dirty.set()
            elif m.get("type") == "compile":
                s.dirty.set()
    except WebSocketDisconnect:
        pass
    finally:
        task.cancel()


app.mount("/", StaticFiles(directory=STATIC, html=True), name="static")
