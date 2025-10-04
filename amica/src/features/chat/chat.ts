import { Message, Role, Screenplay, Talk, textsToScreenplay } from "./messages";
import { SceneCoordinator } from "@/features/scene3d/SceneCoordinator";
import { Alert } from "@/features/alert/alert";
import { HookManager } from "@/features/hooks/hookManager";

import { getEchoChatResponseStream } from "./echoChat";
import {
  getArbiusChatResponseStream,
} from "./arbiusChat";
import {
  getOpenAiChatResponseStream,
  getOpenAiVisionChatResponse,
} from "./openAIChatProvider";
import {
  getLlamaCppChatResponseStream,
  getLlavaCppChatResponse,
} from "./llamaCppChat";
import { getWindowAiChatResponseStream } from "./windowAiChat";
import {
  getOllamaChatResponseStream,
  getOllamaVisionChatResponse,
} from "./ollamaChat";
import { getKoboldAiChatResponseStream } from "./koboldAIChatProvider";

import { rvc } from "@/features/rvc/rvc";
import { coquiLocal } from "@/features/coquiLocal/coquiLocal";
import { piper } from "@/features/piper/piper";
import { elevenlabs } from "@/features/elevenlabs/elevenlabs";
import { speecht5 } from "@/features/speecht5/speecht5";
import { openaiTTS } from "@/features/openaiTTS/openaiTTS";
import { localXTTSTTS } from "@/features/localXTTS/localXTTS";

import { config } from "@/utils/config";
import { removeEmojiFromText } from "@/utils/removeEmojiFromText";
import { processResponse } from "@/utils/processResponse";
import { wait } from "@/utils/wait";
import {
  isCharacterIdle,
  characterIdleTime,
  resetIdleTimer,
} from "@/utils/isIdle";

type Speak = {
  audioBuffer: ArrayBuffer | null;
  screenplay: Screenplay;
  streamIdx: number;
};

type TTSJob = {
  screenplay: Screenplay;
  streamIdx: number;
};

export class Queue<T> {
  private items: T[] = [];

  enqueue(item: T): void {
    this.items.push(item);
  }

  dequeue(): T | undefined {
    return this.items.shift();
  }

  size(): number {
    return this.items.length;
  }

  clear(): void {
    this.items = [];
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }
}

export class Chat {
  public initialized: boolean;

  public viewer?: SceneCoordinator;
  public alert?: Alert;
  public hookManager: HookManager;

  public setChatLog?: (messageLog: Message[]) => void;
  public setUserMessage?: (message: string) => void;
  public setAssistantMessage?: (message: string) => void;
  public setShownMessage?: (role: Role) => void;
  public setChatProcessing?: (processing: boolean) => void;
  public setChatSpeaking?: (speaking: boolean) => void;

  // the message from the user that is currently being processed
  // it can be reset
  public stream: ReadableStream<Uint8Array> | null;
  public streams: ReadableStream<Uint8Array>[];
  public reader: ReadableStreamDefaultReader<Uint8Array> | null;
  public readers: ReadableStreamDefaultReader<Uint8Array>[];

  // process these immediately as they come in and add to audioToPlay
  public ttsJobs: Queue<TTSJob>;

  // this should be read as soon as they exist
  // and then deleted from the queue
  public speakJobs: Queue<Speak>;

  private currentAssistantMessage: string;
  private currentUserMessage: string;

  private lastAwake: number;

  public messageList: Message[];

  public currentStreamIdx: number;

  constructor() {
    this.initialized = false;

    this.stream = null;
    this.reader = null;
    this.streams = [];
    this.readers = [];

    this.ttsJobs = new Queue<TTSJob>();
    this.speakJobs = new Queue<Speak>();

    this.currentAssistantMessage = "";
    this.currentUserMessage = "";

    this.messageList = [];
    this.currentStreamIdx = 0;

    this.lastAwake = 0;

    this.hookManager = new HookManager();
  }

