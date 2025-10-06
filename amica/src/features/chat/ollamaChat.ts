import { Message } from "./messages";
import { buildPrompt } from "@/utils/constructLLMPrompt";
import { config } from '@/utils/config';

export async function getOllamaChatResponseStream(messages: Message[]) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const requestUrl = `${config("ollama_url")}/api/chat`;
  const requestBody = {
    model: config("ollama_model"),
    messages,
  };

  console.log('[Ollama] Starting chat request', {
    url: requestUrl,
    model: config("ollama_model"),
    messageCount: messages.length,
  });

  let res;
  try {
    res = await fetch(requestUrl, {
      headers: headers,
      method: "POST",
      body: JSON.stringify(requestBody),
    });
    console.log('[Ollama] Fetch completed', {
      status: res.status,
      statusText: res.statusText,
      ok: res.ok,
      headers: Object.fromEntries(res.headers.entries()),
    });
  } catch (error: any) {
    console.error('[Ollama] Fetch failed', {
      url: requestUrl,
      error: error.message,
      errorType: error.name,
      stack: error.stack,
    });
    throw new Error(`Network error connecting to Ollama (${config("ollama_url")}): ${error.message}`);
  }

  const reader = res.body?.getReader();
  if (res.status !== 200 || ! reader) {
    console.error('[Ollama] Invalid response', {
      status: res.status,
      statusText: res.statusText,
      hasBody: !!res.body,
    });
    throw new Error(`Ollama chat error (${res.status}): ${res.statusText}`);
  }

  console.log('[Ollama] Stream reader created successfully');

  const stream = new ReadableStream({
    async start(controller: ReadableStreamDefaultController) {
      const decoder = new TextDecoder("utf-8");
      try {
        // Ollama sends chunks of multiple complete JSON objects separated by newlines
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const data = decoder.decode(value);
          const jsonResponses = data
            .trim() // Ollama sends an empty line after the final JSON message...
            .split("\n")
            //.filter((val) => !!val) 

          for (const jsonResponse of jsonResponses) {
            try {
              const json = JSON.parse(jsonResponse);
              const messagePiece = json.message.content;
              if (!!messagePiece) {
                try {
                  controller.enqueue(messagePiece);
                } catch (enqueueError: any) {
                  // Controller may be closed if stream was cancelled
                  if (enqueueError?.code !== 'ERR_INVALID_STATE') {
                    throw enqueueError;
                  }
                }
              }
            } catch (error) {
              // Ignore JSON parsing errors for incomplete chunks
              if (!(error instanceof SyntaxError)) {
                console.error(error);
              }
            }
          }
        }
      } catch (error) {
        console.error(error);
        controller.error(error);
      } finally {
        reader.releaseLock();
        controller.close();
      }
    },
    async cancel() {
      await reader?.cancel();
      reader.releaseLock();
    }
  });

  return stream;
}

export async function getOllamaVisionChatResponse(messages: Message[], imageData: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const requestUrl = `${config("vision_ollama_url")}/api/chat`;
  const requestBody = {
    model: config("vision_ollama_model"),
    messages,
    images: [imageData],
    stream: false,
  };

  console.log('[Ollama Vision] Starting vision request', {
    url: requestUrl,
    model: config("vision_ollama_model"),
    messageCount: messages.length,
    hasImageData: !!imageData,
  });

  let res;
  try {
    res = await fetch(requestUrl, {
      headers: headers,
      method: "POST",
      body: JSON.stringify(requestBody),
    });
    console.log('[Ollama Vision] Fetch completed', {
      status: res.status,
      statusText: res.statusText,
      ok: res.ok,
      headers: Object.fromEntries(res.headers.entries()),
    });
  } catch (error: any) {
    console.error('[Ollama Vision] Fetch failed', {
      url: requestUrl,
      error: error.message,
      errorType: error.name,
      stack: error.stack,
    });
    throw new Error(`Network error connecting to Ollama Vision (${config("vision_ollama_url")}): ${error.message}`);
  }

  if (res.status !== 200) {
    console.error('[Ollama Vision] Invalid response', {
      status: res.status,
      statusText: res.statusText,
    });
    throw new Error(`Ollama chat error (${res.status}): ${res.statusText}`);
  }

  console.log('[Ollama Vision] Parsing response JSON');
  const json = await res.json();
  return json.response;
}
