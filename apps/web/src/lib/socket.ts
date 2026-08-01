import { io, Socket } from "socket.io-client";
import { SOCKET_URL } from "./config";

let socket: Socket | null = null;

/** Lazily creates a single shared Socket.IO connection to the /chat namespace. */
export function getChatSocket(): Socket {
  if (socket) return socket;

  socket = io(`${SOCKET_URL}/chat`, {
    withCredentials: true,
    transports: ["websocket", "polling"],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 8000,
  });

  return socket;
}
