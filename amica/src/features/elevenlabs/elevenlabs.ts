import { TalkStyle } from "@/features/chat/messages";
import { config } from '@/utils/config';

export async function elevenlabs(
  message: string,
  voiceId: string,
  style: TalkStyle,
) {
  const apiKey = config("elevenlabs_apikey");
  if (! apiKey) {
    throw new Error("Invalid ElevenLabs API Key");
  }

  // Request body
  const model = config("elevenlabs_model");
  const body = {
    text: message,
    model_id: model,
    voice_settings: {
      stability: 0,
      similarity_boost: 0,
      style: 0,
      use_speaker_boost: true
    }
  };

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
  console.log('[TTS] ElevenLabs request -', { url, model, voiceId, messageLength: message.length });

  const elevenlabsRes = await fetch(`${url}?optimize_streaming_latency=0&output_format=mp3_44100_128`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      "Accept": "audio/mpeg",
      "xi-api-key": apiKey,
    },
  });
  if (! elevenlabsRes.ok) {
    console.error('[TTS] ElevenLabs error:', elevenlabsRes.status, elevenlabsRes.statusText);
    throw new Error(`ElevenLabs API Error (${elevenlabsRes.status})`);
  }
  const data = (await elevenlabsRes.arrayBuffer()) as any;
  console.log('[TTS] ElevenLabs response -', { audioSize: data.byteLength });

  return { audio: data };
}
