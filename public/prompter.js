const viewport = document.querySelector("#viewport");
const text = document.querySelector("#text");
const statusDot = document.querySelector("#statusDot");
const playButton = document.querySelector("#playButton");
const fullscreenButton = document.querySelector("#fullscreenButton");
const params = new URLSearchParams(window.location.search);
const token = params.get("token") || window.localStorage.getItem("teleprompter-token") || "";

let current = {};
let lastFrame = performance.now();
let lastSync = 0;
let virtualScrollTop = 0;
let socket;

function render(state) {
  const previousText = current.text;
  const previousFontSize = current.fontSize;
  current = state;
  text.textContent = state.text || "";
  text.style.fontSize = `${state.fontSize}px`;

  requestAnimationFrame(() => {
    const maxScroll = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
    const cameFromThisPrompter = state.sourceId === socket?.clientId;
    const layoutChanged = previousText !== state.text || previousFontSize !== state.fontSize;
    if (!cameFromThisPrompter || layoutChanged || !state.playing) {
      virtualScrollTop = maxScroll * state.position;
      applyOffset();
    }
  });
}

function setStatus(status) {
  statusDot.dataset.status = status;
}

socket = window.TeleprompterSocket(render, setStatus);

function setPositionFromScroll() {
  const maxScroll = Math.max(1, viewport.scrollHeight - viewport.clientHeight);
  current.position = clamp(virtualScrollTop / maxScroll, 0, 1);
}

function clamp(number, min, max) {
  return Math.min(max, Math.max(min, number));
}

function applyOffset() {
  const mirror = current.mirror ? " scaleX(-1)" : "";
  text.style.transform = `translateY(${-virtualScrollTop}px)${mirror}`;
}

function tick(now) {
  const delta = Math.min(80, now - lastFrame) / 1000;
  lastFrame = now;

  if (current.playing) {
    const maxScrollTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
    virtualScrollTop = clamp(virtualScrollTop + current.speed * delta, 0, maxScrollTop);
    applyOffset();
    setPositionFromScroll();
    if (now - lastSync > 180) {
      socket.send("prompter:setPosition", {
        position: current.position,
        scrollTop: virtualScrollTop,
        scrollHeight: viewport.scrollHeight,
        clientHeight: viewport.clientHeight
      });
      lastSync = now;
    }
    if (virtualScrollTop >= maxScrollTop - 1) {
      current.playing = false;
      socket.send("prompter:setPosition", {
        position: current.position,
        scrollTop: virtualScrollTop,
        scrollHeight: viewport.scrollHeight,
        clientHeight: viewport.clientHeight,
        playing: false
      });
    }
  }

  requestAnimationFrame(tick);
}

playButton.addEventListener("click", () => {
  socket.send(current.playing ? "control:pause" : "control:play", { token });
});

fullscreenButton.addEventListener("click", async () => {
  if (!document.fullscreenElement) {
    await document.documentElement.requestFullscreen?.();
  } else {
    await document.exitFullscreen?.();
  }
});

requestAnimationFrame(tick);
