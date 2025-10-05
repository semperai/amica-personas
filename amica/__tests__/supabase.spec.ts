import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @supabase/supabase-js before importing
const mockCreateClient = vi.fn((url: string, key: string) => ({
  _url: url,
  _key: key,
  from: vi.fn(),
  auth: {
    signIn: vi.fn(),
    signOut: vi.fn(),
  },
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: mockCreateClient,
}));

describe('supabase', () => {
  it('should create supabase client with environment variables', async () => {
    const { supabase } = await import('@/utils/supabase');

    expect(mockCreateClient).toHaveBeenCalled();
    expect(supabase).toBeDefined();
  });

  it('should initialize with URL and key parameters', async () => {
    const { supabase } = await import('@/utils/supabase');

    expect(mockCreateClient).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String)
    );
    expect(supabase).toBeDefined();
  });

  it('should export a supabase client instance', async () => {
    const { supabase } = await import('@/utils/supabase');

    expect(supabase).toBeDefined();
    expect(typeof supabase).toBe('object');
  });

  it('should have auth methods on the client', async () => {
    const { supabase } = await import('@/utils/supabase');

    expect(supabase.auth).toBeDefined();
  });

  it('should have from method on the client', async () => {
    const { supabase } = await import('@/utils/supabase');

    expect(supabase.from).toBeDefined();
    expect(typeof supabase.from).toBe('function');
  });
});
