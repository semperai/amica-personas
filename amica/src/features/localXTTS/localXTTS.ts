// Basic support for AllTalk XTTS (https://github.com/erew123/alltalk_tts)

import { config } from '@/utils/config';

export async function localXTTSTTS(message:string){ 
  const formData = new URLSearchParams({
    text_input: message,
    streaming: 'false',
    text_filtering: 'none',
    character_voice_gen: 'female_01.wav',
    narrator_enabled: 'false', 
    narrator_voice_gen: 'male_01.wav',
    text_not_inside: 'character',
    language: 'en',
    output_file_name: 'myoutputfile',
    output_file_timestamp: 'true',
    autoplay: 'true',
    autoplay_volume: '0.8',
  });

  try {
    const url = config("localXTTS_url");
    console.log('[TTS] LocalXTTS request -', { url, messageLength: message.length });

    const res = await fetch(url, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      console.error('[TTS] LocalXTTS error:', res.status, res.statusText);
      throw new Error("localXTTS TTS API Error");
    }
    const data = await res.json();
    console.log('[TTS] LocalXTTS response -', { outputUrl: data.output_file_url });

    return {
      audio: data.output_file_url,
    };
  } catch (e) {
    console.error('[TTS] LocalXTTS error:', e);
    throw new Error("localXTTS TTS API Error");
  }
}
