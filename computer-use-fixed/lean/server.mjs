// XMD-Lean server — Node built-in http, hakuna dependency (E2B hiari).
// Kazi: kuendesha injini (lean/xmd_lean.py), kusoma mistari "@@XMD {json}",
// kuzituma LIVE kwa SSE, na kuzihifadhi (refresh haipotezi kitu).
//
//   node lean/server.mjs            (PORT=8787 kwa default)
//
// API:
//   GET  /api/config                     -> model, mode, skills
//   GET  /api/threads                    -> orodha ya mazungumzo
//   GET  /api/threads/:tid               -> {events, active}
//   GET  /api/threads/:tid/stream        -> SSE (replay + live; Last-Event-ID)
//   POST /api/run {threadId?, task}      -> {threadId, runId}
//   POST /api/threads/:tid/stop          -> simamisha run inayoendelea
//   GET  /ws/:tid/<path>                 -> faili za workspace (preview ya site)
//   *                                    -> copilotkit/dist (SPA)

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const DIST = path.join(ROOT, "copilotkit", "dist");
const DATA = process.env.XMD_DATA_DIR || path.join(HERE, ".runs");
const PORT = Number(process.env.PORT || 8787);
const MODE = process.env.XMD_MODE === "e2b" && process.env.E2B_API_KEY ? "e2b" : "local";
const MODEL = process.env.XMD_MODEL || process.env.LLM_MODEL_LEAN || "qwen/qwen3.8-max:free";
const API_KEY = process.env.XMD_API_KEY || process.env.LLM_API_KEY || "";
const PY = process.env.XMD_PYTHON || "python3";

fs.mkdirSync(path.join(DATA, "threads"), { recursive: true });

// ---------------------------------------------------------------- threads
/** @type {Map<string, {events: any[], clients: Set<http.ServerResponse>, active: null | {runId: string, kill: () => void}}>} */
const threads = new Map();

const tdir = (tid) => path.join(DATA, "threads", tid);
const safeId = (s) => typeof s === "string" && /^[a-zA-Z0-9_-]{4,64}$/.test(s);

function loadThread(tid) {
  let t = threads.get(tid);
  if (t) return t;
  const events = [];
  const f = path.join(tdir(tid), "events.jsonl");
  if (fs.existsSync(f)) {
    for (const line of fs.readFileSync(f, "utf8").split("\n")) {
      if (!line.trim()) continue;
      try { events.push(JSON.parse(line)); } catch { /* mstari mbovu — ruka */ }
    }
    // run iliyokatizwa na server restart -> ifunge kwa uwazi
    const last = [...events].reverse().find((e) => e.type === "run_start" || e.type === "run_end");
    if (last && last.type === "run_start") {
      const e = { type: "run_end", status: "interrupted", runId: last.runId, i: events.length, ts: Date.now() };
      events.push(e);
      fs.appendFileSync(f, JSON.stringify(e) + "\n");
    }
  }
  t = { events, clients: new Set(), active: null };
  threads.set(tid, t);
  return t;
}

function push(tid, ev) {
  const t = loadThread(tid);
  ev.i = t.events.length;
  ev.ts = ev.ts || Date.now();
  t.events.push(ev);
  fs.mkdirSync(tdir(tid), { recursive: true });
  fs.appendFileSync(path.join(tdir(tid), "events.jsonl"), JSON.stringify(ev) + "\n");
  const frame = `id: ${ev.i}\ndata: ${JSON.stringify(ev)}\n\n`;
  for (const c of t.clients) c.write(frame);
}

function listThreads() {
  const out = [];
  for (const tid of fs.readdirSync(path.join(DATA, "threads"))) {
    const f = path.join(tdir(tid), "events.jsonl");
    if (!fs.existsSync(f)) continue;
    const t = loadThread(tid);
    const first = t.events.find((e) => e.type === "user");
    const last = t.events[t.events.length - 1];
    out.push({ id: tid, title: first ? String(first.text).slice(0, 80) : tid, updated: last?.ts || 0, active: !!t.active });
  }
  return out.sort((a, b) => b.updated - a.updated);
}

// ---------------------------------------------------------------- engine (local)
function engineEnv() {
  const env = { ...process.env, PYTHONUNBUFFERED: "1", XMD_MODEL: MODEL, XMD_API_KEY: API_KEY };
  return env;
}

function attachLines(stream, onLine) {
  let buf = "";
  stream.setEncoding("utf8");
  stream.on("data", (d) => {
    buf += d;
    let k;
    while ((k = buf.indexOf("\n")) >= 0) {
      onLine(buf.slice(0, k));
      buf = buf.slice(k + 1);
    }
  });
  stream.on("end", () => { if (buf) onLine(buf); });
}

function makeLineHandler(tid, runId, st) {
  return (line) => {
    if (line.startsWith("@@XMD ")) {
      let ev;
      try { ev = JSON.parse(line.slice(6)); } catch { return; }
      ev.runId = runId;
      if (ev.type === "run_end") st.ended = true;
      push(tid, ev);
    } else if (line.trim()) {
      st.stderr.push(line);
      if (st.stderr.length > 40) st.stderr.shift();
    }
  };
}

