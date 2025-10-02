/**
 * Configuration types for Amica
 *
 * These types match the response from the /config endpoint,
 * which is provided by:
 * - Subdomain service in production
 * - Vite plugin reading amica.toml in development
 */

/**
 * Configuration response from /config endpoint
 *
 * When served by subdomain service, includes persona metadata.
 * When served from amica.toml, includes only local config overrides.
 */
export interface AmicaConfig {
  // Persona information (only present when served by subdomain service)
  personaName?: string;
  personaSymbol?: string;
  chainId?: number;
  tokenId?: string;
  domain?: string;
  erc20Token?: string;
  creator?: string;
  owner?: string;
  isGraduated?: boolean;

  // Configuration metadata (merged with defaults)
  metadata?: Record<string, string>;

  // Direct config keys (when loaded from amica.toml)
  // These will be merged with defaults
  [key: string]: any;
}

/**
 * All valid Amica configuration keys
 * Should be kept in sync with defaults in config.ts
 */
export type AmicaConfigKey =
  | 'autosend_from_mic'
  | 'wake_word_enabled'
  | 'wake_word'
  | 'time_before_idle_sec'
  | 'debug_gfx'
  | 'use_webgpu'
  | 'mtoon_debug_mode'
  | 'mtoon_material_type'
  | 'bg_color'
  | 'bg_url'
  | 'vrm_url'
  | 'vrm_hash'
  | 'vrm_save_type'
  | 'youtube_videoid'
  | 'animation_url'
  | 'animation_procedural'
  | 'chatbot_backend'
  | 'arbius_llm_model_id'
  | 'openai_apikey'
  | 'openai_url'
  | 'openai_model'
  | 'llamacpp_url'
  | 'llamacpp_stop_sequence'
  | 'ollama_url'
  | 'ollama_model'
  | 'koboldai_url'
  | 'koboldai_use_extra'
  | 'koboldai_stop_sequence'
  | 'tts_muted'
  | 'tts_backend'
  | 'stt_backend'
  | 'vision_backend'
  | 'vision_system_prompt'
  | 'vision_openai_apikey'
  | 'vision_openai_url'
  | 'vision_openai_model'
  | 'vision_llamacpp_url'
  | 'vision_ollama_url'
  | 'vision_ollama_model'
  | 'whispercpp_url'
  | 'openai_whisper_apikey'
  | 'openai_whisper_url'
  | 'openai_whisper_model'
  | 'openai_tts_apikey'
  | 'openai_tts_url'
  | 'openai_tts_model'
  | 'openai_tts_voice'
  | 'rvc_url'
  | 'rvc_enabled'
  | 'rvc_model_name'
  | 'rvc_f0_upkey'
  | 'rvc_f0_method'
  | 'rvc_index_path'
  | 'rvc_index_rate'
  | 'rvc_filter_radius'
  | 'rvc_resample_sr'
  | 'rvc_rms_mix_rate'
  | 'rvc_protect'
  | 'coquiLocal_url'
  | 'coquiLocal_voiceid'
  | 'localXTTS_url'
  | 'piper_url'
  | 'elevenlabs_apikey'
  | 'elevenlabs_voiceid'
  | 'elevenlabs_model'
  | 'speecht5_speaker_embedding_url'
  | 'coqui_apikey'
  | 'coqui_voice_id'
  | 'name'
  | 'system_prompt'
  | 'scenario_url';
