# Amica JSON-RPC 2.0 Protocol

A comprehensive JSON-RPC 2.0 API for interacting with Amica, enabling external services to control all aspects of the character including chat, emotions, animations, audio input, and hooks.

## Table of Contents

- [Overview](#overview)
- [Transport Layers](#transport-layers)
- [Configuration](#configuration)
- [API Methods](#api-methods)
- [Examples](#examples)
- [Hook System Integration](#hook-system-integration)
- [Scenario System Integration](#scenario-system-integration)

## Overview

The Amica JSON-RPC API provides:

- **Complete Control**: Access to all Amica functionality via RPC
- **Hook Management**: Register, trigger, and manage lifecycle hooks
- **Real-time Communication**: WebSocket support for bidirectional streaming
- **RESTful HTTP**: Traditional HTTP POST for one-off requests
- **Audio Input**: Send audio data for transcription and processing
- **Emotion Control**: Trigger emotional states and expressions
- **Character Control**: Manage animations, speech, and appearance
- **Scenario Integration**: Load and control scenarios programmatically

## Transport Layers

### WebSocket Transport

Real-time bidirectional communication on port 8765 (configurable).

```typescript
const ws = new WebSocket('ws://localhost:8765/amica/jsonrpc');

ws.onopen = () => {
  // Send JSON-RPC request
  ws.send(JSON.stringify({
    jsonrpc: '2.0',
    method: 'chat.sendMessage',
    params: { message: 'Hello Amica!' },
    id: 1
  }));
};

ws.onmessage = (event) => {
  const response = JSON.parse(event.data);
  console.log('Response:', response.result);
};
```

### HTTP Transport

Traditional HTTP POST requests.

```bash
curl -X POST http://localhost:8080/amica/jsonrpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "chat.sendMessage",
    "params": { "message": "Hello Amica!" },
    "id": 1
  }'
```

## Configuration

Add these configuration options to your Amica config:

```toml
# Enable JSON-RPC server
jsonrpc_enabled = true

# WebSocket server URL (for external services to connect to)
jsonrpc_ws_url = "ws://localhost:8765/amica/jsonrpc"

# HTTP server URL (for external services to send requests to)
jsonrpc_http_url = "http://localhost:8080/amica/jsonrpc"

# Maximum concurrent connections
jsonrpc_max_connections = 100

# Request timeout (ms)
jsonrpc_timeout = 30000
```

## API Methods

### Hook Management

#### `hooks.register`

Register a hook for a specific event.

**Parameters:**
```typescript
{
  event: HookEvent;
  priority?: number;       // Lower = higher priority (default: 100)
  timeout?: number;        // Hook timeout in ms (default: 5000)
  callbackUrl?: string;    // Optional HTTP callback URL
}
```

**Example:**
```json
{
  "jsonrpc": "2.0",
  "method": "hooks.register",
  "params": {
    "event": "before:llm:request",
    "priority": 50,
    "timeout": 10000
  },
  "id": 1
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "result": {
    "hookId": "hook_123",
    "event": "before:llm:request"
  },
  "id": 1
}
```

#### `hooks.trigger`

Manually trigger a hook event.

**Parameters:**
```typescript
{
  event: HookEvent;
  data: HookEventMap[event];
}
```

**Example:**
```json
{
  "jsonrpc": "2.0",
  "method": "hooks.trigger",
  "params": {
    "event": "on:expression:change",
    "data": { "expression": "happy" }
  },
  "id": 2
}
```

#### Other Hook Methods

- `hooks.unregister` - Unregister a specific hook
- `hooks.unregisterAll` - Unregister all hooks for an event
- `hooks.list` - List all registered hooks
- `hooks.getMetrics` - Get performance metrics for hooks
- `hooks.enable` - Enable all hooks
- `hooks.disable` - Disable all hooks
- `hooks.clear` - Clear all hooks

### Chat Actions

#### `chat.sendMessage`

Send a message to the character.

**Parameters:**
```typescript
{
  message: string;
  role?: 'user' | 'assistant' | 'system';
}
```

**Example:**
```json
{
  "jsonrpc": "2.0",
  "method": "chat.sendMessage",
  "params": {
    "message": "Tell me a joke!"
  },
  "id": 3
}
```

#### `chat.interrupt`

Interrupt the current chat stream.

```json
{
  "jsonrpc": "2.0",
  "method": "chat.interrupt",
  "id": 4
}
```

#### Other Chat Methods

- `chat.createStream` - Create a new chat stream with custom messages
- `chat.getState` - Get current chat state
- `chat.getMessageList` - Get message history
- `chat.setMessageList` - Set message history
- `chat.isAwake` - Check if character is awake
- `chat.getIdleTime` - Get idle time in milliseconds

### Audio Input

#### `audio.send`

Send audio data to Amica.

**Parameters:**
```typescript
{
  audio: string;           // base64 encoded audio
  format?: 'wav' | 'mp3' | 'ogg' | 'webm' | 'pcm';
  sampleRate?: number;     // Sample rate in Hz
  transcribe?: boolean;    // Auto-transcribe and send as message
}
```

**Example:**
```json
{
  "jsonrpc": "2.0",
  "method": "audio.send",
  "params": {
    "audio": "data:audio/wav;base64,UklGRi...",
    "format": "wav",
    "transcribe": true
  },
  "id": 5
}
```

#### `audio.transcribe`

Transcribe audio without sending as message.

**Example:**
```json
{
  "jsonrpc": "2.0",
  "method": "audio.transcribe",
  "params": {
    "audio": "data:audio/wav;base64,UklGRi...",
    "format": "wav"
  },
  "id": 6
}
```

### Character Actions

#### `character.setExpression`

Set character's facial expression.

**Parameters:**
```typescript
{
  expression: string;  // e.g., "happy", "sad", "angry", "neutral"
}
```

**Example:**
```json
{
  "jsonrpc": "2.0",
  "method": "character.setExpression",
  "params": {
    "expression": "happy"
  },
  "id": 7
}
```

#### `character.setEmotion`

Set character's emotion with intensity.

**Parameters:**
```typescript
{
  emotion: string;
  intensity?: number;  // 0-1
  duration?: number;   // milliseconds, 0 for permanent
}
```

**Example:**
```json
{
  "jsonrpc": "2.0",
  "method": "character.setEmotion",
  "params": {
    "emotion": "excited",
    "intensity": 0.8,
    "duration": 5000
  },
  "id": 8
}
```

#### `character.speak`

Make the character speak text.

**Parameters:**
```typescript
{
  text: string;
  style?: string;    // e.g., "talk", "sing"
  emotion?: string;
}
```

**Example:**
```json
{
  "jsonrpc": "2.0",
  "method": "character.speak",
  "params": {
    "text": "Hello! How are you today?",
    "emotion": "happy"
  },
  "id": 9
}
```

#### `character.playAnimation`

Play an animation on the character.

**Parameters:**
```typescript
{
  animationUrl: string;
  loop?: boolean;
  fadeTime?: number;  // Fade transition time in ms
}
```

#### `character.lookAt`

Control where the character looks.

**Parameters:**
```typescript
{
  target?: { x: number; y: number; z: number };
  enabled?: boolean;
  autoLookAt?: boolean;
}
```

**Example:**
```json
{
  "jsonrpc": "2.0",
  "method": "character.lookAt",
  "params": {
    "target": { "x": 0, "y": 1.5, "z": 1 }
  },
  "id": 10
}
```

#### Other Character Methods

- `character.stopSpeaking` - Stop current speech
- `character.loadModel` - Load a new VRM model
- `character.setAutoLookAt` - Enable/disable auto look at camera
- `character.setAutoBlink` - Enable/disable auto blinking

### Vision Actions

#### `vision.processImage`

Process an image with vision AI.

**Parameters:**
```typescript
{
  imageData: string;  // base64 encoded image
}
```

**Example:**
```json
{
  "jsonrpc": "2.0",
  "method": "vision.processImage",
  "params": {
    "imageData": "data:image/jpeg;base64,/9j/4AAQ..."
  },
  "id": 11
}
```

#### `vision.captureScreenshot`

Capture a screenshot from the viewer.

```json
{
  "jsonrpc": "2.0",
  "method": "vision.captureScreenshot",
  "id": 12
}
```

### Config Management

#### `config.get`

Get a configuration value.

```json
{
  "jsonrpc": "2.0",
  "method": "config.get",
  "params": { "key": "system_prompt" },
  "id": 13
}
```

#### `config.set`

Set a configuration value.

```json
{
  "jsonrpc": "2.0",
  "method": "config.set",
  "params": {
    "key": "tts_backend",
    "value": "elevenlabs"
  },
  "id": 14
}
```

#### Other Config Methods

- `config.getAll` - Get all configuration
- `config.update` - Batch update multiple config values

### Scenario Management

#### `scenario.load`

Load a scenario.

```json
{
  "jsonrpc": "2.0",
  "method": "scenario.load",
  "params": {
    "scenarioUrl": "https://example.com/scenarios/beach.json"
  },
  "id": 15
}
```

#### `scenario.unload`

Unload current scenario.

```json
{
  "jsonrpc": "2.0",
  "method": "scenario.unload",
  "id": 16
}
```

### Model Management

#### `model.load`

Load a VRM character model.

```json
{
  "jsonrpc": "2.0",
  "method": "model.load",
  "params": {
    "modelUrl": "https://example.com/character.vrm",
    "onProgress": true
  },
  "id": 20
}
```

#### `model.unload`

Unload the current character model.

```json
{
  "jsonrpc": "2.0",
  "method": "model.unload",
  "id": 21
}
```

#### `model.setPosition`

Set the 3D position of the character model.

```json
{
  "jsonrpc": "2.0",
  "method": "model.setPosition",
  "params": {
    "position": { "x": 0, "y": 0, "z": -2 }
  },
  "id": 22
}
```

#### `model.setRotation`

Set the rotation of the character model (Euler angles in radians).

```json
{
  "jsonrpc": "2.0",
  "method": "model.setRotation",
  "params": {
    "rotation": { "x": 0, "y": 1.57, "z": 0 }
  },
  "id": 23
}
```

#### `model.setScale`

Set the scale of the character model.

```json
{
  "jsonrpc": "2.0",
  "method": "model.setScale",
  "params": {
    "scale": { "x": 1.2, "y": 1.2, "z": 1.2 }
  },
  "id": 24
}
```

#### `model.getTransform`

Get the current transform (position, rotation, scale) of the character model.

```json
{
  "jsonrpc": "2.0",
  "method": "model.getTransform",
  "id": 25
}
```

### Room/Environment Management

#### `room.load`

Load a 3D room/environment (GLB, GLTF).

```json
{
  "jsonrpc": "2.0",
  "method": "room.load",
  "params": {
    "roomUrl": "https://example.com/room.glb",
    "position": { "x": 0, "y": 0, "z": 0 },
    "rotation": { "x": 0, "y": 0, "z": 0 },
    "scale": { "x": 1, "y": 1, "z": 1 },
    "onProgress": true
  },
  "id": 26
}
```

#### `room.unload`

Unload the current room/environment.

```json
{
  "jsonrpc": "2.0",
  "method": "room.unload",
  "id": 27
}
```

#### `room.setPosition`, `room.setRotation`, `room.setScale`, `room.getTransform`

Same as model methods but for the room/environment.

#### `room.loadSplat`

Load a Gaussian Splat scene.

```json
{
  "jsonrpc": "2.0",
  "method": "room.loadSplat",
  "params": {
    "splatUrl": "https://example.com/scene.splat",
    "position": { "x": 0, "y": 0, "z": 0 }
  },
  "id": 28
}
```

### VR/XR Management

#### `xr.startSession`

Start an immersive VR/AR session.

```json
{
  "jsonrpc": "2.0",
  "method": "xr.startSession",
  "params": {
    "mode": "immersive-vr",
    "referenceSpaceType": "local-floor"
  },
  "id": 29
}
```

**Parameters:**
- `mode`: "immersive-vr" | "immersive-ar" | "inline"
- `referenceSpaceType`: "local" | "local-floor" | "bounded-floor" | "unbounded"

#### `xr.endSession`

End the current XR session.

```json
{
  "jsonrpc": "2.0",
  "method": "xr.endSession",
  "id": 30
}
```

#### `xr.getSessionState`

Get the current XR session state.

```json
{
  "jsonrpc": "2.0",
  "method": "xr.getSessionState",
  "id": 31
}
```

#### `xr.setFoveation`

Set foveated rendering level (0-1, higher = more aggressive optimization).

```json
{
  "jsonrpc": "2.0",
  "method": "xr.setFoveation",
  "params": { "level": 0.5 },
  "id": 32
}
```

#### `xr.setFramebufferScale`

Set framebuffer resolution scale (e.g., 1.0, 1.2, 1.5).

```json
{
  "jsonrpc": "2.0",
  "method": "xr.setFramebufferScale",
  "params": { "scale": 1.2 },
  "id": 33
}
```

### System Methods

#### `system.ping`

Health check.

```json
{
  "jsonrpc": "2.0",
  "method": "system.ping",
  "id": 17
}
```

#### `system.getCapabilities`

Get list of all available methods and hooks.

```json
{
  "jsonrpc": "2.0",
  "method": "system.getCapabilities",
  "id": 18
}
```

#### `system.batch`

Execute multiple requests in batch.

**Parameters:**
```typescript
{
  actions: JsonRpcRequest[];
  sequential?: boolean;  // Run in sequence vs parallel
}
```

**Example:**
```json
{
  "jsonrpc": "2.0",
  "method": "system.batch",
  "params": {
    "sequential": true,
    "actions": [
      {
        "jsonrpc": "2.0",
        "method": "character.setEmotion",
        "params": { "emotion": "happy" },
        "id": 1
      },
      {
        "jsonrpc": "2.0",
        "method": "character.speak",
        "params": { "text": "I'm so happy!" },
        "id": 2
      }
    ]
  },
  "id": 19
}
```

## Examples

### Python Client

```python
import websocket
import json

class AmicaClient:
    def __init__(self, url="ws://localhost:8765/amica/jsonrpc"):
        self.ws = websocket.create_connection(url)
        self.request_id = 0

    def call(self, method, params=None):
        self.request_id += 1
        request = {
            "jsonrpc": "2.0",
            "method": method,
            "params": params or {},
            "id": self.request_id
        }
        self.ws.send(json.dumps(request))
        response = json.loads(self.ws.recv())
        return response.get("result")

    def send_message(self, message):
        return self.call("chat.sendMessage", {"message": message})

    def set_emotion(self, emotion, intensity=1.0):
        return self.call("character.setEmotion", {
            "emotion": emotion,
            "intensity": intensity
        })

# Usage
client = AmicaClient()
client.set_emotion("happy", 0.8)
client.send_message("Hello! How are you?")
```

### JavaScript/TypeScript Client

```typescript
class AmicaClient {
  private ws: WebSocket;
  private requestId = 0;
  private pending = new Map<number, any>();

  constructor(url: string = 'ws://localhost:8765/amica/jsonrpc') {
    this.ws = new WebSocket(url);

    this.ws.onmessage = (event) => {
      const response = JSON.parse(event.data);
      const resolver = this.pending.get(response.id);
      if (resolver) {
        resolver(response.result);
        this.pending.delete(response.id);
      }
    };
  }

  async call<T>(method: string, params?: any): Promise<T> {
    return new Promise((resolve) => {
      const id = ++this.requestId;
      this.pending.set(id, resolve);

      this.ws.send(JSON.stringify({
        jsonrpc: '2.0',
        method,
        params,
        id
      }));
    });
  }

  async sendMessage(message: string) {
    return this.call('chat.sendMessage', { message });
  }

  async setEmotion(emotion: string, intensity = 1.0) {
    return this.call('character.setEmotion', { emotion, intensity });
  }

  async sendAudio(audioBase64: string, transcribe = true) {
    return this.call('audio.send', {
      audio: audioBase64,
      transcribe
    });
  }
}

// Usage
const client = new AmicaClient();
await client.setEmotion('happy', 0.8);
await client.sendMessage('Hello!');
```

### Node.js HTTP Client

```javascript
const fetch = require('node-fetch');

async function callAmicaRpc(method, params) {
  const response = await fetch('http://localhost:8080/amica/jsonrpc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method,
      params,
      id: Date.now()
    })
  });

  const data = await response.json();
  return data.result;
}

// Usage
await callAmicaRpc('character.setEmotion', { emotion: 'excited', intensity: 0.9 });
await callAmicaRpc('chat.sendMessage', { message: 'Tell me a story!' });
```

## Hook System Integration

The JSON-RPC API integrates seamlessly with Amica's hook system, allowing external services to intercept and modify data at every stage of the pipeline.

### Available Hook Events

#### User Input Pipeline
- `before:user:message:receive` - Before processing user message
- `after:user:message:receive` - After processing user message
- `before:stt:transcribe` - Before speech-to-text transcription
- `after:stt:transcribe` - After speech-to-text transcription

#### LLM Pipeline
- `before:llm:request` - Before LLM request
- `after:llm:request` - After LLM request
- `before:llm:stream` - Before streaming starts
- `on:llm:chunk` - On each streamed chunk
- `after:llm:complete` - After stream completes

#### TTS Pipeline
- `before:tts:generate` - Before TTS generation
- `after:tts:generate` - After TTS generation
- `before:rvc:process` - Before RVC processing
- `after:rvc:process` - After RVC processing

#### Character Animation Pipeline
- `before:speak:start` - Before speaking starts
- `after:speak:end` - After speaking ends
- `on:expression:change` - On expression change
- `on:animation:play` - On animation play

#### Vision Pipeline
- `before:vision:capture` - Before vision capture
- `after:vision:response` - After vision response

#### Scenario Lifecycle
- `scenario:loaded` - When scenario is loaded
- `scenario:setup:complete` - When scenario setup is complete
- `scenario:update` - On scenario update
- `scenario:unload` - When scenario is unloaded

### Hook Example: Text Translation

```javascript
// Register hook to translate all incoming messages
await client.call('hooks.register', {
  event: 'before:user:message:receive',
  priority: 10,
  callbackUrl: 'http://my-service.com/translate'
});

// Your service receives:
// POST http://my-service.com/translate
// { "message": "Bonjour!" }
//
// Your service responds with:
// { "message": "Hello!" }
```

### Hook Example: Custom TTS

```javascript
// Intercept TTS generation
await client.call('hooks.register', {
  event: 'before:tts:generate',
  callbackUrl: 'http://my-tts-service.com/generate'
});
```

## Scenario System Integration

Scenarios can use the JSON-RPC API to create complex interactive experiences.

### Example: Interactive Game Scenario

```javascript
// Scenario registers hooks on load
async function onScenarioLoad() {
  // Register hook for user messages
  const hookId = await amicaRpc.call('hooks.register', {
    event: 'after:user:message:receive',
    priority: 50
  });

  // Trigger emotion based on game state
  if (playerWins) {
    await amicaRpc.call('character.setEmotion', {
      emotion: 'happy',
      intensity: 1.0,
      duration: 5000
    });
  }
}
```

## Error Handling

All errors follow JSON-RPC 2.0 error format:

```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32603,
    "message": "Internal error",
    "data": "No model loaded"
  },
  "id": 1
}
```

### Error Codes

- `-32700` - Parse error
- `-32600` - Invalid Request
- `-32601` - Method not found
- `-32602` - Invalid params
- `-32603` - Internal error
- `-32000` - Hook registration failed
- `-32001` - Hook not found
- `-32002` - Action failed
- `-32003` - State not available
- `-32004` - Config error
- `-32005` - Chat error
- `-32006` - Viewer error
- `-32007` - Scenario error

## Security Considerations

The JSON-RPC server should only be exposed on localhost by default. For remote access:

1. Use a reverse proxy with authentication
2. Enable HTTPS/WSS
3. Implement rate limiting
4. Validate all input data
5. Use API keys or tokens for authentication

## License

This API is part of the Amica project and follows its license terms.
