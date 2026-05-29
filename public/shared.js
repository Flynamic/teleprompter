window.TeleprompterSocket = function createTeleprompterSocket(onState, onStatus, onError) {
  let socket;
  let retryTimer;

  function connect() {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    socket = new WebSocket(`${protocol}://${window.location.host}/ws`);
    onStatus("connecting");

    socket.addEventListener("open", () => onStatus("online"));
    socket.addEventListener("close", () => {
      onStatus("offline");
      clearTimeout(retryTimer);
      retryTimer = setTimeout(connect, 900);
    });
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.event === "state:init" || message.event === "state:update") {
        onState(message.payload);
      }
      if (message.event === "control:error" && onError) {
        onError(message.payload);
      }
    });
  }

  connect();

  return {
    send(event, payload = {}) {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ event, payload }));
      }
    }
  };
};
