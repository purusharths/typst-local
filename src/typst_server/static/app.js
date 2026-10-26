import { EditorView, basicSetup, EditorState, Compartment, keymap, indentWithTab,
  StreamLanguage, HighlightStyle, syntaxHighlighting, tags as t, oneDark } from "./vendor/codemirror.js";

// ---------- Typst stream tokenizer (markup / code / math, approximate) ----------
const typstLang = StreamLanguage.define({
  startState: () => ({ mode: "markup", depth: 0, math: false }),
  token(stream, st) {
    if (stream.match(/\/\/.*/)) return "comment";
    if (stream.match("/*")) { st.block = true; }
    if (st.block) { if (stream.match(/.*?\*\//)) st.block = false; else stream.skipToEnd(); return "comment"; }

    if (st.math) {
      if (stream.match("$")) { st.math = false; return "string"; }
      if (stream.match(/[a-zA-Z][a-zA-Z.]*(?=\()/)) return "variableName";
      if (stream.match(/\d+(\.\d+)?/)) return "number";
      if (stream.match(/[\^_]/)) return "operator";
      stream.next(); return "string";
    }
    if (st.mode === "markup") {
      if (stream.sol() && stream.match(/=+\s/)) { stream.skipToEnd(); return "heading"; }
      if (stream.sol() && stream.match(/\s*[-+]\s/)) return "keyword";
      if (stream.match("$")) { st.math = true; return "string"; }
      if (stream.match(/#(let|set|show|import|include|if|else|for|while|return|break|continue)\b/)) { st.mode = "code"; return "keyword"; }
      if (stream.match(/#[a-zA-Z_][\w-]*(\.[a-zA-Z_][\w-]*)*/)) { if (stream.peek() === "(" || stream.peek() === "[") st.mode = "code"; return "variableName"; }
      if (stream.match(/\*[^*\n]+\*/)) return "strong";
      if (stream.match(/_[^_\n]+_/)) return "emphasis";
      if (stream.match(/`[^`\n]*`/)) return "monospace";
      if (stream.match(/@[\w:.-]+/)) return "labelName";
      if (stream.match(/<[\w:.-]+>/)) return "labelName";
      if (stream.match(/\\./)) return "escape";
      stream.next(); return null;
    }
    // code mode
    if (stream.match(/"(?:[^"\\]|\\.)*"/)) return "string";
    if (stream.match(/\b(let|set|show|import|include|if|else|for|in|while|return|break|continue|and|or|not|none|auto|true|false)\b/)) return "keyword";
    if (stream.match(/\d+(\.\d+)?(pt|mm|cm|in|em|fr|%|deg|rad)?/)) return "number";
    if (stream.match(/[a-zA-Z_][\w-]*(?=\s*\()/)) return "variableName";
    if (stream.match(/[a-zA-Z_][\w-]*(?=\s*:)/)) return "propertyName";
    if (stream.match(/[a-zA-Z_][\w-]*/)) return "variableName";
    if (stream.match(/[()]/)) { st.depth += stream.current() === "(" ? 1 : -1; if (st.depth <= 0 && stream.peek() !== "." && stream.peek() !== "[" && stream.peek() !== "(") { st.depth = 0; st.mode = "markup"; } return "bracket"; }
    if (stream.match("[")) { st.mode = "markup"; st.depth = 0; return "bracket"; }
    if (stream.match(/[{}\]]/)) return "bracket";
    if (stream.match(/[=+\-*\/<>!.,:;]/)) return "operator";
    if (stream.eatSpace()) { if (st.depth <= 0 && stream.eol()) st.mode = "markup"; return null; }
    stream.next(); return null;
  },
});
const typstHighlight = HighlightStyle.define([
  { tag: t.heading, color: "#7fd3ff", fontWeight: "bold" },
  { tag: t.strong, fontWeight: "bold" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.monospace, color: "#c3e88d" },
  { tag: t.labelName, color: "#ffcb6b" },
  { tag: t.escape, color: "#89ddff" },
]);

// ---------- state ----------
const $ = (s) => document.querySelector(s);
const state = { project: null, file: null, files: [], ws: null, seq: 0, zoom: 1, fit: true };
const themeComp = new Compartment();
const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
                set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };

// ---------- theme ----------
const lightHighlight = HighlightStyle.define([
  { tag: t.heading, color: "#0b6e8a", fontWeight: "bold" },
  { tag: t.keyword, color: "#a626a4" },
  { tag: t.variableName, color: "#4078f2" },
  { tag: t.propertyName, color: "#986801" },
  { tag: t.string, color: "#50a14f" },
  { tag: t.number, color: "#986801" },
  { tag: t.comment, color: "#a0a1a7", fontStyle: "italic" },
  { tag: t.operator, color: "#383a42" },
  { tag: t.bracket, color: "#383a42" },
  { tag: t.strong, fontWeight: "bold" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.monospace, color: "#986801" },
  { tag: t.labelName, color: "#e45649" },
  { tag: t.escape, color: "#0184bc" },
]);
const lightTheme = EditorView.theme({
  "&": { backgroundColor: "#ffffff", color: "#1f2328" },
  ".cm-gutters": { backgroundColor: "#f4f5f7", color: "#9aa0a6", borderRight: "1px solid #e3e5ea" },
  // Translucent so the selection layer (drawn beneath the text) stays visible on the active line.
  ".cm-activeLine": { backgroundColor: "rgba(0, 0, 0, 0.035)" },
  ".cm-activeLineGutter": { backgroundColor: "#eceff3" },
  "&.cm-focused .cm-cursor": { borderLeftColor: "#1f2328" },
  ".cm-selectionBackground": { backgroundColor: "#d6e4f7 !important" },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground": { backgroundColor: "#b4d2f7 !important" },
  ".cm-selectionMatch": { backgroundColor: "rgba(255, 213, 79, 0.45)" },
});
// Overrides on top of oneDark: translucent active line and a clearly visible selection.
const darkFixes = EditorView.theme({
  ".cm-activeLine": { backgroundColor: "rgba(255, 255, 255, 0.045)" },
  ".cm-selectionBackground": { backgroundColor: "#3a4a6b !important" },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground": { backgroundColor: "#4a6394 !important" },
}, { dark: true });
const darkHighlight = HighlightStyle.define([
  { tag: t.heading, color: "#7fd3ff", fontWeight: "bold" },
  { tag: t.strong, fontWeight: "bold" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.monospace, color: "#c3e88d" },
  { tag: t.labelName, color: "#ffcb6b" },
  { tag: t.escape, color: "#89ddff" },
]);
const themeExt = (th) => th === "dark" ? [oneDark, darkFixes, syntaxHighlighting(darkHighlight)] : [lightTheme, syntaxHighlighting(lightHighlight)];
function currentTheme() { return document.documentElement.dataset.theme === "dark" ? "dark" : "light"; }
function setTheme(th) {
  document.documentElement.dataset.theme = th; store.set("theme", th);
  view.dispatch({ effects: themeComp.reconfigure(themeExt(th)) });
}
document.querySelectorAll(".theme-toggle").forEach((b) => b.onclick = () => setTheme(currentTheme() === "dark" ? "light" : "dark"));

// ---------- editor ----------
const view = new EditorView({
  parent: $("#editor"),
  state: EditorState.create({
    doc: "",
    extensions: [
      basicSetup, typstLang,
      themeComp.of(themeExt(currentTheme())),
      keymap.of([indentWithTab, { key: "Mod-s", run: () => { sendEdit(); return true; } }]),
      EditorView.lineWrapping,
      EditorView.updateListener.of((u) => { if (u.docChanged) onChange(); }),
    ],
  }),
});

function setStatus(msg, cls = "") { const s = $("#status"); s.textContent = msg; s.className = "status " + cls; }

async function api(path, opts = {}) {
  const r = await fetch("/api" + path, { headers: { "Content-Type": "application/json" }, ...opts });
  if (!r.ok) throw new Error((await r.text()) || r.statusText);
  return r.status === 204 ? null : r.json();
}
const enc = encodeURIComponent;
const fileUrl = (p) => `/api/projects/${enc(state.project)}/file?path=${enc(p)}`;

// ---------- routing ----------
function route() {
  const name = decodeURIComponent(location.hash.slice(1));
  if (name) showEditor(name); else showHome();
}
window.addEventListener("hashchange", route);

function showHome() {
  if (state.ws) { state.ws.onclose = null; state.ws.close(); state.ws = null; }
  state.project = null; state.file = null;
  document.title = "Typst";
  $("#app").hidden = true; $("#home").hidden = false;
  loadHome();
}

function relTime(ts) {
  const d = (Date.now() / 1000 - ts), m = d / 60, h = m / 60, day = h / 24;
  if (m < 1) return "just now"; if (m < 60) return `${Math.floor(m)} min ago`;
  if (h < 24) return `${Math.floor(h)} h ago`; if (day < 7) return `${Math.floor(day)} d ago`;
  return new Date(ts * 1000).toLocaleDateString();
}

async function loadHome() {
  const list = await api("/projects");
  const cards = $("#cards"); cards.innerHTML = "";
  $("#home-empty").hidden = list.length > 0;
  for (const p of list) {
    const c = document.createElement("div"); c.className = "card";
    c.innerHTML = `<div class="title"></div><div class="meta"></div><button class="x" title="Delete project">✕</button><button class="folder" title="Open folder in file manager">📁</button>`;
    c.querySelector(".folder").onclick = (e) => { e.stopPropagation(); reveal(p.name); };
    c.querySelector(".title").textContent = p.name;
    c.querySelector(".meta").textContent = "edited " + relTime(p.mtime);
    c.onclick = () => { location.hash = enc(p.name); };
    c.querySelector(".x").onclick = async (e) => {
      e.stopPropagation();
      if (!confirm(`Delete project "${p.name}" and all its files?`)) return;
      await api(`/projects/${enc(p.name)}`, { method: "DELETE" }); loadHome();
    };
    cards.appendChild(c);
  }
}

async function newProject() {
  const name = prompt("Project name:"); if (!name) return;
  try { const p = await api("/projects", { method: "POST", body: JSON.stringify({ name }) }); location.hash = enc(p.name); }
  catch (e) { alert(e.message); }
}
$("#home-new").onclick = newProject;

// ---------- editor view ----------
async function showEditor(name) {
  if (state.project === name) return;
  if (state.ws) { state.ws.onclose = null; state.ws.close(); state.ws = null; }
  try { await api(`/projects/${enc(name)}/files`); } catch { location.hash = ""; return; }
  state.project = name; state.file = null;
  document.title = `${name} · Typst`;
  $("#home").hidden = true; $("#app").hidden = false;
  $("#proj-name").textContent = name;
  $("#pdf").href = `/api/projects/${enc(name)}/pdf`;
  $("#pdf-dl").href = `/api/projects/${enc(name)}/pdf?download=1`;
  $("#pdf-dl").setAttribute("download", `${name}.pdf`);
  api(`/projects/${enc(name)}/location`).then((l) => { $("#proj-path").textContent = l.path; }).catch(() => {});
  await loadFiles();
  await openFile("main.typ");
  connect();
}

async function loadFiles() {
  state.files = await api(`/projects/${enc(state.project)}/files`);
  const ul = $("#files"); ul.innerHTML = "";
  // Build a tree from the flat listing (folders are "a/b/", files "a/b/c.typ").
  const root = { dirs: new Map(), files: [] };
  const dirNode = (parts) => {
    let n = root;
    for (const part of parts) { if (!n.dirs.has(part)) n.dirs.set(part, { dirs: new Map(), files: [] }); n = n.dirs.get(part); }
    return n;
  };
  for (const f of state.files) {
    const parts = f.path.split("/").filter(Boolean);
    if (f.dir) dirNode(parts); else dirNode(parts.slice(0, -1)).files.push(f);
  }
  const collapsedKey = (path) => `collapsed:${state.project}/${path}`;
  const addDir = (name, node, path, depth) => {
    const li = document.createElement("li");
    const collapsed = store.get(collapsedKey(path)) === "1";
    li.className = "dir" + (collapsed ? " collapsed" : "");
    li.style.paddingLeft = 8 + depth * 14 + "px";
    li.innerHTML = `<span class="arrow"></span><span class="name"></span><span class="go" title="Show in file manager">📁</span>`;
    li.querySelector(".name").textContent = name;
    li.title = "Drop files here to upload into " + path;
    li.onclick = () => { store.set(collapsedKey(path), li.classList.contains("collapsed") ? "0" : "1"); loadFiles(); };
    li.querySelector(".go").onclick = (e) => { e.stopPropagation(); reveal(state.project, path); };
    li.ondragover = (e) => { e.preventDefault(); e.stopPropagation(); li.classList.add("drop"); };
    li.ondragleave = () => li.classList.remove("drop");
    li.ondrop = (e) => { e.preventDefault(); e.stopPropagation(); li.classList.remove("drop"); uploadFiles(e.dataTransfer.files, path); };
    ul.appendChild(li);
    if (!collapsed) addChildren(node, path, depth + 1);
  };
  const addFile = (f, depth) => {
    const li = document.createElement("li");
    li.className = (f.path === state.file ? "active " : "") + (f.text ? "" : "bin");
    li.style.paddingLeft = 8 + depth * 14 + "px";
    li.innerHTML = `<span class="name"></span><span class="go" title="Show in file manager">📁</span><span class="x" title="Delete">✕</span>`;
    li.querySelector(".name").textContent = f.path.split("/").pop();
    li.dataset.path = f.path;
    li.title = `${f.path} (${f.size} B)`;
    li.onclick = () => f.text ? openFile(f.path) : window.open(fileUrl(f.path));
    li.querySelector(".go").onclick = (e) => { e.stopPropagation(); reveal(state.project, f.path); };
    const x = li.querySelector(".x");
    if (f.path === "main.typ") x.remove();
    else x.onclick = async (e) => {
      e.stopPropagation();
      if (!confirm(`Delete ${f.path}?`)) return;
      await api(`/projects/${enc(state.project)}/file?path=${enc(f.path)}`, { method: "DELETE" });
      if (state.file === f.path) await openFile("main.typ");
      await loadFiles(); requestCompile();
    };
    ul.appendChild(li);
  };
  const addChildren = (node, path, depth) => {
    for (const [name, child] of [...node.dirs].sort((a, b) => a[0].localeCompare(b[0]))) addDir(name, child, path + name + "/", depth);
    for (const f of node.files) addFile(f, depth);
  };
  addChildren(root, "", 0);
}

let loading = false;
async function openFile(path) {
  const r = await api(fileUrl(path).slice(4));
  state.file = path;
  $("#cur-file").textContent = path;
  loading = true;
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: r.content } });
  loading = false;
  [...$("#files").children].forEach((li) => li.classList.toggle("active", li.dataset.path === path));
  applyPreviewVisibility();
  view.focus();
}

// ---------- reveal in file manager / copy path ----------
async function reveal(project, path = "") {
  try { await api(`/projects/${enc(project)}/reveal?path=${enc(path)}`, { method: "POST" }); }
  catch (e) { alert("Could not open folder: " + e.message); }
}
$("#reveal").onclick = () => reveal(state.project);
$("#proj-path").onclick = async () => {
  const el = $("#proj-path"), txt = el.textContent;
  try { await navigator.clipboard.writeText(txt); el.textContent = "copied!"; setTimeout(() => (el.textContent = txt), 900); } catch {}
};

// ---------- per-file preview (pdf) visibility ----------
const previewKey = () => `hidepdf:${state.project}/${state.file}`;
function applyPreviewVisibility() {
  const hidden = store.get(previewKey()) === "1";
  $("#app").classList.toggle("no-preview", hidden);
  const b = $("#toggle-preview"); b.textContent = hidden ? "show pdf" : "hide pdf"; b.classList.toggle("active", hidden);
  if (!hidden) applyZoom();
}
$("#toggle-preview").onclick = () => {
  store.set(previewKey(), store.get(previewKey()) === "1" ? "0" : "1");
  applyPreviewVisibility();
};

// ---------- websocket / compile ----------
function connect() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const ws = new WebSocket(`${proto}://${location.host}/ws/${enc(state.project)}`);
  state.ws = ws;
  ws.onopen = () => setStatus("connected", "ok");
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.type === "pages") render(m.pages); else if (m.type === "error") showError(m.message);
    if (m.seq != null && m.seq < state.seq) return;
    setStatus(m.type === "error" ? "error" : `${m.pages.length} page${m.pages.length === 1 ? "" : "s"}`, m.type === "error" ? "err" : "ok");
  };
  ws.onclose = () => { setStatus("disconnected, retrying…", "err"); setTimeout(() => state.project && state.ws === ws && connect(), 1500); };
}

let timer;
function onChange() {
  if (loading) return;
  setStatus("…");
  clearTimeout(timer); timer = setTimeout(sendEdit, 150);
}
function sendEdit() {
  clearTimeout(timer);
  if (!state.ws || state.ws.readyState !== 1 || !state.file) return;
  state.ws.send(JSON.stringify({ type: "edit", path: state.file, content: view.state.doc.toString(), seq: ++state.seq }));
}
function requestCompile() { state.ws?.readyState === 1 && state.ws.send(JSON.stringify({ type: "compile" })); }

// ---------- preview ----------
// Pages are double-buffered: a new <img> is decoded off-screen and only then swapped
// in place of the old one, so the preview never blanks or flickers while typing.
let renderSeq = 0;
async function render(pages) {
  const pv = $("#preview");
  const my = ++renderSeq;
  $("#errors").hidden = true;
  pv.querySelector("#placeholder")?.remove();
  const fresh = await Promise.all(pages.map(async (b64) => {
    const svg = atob(b64);
    const m = svg.match(/width="([\d.]+)pt"\s+height="([\d.]+)pt"/);
    const img = new Image();
    img.src = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    if (m) { img.dataset.w = m[1]; img.dataset.h = m[2]; }
    try { await img.decode(); } catch {}
    return img;
  }));
  if (my !== renderSeq) { fresh.forEach((i) => URL.revokeObjectURL(i.src)); return; } // superseded
  const old = [...pv.querySelectorAll("img")];
  const scroll = pv.scrollTop;
  sizeImages(fresh);
  fresh.forEach((img, i) => { if (old[i]) old[i].replaceWith(img); else pv.appendChild(img); });
  old.slice(fresh.length).forEach((o) => o.remove());
  old.forEach((o) => URL.revokeObjectURL(o.src));
  pv.scrollTop = scroll;
  $("#zoom-val").textContent = Math.round(state.zoom * 100) + "%";
}
function showError(msg) {
  const e = $("#errors"); e.hidden = false; e.textContent = msg;  // last good render stays visible
}
function sizeImages(imgs) {
  const pv = $("#preview");
  if (!imgs.length || !pv.clientWidth) return;
  const wPt = +imgs[0].dataset.w || 595, pxPerPt = 96 / 72;
  if (state.fit) state.zoom = (pv.clientWidth - 40) / (wPt * pxPerPt);
  imgs.forEach((img) => { img.style.width = (+img.dataset.w || wPt) * pxPerPt * state.zoom + "px"; img.style.height = (+img.dataset.h || 842) * pxPerPt * state.zoom + "px"; });
}
function applyZoom() {
  sizeImages([...$("#preview").querySelectorAll("img")]);
  $("#zoom-val").textContent = Math.round(state.zoom * 100) + "%";
}
$("#zoom-in").onclick = () => { state.fit = false; state.zoom = Math.min(4, state.zoom * 1.2); applyZoom(); };
$("#zoom-out").onclick = () => { state.fit = false; state.zoom = Math.max(0.2, state.zoom / 1.2); applyZoom(); };
$("#zoom-fit").onclick = () => { state.fit = true; applyZoom(); };
new ResizeObserver(() => state.fit && applyZoom()).observe($("#preview"));

// ---------- file actions ----------
$("#new-file").onclick = async () => {
  const path = prompt("File path (e.g. chapters/intro.typ):"); if (!path) return;
  try { const f = await api(`/projects/${enc(state.project)}/newfile`, { method: "POST", body: JSON.stringify({ path }) }); await loadFiles(); openFile(f.path); }
  catch (e) { alert(e.message); }
};
async function uploadFiles(fileList, dir = "") {
  if (!state.project || !fileList.length) return;
  const fd = new FormData(); for (const f of fileList) fd.append("files", f);
  await fetch(`/api/projects/${enc(state.project)}/upload?dir=${enc(dir)}`, { method: "POST", body: fd });
  await loadFiles(); requestCompile();
}
$("#upload-btn").onclick = () => $("#upload").click();
$("#upload").onchange = async (e) => { await uploadFiles(e.target.files); e.target.value = ""; };
const side = $("#sidebar");
side.ondragover = (e) => e.preventDefault();
side.ondrop = (e) => { e.preventDefault(); uploadFiles(e.dataTransfer.files); };

// ---------- resizable gutter ----------
const gutter = $("#gutter"), appEl = $("#app");
gutter.onmousedown = (e) => {
  e.preventDefault();
  const move = (ev) => {
    const sideW = 220, total = appEl.clientWidth - sideW - 6;
    const left = Math.min(Math.max(ev.clientX - sideW, 300), total - 300);
    appEl.style.gridTemplateColumns = `${sideW}px ${left}px 6px ${total - left}px`;
  };
  const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
  window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
};

// ---------- boot ----------
route();
