import { config } from '@/utils/config';

export async function openaiTTS(
  message: string,
) {
  const apiKey = config("openai_tts_apikey");
  if (!apiKey) {
    throw new Error("Invalid OpenAI TTS API Key");
  }

  try {
    const url = `${config("openai_tts_url")}/v1/audio/speech`;
    const model = config("openai_tts_model");
    const voice = config("openai_tts_voice");

    console.log('[TTS] OpenAI TTS request -', { url, model, voice, messageLength: message.length });

    const res = await fetch(url, {
      method: "POST",
      body: JSON.stringify({
        model,
        input: message,
        voice,
      }),
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
    });

    if (! res.ok) {
      // Try to get error details from response
      // Note: Intentionally not logging error response body to avoid exposing user message (PII)
      // Error responses from OpenAI may echo back the input text
      console.error('OpenAI TTS API Error:', {
        status: res.status,
        statusText: res.statusText,
        url,
        messageLength: message.length
      });

      throw new Error(`OpenAI TTS API Error: ${res.status} ${res.statusText}`);
    }

    const data = (await res.arrayBuffer()) as any;
    console.log('[TTS] OpenAI TTS response -', { audioSize: data.byteLength });

    return { audio: data };
  } catch (e) {
    console.error('OpenAI TTS Error:', e);
    if (e instanceof Error && e.message.includes('OpenAI TTS API Error')) {
      throw e; // Re-throw API errors with details
    }
    throw new Error(`OpenAI TTS Error: ${e instanceof Error ? e.message : String(e)}`);
  }
}
