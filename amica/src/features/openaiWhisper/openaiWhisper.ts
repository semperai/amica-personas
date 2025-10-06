import { config } from '@/utils/config';

export async function openaiWhisper(
  file: File,
  prompt?: string,
) {
  const apiKey = config("openai_whisper_apikey");
  if (!apiKey) {
    throw new Error("Invalid OpenAI Whisper API Key");
  }

  // Request body
  const formData = new FormData();
  formData.append('file', file);
  formData.append('model', config('openai_whisper_model'));
  formData.append('language', 'en');
  if (prompt) {
    formData.append('prompt', prompt);
  }

  const url = `${config("openai_whisper_url")}/v1/audio/transcriptions`;
  console.debug('whisper-openai req', { url, model: config('openai_whisper_model'), fileSize: file.size });

  try {
    const res = await fetch(url, {
      method: "POST",
      body: formData,
      headers: {
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

      console.error('OpenAI Whisper API Error:', {
        status: res.status,
        statusText: res.statusText,
        url,
        fileSize: file.size,
        fileName: file.name,
        headers: Object.fromEntries(res.headers.entries()),
        errorDetails
      });

      throw new Error(`OpenAI Whisper API Error: ${errorDetails}`);
    }

    const data = await res.json();
    console.debug('whisper-openai res', data);

    return { text: data.text.trim() };
  } catch (e) {
    console.error('OpenAI Whisper Error:', e);
    if (e instanceof Error && e.message.includes('OpenAI Whisper API Error')) {
      throw e; // Re-throw API errors with details
    }
    throw new Error(`OpenAI Whisper Error: ${e instanceof Error ? e.message : String(e)}`);
  }
}
