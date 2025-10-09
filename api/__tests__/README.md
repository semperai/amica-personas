# API Test Suite

Comprehensive test suite for the Amica API.

## Test Structure

```
__tests__/
├── utils/
│   ├── testHelpers.ts      # Mock request/response helpers and utilities
│   ├── mockEnv.ts          # Mock environment configuration
│   ├── fetchWithRetry.test.ts  # Tests for fetch retry utility
├── middleware/
│   └── authorizationCheck.test.ts  # Authorization middleware tests
├── endpoints/
│   ├── chat.test.ts        # Chat completion endpoint tests
│   ├── tts.test.ts         # Text-to-speech endpoint tests
│   └── whisper.test.ts     # Speech-to-text endpoint tests
└── README.md              # This file
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run tests with UI
npm run test:ui
```

## Test Coverage

The test suite covers:

### Utilities
- **fetchWithRetry**: Network request retry logic
  - Successful requests
  - Client error handling (4xx - no retry)
  - Server error handling (5xx - with retry)
  - Network error handling (with retry)
  - Timeout handling
  - Error message formatting

### Middleware
- **Authorization Check**: Request authentication and credit management
  - Authorization header parsing
  - API key validation
  - Credit tracking and deduction
  - Plan tier handling (anon, free, pro)
  - IP-based rate limiting

### Endpoints

#### Chat (`/v1/chat/completions`)
- Message validation
- Empty message filtering
- Credit validation
- Streaming response handling
- Error handling (400, timeout, network)

#### TTS (`/v1/audio/speech`)
- Text parameter validation
- Credit checking
- Audio streaming
- Voice parameter handling
- Error handling (400, 401, 429, timeout)

#### Whisper/STT (`/v1/audio/transcriptions`)
- File upload validation
- Audio format validation
- Credit checking
- Transcription response handling
- Multipart form-data handling
- Language parameter support
- Error handling (400, 401, 413, timeout)

## Test Utilities

### Mock Helpers

**createMockRequest(overrides)**
- Creates a mock Express request object
- Accepts partial overrides for customization

**createMockResponse()**
- Creates a mock Express response object
- Includes spies for all response methods

**createMockStreamResponse()**
- Creates a mock streaming response
- Captures chunks written to response

**mockFetch(response, status, ok)**
- Mocks global fetch with a simple response

**mockStreamingFetch(chunks)**
- Mocks fetch with a streaming response
- Accepts array of chunks to stream

**waitFor(ms)**
- Utility for waiting in async tests

### Environment Mocking

The `mockEnv` object provides test environment variables:
- Database configuration
- API keys and URLs
- Credit limits
- Timeout values
- Feature flags

## Writing New Tests

1. Import test utilities:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest, createMockResponse } from "../utils/testHelpers";
import { setupMockEnv } from "../utils/mockEnv";
```

2. Set up mocks:
```typescript
setupMockEnv();

vi.mock("@/metrics", () => ({
  // Mock metrics
}));
```

3. Write test cases:
```typescript
describe("Feature name", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should do something", () => {
    // Test implementation
    expect(result).toBe(expected);
  });
});
```

## Best Practices

1. **Isolate tests**: Each test should be independent
2. **Mock external dependencies**: Use vi.mock() for modules
3. **Clear mocks**: Reset mocks between tests with vi.clearAllMocks()
4. **Test edge cases**: Include error conditions and boundary cases
5. **Use descriptive names**: Test names should describe what they're testing
6. **Keep tests focused**: One assertion per test when possible
7. **Async handling**: Use async/await for asynchronous tests

## Continuous Integration

Tests run automatically on:
- Pull requests
- Pushes to main branch
- Manual workflow dispatch

Coverage reports are generated and can be viewed in the `coverage/` directory.
