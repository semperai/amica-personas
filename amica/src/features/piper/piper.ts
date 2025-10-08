import { config } from '@/utils/config';

export async function piper(
    message: string,
  ) {
    try {
      const baseUrl = config("piper_url");
      const url = new URL(baseUrl);
      url.searchParams.append('text', message);

      // Note: Using GET with query params for compatibility with existing Piper server
      // Security considerations:
      // - Message content is exposed in URL (server logs, browser history, proxies)
      // - URL length limits may truncate long messages
      // Consider migrating to POST with body if server supports it
      console.log('[TTS] Piper request -', { baseUrl, messageLength: message.length });

      const res = await fetch(url.toString());

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        console.error('[TTS] Piper error:', res.status, res.statusText, errorText);
        throw new Error(`Piper API Error (${res.status}: ${res.statusText})`);
      }

      const data = await res.arrayBuffer();
      console.log('[TTS] Piper response -', { audioSize: data.byteLength });

      return { audio: data };
    } catch (error) {
      console.error('[TTS] Piper error:', error);
      throw error;
    }
  }