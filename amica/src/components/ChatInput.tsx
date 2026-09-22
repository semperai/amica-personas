import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useMicVAD } from "@/hooks/useMicVAD"
import { Mic, Pause, Send, Loader2 } from "lucide-react";
import { useTranscriber } from "@/hooks/useTranscriber";
import { cleanTranscript, cleanFromPunctuation, cleanFromWakeWord } from "@/utils/stringProcessing";
import { hasOnScreenKeyboard } from "@/utils/hasOnScreenKeyboard";
import { AlertContext } from "@/features/alert/alertContext";
import { ChatContext } from "@/features/chat/chatContext";
import { openaiWhisper  } from "@/features/openaiWhisper/openaiWhisper";
import { whispercpp  } from "@/features/whispercpp/whisperCpp";
import { config } from "@/utils/config";
import { WaveFile } from "wavefile";


export default function MessageInput({
  userMessage,
  setUserMessage,
  isChatProcessing,
  onChangeUserMessage,
  audioDevices = [],
  selectedDeviceId = 'default',
  micEnabled = true,
}: {
  userMessage: string;
  setUserMessage: (message: string) => void;
  isChatProcessing: boolean;
  onChangeUserMessage: (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => void;
  audioDevices?: MediaDeviceInfo[];
  selectedDeviceId?: string;
  micEnabled?: boolean;
}) {
  const transcriber = useTranscriber();
  const inputRef = useRef<HTMLInputElement>(null);
  const [whisperOpenAIOutput, setWhisperOpenAIOutput] = useState<any | null>(null);
  const [whisperCppOutput, setWhisperCppOutput] = useState<any | null>(null);
  const { chat: bot } = useContext(ChatContext);
  const { alert } = useContext(AlertContext);

  // Memoize getStream to prevent VAD from recreating on every render
  const getStream = useMemo(() => {
    return async () => {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: selectedDeviceId !== 'default' ? { exact: selectedDeviceId } : undefined,
          channelCount: 1,
          echoCancellation: true,
          autoGainControl: true,
          noiseSuppression: true,
        },
      });
      return stream;
    };
  }, [selectedDeviceId]);

  const vad = useMicVAD({
    startOnLoad: false,
    model: 'v5' as const,
    baseAssetPath: '/',
    onnxWASMBasePath: '/assets/',
    getStream,
    onFrameProcessed: (probabilities) => {
      // Removed excessive VAD logging - no per-frame logging
    },
    onVADMisfire: () => {
      // Speech segment too short - no logging needed
    },
    onSpeechStart: () => {
      console.time('performance_speech');
    },
    onSpeechRealStart: () => {
      console.log('[VAD] Speech detected');
    },
    onSpeechEnd: (audio: Float32Array) => {
      console.log('[VAD] Speech ended -', (audio.length / 16000).toFixed(2), 'seconds');
      console.timeEnd('performance_speech');
      console.time('performance_transcribe');
      (window as any).chatvrm_latency_tracker = {
        start: +Date.now(),
        active: true,
      };

      try {
        const sttBackend = config("stt_backend");

        switch (sttBackend) {
          case 'whisper_browser': {
            // since VAD sample rate is same as whisper we do nothing here
            // both are 16000
            const audioCtx = new AudioContext();
            const buffer = audioCtx.createBuffer(1, audio.length, 16000);
            buffer.copyToChannel(new Float32Array(audio), 0, 0);
            transcriber.start(buffer);
            break;
          }
          case 'whisper_openai': {
            const wav = new WaveFile();
            wav.fromScratch(1, 16000, '32f', audio);
            const file = new File([new Uint8Array(wav.toBuffer())], "input.wav", { type: "audio/wav" });

            let prompt;
            // TODO load prompt if it exists

            (async () => {
              try {
                console.log('[STT] OpenAI Whisper request -', { url: config("openai_whisper_url"), model: config("openai_whisper_model"), fileSize: file.size });
                const transcript = await openaiWhisper(file, prompt);
                console.log('[STT] OpenAI Whisper response -', { text: transcript });
                setWhisperOpenAIOutput(transcript);
              } catch (e: any) {
                console.error('[STT] OpenAI Whisper error:', e);
                alert.error('whisper_openai error', e.toString());
              }
            })();
            break;
          }
          case 'whispercpp': {
            const wav = new WaveFile();
            wav.fromScratch(1, 16000, '32f', audio);
            wav.toBitDepth('16');
            const file = new File([new Uint8Array(wav.toBuffer())], "input.wav", { type: "audio/wav" });

            let prompt;
            // TODO load prompt if it exists

            (async () => {
              try {
                console.log('[STT] Whisper.cpp request -', { url: config("whispercpp_url"), fileSize: file.size });
                const transcript = await whispercpp(file, prompt);
                console.log('[STT] Whisper.cpp response -', { text: transcript });
                setWhisperCppOutput(transcript);
              } catch (e: any) {
                console.error('[STT] Whisper.cpp error:', e);
                alert.error('whispercpp error', e.toString());
              }
            })();
            break;
          }
          default:
            console.warn('[STT] Unknown backend:', sttBackend);
        }
      } catch (e: any) {
        console.error('[STT] stt_backend error', e);
        alert.error('STT backend error', e.toString());
      }
    },
  });

  // Always print VAD status with setInterval for testing
  const selectedDevice = audioDevices.find(d => d.deviceId === selectedDeviceId);

  // Removed VAD status interval logging

  if (vad.errored) {
    console.error('[VAD] ERROR:', vad.errored);
  }

  // Debug: Log button disabled state
  useEffect(() => {
    try {
      const sttBackend = config('stt_backend');
      const isDisabled = !micEnabled || sttBackend === 'none' || vad.loading || Boolean(vad.errored);
      console.log('[Mic Button] State:', {
        disabled: isDisabled,
        micEnabled,
        sttBackend,
        vadLoading: vad.loading,
        vadErrored: vad.errored,
        vadListening: vad.listening,
      });
    } catch (error) {
      console.error('[Mic Button] Failed to log state:', error);
    }
  }, [micEnabled, vad.loading, vad.errored, vad.listening]);

  useEffect(() => {

    // Check if we have an audio context and it's running
    if (vad.listening) {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
          console.log('[VAD] Microphone access granted');
          console.log('[VAD] Audio tracks:', stream.getAudioTracks().map(t => ({
            label: t.label,
            enabled: t.enabled,
            muted: t.muted,
            readyState: t.readyState,
          })));
          // Don't stop the stream, VAD is using it
        })
        .catch(err => {
          console.error('[VAD] Microphone access denied or failed:', err);
        });
    }
  }, [vad.listening, vad.userSpeaking]);

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

  // Safe config access for button state
  const sttBackend = (() => {
    try {
      return config('stt_backend');
    } catch {
      return 'none';
    }
  })();

  return (
    <div className="fixed bottom-2 z-20 w-full">
      <div className="mx-auto max-w-4xl p-2">
        <div className="bg-white/20 backdrop-blur-xl border border-white/10 rounded-lg shadow-lg p-2">
          <div className="flex items-center gap-2">
            <button
              disabled={!micEnabled || sttBackend === 'none' || vad.loading || Boolean(vad.errored)}
              onClick={() => {
                console.log('[VAD] Microphone button clicked');
                console.log('[VAD] Current state before toggle:', {
                  listening: vad.listening,
                  loading: vad.loading,
                  errored: vad.errored,
                  micEnabled,
                  sttBackend,
                });
                vad.toggle();
              }}
              className="flex-shrink-0 p-2 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-slate-900"
              title={
                !micEnabled ? 'Microphone disabled in settings' :
                sttBackend === 'none' ? 'No STT backend configured' :
                vad.loading ? 'Loading voice detection model...' :
                vad.errored ? `Error: ${vad.errored}` :
                vad.listening ? 'Stop listening' :
                'Start listening'
              }
            >
              {vad.loading ? (
                <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
              ) : vad.userSpeaking ? (
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
