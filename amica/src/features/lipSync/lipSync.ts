import { LipSyncAnalyzeResult } from "./lipSyncAnalyzeResult";

const TIME_DOMAIN_DATA_LENGTH = 2048;

export class LipSync {
  public readonly audio: AudioContext;
  public readonly analyser: AnalyserNode;
  public readonly timeDomainData: Float32Array;

  public constructor(audio: AudioContext) {
    this.audio = audio;

    this.analyser = audio.createAnalyser();
    this.timeDomainData = new Float32Array(TIME_DOMAIN_DATA_LENGTH);
  }

  public update(): LipSyncAnalyzeResult {
    // @ts-expect-error - TypeScript strict type check for ArrayBuffer vs ArrayBufferLike
    this.analyser.getFloatTimeDomainData(this.timeDomainData);

    let volume = 0.0;
    for (let i = 0; i < TIME_DOMAIN_DATA_LENGTH; i++) {
      volume = Math.max(volume, Math.abs(this.timeDomainData[i]));
    }

    // cook
    volume = 1 / (1 + Math.exp(-45 * volume + 5));
    if (volume < 0.1 || !isFinite(volume)) volume = 0;

    return {
      volume,
    };
  }

  public async playFromArrayBuffer(buffer: ArrayBuffer, onEnded?: () => void) {
    console.log('[LipSync] playFromArrayBuffer called -', {
      bufferSize: buffer.byteLength,
      audioContextState: this.audio.state
    });

    // Resume AudioContext if suspended (required by modern browsers)
    if (this.audio.state === 'suspended') {
      console.log('[LipSync] Resuming suspended AudioContext');
      await this.audio.resume();
      console.log('[LipSync] AudioContext resumed, new state:', this.audio.state);
    }

    const audioBuffer = await this.audio.decodeAudioData(buffer);
    console.log('[LipSync] Audio decoded -', {
      duration: audioBuffer.duration,
      channels: audioBuffer.numberOfChannels,
      sampleRate: audioBuffer.sampleRate
    });

    const bufferSource = this.audio.createBufferSource();
    bufferSource.buffer = audioBuffer;

    bufferSource.connect(this.audio.destination);
    bufferSource.connect(this.analyser);
    bufferSource.start();
    console.log('[LipSync] Audio playback started');

    if (onEnded) {
      bufferSource.addEventListener("ended", onEnded);
    }
  }

  public async playFromURL(url: string, onEnded?: () => void) {
    const res = await fetch(url);
    const buffer = await res.arrayBuffer();
    this.playFromArrayBuffer(buffer, onEnded);
  }
}
