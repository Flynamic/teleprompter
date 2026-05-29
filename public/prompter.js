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
let socket;

function render(state) {
  current = state;
  text.textContent = state.text || "";
  text.style.fontSize = `${state.fontSize}px`;
  text.classList.toggle("mirror", state.mirror);

  requestAnimationFrame(() => {
    const maxScroll = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
    viewport.scrollTop = maxScroll * state.position;
  });
}

function setStatus(status) {
  statusDot.dataset.status = status;
}

socket = window.TeleprompterSocket(render, setStatus);

function setPositionFromScroll() {
  const maxScroll = Math.max(1, viewport.scrollHeight - viewport.clientHeight);
  current.position = viewport.scrollTop / maxScroll;
}

function tick(now) {
  const delta = Math.min(80, now - lastFrame) / 1000;
  lastFrame = now;

  if (current.playing) {
    viewport.scrollTop += current.speed * delta;
    setPositionFromScroll();
    if (now - lastSync > 180) {
      socket.send("prompter:setPosition", { position: current.position });
      lastSync = now;
    }
    if (viewport.scrollTop >= viewport.scrollHeight - viewport.clientHeight - 1) {
      socket.send("control:pause", { token });
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
