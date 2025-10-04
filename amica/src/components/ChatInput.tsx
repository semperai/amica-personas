import { useContext, useEffect, useRef, useState } from "react";
import { useMicVAD } from "@ricky0123/vad-react"
import { Mic, Pause, Send, Loader2 } from "lucide-react";
import { useTranscriber } from "@/hooks/useTranscriber";
import { cleanTranscript, cleanFromPunctuation, cleanFromWakeWord } from "@/utils/stringProcessing";
import { hasOnScreenKeyboard } from "@/utils/hasOnScreenKeyboard";
import { AlertContext } from "@/features/alert/alertContext";
import { ChatContext } from "@/features/chat/chatContext";
import { openaiWhisper  } from "@/features/openaiWhisper/openaiWhisper";
import { whispercpp  } from "@/features/whispercpp/whispercpp";
import { config } from "@/utils/config";
import { WaveFile } from "wavefile";


export default function MessageInput({
  userMessage,
  setUserMessage,
  isChatProcessing,
  onChangeUserMessage,
}: {
  userMessage: string;
  setUserMessage: (message: string) => void;
  isChatProcessing: boolean;
  onChangeUserMessage: (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => void;
}) {
  const transcriber = useTranscriber();
  const inputRef = useRef<HTMLInputElement>(null);
  const [whisperOpenAIOutput, setWhisperOpenAIOutput] = useState<any | null>(null);
  const [whisperCppOutput, setWhisperCppOutput] = useState<any | null>(null);
  const { chat: bot } = useContext(ChatContext);
  const { alert } = useContext(AlertContext);

  const vad = useMicVAD({
    startOnLoad: false,
    onnxWASMBasePath: 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/',
    baseAssetPath: 'https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.28/dist/',
    onSpeechStart: () => {
      console.log('[VAD] Speech started');
      console.time('performance_speech');
    },
    onSpeechEnd: (audio: Float32Array) => {
      console.log('[VAD] Speech ended, audio length:', audio.length);
      console.timeEnd('performance_speech');
      console.time('performance_transcribe');
      (window as any).chatvrm_latency_tracker = {
        start: +Date.now(),
        active: true,
      };

      try {
        const sttBackend = config("stt_backend");
        console.log('[STT] Using backend:', sttBackend);

        switch (sttBackend) {
          case 'whisper_browser': {
            console.log('[STT] Starting whisper_browser transcription');
            // since VAD sample rate is same as whisper we do nothing here
            // both are 16000
            const audioCtx = new AudioContext();
            const buffer = audioCtx.createBuffer(1, audio.length, 16000);
            buffer.copyToChannel(new Float32Array(audio), 0, 0);
            transcriber.start(buffer);
            console.log('[STT] whisper_browser transcription started');
            break;
          }
          case 'whisper_openai': {
            console.log('[STT] Starting whisper_openai transcription');
            const wav = new WaveFile();
            wav.fromScratch(1, 16000, '32f', audio);
            const file = new File([new Uint8Array(wav.toBuffer())], "input.wav", { type: "audio/wav" });
            console.log('[STT] Created WAV file, size:', file.size);

            let prompt;
            // TODO load prompt if it exists

            (async () => {
              try {
                console.log('[STT] Calling OpenAI Whisper API...');
                const transcript = await openaiWhisper(file, prompt);
                console.log('[STT] OpenAI Whisper response:', transcript);
                setWhisperOpenAIOutput(transcript);
              } catch (e: any) {
                console.error('[STT] whisper_openai error', e);
                alert.error('whisper_openai error', e.toString());
              }
            })();
            break;
          }
          case 'whispercpp': {
            console.log('[STT] Starting whispercpp transcription');
            const wav = new WaveFile();
            wav.fromScratch(1, 16000, '32f', audio);
            wav.toBitDepth('16');
            const file = new File([new Uint8Array(wav.toBuffer())], "input.wav", { type: "audio/wav" });
            console.log('[STT] Created WAV file, size:', file.size);

            let prompt;
            // TODO load prompt if it exists

            (async () => {
              try {
                console.log('[STT] Calling Whisper.cpp API...');
                const transcript = await whispercpp(file, prompt);
                console.log('[STT] Whisper.cpp response:', transcript);
                setWhisperCppOutput(transcript);
              } catch (e: any) {
                console.error('[STT] whispercpp error', e);
                alert.error('whispercpp error', e.toString());
              }
            })();
            break;
          }
          default:
            console.log('[STT] Unknown or no backend configured:', sttBackend);
        }
      } catch (e: any) {
        console.error('[STT] stt_backend error', e);
        alert.error('STT backend error', e.toString());
      }
    },
  });

  if (vad.errored) {
    console.error('vad error', vad.errored);
  }

  function handleTranscriptionResult(preprocessed: string) {
    console.log('[Transcription] Raw result:', preprocessed);
    const cleanText = cleanTranscript(preprocessed);
    console.log('[Transcription] Cleaned text:', cleanText);
    const wakeWordEnabled = config("wake_word_enabled") === 'true';
    const textStartsWithWakeWord = wakeWordEnabled && cleanFromPunctuation(cleanText).startsWith(cleanFromPunctuation(config("wake_word")));
    const text = wakeWordEnabled && textStartsWithWakeWord ? cleanFromWakeWord(cleanText, config("wake_word")) : cleanText;
    console.log('[Transcription] Final text:', text, 'Wake word enabled:', wakeWordEnabled);

    if (wakeWordEnabled) {
      // Text start with wake word
      if (textStartsWithWakeWord) {
        bot.updateAwake();
      }
    }


    if (text === "") {
      return;
    }


    if (config("autosend_from_mic") === 'true') {
      if (!wakeWordEnabled || bot.isAwake()) {
        bot.receiveMessageFromUser(text);
      } 
    } else {
      setUserMessage(text);
    }
    console.timeEnd('performance_transcribe');
  }

  function handleInputChange(event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    onChangeUserMessage(event); 
  }

  // for whisper_browser
  useEffect(() => {
    if (transcriber.output && ! transcriber.isBusy) {
      const output = transcriber.output?.text;
      handleTranscriptionResult(output);
    }
  }, [transcriber]);

  // for whisper_openai
  useEffect(() => {
    if (whisperOpenAIOutput) {
      const output = whisperOpenAIOutput?.text;
      handleTranscriptionResult(output);
    }
  }, [whisperOpenAIOutput]);

  // for whispercpp
  useEffect(() => {
    if (whisperCppOutput) {
      const output = whisperCppOutput?.text;
      handleTranscriptionResult(output);
    }
  }, [whisperCppOutput]);

  function clickedSendButton() {
    bot.receiveMessageFromUser(userMessage);
    // only if we are using non-VAD mode should we focus on the input
    if (! vad.listening) {
      if (! hasOnScreenKeyboard()) {
        inputRef.current?.focus();
      }
    }
    setUserMessage("");
  }

  return (
    <div className="fixed bottom-2 z-20 w-full">
      <div className="mx-auto max-w-4xl p-2">
        <div className="bg-white/20 backdrop-blur-xl border border-white/10 rounded-lg shadow-lg p-2">
          <div className="flex items-center gap-2">
            <button
              disabled={config('stt_backend') === 'none' || vad.loading || Boolean(vad.errored)}
              onClick={vad.toggle}
              className="flex-shrink-0 p-2 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-slate-900"
            >
              {vad.userSpeaking ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : vad.listening ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Mic className="h-5 w-5" />
              )}
            </button>

            <input
              type="text"
              ref={inputRef}
              placeholder="Write message here..."
              onChange={handleInputChange}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (hasOnScreenKeyboard()) {
                    inputRef.current?.blur();
                  }

                  if (userMessage === "") {
                    return false;
                  }

                  clickedSendButton();
                }
              }}
              disabled={false}
              className="flex-1 px-3 py-2 text-sm text-slate-900 bg-white/90 backdrop-blur-xl border border-white/30 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-transparent transition-all"
              value={userMessage}
              autoComplete="off"
            />

            <button
              disabled={isChatProcessing || !userMessage || transcriber.isModelLoading}
              onClick={clickedSendButton}
              className="flex-shrink-0 p-2 rounded-lg bg-rose-500 hover:bg-rose-600 disabled:bg-slate-300 disabled:cursor-not-allowed cursor-pointer transition-colors text-white"
            >
              {isChatProcessing || transcriber.isBusy ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