  public initialize(
    viewer: SceneCoordinator,
    alert: Alert,
    setChatLog: (messageLog: Message[]) => void,
    setUserMessage: (message: string) => void,
    setAssistantMessage: (message: string) => void,
    setShownMessage: (role: Role) => void,
    setChatProcessing: (processing: boolean) => void,
    setChatSpeaking: (speaking: boolean) => void,
  ) {
    this.viewer = viewer;
    this.viewer.chat = this; // Set bidirectional reference
    this.alert = alert;
    this.setChatLog = setChatLog;
    this.setUserMessage = setUserMessage;
    this.setAssistantMessage = setAssistantMessage;
    this.setShownMessage = setShownMessage;
    this.setChatProcessing = setChatProcessing;
    this.setChatSpeaking = setChatSpeaking;

    // these will run forever
    this.processTtsJobs();
    this.processSpeakJobs();

    this.updateAwake();
    this.initialized = true;
  }

  public setMessageList(messages: Message[]) {
    this.messageList = messages;
    this.currentAssistantMessage = "";
    this.currentUserMessage = "";
    this.setChatLog!(this.messageList!);
    this.setAssistantMessage!(this.currentAssistantMessage);
    this.setUserMessage!(this.currentAssistantMessage);
    this.currentStreamIdx++;
  }

  public async handleRvc(audio: any) {
    const rvcModelName = config("rvc_model_name");
    const rvcIndexPath = config("rvc_index_path");
    const rvcF0upKey = parseInt(config("rvc_f0_upkey"));
    const rvcF0Method = config("rvc_f0_method");
    const rvcIndexRate = config("rvc_index_rate");
    const rvcFilterRadius = parseInt(config("rvc_filter_radius"));
    const rvcResampleSr = parseInt(config("rvc_resample_sr"));
    const rvcRmsMixRate = parseInt(config("rvc_rms_mix_rate"));
    const rvcProtect = parseInt(config("rvc_protect"));

    const voice = await rvc(
      audio,
      rvcModelName,
      rvcIndexPath,
      rvcF0upKey,
      rvcF0Method,
      rvcIndexRate,
      rvcFilterRadius,
      rvcResampleSr,
      rvcRmsMixRate,
      rvcProtect,
    );

    return voice.audio;
  }

  public idleTime(): number {
    return characterIdleTime(this.lastAwake);
  }

  public isAwake() {
    return !isCharacterIdle(this.lastAwake);
  }

  public updateAwake() {
    this.lastAwake = new Date().getTime();
    resetIdleTimer();
  }

  public async processTtsJobs() {
    while (true) {
      do {
        const ttsJob = this.ttsJobs.dequeue();
        if (!ttsJob) {
          break;
        }

        if (ttsJob.streamIdx !== this.currentStreamIdx) {
          console.log("skipping tts for streamIdx");
          continue;
        }

        const audioBuffer = await this.fetchAudio(ttsJob.screenplay.talk);
        this.speakJobs.enqueue({
          audioBuffer,
          screenplay: ttsJob.screenplay,
          streamIdx: ttsJob.streamIdx,
        });
      } while (this.ttsJobs.size() > 0);
      await wait(50);
    }
  }

  public async processSpeakJobs() {
    while (true) {
      do {
        const speak = this.speakJobs.dequeue();
        if (!speak) {
          break;
        }
        if (speak.streamIdx !== this.currentStreamIdx) {
          console.log("skipping speak for streamIdx");
          continue;
        }

        if ((window as any).chatvrm_latency_tracker) {
          if ((window as any).chatvrm_latency_tracker.active) {
            const ms =
              +new Date() - (window as any).chatvrm_latency_tracker.start;
            console.log("performance_latency", ms);
            (window as any).chatvrm_latency_tracker.active = false;
          }
        }

        this.bubbleMessage("assistant", speak.screenplay.text);

        if (speak.audioBuffer) {
          this.setChatSpeaking!(true);
          await this.viewer!.model?.speak(speak.audioBuffer, speak.screenplay);
          this.setChatSpeaking!(false);
          this.isAwake() ? this.updateAwake() : null;
        }
      } while (this.speakJobs.size() > 0);
      await wait(50);
    }
  }

