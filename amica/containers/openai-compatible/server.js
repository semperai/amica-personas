/**
 * OpenAI-Compatible Mock API Server
 *
 * A simple mock server that implements OpenAI's chat completions API
 * for testing purposes. Supports both streaming and non-streaming responses.
 */

const http = require('http');

const PORT = process.env.PORT || 8080;

// Mock responses for testing
const MOCK_RESPONSES = {
  'test': 'This is a test response from the mock OpenAI-compatible server.',
  'hello': 'Hello! How can I assist you today?',
  'default': 'I am a mock AI assistant. This is a simulated response for testing purposes.',
};

function generateResponse(message) {
  const lowerMessage = message.toLowerCase();

  for (const [key, response] of Object.entries(MOCK_RESPONSES)) {
    if (lowerMessage.includes(key)) {
      return response;
    }
  }

  return MOCK_RESPONSES.default;
}

function handleChatCompletions(req, res, body, stream = false) {
  try {
    const data = JSON.parse(body);
    const messages = data.messages || [];
    const lastMessage = messages[messages.length - 1];
    const userMessage = lastMessage?.content || '';

    const response = generateResponse(userMessage);

    if (stream) {
      // Streaming response (SSE format)
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });

      // Split response into chunks for realistic streaming
      const words = response.split(' ');
      let chunkIndex = 0;

      const interval = setInterval(() => {
        if (chunkIndex >= words.length) {
          res.write('data: [DONE]\n\n');
          res.end();
          clearInterval(interval);
          return;
        }

        const chunk = {
          id: `chatcmpl-${Date.now()}`,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: data.model || 'mock-gpt-3.5-turbo',
          choices: [{
            index: 0,
            delta: {
              content: (chunkIndex === 0 ? '' : ' ') + words[chunkIndex]
            },
            finish_reason: null
          }]
        };

        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        chunkIndex++;
      }, 50); // 50ms between chunks

    } else {
      // Non-streaming response
      const completion = {
        id: `chatcmpl-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: data.model || 'mock-gpt-3.5-turbo',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: response
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30
        }
      };

      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(JSON.stringify(completion));
    }
  } catch (error) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { message: error.message } }));
  }
}

function handleModels(req, res) {
  const models = {
    object: 'list',
    data: [
      {
        id: 'mock-gpt-3.5-turbo',
        object: 'model',
        created: 1677610602,
        owned_by: 'mock-openai',
      },
      {
        id: 'mock-gpt-4',
        object: 'model',
        created: 1677610602,
        owned_by: 'mock-openai',
      }
    ]
  };

  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(models));
}

const server = http.createServer((req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    res.end();
    return;
  }

  // Health check
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', message: 'Mock OpenAI-compatible API is running' }));
    return;
  }

  // Models endpoint
  if (req.url === '/v1/models' && req.method === 'GET') {
    handleModels(req, res);
    return;
  }

  // Chat completions endpoint
  if (req.url === '/v1/chat/completions' && req.method === 'POST') {
    let body = '';

    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const stream = data.stream || false;
        handleChatCompletions(req, res, body, stream);
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: 'Invalid JSON' } }));
      }
    });
    return;
  }

  // 404 for unknown endpoints
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: { message: 'Not found' } }));
});

server.listen(PORT, () => {
  console.log(`Mock OpenAI-compatible API server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Models: http://localhost:${PORT}/v1/models`);
  console.log(`Chat: http://localhost:${PORT}/v1/chat/completions`);
});
