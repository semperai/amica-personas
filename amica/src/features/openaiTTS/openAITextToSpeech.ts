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
    console.debug('openai-tts request', { url, model: config("openai_tts_model"), voice: config("openai_tts_voice") });

    const res = await fetch(url, {
      method: "POST",
      body: JSON.stringify({
        model: config("openai_tts_model"),
        input: message,
        voice: config("openai_tts_voice"),
      }),
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
    });

    if (! res.ok) {
      // Try to get error details from response
      let errorDetails = `HTTP ${res.status} ${res.statusText}`;
      try {
        const contentType = res.headers.get("content-type");
        if (contentType?.includes("application/json")) {
          const errorJson = await res.json();
          errorDetails += ` - ${JSON.stringify(errorJson)}`;
        } else {
          const errorText = await res.text();
          errorDetails += ` - ${errorText.substring(0, 200)}`;
        }
      } catch (parseErr) {
        // If we can't parse the error, just use status
      }

      console.error('OpenAI TTS API Error:', {
        status: res.status,
        statusText: res.statusText,
        url,
        headers: Object.fromEntries(res.headers.entries()),
        errorDetails
      });

      throw new Error(`OpenAI TTS API Error: ${errorDetails}`);
    }

    const data = (await res.arrayBuffer()) as any;
    console.debug('openai-tts success', { size: data.byteLength });

    return { audio: data };
  } catch (e) {
    console.error('OpenAI TTS Error:', e);
    if (e instanceof Error && e.message.includes('OpenAI TTS API Error')) {
      throw e; // Re-throw API errors with details
    }
    throw new Error(`OpenAI TTS Error: ${e instanceof Error ? e.message : String(e)}`);
  }
}