  public bubbleMessage(role: Role, text: string) {
    // TODO: currentUser & Assistant message should be contain the message with emotion in it

    if (role === "user") {
      // add space if there is already a partial message
      if (this.currentUserMessage !== "") {
        this.currentUserMessage += " ";
      }
      this.currentUserMessage += text;
      this.setUserMessage!(this.currentUserMessage);
      this.setAssistantMessage!("");

      if (this.currentAssistantMessage !== "") {
        this.messageList!.push({
          role: "assistant",
          content: this.currentAssistantMessage,
        });

        this.currentAssistantMessage = "";
      }

      this.setChatLog!([
        ...this.messageList!,
        { role: "user", content: this.currentUserMessage },
      ]);
    }

    if (role === "assistant") {
      this.currentAssistantMessage += text;
      this.setUserMessage!("");
      this.setAssistantMessage!(this.currentAssistantMessage);

      if (this.currentUserMessage !== "") {
        this.messageList!.push({
          role: "user",
          content: this.currentUserMessage,
        });

        this.currentUserMessage = "";
      }

      this.setChatLog!([
        ...this.messageList!,
        { role: "assistant", content: this.currentAssistantMessage },
      ]);
    }

    this.setShownMessage!(role);
  }

  public async interrupt() {
    this.currentStreamIdx++;
    try {
      if (this.reader) {
        console.debug("cancelling");
        if (!this.reader?.closed) {
          await this.reader?.cancel();
        }
        // this.reader = null;
        // this.stream = null;
        console.debug("finished cancelling");
      }
    } catch (e: any) {
      console.error(e.toString());
    }

    // TODO if llm type is llama.cpp, we can send /stop message here
    this.ttsJobs.clear();
    this.speakJobs.clear();
    // TODO stop viewer from speaking
  }

  // this happens either from text or from voice / whisper completion
  public async receiveMessageFromUser(message: string) {
    if (message === null || message === "") {
      return;
    }

    console.time("performance_interrupting");
    console.debug("interrupting...");
    await this.interrupt();
    console.timeEnd("performance_interrupting");
    await wait(0);
    console.debug("wait complete");

    console.log("receiveMessageFromUser", message);

    // Trigger before hook
    const beforeContext = await this.hookManager.trigger('before:user:message:receive', { message });
    message = beforeContext.message;

    if (!/\[.*?\]/.test(message)) {
      message = `[neutral] ${message}`;
    }

    this.updateAwake();
    this.bubbleMessage("user", message);

    // Trigger after hook
    await this.hookManager.trigger('after:user:message:receive', { message });

    // make new stream
    const messages: Message[] = [
      { role: "system", content: config("system_prompt") },
      ...this.messageList!,
      { role: "user", content: this.currentUserMessage },
    ];
    // console.debug('messages', messages);

    await this.makeAndHandleStream(messages);
  }

  public async makeAndHandleStream(messages: Message[]) {
    try {
      this.streams.push(await this.getChatResponseStream(messages));
    } catch (e: any) {
      const errMsg = e.toString();
      console.error(errMsg);
      this.alert?.error("Failed to get chat response", errMsg);
      return errMsg;
    }

    if (this.streams[this.streams.length - 1] == null) {
      const errMsg = "Error: Null stream encountered.";
      console.error(errMsg);
      this.alert?.error("Null stream encountered", errMsg);
      return errMsg;
    }

    return await this.handleChatResponseStream();
  }

