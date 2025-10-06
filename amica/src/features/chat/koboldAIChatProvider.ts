import { Message } from "./messages";
import { buildPrompt } from "@/utils/constructLLMPrompt";
import { config } from '@/utils/config';

export async function getKoboldAiChatResponseStream(messages: Message[]) {
  if (config("koboldai_use_extra") === 'true') {
    return getExtra(messages);
  } else {
    return getNormal(messages);
  }
}

// koboldcpp / stream support
async function getExtra(messages: Message[]) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const prompt = buildPrompt(messages);
  const stop_sequence: string[] = [`${config("name")}:`, ...`${config("koboldai_stop_sequence")}`.split("||")];

  const requestUrl = `${config("koboldai_url")}/api/extra/generate/stream`;
  const requestBody = {
    prompt,
    stop_sequence
  };

  console.log('[KoboldAI Extra] Starting chat request', {
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
    console.log('[KoboldAI Extra] Fetch completed', {
      status: res.status,
      statusText: res.statusText,
      ok: res.ok,
      headers: Object.fromEntries(res.headers.entries()),
    });
  } catch (error: any) {
    console.error('[KoboldAI Extra] Fetch failed', {
      url: requestUrl,
      error: error.message,
      errorType: error.name,
      stack: error.stack,
    });
    throw new Error(`Network error connecting to KoboldAI (${config("koboldai_url")}): ${error.message}`);
  }

  const reader = res.body?.getReader();
  if (res.status !== 200 || ! reader) {
    console.error('[KoboldAI Extra] Invalid response', {
      status: res.status,
      statusText: res.statusText,
      hasBody: !!res.body,
    });
    throw new Error(`KoboldAi chat error (${res.status}): ${res.statusText}`);
  }

  console.log('[KoboldAI Extra] Stream reader created successfully');

  const stream = new ReadableStream({
    async start(controller: ReadableStreamDefaultController) {
      const decoder = new TextDecoder("utf-8");
      try {
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value);

          let eolIndex;
          while ((eolIndex = buffer.indexOf('\n')) >= 0) {
            const line = buffer.substring(0, eolIndex).trim();
            buffer = buffer.substring(eolIndex + 1);

            if (line.startsWith('data:')) {
              try {
                const json = JSON.parse(line.substring(5));
                const messagePiece = json.token;
                if (messagePiece) {
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
                  console.error("JSON parsing error:", error, "in line:", line);
                }
              }
            }
          }
        }
      } catch (error) {
        console.error("Stream error:", error);
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

// koboldai / no stream support
async function getNormal(messages: Message[]) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const prompt = buildPrompt(messages);
  const stop_sequence: string[] = [`${config("name")}:`, ...`${config("koboldai_stop_sequence")}`.split("||")];

  const requestUrl = `${config("koboldai_url")}/api/v1/generate`;
  const requestBody = {
    prompt,
    stop_sequence
  };

  console.log('[KoboldAI] Starting chat request', {
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
    console.log('[KoboldAI] Fetch completed', {
      status: res.status,
      statusText: res.statusText,
      ok: res.ok,
      headers: Object.fromEntries(res.headers.entries()),
    });
  } catch (error: any) {
    console.error('[KoboldAI] Fetch failed', {
      url: requestUrl,
      error: error.message,
      errorType: error.name,
      stack: error.stack,
    });
    throw new Error(`Network error connecting to KoboldAI (${config("koboldai_url")}): ${error.message}`);
  }

  if (res.status !== 200) {
    console.error('[KoboldAI] Invalid response', {
      status: res.status,
      statusText: res.statusText,
    });
    throw new Error(`KoboldAI chat error (${res.status}): ${res.statusText}`);
  }

  console.log('[KoboldAI] Parsing response JSON');
  const json = await res.json();
  if (json.results.length === 0) {
    console.error('[KoboldAI] Empty results array');
    throw new Error(`KoboldAi result length 0`);
  }

  const text = json.results.map((row: {text: string}) => row.text).join('');

  const stream = new ReadableStream({
    async start(controller: ReadableStreamDefaultController) {
      try {
        text.split(' ').map((word: string) => word + ' ').forEach((word: string) => {
          try {
            controller.enqueue(word);
          } catch (enqueueError: any) {
            // Controller may be closed if stream was cancelled
            if (enqueueError?.code !== 'ERR_INVALID_STATE') {
              throw enqueueError;
            }
          }
        });
      } catch (error) {
        controller.error(error);
      } finally {
        controller.close();
      }
    },
  });

  return stream;
}
