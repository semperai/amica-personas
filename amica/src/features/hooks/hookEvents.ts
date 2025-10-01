/**
 * Hook Events - All available hook points in the Amica pipeline
 */

export type HookEvent =
  // User Input Pipeline
  | 'before:user:message:receive'
  | 'after:user:message:receive'
  | 'before:stt:transcribe'
  | 'after:stt:transcribe'

  // LLM Pipeline
  | 'before:llm:request'
  | 'after:llm:request'
  | 'before:llm:stream'
  | 'on:llm:chunk'
  | 'after:llm:complete'

  // TTS Pipeline
  | 'before:tts:generate'
  | 'after:tts:generate'
  | 'before:rvc:process'
  | 'after:rvc:process'

  // Character Animation Pipeline
  | 'before:speak:start'
  | 'after:speak:end'
  | 'on:expression:change'
  | 'on:animation:play'

  // Vision Pipeline
  | 'before:vision:capture'
  | 'after:vision:response'

  // Scenario Lifecycle
  | 'scenario:loaded'
  | 'scenario:setup:complete'
  | 'scenario:update'
  | 'scenario:unload';

export type HookEventMap = {
  'before:user:message:receive': { message: string };
  'after:user:message:receive': { message: string };
  'before:stt:transcribe': { audio: Float32Array };
  'after:stt:transcribe': { transcript: string };

  'before:llm:request': { messages: any[]; backend: string };
  'after:llm:request': { messages: any[]; backend: string };
  'before:llm:stream': { streamIdx: number };
  'on:llm:chunk': { chunk: string; streamIdx: number };
  'after:llm:complete': { response: string; streamIdx: number };

  'before:tts:generate': { text: string; backend: string };
  'after:tts:generate': { audioBuffer: ArrayBuffer | null; text: string };
  'before:rvc:process': { audio: any };
  'after:rvc:process': { audio: any };

  'before:speak:start': { audioBuffer: ArrayBuffer | null; screenplay: any };
  'after:speak:end': { screenplay: any };
  'on:expression:change': { expression: string };
  'on:animation:play': { animation: string };

  'before:vision:capture': { imageData: string };
  'after:vision:response': { response: string; imageData: string };

  'scenario:loaded': { scenarioName: string };
  'scenario:setup:complete': { scenarioName: string };
  'scenario:update': { delta: number };
  'scenario:unload': { scenarioName: string };
};