  public async handleChatResponseStream() {
    if (this.streams.length === 0) {
      console.log("no stream!");
      return;
    }

    this.currentStreamIdx++;
    const streamIdx = this.currentStreamIdx;
    this.setChatProcessing!(true);

    // Trigger before stream hook
    await this.hookManager.trigger('before:llm:stream', { streamIdx });

    console.time("chat stream processing");
    let reader = this.streams[this.streams.length - 1].getReader();
    this.readers.push(reader);
    let sentences = new Array<string>();

    let aiTextLog = "";
    let tag = "";
    let rolePlay = "";
    let receivedMessage = "";

    let firstTokenEncountered = false;
    let firstSentenceEncountered = false;
    console.time("performance_time_to_first_token");
    console.time("performance_time_to_first_sentence");

    try {
      while (true) {
        if (this.currentStreamIdx !== streamIdx) {
          console.log("wrong stream idx");
          break;
        }
        const { done, value } = await reader.read();
        console.log("monkey", value);
        if (!firstTokenEncountered) {
          console.timeEnd("performance_time_to_first_token");
          firstTokenEncountered = true;
        }
        if (done) break;

        // Trigger chunk hook
        const chunkContext = await this.hookManager.trigger('on:llm:chunk', {
          chunk: value,
          streamIdx
        });

        receivedMessage += chunkContext.chunk;
        receivedMessage = receivedMessage.trimStart();

        const proc = processResponse({
          sentences,
          aiTextLog,
          receivedMessage,
          tag,
          rolePlay,
          callback: (aiTalks: Screenplay[]): boolean => {
            // Generate & play audio for each sentence, display responses
            if (streamIdx !== this.currentStreamIdx) {
              console.log("wrong stream idx");
              return true; // should break
            }
            this.ttsJobs.enqueue({
              screenplay: aiTalks[0],
              streamIdx: streamIdx,
            });

            if (!firstSentenceEncountered) {
              console.timeEnd("performance_time_to_first_sentence");
              firstSentenceEncountered = true;
            }

            return false; // normal processing
          },
        });

        sentences = proc.sentences;
        aiTextLog = proc.aiTextLog;
        receivedMessage = proc.receivedMessage;
        tag = proc.tag;
        rolePlay = proc.rolePlay;
        if (proc.shouldBreak) {
          break;
        }
      }

      // Trigger after completion hook
      await this.hookManager.trigger('after:llm:complete', {
        response: aiTextLog,
        streamIdx
      });
    } catch (e: any) {
      const errMsg = e.toString();
      this.bubbleMessage!("assistant", errMsg);
      console.error(errMsg);
    } finally {
      if (!reader.closed) {
        reader.releaseLock();
      }
      console.timeEnd("chat stream processing");
      if (streamIdx === this.currentStreamIdx) {
        this.setChatProcessing!(false);
      }
    }

    return aiTextLog;
  }

  async fetchAudio(talk: Talk): Promise<ArrayBuffer | null> {
    // TODO we should remove non-speakable characters
    // since this depends on the tts backend, we should do it
    // in their respective functions
    // this is just a simple solution for now
    talk = removeEmojiFromText(talk);
    if (talk.message.trim() === "" || config("tts_muted") === "true") {
      return null;
    }

    const ttsBackend = config("tts_backend");

    // Trigger before TTS hook
    const beforeContext = await this.hookManager.trigger('before:tts:generate', {
      text: talk.message,
      backend: ttsBackend
    });

    const rvcEnabled = config("rvc_enabled") === "true";

    let audioBuffer: ArrayBuffer | null = null;
    try {
      switch (ttsBackend) {
        case "none": {
          audioBuffer = null;
          break;
        }
        case "elevenlabs": {
          const voiceId = config("elevenlabs_voiceid");
          const voice = await elevenlabs(beforeContext.text, voiceId, talk.style);
          audioBuffer = rvcEnabled ? await this.handleRvc(voice.audio) : voice.audio;
          break;
        }
        case "speecht5": {
          const speakerEmbeddingUrl = config("speecht5_speaker_embedding_url");
          const voice = await speecht5(beforeContext.text, speakerEmbeddingUrl);
          audioBuffer = rvcEnabled ? await this.handleRvc(voice.audio) : voice.audio;
          break;
        }
        case "openai_tts": {
          const voice = await openaiTTS(beforeContext.text);
          audioBuffer = rvcEnabled ? await this.handleRvc(voice.audio) : voice.audio;
          break;
        }
        case "localXTTS": {
          const voice = await localXTTSTTS(beforeContext.text);
          audioBuffer = rvcEnabled ? await this.handleRvc(voice.audio) : voice.audio;
          break;
        }
        case "piper": {
          const voice = await piper(beforeContext.text);
          audioBuffer = rvcEnabled ? await this.handleRvc(voice.audio) : voice.audio;
          break;
        }
        case "coquiLocal": {
          const voice = await coquiLocal(beforeContext.text);
          audioBuffer = voice.audio;
          break;
        }
      }
    } catch (e: any) {
      console.error(e.toString());
      this.alert?.error("Failed to get TTS response", e.toString());
    }

    // Trigger after TTS hook
    const afterContext = await this.hookManager.trigger('after:tts:generate', {
      audioBuffer,
      text: beforeContext.text
    });

    return afterContext.audioBuffer;
  }

