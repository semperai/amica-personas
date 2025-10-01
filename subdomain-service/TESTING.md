# Testing Guide

## Overview

The subdomain service includes comprehensive test coverage for all core functionality.

## Test Structure

```
src/__tests__/
├── utils.test.ts              # Unit tests for utility functions
├── amica-config-keys.test.ts  # Tests for config key validation
├── graphql.test.ts            # GraphQL query structure tests
└── server.test.ts             # Integration tests for server endpoints
```

## Running Tests

### All tests
```bash
npm test
```

### Watch mode
```bash
npm run test:watch
```

### Coverage report
```bash
npm run test:coverage
```

### Type checking
```bash
npm run typecheck
```

## Test Coverage

The test suite includes:

### Unit Tests (`utils.test.ts`)

**parseSubdomain**:
- ✓ Parses valid subdomains
- ✓ Handles www subdomain
- ✓ Returns null for root domain
- ✓ Returns null for localhost
- ✓ Handles nested subdomains

**getAmicaVersion**:
- ✓ Returns version from metadata
- ✓ Returns default version when not specified
- ✓ Handles undefined/empty metadata
- ✓ Supports future versions

**buildAmicaConfig**:
- ✓ Builds config from persona data
- ✓ Converts metadata array to object
- ✓ Handles personas without metadata
- ✓ Handles graduated personas

**injectConfig**:
- ✓ Injects script before `</head>`
- ✓ Injects at beginning of `<body>` if no `</head>`
- ✓ Injects persona name as localStorage
- ✓ Dynamically injects all valid metadata
- ✓ Rejects invalid config keys
- ✓ Stores full persona config in `window.__AMICA_PERSONA__`
- ✓ Properly escapes JSON strings
- ✓ Handles empty metadata
- ✓ Tests all config keys dynamically

### Config Key Tests (`amica-config-keys.test.ts`)

**AMICA_CONFIG_KEYS**:
- ✓ Contains expected config keys
- ✓ Contains API-related keys
- ✓ Has unique values
- ✓ Not empty

**isValidConfigKey**:
- ✓ Returns true for valid keys
- ✓ Returns false for invalid keys
- ✓ Case sensitive validation
- ✓ Handles special characters
- ✓ Validates all keys in AMICA_CONFIG_KEYS

### GraphQL Tests (`graphql.test.ts`)

**GET_PERSONA_BY_DOMAIN**:
- ✓ Valid GraphQL query structure
- ✓ Contains required query parameters
- ✓ Queries for required fields
- ✓ Includes metadata fields
- ✓ Uses correct where clause
- ✓ Limits to 1 result

### Integration Tests (`server.test.ts`)

**Root domain**:
- ✓ Shows landing page for root domain
- ✓ Shows landing page for www subdomain

**Persona subdomain**:
- ✓ Loads persona when found
- ✓ Returns 404 when persona not found
- ✓ Returns 500 on GraphQL error
- ✓ Handles different subdomains
- ✓ Serves static files for valid persona

**Error Handling**:
- ✓ Handles network errors gracefully
- ✓ Handles timeout errors
- ✓ Handles malformed GraphQL responses

## Coverage Thresholds

The project maintains minimum coverage thresholds:

- **Branches**: 80%
- **Functions**: 80%
- **Lines**: 80%
- **Statements**: 80%

## Writing New Tests

### Adding a new utility function

1. Add the function to `src/utils.ts`
2. Add tests to `src/__tests__/utils.test.ts`:

```typescript
describe('myNewFunction', () => {
  test('should handle basic case', () => {
    expect(myNewFunction('input')).toBe('output');
  });

  test('should handle edge case', () => {
    expect(myNewFunction(null)).toBeNull();
  });
});
```

### Adding a new config key

1. Add the key to `src/amica-config-keys.ts`
2. The existing tests automatically validate all keys
3. Optionally add specific test in `amica-config-keys.test.ts`

### Testing server endpoints

1. Mock the GraphQL client response
2. Create a test request with proper hostname
3. Assert on response status and content

```typescript
test('should handle new endpoint', async () => {
  mockRequest.mockResolvedValue(mockData);
  const app = createTestServer();

  const response = await request(app)
    .get('/new-endpoint')
    .set('Host', 'test.amica.bot');

  expect(response.status).toBe(200);
  expect(response.text).toContain('Expected content');
});
```

## Debugging Tests

### Run specific test file
```bash
npm test utils.test.ts
```

### Run specific test suite
```bash
npm test -- -t "parseSubdomain"
```

### Run with verbose output
```bash
npm test -- --verbose
```

### Debug in VS Code

Add to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Jest Debug",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand", "--no-cache"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

## Continuous Integration

Tests should be run in CI/CD pipelines before deployment:

```yaml
# Example GitHub Actions
- name: Run tests
  run: |
    npm install
    npm run typecheck
    npm run test:coverage
```

## Mocking GraphQL

The server tests use mocked GraphQL responses to avoid network calls:

```typescript
import { GraphQLClient } from 'graphql-request';
jest.mock('graphql-request');

const MockedGraphQLClient = GraphQLClient as jest.MockedClass<typeof GraphQLClient>;
const mockRequest = jest.fn();
MockedGraphQLClient.prototype.request = mockRequest;

// In test:
mockRequest.mockResolvedValue({ personas: [...] });
```

## Test Data

Mock persona data is defined in `server.test.ts`:

```typescript
const mockPersonaData = {
  personas: [{
    id: '1',
    tokenId: '123',
    name: 'Cool Agent',
    // ... other fields
    metadata: [
      { key: 'system_prompt', value: 'You are a cool AI' },
      // ... other metadata
    ]
  }]
};
```

## Best Practices

1. **Test behavior, not implementation**: Test what the function does, not how it does it
2. **Use descriptive test names**: Names should explain what is being tested
3. **One assertion per test**: Keep tests focused and simple
4. **Mock external dependencies**: Don't make real network calls or file system operations
5. **Test edge cases**: Empty inputs, null values, large values, etc.
6. **Keep tests fast**: Tests should run in milliseconds, not seconds
7. **Update tests when code changes**: Tests are documentation of expected behavior

## Common Issues

### Tests fail with "Cannot find module"
- Run `npm install` to ensure all dependencies are installed
- Check that TypeScript has compiled: `npm run build`

### Tests timeout
- Check for async operations without proper awaits
- Increase timeout in jest.config.js if needed

### Coverage below threshold
- Add tests for uncovered branches
- Check coverage report: `npm run test:coverage`
- View HTML report: `open coverage/lcov-report/index.html`

## Future Improvements

- [ ] E2E tests with real Amica builds
- [ ] Performance benchmarks
- [ ] Load testing for concurrent requests
- [ ] Visual regression testing for error pages
- [ ] Security testing for XSS/injection
