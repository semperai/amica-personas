/**
 * HTTP Transport for JSON-RPC
 *
 * Enables HTTP POST requests for JSON-RPC communication
 */

import { JsonRpcServer } from './server';
import { JsonRpcRequest, JsonRpcResponse } from './protocol';

export interface HttpTransportConfig {
  cors?: boolean;
  maxRequestSize?: number;
  timeout?: number;
}

export class HttpTransport {
  private server: JsonRpcServer;
  private config: Required<HttpTransportConfig>;

  constructor(server: JsonRpcServer, config: HttpTransportConfig = {}) {
    this.server = server;
    this.config = {
      cors: config.cors ?? true,
      maxRequestSize: config.maxRequestSize ?? 1048576, // 1MB
      timeout: config.timeout ?? 30000,
    };
  }

  /**
   * Handle HTTP POST request
   */
  public async handleRequest(
    body: string,
    headers?: Record<string, string>
  ): Promise<{ status: number; body: string; headers: Record<string, string> }> {
    const responseHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add CORS headers if enabled
    if (this.config.cors) {
      responseHeaders['Access-Control-Allow-Origin'] = '*';
      responseHeaders['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
      responseHeaders['Access-Control-Allow-Headers'] = 'Content-Type';
    }

    // Check request size
    if (body.length > this.config.maxRequestSize) {
      return {
        status: 413,
        body: JSON.stringify({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Request too large',
          },
          id: null,
        }),
        headers: responseHeaders,
      };
    }

    try {
      const data = JSON.parse(body);

      let response: JsonRpcResponse | JsonRpcResponse[];

      // Handle batch requests
      if (Array.isArray(data)) {
        response = await this.server.handleBatch(data);
      } else {
        response = await this.server.handleRequest(data as JsonRpcRequest);
      }

      return {
        status: 200,
        body: JSON.stringify(response),
        headers: responseHeaders,
      };
    } catch (error: any) {
      console.error('[HttpTransport] Error handling request:', error);

      const errorResponse: JsonRpcResponse = {
        jsonrpc: '2.0',
        error: {
          code: -32700,
          message: 'Parse error',
          data: error.message,
        },
        id: null,
      };

      return {
        status: 400,
        body: JSON.stringify(errorResponse),
        headers: responseHeaders,
      };
    }
  }

  /**
   * Handle OPTIONS request for CORS preflight
   */
  public handleOptions(): { status: number; headers: Record<string, string> } {
    const headers: Record<string, string> = {};

    if (this.config.cors) {
      headers['Access-Control-Allow-Origin'] = '*';
      headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
      headers['Access-Control-Allow-Headers'] = 'Content-Type';
      headers['Access-Control-Max-Age'] = '86400';
    }

    return {
      status: 204,
      headers,
    };
  }
}
