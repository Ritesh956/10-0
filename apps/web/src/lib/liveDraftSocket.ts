import { io, type Socket } from "socket.io-client";
import { getAuthToken } from "../api/client";

const API_BASE_URL = (import.meta.env["VITE_API_URL"] as string | undefined) ?? "http://localhost:4000";

/** One socket per LiveDraftPage mount — auth happens once at connect time (live-draft.gateway.ts's
    handleConnection verifies the JWT off the handshake), not per-message, so this must be recreated
    if the auth token changes (e.g. a guest just upgraded mid-session). */
export function createLiveDraftSocket(): Socket {
  return io(API_BASE_URL, {
    auth: { token: getAuthToken() ?? "" },
    transports: ["websocket"],
  });
}
