import { io } from "socket.io-client";
import { API_BASE_URL } from "@/lib/api";

let socketInstance = null;
let socketBaseUrl = null;
const getSocketBaseUrl = () => API_BASE_URL || "http://localhost:5001";

export function getSocket() {
  const nextBaseUrl = getSocketBaseUrl();

  if (socketInstance && socketBaseUrl !== nextBaseUrl) {
    socketInstance.disconnect();
    socketInstance = null;
  }

  if (!socketInstance) {
    socketBaseUrl = nextBaseUrl;
    socketInstance = io(nextBaseUrl, {
      transports: ["websocket", "polling"],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      timeout: 10000
    });

    socketInstance.on("connect_error", () => {
      const refreshedBase = getSocketBaseUrl();
      if (refreshedBase !== socketBaseUrl) {
        socketInstance?.disconnect();
        socketInstance = null;
      }
    });

    socketInstance.on("disconnect", (reason) => {
      if (reason === "io client disconnect") return;
      const refreshedBase = getSocketBaseUrl();
      if (refreshedBase !== socketBaseUrl) {
        socketInstance?.disconnect();
        socketInstance = null;
      }
    });
  }

  return socketInstance;
}

export function disconnectSocket() {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
    socketBaseUrl = null;
  }
}
