const connection = document.querySelector("#connection");
const playPause = document.querySelector("#playPause");
const topButton = document.querySelector("#topButton");
const tokenInput = document.querySelector("#tokenInput");
const positionInput = document.querySelector("#positionInput");
const speedInput = document.querySelector("#speedInput");
const fontInput = document.querySelector("#fontInput");
const mirrorInput = document.querySelector("#mirrorInput");
const textInput = document.querySelector("#textInput");
const preview = document.querySelector("#preview");

const params = new URLSearchParams(window.location.search);
tokenInput.value = params.get("token") || window.localStorage.getItem("teleprompter-token") || "";

let current = {};
let applying = false;
let socket;

function tokenPayload(extra = {}) {
  return { ...extra, token: tokenInput.value };
}

function send(event, payload = {}) {
  window.localStorage.setItem("teleprompter-token", tokenInput.value);
  socket.send(event, tokenPayload(payload));
}

function render(state) {
  current = state;
  applying = true;
  textInput.value = state.text || "";
  preview.textContent = state.text || "";
  positionInput.value = Math.round((state.position || 0) * 1000);
  speedInput.value = state.speed;
  fontInput.value = state.fontSize;
  mirrorInput.checked = state.mirror;
  playPause.textContent = state.playing ? "Pause" : "Start";
  applying = false;
}

function setStatus(status) {
  connection.textContent = status;
  connection.dataset.status = status;
}

function showError(error) {
  connection.textContent = error.message || "error";
  connection.dataset.status = "error";
}

socket = window.TeleprompterSocket(render, setStatus, showError);

playPause.addEventListener("click", () => {
  send(current.playing ? "control:pause" : "control:play");
});

topButton.addEventListener("click", () => {
  send("control:setPosition", { position: 0 });
});

positionInput.addEventListener("input", () => {
  if (!applying) {
    send("control:setPosition", { position: Number(positionInput.value) / 1000 });
  }
});

speedInput.addEventListener("input", () => {
  if (!applying) {
    send("control:setSpeed", { speed: Number(speedInput.value) });
  }
});

fontInput.addEventListener("input", () => {
  if (!applying) {
    send("control:setFontSize", { fontSize: Number(fontInput.value) });
  }
});

mirrorInput.addEventListener("change", () => {
  send("control:toggleMirror", { mirror: mirrorInput.checked });
});

let textTimer;
textInput.addEventListener("input", () => {
  preview.textContent = textInput.value;
  clearTimeout(textTimer);
  textTimer = setTimeout(() => {
    send("control:setText", { text: textInput.value });
  }, 250);
});
