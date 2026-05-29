import crypto from "node:crypto";
import express from "express";
import { WebSocketServer } from "ws";

const app = express();
const port = Number(process.env.PORT || 3000);
const controlToken = process.env.CONTROL_TOKEN || "";

const defaultText = `Guten Morgen zusammen,

ich gebe euch heute ein kurzes Update:

Was seit dem letzten Standup passiert ist.
Woran ich gerade arbeite.
Wo ich Unterstuetzung brauche.

Danke euch.`;

const state = {
  text: process.env.DEFAULT_TEXT || defaultText,
  position: 0,
  playing: false,
  speed: 34,
  fontSize: 72,
  mirror: false,
  viewport: {
    scrollTop: 0,
    scrollHeight: 1,
    clientHeight: 1
  },
  sourceId: null,
  updatedAt: Date.now()
};

const clients = new Set();

app.disable("x-powered-by");
app.use(express.static("public", {
  extensions: ["html"],
  etag: true,
  maxAge: 0,
  setHeaders(res, path) {
    if (/\.(html|js|css)$/.test(path)) {
      res.setHeader("Cache-Control", "no-store, must-revalidate");
    }
  }
}));

app.get("/healthz", (_req, res) => {
  res.status(200).json({ ok: true });
});

const server = app.listen(port, () => {
  console.log(`teleprompter listening on :${port}`);
});

const wss = new WebSocketServer({ server, path: "/ws" });

function send(ws, event, payload) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify({ event, payload }));
  }
}

function broadcast(event, payload) {
  for (const client of clients) {
    send(client, event, payload);
  }
}

function authorized(payload) {
  if (!controlToken) {
    return true;
  }
  if (!payload?.token) {
    return false;
  }
  const expected = Buffer.from(controlToken);
  const received = Buffer.from(String(payload.token));
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}

function clamp(number, min, max) {
  return Math.min(max, Math.max(min, number));
}

function updateState(patch, sourceId = null) {
  Object.assign(state, patch, { sourceId, updatedAt: Date.now() });
  broadcast("state:update", state);
}

function handleControl(ws, event, payload = {}) {
  if (event === "prompter:setPosition") {
    const patch = {
      position: clamp(Number(payload.position) || 0, 0, 1),
      viewport: {
        scrollTop: Math.max(0, Number(payload.scrollTop) || 0),
        scrollHeight: Math.max(1, Number(payload.scrollHeight) || 1),
        clientHeight: Math.max(1, Number(payload.clientHeight) || 1)
      }
    };
    if (typeof payload.playing === "boolean") {
      patch.playing = payload.playing;
    }
    updateState(patch, payload.clientId || null);
    return;
  }

  if (!authorized(payload)) {
    send(ws, "control:error", { message: "unauthorized" });
    return;
  }

  if (event === "control:setText") {
    updateState({ text: String(payload.text || ""), position: 0, playing: false }, payload.clientId || null);
    return;
  }

  if (event === "control:play") {
    updateState({ playing: true }, payload.clientId || null);
    return;
  }

  if (event === "control:pause") {
    updateState({ playing: false }, payload.clientId || null);
    return;
  }

  if (event === "control:setSpeed") {
    updateState({ speed: clamp(Number(payload.speed) || state.speed, 1, 180) }, payload.clientId || null);
    return;
  }

  if (event === "control:setPosition") {
    updateState({ position: clamp(Number(payload.position) || 0, 0, 1) }, payload.clientId || null);
    return;
  }

  if (event === "control:setFontSize") {
    updateState({ fontSize: clamp(Number(payload.fontSize) || state.fontSize, 36, 140) }, payload.clientId || null);
    return;
  }

  if (event === "control:toggleMirror") {
    updateState({ mirror: Boolean(payload.mirror) }, payload.clientId || null);
  }
}

wss.on("connection", (ws) => {
  clients.add(ws);
  send(ws, "state:init", state);

  ws.on("message", (raw) => {
    try {
      const message = JSON.parse(raw.toString());
      handleControl(ws, message.event, message.payload);
    } catch {
      send(ws, "control:error", { message: "invalid message" });
    }
  });

  ws.on("close", () => {
    clients.delete(ws);
  });
});

function shutdown() {
  wss.close();
  server.close(() => process.exit(0));
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
