/**
 * JLC Bridge Gateway — Three-party WebSocket Router
 *
 * Connections:
 *   MCP Server  →  ws://127.0.0.1:18800/ws/bridge  (sends commands, receives results)
 *   EDA Plugin  →  ws://127.0.0.1:18800/ws/bridge  (sends hello+results, receives commands)
 *
 * Routing:
 *   command from MCP  →  forward to Plugin WS  →  Plugin executes  →  result back to MCP
 *
 * Fallback transports (when plugin WS not connected):
 *   HTTP REST  http://127.0.0.1:18800/api/*   (plugin polls via fetch)
 *   File I/O   /tmp/jlc-bridge/*.json          (last resort file polling)
 */

import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';

const PORT = 18800;
const BRIDGE_DIR = '/tmp/jlc-bridge';
const COMMAND_FILE = join(BRIDGE_DIR, 'command.json');
const RESULT_FILE  = join(BRIDGE_DIR, 'result.json');
const POLL_MS = 100;

mkdirSync(BRIDGE_DIR, { recursive: true });

/** The EDA plugin WebSocket connection (identified by hello message) */
let pluginWs = null;

/** HTTP fallback: current pending command for plugin to poll */
let pendingHttpCommand = null;
let httpPollCount = 0;

/** pending MCP requests: id → { ws, timer } */
const pending = new Map();

const httpServer = createServer();
const wss = new WebSocketServer({ server: httpServer, path: '/ws/bridge' });

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function dispatchResult(result) {
  const id = result.id ?? result.payload?.commandId;
  if (!id) return;

  const payload = {
    commandId: id,
    success: result.success ?? result.payload?.success ?? false,
    data: result.data ?? result.payload?.data ?? null,
    error: result.error ?? result.payload?.error ?? null,
    durationMs: result.durationMs ?? result.payload?.durationMs ?? 0,
  };

  // Resolve HTTP-run promise (POST /api/run path)
  const httpEntry = pendingHttp.get(id);
  if (httpEntry) {
    clearTimeout(httpEntry.timer);
    pendingHttp.delete(id);
    pendingHttpCommand = null;
    httpEntry.resolve(payload);
    log(`result dispatched → HTTP-run: ${payload.success ? 'ok' : 'fail'} id=${id}`);
    return;
  }

  // Reply to MCP WebSocket client
  const entry = pending.get(id);
  if (!entry) return;

  clearTimeout(entry.timer);
  pending.delete(id);
  pendingHttpCommand = null;

  const reply = { type: 'result', id, timestamp: Date.now(), payload };

  if (entry.ws && entry.ws.readyState === WebSocket.OPEN) {
    entry.ws.send(JSON.stringify(reply));
    log(`result dispatched → MCP: ${payload.success ? 'ok' : 'fail'} id=${id}`);
  }
}

/** pending HTTP-run requests: id → { resolve, timer } */
const pendingHttp = new Map();

function sendCommand(id, action, params, mcpWs) {
  const cmd = { type: 'command', id, action, params, timestamp: Date.now() };

  const timer = setTimeout(() => {
    pending.delete(id);
    pendingHttpCommand = null;
    if (mcpWs && mcpWs.readyState === WebSocket.OPEN) {
      mcpWs.send(JSON.stringify({
        type: 'result', id, timestamp: Date.now(),
        payload: { commandId: id, success: false, data: null,
                   error: 'EDA plugin timeout (30s) — is bridge enabled?', durationMs: 30000 }
      }));
    }
    log(`timeout: id=${id} action=${action}`);
  }, 30_000);

  pending.set(id, { ws: mcpWs, timer });

  if (pluginWs && pluginWs.readyState === WebSocket.OPEN) {
    pluginWs.send(JSON.stringify(cmd));
    log(`command → plugin WS: ${action} id=${id}`);
    return;
  }

  pendingHttpCommand = { id, action, params, timestamp: cmd.timestamp };
  log(`command → HTTP pending: ${action} id=${id}`);

  try { writeFileSync(COMMAND_FILE, JSON.stringify({ id, action, params }), 'utf8'); }
  catch { /* ignore */ }
}

/**
 * HTTP-run: send a command to the plugin and return a Promise that resolves with the result.
 * Used by POST /api/run so that curl/scripts can invoke bridge commands without MCP.
 */
