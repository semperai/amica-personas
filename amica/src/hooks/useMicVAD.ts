import { useEffect, useRef, useState, useCallback } from "react";
import { MicVAD, RealTimeVADOptions, getDefaultRealTimeVADOptions } from "@/lib/vad";

interface ReactOptions {
  userSpeakingThreshold: number;
}

export type ReactRealTimeVADOptions = RealTimeVADOptions & ReactOptions;

const defaultReactOptions: ReactOptions = {
  userSpeakingThreshold: 0.6,
};

export const getDefaultReactRealTimeVADOptions = (
  model: "legacy" | "v5"
): ReactRealTimeVADOptions => {
  return {
    ...getDefaultRealTimeVADOptions(model),
    ...defaultReactOptions,
  };
};

/**
 * Fixed version of useMicVAD that properly handles device changes.
 *
 * The original vad-react hook creates the VAD instance once and never recreates it,
 * which means the getStream function (and thus the selected device) is captured
 * at creation time and never updates.
 *
 * This version:
 * 1. Recreates the VAD when critical options change (like getStream)
 * 2. Properly cleans up and reinitializes when needed
 * 3. Uses a stable options object to avoid unnecessary recreations
 */
export function useMicVAD(options: Partial<ReactRealTimeVADOptions>) {
  const model = options.model ?? 'v5';
  const fullOptions: ReactRealTimeVADOptions = {
    ...getDefaultReactRealTimeVADOptions(model),
    ...options,
  };

  const [userSpeaking, setUserSpeaking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState<false | string>(false);
  const [listening, setListening] = useState(false);
  const [vad, setVAD] = useState<MicVAD | null>(null);

  // Use refs to store the latest callbacks so they can be called without recreating the VAD
  const onFrameProcessedRef = useRef(fullOptions.onFrameProcessed);
  const onSpeechEndRef = useRef(fullOptions.onSpeechEnd);
  const onSpeechStartRef = useRef(fullOptions.onSpeechStart);
  const onSpeechRealStartRef = useRef(fullOptions.onSpeechRealStart);
  const onVADMisfireRef = useRef(fullOptions.onVADMisfire);
  const getStreamRef = useRef(fullOptions.getStream);

  // Update refs when callbacks change
  useEffect(() => {
    onFrameProcessedRef.current = fullOptions.onFrameProcessed;
    onSpeechEndRef.current = fullOptions.onSpeechEnd;
    onSpeechStartRef.current = fullOptions.onSpeechStart;
    onSpeechRealStartRef.current = fullOptions.onSpeechRealStart;
    onVADMisfireRef.current = fullOptions.onVADMisfire;
  }, [
    fullOptions.onFrameProcessed,
    fullOptions.onSpeechEnd,
    fullOptions.onSpeechStart,
    fullOptions.onSpeechRealStart,
    fullOptions.onVADMisfire,
  ]);

  // Update getStream ref - this is the key fix!
  useEffect(() => {
    getStreamRef.current = fullOptions.getStream;
  }, [fullOptions.getStream]);

  // Serialize getStream function to detect changes
  // We use a simple approach: convert function to string
  const getStreamKey = fullOptions.getStream.toString();

  useEffect(() => {
    let myvad: MicVAD | null = null;
    let canceled = false;

    console.log('[useMicVAD] ========================================');
    console.log('[useMicVAD] VAD useEffect triggered!');
    console.log('[useMicVAD] getStream key (first 100 chars):', getStreamKey.slice(0, 100));
    console.log('[useMicVAD] model:', model);
    console.log('[useMicVAD] ========================================');

    const setup = async (): Promise<void> => {
      try {
        setLoading(true);
        setErrored(false);

        // Create VAD options with stable callback wrappers
        const vadOptions: RealTimeVADOptions = {
          ...fullOptions,
          onFrameProcessed: (probs, frame) => {
            if (!window._vadWrapperCalled) {
              window._vadWrapperCalled = true;
              console.log('[useMicVAD] onFrameProcessed WRAPPER is being called!');
            }
            const isSpeaking = probs.isSpeech > fullOptions.userSpeakingThreshold;
            setUserSpeaking(isSpeaking);
            onFrameProcessedRef.current(probs, frame);
          },
          onSpeechEnd: (audio) => {
            onSpeechEndRef.current(audio);
          },
          onSpeechStart: () => {
            onSpeechStartRef.current();
          },
          onSpeechRealStart: () => {
            onSpeechRealStartRef.current();
          },
          onVADMisfire: () => {
            onVADMisfireRef.current();
          },
          getStream: () => {
            console.log('[useMicVAD] getStream wrapper called');
            return getStreamRef.current();
          },
        };

        console.log('[useMicVAD] Creating MicVAD instance...');
        myvad = await MicVAD.new(vadOptions);

        if (canceled) {
          console.log('[useMicVAD] Setup canceled, destroying VAD');
          myvad.destroy();
          return;
        }

        console.log('[useMicVAD] MicVAD created successfully');
        setVAD(myvad);
        setLoading(false);

        if (fullOptions.startOnLoad) {
          console.log('[useMicVAD] Starting VAD (startOnLoad=true)');
          myvad.start();
          setListening(true);
        }
      } catch (e) {
        console.error('[useMicVAD] Setup error:', e);
        setLoading(false);
        if (e instanceof Error) {
          setErrored(e.message);
        } else {
          setErrored(String(e));
        }
      }
    };

    setup().catch((e) => {
      console.error('[useMicVAD] Unhandled setup error:', e);
    });

    return function cleanUp() {
      console.log('[useMicVAD] ========================================');
      console.log('[useMicVAD] CLEANUP: Destroying VAD instance');
      console.log('[useMicVAD] ========================================');
      canceled = true;
      if (myvad) {
        myvad.destroy();
      }
      if (!loading && !errored) {
        setListening(false);
      }
    };
  }, [getStreamKey, model]); // Recreate when getStream changes or model changes

  const pause = useCallback(() => {
    console.log('[useMicVAD] Pausing VAD');
    if (!loading && !errored) {
      vad?.pause();
      setListening(false);
    }
  }, [loading, errored, vad]);

  const start = useCallback(() => {
    console.log('[useMicVAD] Starting VAD');
    if (!loading && !errored) {
      vad?.start();
      setListening(true);
    }
  }, [loading, errored, vad]);

  const toggle = useCallback(() => {
    if (listening) {
      pause();
    } else {
      start();
    }
  }, [listening, pause, start]);

  return {
    listening,
    errored,
    loading,
    userSpeaking,
    pause,
    start,
    toggle,
  };
}
