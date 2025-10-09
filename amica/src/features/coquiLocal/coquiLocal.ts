import { config } from '@/utils/config';

export async function coquiLocal(
  message: string,
) {
    
  const voiceId = config("coquiLocal_voiceid");
  if (!voiceId) {
    throw new Error("Invalid CoquiLocal TTS Voice Id");
  }

  try {
    const url = `${config("coquiLocal_url")}/api/tts`;
    console.log('[TTS] CoquiLocal request -', { url, voiceId, messageLength: message.length });

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'text': message,
        'speaker-id': voiceId,
      }
    });

    if (!res.ok) {
      console.error('[TTS] CoquiLocal error:', res.status, res.statusText);
      throw new Error(`CoquiLocal API Error (${res.status})`);
    }

    const data = await res.arrayBuffer();
    console.log('[TTS] CoquiLocal response -', { audioSize: data.byteLength });

    return { audio: data };

  } catch (error) {
    console.error('[TTS] CoquiLocal error:', error);
    throw error;
  }
}

export async function coquiLocalVoiceIdList(
) {
  try {
    const response = await fetch(`${config("coquiLocal_url")}/`, {
      method: 'GET',
      headers: {
        'Accept': "application/text",
      }
    })
    const html = await response.text();
    const selectedValues = html.match(/value="([^"]+)" SELECTED/g)?.map((match) => match.split('"')[1]) || [];

    return { list : selectedValues};

  } catch (error) {

    console.error('Error in coquiLocalVoiceIdList:', error);
    throw error;
  }
}