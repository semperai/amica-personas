# OpenAI-Compatible Mock Server

A lightweight Node.js server that implements OpenAI's chat completions API for testing purposes.

## Features

- ✅ OpenAI-compatible `/v1/chat/completions` endpoint
- ✅ Streaming and non-streaming responses
- ✅ `/v1/models` endpoint
- ✅ CORS support
- ✅ Health check endpoint
- ✅ No external dependencies

## Quick Start

### Using Docker Compose

```bash
docker-compose up -d
```

The server will be available at `http://localhost:8080`

### Using Docker

```bash
docker build -t amica-openai-mock .
docker run -p 8080:8080 amica-openai-mock
```

### Using Node.js

```bash
node server.js
```

## Endpoints

### Health Check
```bash
curl http://localhost:8080/health
```

### List Models
```bash
curl http://localhost:8080/v1/models
```

### Chat Completion (Non-streaming)
```bash
curl http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "mock-gpt-3.5-turbo",
    "messages": [{"role": "user", "content": "Hello"}],
    "stream": false
  }'
```

### Chat Completion (Streaming)
```bash
curl http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "mock-gpt-3.5-turbo",
    "messages": [{"role": "user", "content": "Hello"}],
    "stream": true
  }'
```

## Configuration

Set the port via environment variable:
```bash
PORT=3000 node server.js
```

## Testing with Amica

Configure Amica to use this mock server:

1. Open Amica settings
2. Select "ChatGPT" as backend
3. Set URL to `http://localhost:8080`
4. API key can be any string (not validated)
5. Model: `mock-gpt-3.5-turbo`

## Mock Responses

The server provides different responses based on keywords:
- "test" → "This is a test response..."
- "hello" → "Hello! How can I assist you today?"
- Default → Generic mock response

You can customize responses by editing `MOCK_RESPONSES` in `server.js`.

## Use Cases

- Integration testing
- Development without API costs
- Offline development
- CI/CD pipeline testing
- Load testing chat interfaces