function finishRun(tid, runId, st, code) {
  const t = loadThread(tid);
  if (!st.ended) {
    if (st.stopped) {
      push(tid, { type: "run_end", runId, status: "stopped" });
    } else {
      push(tid, { type: "error", runId, message: `Injini imesimama ghafla (code ${code}). ${st.stderr.slice(-4).join(" | ").slice(0, 400)}` });
      push(tid, { type: "run_end", runId, status: "error" });
    }
  }
  if (t.active?.runId === runId) t.active = null;
}

function startLocal(tid, runId, task) {
  const ws = path.join(tdir(tid), "ws");
  fs.mkdirSync(ws, { recursive: true });
  const st = { ended: false, stopped: false, stderr: [] };
  const child = spawn(PY, [path.join(HERE, "xmd_lean.py"), "--task", task,
    "--state", path.join(tdir(tid), "state.json"), "--workspace", ws, "--run-id", runId],
  { env: engineEnv(), cwd: ws, detached: true, stdio: ["ignore", "pipe", "pipe"] });
  const onLine = makeLineHandler(tid, runId, st);
  attachLines(child.stdout, onLine);
  attachLines(child.stderr, (l) => { if (l.trim()) { st.stderr.push(l); if (st.stderr.length > 40) st.stderr.shift(); } });
  child.on("close", (code) => finishRun(tid, runId, st, code));
  child.on("error", (err) => { st.stderr.push(String(err)); });
  return () => {
    st.stopped = true;
    try { process.kill(-child.pid, "SIGTERM"); } catch { /* tayari imekufa */ }
    setTimeout(() => { try { process.kill(-child.pid, "SIGKILL"); } catch { /* */ } }, 2500);
  };
}

// ---------------------------------------------------------------- engine (E2B) — HAIJAJARIBIWA (hakuna key)
// Injini nzima inapakiwa ndani ya sandbox; events zile zile zinarudi kupitia onStdout.
const sandboxes = new Map();
async function startE2B(tid, runId, task) {
  const { Sandbox } = await import("@e2b/code-interpreter");
  let sbx = sandboxes.get(tid);
  if (!sbx) {
    const idFile = path.join(tdir(tid), "sandbox.id");
    if (fs.existsSync(idFile)) {
      try { sbx = await Sandbox.connect(fs.readFileSync(idFile, "utf8").trim()); } catch { sbx = null; }
    }
    if (!sbx) {
      sbx = await Sandbox.create({ timeoutMs: 60 * 60 * 1000 });
      fs.mkdirSync(tdir(tid), { recursive: true });
      fs.writeFileSync(idFile, sbx.sandboxId);
    }
    const files = [["lean/xmd_lean.py", path.join(HERE, "xmd_lean.py")]];
    for (const d of ["bin", "skills"]) {
      const walk = (rel) => {
        for (const n of fs.readdirSync(path.join(HERE, rel))) {
          const r = path.join(rel, n);
          if (fs.statSync(path.join(HERE, r)).isDirectory()) walk(r);
          else files.push([`lean/${r}`, path.join(HERE, r)]);
        }
      };
      walk(d);
    }
    for (const [dest, src] of files) await sbx.files.write(`/home/user/${dest}`, fs.readFileSync(src, "utf8"));
    await sbx.commands.run("chmod +x /home/user/lean/bin/* && mkdir -p /home/user/ws /home/user/.xmd");
    sandboxes.set(tid, sbx);
  }
  const st = { ended: false, stopped: false, stderr: [] };
  const onLine = makeLineHandler(tid, runId, st);
  let buf = "";
  const envs = { XMD_API_KEY: API_KEY, XMD_MODEL: MODEL, PYTHONUNBUFFERED: "1" };
  for (const k of ["XMD_BASE_URL", "XMD_PROTOCOL", "XMD_EFFORT", "GITHUB_TOKEN", "NETLIFY_AUTH_TOKEN", "VERCEL_TOKEN", "SEARXNG_URL"]) {
    if (process.env[k]) envs[k] = process.env[k];
  }
  const q = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;
  const handle = await sbx.commands.run(
    `python3 /home/user/lean/xmd_lean.py --task ${q(task)} --state /home/user/.xmd/state.json --workspace /home/user/ws --run-id ${runId}`,
    {
      background: true, envs, timeoutMs: 0,
      onStdout: (d) => { buf += d; let k; while ((k = buf.indexOf("\n")) >= 0) { onLine(buf.slice(0, k)); buf = buf.slice(k + 1); } },
      onStderr: (d) => { st.stderr.push(String(d).slice(0, 300)); },
    });
  handle.wait().then(() => finishRun(tid, runId, st, 0)).catch((e) => finishRun(tid, runId, st, e?.exitCode ?? 1));
  return () => { st.stopped = true; handle.kill().catch(() => {}); };
}

