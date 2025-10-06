import { Message } from "./messages";
import { buildPrompt, buildVisionPrompt } from "@/utils/constructLLMPrompt";
import { config } from '@/utils/config';

export async function getLlamaCppChatResponseStream(messages: Message[]) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Connection": "keep-alive",
    "Accept": "text/event-stream",
  };
  const prompt = buildPrompt(messages);
  const stop: string[] = [`${config("name")}:`, ...`${config("llamacpp_stop_sequence")}`.split("||")];

  const requestUrl = `${config("llamacpp_url")}/completion`;
  const requestBody = {
    stream: true,
    n_predict: 400,
    temperature: 0.7,
    cache_prompt: true,
    stop,
    prompt,
  };

  console.log('[LlamaCpp] Starting chat request', {
    url: requestUrl,
    messageCount: messages.length,
    promptLength: prompt.length,
  });

  let res;
  try {
    res = await fetch(requestUrl, {
      headers: headers,
      method: "POST",
      body: JSON.stringify(requestBody),
    });
    console.log('[LlamaCpp] Fetch completed', {
      status: res.status,
      statusText: res.statusText,
      ok: res.ok,
      headers: Object.fromEntries(res.headers.entries()),
    });
  } catch (error: any) {
    console.error('[LlamaCpp] Fetch failed', {
      url: requestUrl,
      error: error.message,
      errorType: error.name,
      stack: error.stack,
    });
    throw new Error(`Network error connecting to LlamaCpp (${config("llamacpp_url")}): ${error.message}`);
  }

  const reader = res.body?.getReader();
  if (res.status !== 200 || ! reader) {
    console.error('[LlamaCpp] Invalid response', {
      status: res.status,
      statusText: res.statusText,
      hasBody: !!res.body,
    });
    throw new Error(`LlamaCpp chat error (${res.status}): ${res.statusText}`);
  }

  console.log('[LlamaCpp] Stream reader created successfully');

  const stream = new ReadableStream({
    async start(controller: ReadableStreamDefaultController) {
      const decoder = new TextDecoder("utf-8");
      try {
        // sometimes the response is chunked, so we need to combine the chunks
        let combined = "";
        let cont = true;
        while (true) {
          const { done, value } = await reader.read();
          if (done || ! cont) break;
          const data = decoder.decode(value);
          const chunks = data
            .split("data:")
            .filter((val) => !!val && val.trim() !== "[DONE]");

          for (const chunk of chunks) {
            // skip comments
            if (chunk.length > 0 && chunk[0] === ":") {
              continue;
            }
            combined += chunk;

            try {
              const json = JSON.parse(combined);
              if (json.stop) {
                cont = false;
              }
              const messagePiece = json.content;
              combined = "";
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

export async function getLlavaCppChatResponse(messages: Message[], imageData: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Connection": "keep-alive",
    "Accept": "text/event-stream",
  };
  const prompt = buildVisionPrompt(messages);

  const requestUrl = `${config("vision_llamacpp_url")}/completion`;
  const requestBody = {
    stream: true,
    n_predict: 400,
    temperature: 0.7,
    cache_prompt: true,
    stop: [
      "</s>",
      `${config('name')}:`,
      "User:"
    ],
    image_data: [{
      data: imageData,
      id: 10,
    }],
    prompt,
  };

  console.log('[LlamaCpp Vision] Starting vision request', {
    url: requestUrl,
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
    console.log('[LlamaCpp Vision] Fetch completed', {
      status: res.status,
      statusText: res.statusText,
      ok: res.ok,
      headers: Object.fromEntries(res.headers.entries()),
    });
  } catch (error: any) {
    console.error('[LlamaCpp Vision] Fetch failed', {
      url: requestUrl,
      error: error.message,
      errorType: error.name,
      stack: error.stack,
    });
    throw new Error(`Network error connecting to LlamaCpp Vision (${config("vision_llamacpp_url")}): ${error.message}`);
  }

  if (! res.ok) {
    console.error('[LlamaCpp Vision] Invalid response', {
      status: res.status,
      statusText: res.statusText,
    });
    throw new Error(`LlamaCpp llava chat error (${res.status}): ${res.statusText}`);
  }

  const reader = res.body?.getReader();
  if (res.status !== 200 || ! reader) {
    console.error('[LlamaCpp Vision] Stream error', {
      status: res.status,
      hasBody: !!res.body,
    });
    throw new Error(`LlamaCpp vision error (${res.status}): ${res.statusText}`);
  }

  console.log('[LlamaCpp Vision] Stream reader created successfully');

  // Fetch the original image
  const stream = new ReadableStream({
    async start(controller: ReadableStreamDefaultController) {
      const decoder = new TextDecoder("utf-8");
      try {
        // sometimes the response is chunked, so we need to combine the chunks
        let combined = "";
        let cont = true;
        while (true) {
          const { done, value } = await reader.read();
          if (done || ! cont) break;
          const data = decoder.decode(value);
          const chunks = data
            .split("data:")
            .filter((val) => !!val && val.trim() !== "[DONE]");

          for (const chunk of chunks) {
            // skip comments
            if (chunk.length > 0 && chunk[0] === ":") {
              continue;
            }
            combined += chunk;

            try {
              const json = JSON.parse(combined);
              if (json.stop) {
                cont = false;
              }
              const messagePiece = json.content;
              combined = "";
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

  const sreader = await stream.getReader();

  let combined = "";
  while (true) {
    const { done, value } = await sreader.read();
    if (done) break;
    combined += value;
  }

  return combined;
}
