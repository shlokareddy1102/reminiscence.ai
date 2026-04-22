import { io } from "socket.io-client";
import { API_BASE_URL } from "@/lib/api";

let socketInstance = null;

export function getSocket() {
  if (!socketInstance) {
    socketInstance = io(API_BASE_URL, {
      transports: ["websocket", "polling"]
    });
  }
  return socketInstance;
}

export function disconnectSocket() {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}
