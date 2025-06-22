import { FC, useRef } from "react";
import { AudioStats, useServerAudio } from "@/features/moshi/hooks/useServerAudio";
import { ServerVisualizer } from "@/features/moshi/components/ServerVisualizer";

type ServerAudioProps = {
  setGetAudioStats: (getAudioStats: () => AudioStats) => void;
  copyCanvasRef?: React.RefObject<HTMLCanvasElement>;
};
export const ServerAudio: FC<ServerAudioProps> = ({ setGetAudioStats,copyCanvasRef }) => {
  const { analyser, hasCriticalDelay, setHasCriticalDelay } = useServerAudio({
    setGetAudioStats,
  });
  const containerRef = useRef<HTMLDivElement>(null);
  return (
    <>
      {hasCriticalDelay && (
        <div className="fixed left-0 top-0 flex w-screen justify-between bg-red-500 p-2 text-center text-white">
          <p>A connection issue has been detected, you&apos;ve been reconnected</p>
          <button
            onClick={async () => {
              setHasCriticalDelay(false);
            }}
            className="bg-white p-1 text-black"
          >
            Dismiss
          </button>
        </div>
      )}
      <div className="server-audio h-4/6 aspect-square" ref={containerRef}>
        <ServerVisualizer analyser={analyser.current} parent={containerRef} copyCanvasRef={copyCanvasRef}/>
      </div>
    </>
  );
};
