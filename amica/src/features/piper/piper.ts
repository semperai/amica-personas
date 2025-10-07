import { config } from '@/utils/config';

export async function piper(
    message: string,
  ) {
    try {
      const url = new URL(config("piper_url"));
      url.searchParams.append('text', message);

      console.log('[TTS] Piper request -', { url: url.toString(), messageLength: message.length });

      const res = await fetch(url.toString());

      if (!res.ok) {
        console.error('[TTS] Piper error:', res.status, res.statusText);
        throw new Error(`Piper API Error (${res.status})`);
      }

      const data = (await res.arrayBuffer()) as any;
      console.log('[TTS] Piper response -', { audioSize: data.byteLength });

      return { audio: data };
    } catch (error) {
      console.error('[TTS] Piper error:', error);
      throw error;
    }
  }