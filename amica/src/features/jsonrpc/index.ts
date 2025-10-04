/**
 * JSON-RPC API for Amica
 *
 * Entry point for the JSON-RPC server and transports
 */

export * from './protocol';
export * from './server';
export * from './websocket-transport';
export * from './http-transport';

import { JsonRpcServer } from './server';
import { WebSocketTransport } from './websocket-transport';
import { HttpTransport } from './http-transport';
import { Chat } from '@/features/chat/chat';
import { SceneCoordinator } from "@/features/scene3d/SceneCoordinator";
import { HookManager } from '@/features/hooks/hookManager';

/**
 * Initialize JSON-RPC server with transports
 */
export function initializeJsonRpc(
  chat: Chat,
  viewer: SceneCoordinator,
  hookManager: HookManager
): {
  server: JsonRpcServer;
  wsTransport: WebSocketTransport;
  httpTransport: HttpTransport;
} {
  const server = new JsonRpcServer(chat, viewer, hookManager);
  const wsTransport = new WebSocketTransport(server);
  const httpTransport = new HttpTransport(server);

  return {
    server,
    wsTransport,
    httpTransport,
  };
}
