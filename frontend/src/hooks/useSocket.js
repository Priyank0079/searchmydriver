import { useCallback, useEffect, useRef } from 'react';
import useSocketStore from '../store/useSocketStore';

/**
 * Hook into the singleton Socket.IO connection.
 *
 * Returns:
 *   - socket:       the raw socket instance (or null until connected)
 *   - isConnected:  true once the server has acknowledged the handshake
 *   - isConnecting: handshake in progress
 *   - error:        last connection error message (string|null)
 *   - serverHello:  payload from the server's CONNECTED welcome event
 *   - emit(event, payload, ack?)
 *   - on(event, handler) → returns an unsubscribe function
 *
 * The hook does NOT manage auth. The lifecycle is auto-driven by auth stores
 * in `useSocketStore`. Just call this and use what's there.
 */
export function useSocket() {
  const socket = useSocketStore((s) => s.socket);
  const isConnected = useSocketStore((s) => s.isConnected);
  const isConnecting = useSocketStore((s) => s.isConnecting);
  const error = useSocketStore((s) => s.connectError);
  const serverHello = useSocketStore((s) => s.serverHello);

  const socketRef = useRef(socket);
  socketRef.current = socket;

  const emit = useCallback((event, payload, ack) => {
    const s = socketRef.current;
    if (!s) return false;
    s.emit(event, payload, ack);
    return true;
  }, []);

  const on = useCallback((event, handler) => {
    const s = socketRef.current;
    if (!s) return () => {};
    s.on(event, handler);
    return () => s.off(event, handler);
  }, []);

  return { socket, isConnected, isConnecting, error, serverHello, emit, on };
}

/**
 * Subscribe to a single socket event for the lifetime of the calling component.
 * Auto-attaches when the socket exists and auto-detaches on unmount or when
 * the handler / event changes.
 *
 *   useSocketEvent(S2C_EVENTS.NOTIFICATION, (payload) => {...});
 */
export function useSocketEvent(event, handler) {
  const socket = useSocketStore((s) => s.socket);

  // Keep the latest handler in a ref so we don't reattach on every render.
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!socket || !event) return undefined;
    const wrapped = (...args) => handlerRef.current?.(...args);
    socket.on(event, wrapped);
    return () => {
      socket.off(event, wrapped);
    };
  }, [socket, event]);
}
