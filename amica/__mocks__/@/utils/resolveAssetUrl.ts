// Manual mock for utils/resolveAssetUrl to avoid import.meta issues in Jest

export let mockBaseUrl = '/';

export function buildUrl(path: string): string {
  const root = mockBaseUrl || '/';
  return root + path;
}

// Helper for tests to set BASE_URL
export function setMockBaseUrl(url: string): void {
  mockBaseUrl = url;
}