async function startRun(tid, task) {
  const t = loadThread(tid);
  if (t.active) throw Object.assign(new Error("Kazi nyingine bado inaendelea kwenye mazungumzo haya"), { status: 409 });
  const runId = "r" + Date.now().toString(36);
  t.active = { runId, kill: () => {} };
  push(tid, { type: "user", runId, text: task });
  try {
    t.active.kill = MODE === "e2b" ? await startE2B(tid, runId, task) : startLocal(tid, runId, task);
  } catch (e) {
    push(tid, { type: "error", runId, message: "Imeshindwa kuanzisha injini: " + (e?.message || e) });
    push(tid, { type: "run_end", runId, status: "error" });
    t.active = null;
  }
  return runId;
}

// ---------------------------------------------------------------- http
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".gif": "image/gif", ".webp": "image/webp", ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8", ".woff2": "font/woff2", ".map": "application/json",
};

function json(res, code, obj) {
  res.writeHead(code, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let b = "";
    req.on("data", (d) => { b += d; if (b.length > 1e6) { reject(new Error("body too large")); req.destroy(); } });
    req.on("end", () => { try { resolve(b ? JSON.parse(b) : {}); } catch (e) { reject(e); } });
  });
}

function serveFile(res, file, fallback) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      if (fallback) return serveFile(res, fallback, null);
      res.writeHead(404, { "Content-Type": "text/plain" });
      return res.end("not found");
    }
    const ext = path.extname(file).toLowerCase();
    const immutable = file.includes(`${path.sep}assets${path.sep}`);
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": immutable ? "public, max-age=31536000, immutable" : "no-cache",
    });
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", "http://x");
  const p = decodeURIComponent(url.pathname);
  try {
    if (p === "/api/config" && req.method === "GET") {
      const skills = fs.readdirSync(path.join(HERE, "skills")).filter((n) => fs.existsSync(path.join(HERE, "skills", n, "SKILL.md")))
        .map((n) => {
          const txt = fs.readFileSync(path.join(HERE, "skills", n, "SKILL.md"), "utf8");
          return { name: n, description: (txt.match(/^description:\s*(.*)$/m) || [])[1] || "" };
        });
      return json(res, 200, { model: MODEL, mode: MODE, hasKey: !!API_KEY, skills });
    }
    if (p === "/api/threads" && req.method === "GET") return json(res, 200, listThreads());

    if (p === "/api/run" && req.method === "POST") {
      const body = await readBody(req);
      const task = String(body.task || "").trim();
      if (!task) return json(res, 400, { error: "task tupu" });
      if (!API_KEY && MODE === "local") return json(res, 500, { error: "XMD_API_KEY haijawekwa kwenye server" });
      const tid = safeId(body.threadId) ? body.threadId : "t" + randomUUID().replace(/-/g, "").slice(0, 12);
      try {
        const runId = await startRun(tid, task);
        return json(res, 200, { threadId: tid, runId });
      } catch (e) {
        return json(res, e.status || 500, { error: e.message });
      }
    }

    let m = p.match(/^\/api\/threads\/([a-zA-Z0-9_-]+)(\/stream|\/stop)?$/);
    if (m && safeId(m[1])) {
      const tid = m[1];
      const t = loadThread(tid);
      if (!m[2] && req.method === "GET") return json(res, 200, { events: t.events, active: t.active?.runId || null });
      if (m[2] === "/stop" && req.method === "POST") {
        if (t.active) { t.active.kill(); return json(res, 200, { ok: true }); }
        return json(res, 200, { ok: false, message: "hakuna kazi inayoendelea" });
      }
      if (m[2] === "/stream" && req.method === "GET") {
        res.writeHead(200, {
          "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive", "X-Accel-Buffering": "no",
        });
        res.write("retry: 1500\n\n");
        const from = Number(req.headers["last-event-id"] ?? url.searchParams.get("from") ?? -1) + 1;
        for (let i = Math.max(0, from); i < t.events.length; i++) res.write(`id: ${i}\ndata: ${JSON.stringify(t.events[i])}\n\n`);
        t.clients.add(res);
        const hb = setInterval(() => res.write(": hb\n\n"), 15000);
        req.on("close", () => { clearInterval(hb); t.clients.delete(res); });
        return;
      }
    }

    m = p.match(/^\/ws\/([a-zA-Z0-9_-]+)(\/.*)?$/);
    if (m && safeId(m[1]) && req.method === "GET") {
      const base = path.join(tdir(m[1]), "ws");
      let rel = m[2] || "/";
      if (rel.endsWith("/")) rel += "index.html";
      const file = path.resolve(base, "." + rel);
      if (!file.startsWith(base + path.sep)) { res.writeHead(403); return res.end("forbidden"); }
      return serveFile(res, file, null);
    }

    if (req.method === "GET") {
      const file = path.resolve(DIST, "." + (p === "/" ? "/index.html" : p));
      if (!file.startsWith(DIST)) { res.writeHead(403); return res.end(); }
      return serveFile(res, file, path.join(DIST, "index.html"));
    }
    res.writeHead(405); res.end();
  } catch (e) {
    json(res, 500, { error: String(e?.message || e) });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`XMD-Lean server http://0.0.0.0:${PORT}  mode=${MODE}  model=${MODEL}  key=${API_KEY ? "yes" : "NO"}`);
});