  public async getChatResponseStream(messages: Message[]) {
    console.debug("getChatResponseStream", messages);
    const chatbotBackend = config("chatbot_backend");

    // Trigger before hook
    const beforeContext = await this.hookManager.trigger('before:llm:request', {
      messages,
      backend: chatbotBackend
    });

    let stream: ReadableStream<Uint8Array>;
    switch (beforeContext.backend) {
      case "arbius_llm":
        stream = await getArbiusChatResponseStream(beforeContext.messages);
        break;
      case "chatgpt":
        stream = await getOpenAiChatResponseStream(beforeContext.messages);
        break;
      case "llamacpp":
        stream = await getLlamaCppChatResponseStream(beforeContext.messages);
        break;
      case "windowai":
        stream = await getWindowAiChatResponseStream(beforeContext.messages);
        break;
      case "ollama":
        stream = await getOllamaChatResponseStream(beforeContext.messages);
        break;
      case "koboldai":
        stream = await getKoboldAiChatResponseStream(beforeContext.messages);
        break;
      default:
        stream = await getEchoChatResponseStream(beforeContext.messages);
    }

    // Trigger after hook
    await this.hookManager.trigger('after:llm:request', {
      messages: beforeContext.messages,
      backend: beforeContext.backend
    });

    return stream;
  }

  public async getVisionResponse(imageData: string) {
    try {
      const visionBackend = config("vision_backend");

      console.debug("vision_backend", visionBackend);

      // Trigger before vision capture hook
      const beforeContext = await this.hookManager.trigger('before:vision:capture', { imageData });

      let res = "";
      if (visionBackend === "vision_llamacpp") {
        const messages: Message[] = [
          { role: "system", content: config("vision_system_prompt") },
          ...this.messageList!,
          {
            role: "user",
            content: "Describe the image as accurately as possible",
          },
        ];

        res = await getLlavaCppChatResponse(messages, beforeContext.imageData);
      } else if (visionBackend === "vision_ollama") {
        const messages: Message[] = [
          { role: "system", content: config("vision_system_prompt") },
          ...this.messageList!,
          {
            role: "user",
            content: "Describe the image as accurately as possible",
          },
        ];

        res = await getOllamaVisionChatResponse(messages, beforeContext.imageData);
      } else if (visionBackend === "vision_openai") {
        const messages: Message[] = [
          { role: "user", content: config("vision_system_prompt") },
          ...this.messageList! as any[],
          {
            role: "user",
            // @ts-ignore normally this is a string
            content: [
              {
                type: "text",
                text: "Describe the image as accurately as possible",
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${beforeContext.imageData}`,
                },
              },
            ],
          },
        ];

        res = await getOpenAiVisionChatResponse(messages);
      } else {
        console.warn("vision_backend not supported", visionBackend);
        return;
      }

      // Trigger after vision response hook
      const afterContext = await this.hookManager.trigger('after:vision:response', {
        response: res,
        imageData: beforeContext.imageData
      });

      await this.makeAndHandleStream([
        { role: "system", content: config("system_prompt") },
        ...this.messageList!,
        {
          role: "user",
          content: `This is a picture I just took from my webcam (described between [[ and ]] ): [[${afterContext.response}]] Please respond accordingly and as if it were just sent and as though you can see it.`,
        },
      ]);
    } catch (e: any) {
      console.error("getVisionResponse", e.toString());
      this.alert?.error("Failed to get vision response", e.toString());
    }
  }
}
