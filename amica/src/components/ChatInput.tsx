import { useContext, useEffect, useRef, useState } from "react";
import { useMicVAD } from "@ricky0123/vad-react"
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

  const vad = useMicVAD({
    startOnLoad: false,
    model: 'v5' as const,
    modelURL: '/silero_vad_v5.onnx',
    workletURL: '/vad.worklet.bundle.min.js',
    onFrameProcessed: (probabilities) => {
      // Log every 50 frames to verify processing is happening (more frequent for testing)
      if (!window._vadFrameCount) {
        window._vadFrameCount = 0;
        console.log('[VAD] onFrameProcessed callback is firing! Starting frame count.');
      }
      window._vadFrameCount++;

      if (window._vadFrameCount % 50 === 0) {
        console.log('[VAD] Processed', window._vadFrameCount, 'frames, current speech probability:', probabilities.isSpeech, 'full probabilities:', probabilities);
      }

      if (probabilities.isSpeech > 0.3) {
        console.log('[VAD] SPEECH DETECTED! Probability:', probabilities.isSpeech, 'full:', probabilities);
      }
    },
    onVADMisfire: () => {
      console.log('[VAD] VAD misfire (speech segment too short)');
    },
    onSpeechStart: () => {
      console.log('[VAD] ===== Speech started =====');
      console.time('performance_speech');
    },
    onSpeechRealStart: () => {
      console.log('[VAD] ===== Speech REALLY started (not a misfire) =====');
    },
    onSpeechEnd: (audio: Float32Array) => {
      console.log('[VAD] ===== Speech ended =====');
      console.log('[VAD] Audio length:', audio.length, 'samples');
      console.log('[VAD] Audio duration:', (audio.length / 16000).toFixed(2), 'seconds');
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

  // Always print VAD status with setInterval for testing
  const selectedDevice = audioDevices.find(d => d.deviceId === selectedDeviceId);

  useEffect(() => {
    const statusInterval = setInterval(() => {
      console.log('[VAD] Status:', {
        loading: vad.loading,
        listening: vad.listening,
        userSpeaking: vad.userSpeaking,
        errored: !!vad.errored,
        micEnabled,
        selectedDeviceId,
        selectedDeviceName: selectedDevice?.label || selectedDeviceId,
        totalDevices: audioDevices.length,
        frameCount: window._vadFrameCount || 0,
      });
    }, 2000); // Print every 2 seconds

    return () => clearInterval(statusInterval);
  }, [vad.loading, vad.listening, vad.userSpeaking, vad.errored, micEnabled, selectedDeviceId, selectedDevice, audioDevices.length]);

  if (vad.errored) {
    console.error('[VAD] ERROR:', vad.errored);
  }

  useEffect(() => {
    console.log('[VAD] State changed - listening:', vad.listening, 'userSpeaking:', vad.userSpeaking);

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

  return (
    <div className="fixed bottom-2 z-20 w-full">
      <div className="mx-auto max-w-4xl p-2">
        <div className="bg-white/20 backdrop-blur-xl border border-white/10 rounded-lg shadow-lg p-2">
          <div className="flex items-center gap-2">
            <button
              disabled={!micEnabled || config('stt_backend') === 'none' || vad.loading || Boolean(vad.errored)}
              onClick={() => {
                console.log('[VAD] Microphone button clicked');
                console.log('[VAD] Current state before toggle:', {
                  listening: vad.listening,
                  loading: vad.loading,
                  errored: vad.errored,
                  micEnabled,
                  sttBackend: config('stt_backend'),
                });
                vad.toggle();
              }}
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
