/**
 * Valid Amica configuration keys
 * This list should be kept in sync with amica/src/utils/config.ts
 *
 * When new config keys are added to Amica, add them here to enable
 * automatic metadata injection from persona NFTs.
 */
export const AMICA_CONFIG_KEYS = [
  'autosend_from_mic',
  'wake_word_enabled',
  'wake_word',
  'time_before_idle_sec',
  'debug_gfx',
  'use_webgpu',
  'mtoon_debug_mode',
  'mtoon_material_type',
  'show_introduction',
  'show_arbius_introduction',
  'show_add_to_homescreen',
  'bg_color',
  'bg_url',
  'vrm_url',
  'vrm_hash',
  'vrm_save_type',
  'youtube_videoid',
  'animation_url',
  'animation_procedural',
  'voice_url',
  'chatbot_backend',
  'arbius_llm_model_id',
  'openai_apikey',
  'openai_url',
  'openai_model',
  'llamacpp_url',
  'llamacpp_stop_sequence',
  'ollama_url',
  'ollama_model',
  'koboldai_url',
  'koboldai_use_extra',
  'koboldai_stop_sequence',
  'tts_muted',
  'tts_backend',
  'stt_backend',
  'vision_backend',
  'vision_system_prompt',
  'vision_openai_apikey',
  'vision_openai_url',
  'vision_openai_model',
  'vision_llamacpp_url',
  'vision_ollama_url',
  'vision_ollama_model',
  'whispercpp_url',
  'openai_whisper_apikey',
  'openai_whisper_url',
  'openai_whisper_model',
  'openai_tts_apikey',
  'openai_tts_url',
  'openai_tts_model',
  'openai_tts_voice',
  'rvc_url',
  'rvc_enabled',
  'rvc_model_name',
  'rvc_f0_upkey',
  'rvc_f0_method',
  'rvc_index_path',
  'rvc_index_rate',
  'rvc_filter_radius',
  'rvc_resample_sr',
  'rvc_rms_mix_rate',
  'rvc_protect',
  'coquiLocal_url',
  'coquiLocal_voiceid',
  'localXTTS_url',
  'piper_url',
  'elevenlabs_apikey',
  'elevenlabs_voiceid',
  'elevenlabs_model',
  'speecht5_speaker_embedding_url',
  'coqui_apikey',
  'coqui_voice_id',
  'min_time_interval_sec',
  'max_time_interval_sec',
  'time_to_sleep_sec',
  'idle_text_prompt',
  'name',
  'system_prompt',
  'scenario_url',
] as const;

export type AmicaConfigKey = typeof AMICA_CONFIG_KEYS[number];

/**
 * Check if a key is a valid Amica config key
 */
export function isValidConfigKey(key: string): key is AmicaConfigKey {
  return AMICA_CONFIG_KEYS.includes(key as AmicaConfigKey);
}

/**
 * LocalStorage key prefix used by Amica
 */
export const AMICA_LOCALSTORAGE_PREFIX = 'chatvrm_';