function sendCommandHttp(id, action, params) {
  return new Promise((resolve) => {
    const cmd = { type: 'command', id, action, params, timestamp: Date.now() };

    const timer = setTimeout(() => {
      pending.delete(id);
      pendingHttp.delete(id);
      pendingHttpCommand = null;
      resolve({ success: false, error: 'EDA plugin timeout (30s)' });
      log(`timeout (http-run): id=${id} action=${action}`);
    }, 30_000);

    // Store resolve callback keyed by id
    pendingHttp.set(id, { resolve, timer });

    if (pluginWs && pluginWs.readyState === WebSocket.OPEN) {
      pluginWs.send(JSON.stringify(cmd));
      log(`command → plugin WS (http-run): ${action} id=${id}`);
    } else {
      pendingHttpCommand = { id, action, params, timestamp: cmd.timestamp };
      try { writeFileSync(COMMAND_FILE, JSON.stringify({ id, action, params, timestamp: cmd.timestamp }), 'utf8'); }
      catch { /* ignore */ }
      log(`command → HTTP pending (http-run): ${action} id=${id}`);
    }
  });
}

// ── HTTP REST endpoints ──────────────────────────────────────────────────────
httpServer.on('request', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);

  if (req.method === 'GET' && url.pathname === '/api/command') {
    httpPollCount++;
    if (pendingHttpCommand) {
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(200);
      res.end(JSON.stringify(pendingHttpCommand));
      log(`command served via HTTP: ${pendingHttpCommand.action} id=${pendingHttpCommand.id}`);
    } else {
      res.writeHead(204);
      res.end();
    }
    return;
  }

  // POST /api/run  — direct command from scripts/curl (bypasses MCP tool list)
  if (req.method === 'POST' && url.pathname === '/api/run') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { action, params } = JSON.parse(body);
        if (!action) { res.writeHead(400); res.end(JSON.stringify({ error: 'action required' })); return; }
        const id = Math.random().toString(36).slice(2);
        const result = await sendCommandHttp(id, action, params ?? {});
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(200);
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: String(err) }));
      }
    });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/result') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        dispatchResult(JSON.parse(body));
        res.writeHead(200);
        res.end('ok');
      } catch { res.writeHead(400); res.end('bad request'); }
    });
    return;
  }

  // GET /api/status — debug: show internal state
  if (req.method === 'GET' && url.pathname === '/api/status') {
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify({
      pluginWs: pluginWs ? `connected (readyState=${pluginWs.readyState})` : 'null',
      httpPollCount,
      pendingCount: pending.size,
      pendingHttpCommand: pendingHttpCommand ? pendingHttpCommand.action : null,
      wsClients: wss.clients.size,
    }));
    return;
  }

  res.writeHead(404); res.end();
});

// ── File fallback polling ────────────────────────────────────────────────────
setInterval(() => {
  if (!existsSync(RESULT_FILE)) return;
  let raw;
  try { raw = readFileSync(RESULT_FILE, 'utf8').trim(); if (!raw) return; unlinkSync(RESULT_FILE); }
  catch { return; }
  let result;
  try { result = JSON.parse(raw); } catch { return; }
  dispatchResult(result);
}, POLL_MS);

// ── WebSocket server ─────────────────────────────────────────────────────────
wss.on('connection', (ws, req) => {
  const remote = req.socket.remoteAddress + ':' + req.socket.remotePort;
  let isPlugin = false;
  log(`WS connected: ${remote}`);

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    // Plugin identifies itself with 'hello'
    if (msg.type === 'hello') {
      isPlugin = true;
      pluginWs = ws;
      log(`plugin registered: ${msg.name ?? 'unknown'} v${msg.version ?? '?'}`);
      // Flush any pending HTTP command to plugin via WS
      if (pendingHttpCommand) {
        const cmd = pendingHttpCommand;
        ws.send(JSON.stringify({ type: 'command', ...cmd }));
        log(`flushed pending command → plugin WS: ${cmd.action} id=${cmd.id}`);
      }
      return;
    }

    // Result from plugin
    if (msg.type === 'result' && isPlugin) {
      dispatchResult(msg);
      return;
    }

    // Pong from plugin (ignore)
    if (msg.type === 'pong' && isPlugin) return;

    // Event from plugin (log only)
    if (msg.type === 'event' && isPlugin) {
      log(`plugin event: ${msg.event}`);
      return;
    }

    // Command from MCP server
    if (msg.type === 'command') {
      const id = msg.id;
      const action = msg.payload?.action;
      const params = msg.payload?.params ?? {};
      if (!id || !action) return;
      sendCommand(id, action, params, ws);
    }
  });

  ws.on('close', () => {
    if (isPlugin) {
      pluginWs = null;
      log(`plugin disconnected: ${remote}`);
    } else {
      log(`MCP client disconnected: ${remote}`);
      for (const [id, entry] of pending) {
        if (entry.ws === ws) { clearTimeout(entry.timer); pending.delete(id); }
      }
    }
  });

  ws.on('error', (err) => log(`ws error [${remote}]: ${err.message}`));
});

httpServer.listen(PORT, '127.0.0.1', () => {
  log(`JLC Bridge Gateway started on ws://127.0.0.1:${PORT}/ws/bridge`);
});

process.on('SIGINT', () => { log('shutting down...'); httpServer.close(); process.exit(0); });
