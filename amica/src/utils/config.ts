import { AmicaConfig } from '@/types/config';

const defaults = {
  autosend_from_mic: 'true',
  wake_word_enabled: 'false',
  wake_word: 'Hello',
  time_before_idle_sec: '20',
  debug_gfx: 'false',
  use_webgpu: 'false',
  mtoon_debug_mode: 'none',
  mtoon_material_type: 'mtoon',
  bg_color: import.meta.env.VITE_BG_COLOR ?? '#000000',
  bg_url: import.meta.env.VITE_BG_URL ?? '/bg/bg-room2.jpg',
  vrm_url: import.meta.env.VITE_VRM_HASH ?? '/vrm/AvatarSample_A.vrm',
  vrm_hash: '',
  vrm_save_type: 'web',
  youtube_videoid: '',
  animation_url: import.meta.env.VITE_ANIMATION_URL ?? '/animations/idle_loop.vrma',
  animation_procedural: import.meta.env.VITE_ANIMATION_PROCEDURAL ?? 'false',
  chatbot_backend: import.meta.env.VITE_CHATBOT_BACKEND ?? 'chatgpt',
  arbius_llm_model_id: import.meta.env.VITE_ARBIUS_LLM_MODEL_ID ?? 'default',
  openai_apikey: import.meta.env.VITE_OPENAI_APIKEY ?? 'default',
  openai_url: import.meta.env.VITE_OPENAI_URL ?? 'https://api-01.heyamica.com',
  openai_model: import.meta.env.VITE_OPENAI_MODEL ?? 'gpt-4o',
  llamacpp_url: import.meta.env.VITE_LLAMACPP_URL ?? 'http://127.0.0.1:8080',
  llamacpp_stop_sequence: import.meta.env.VITE_LLAMACPP_STOP_SEQUENCE ?? '(End)||[END]||Note||***||You:||User:||</s>',
  ollama_url: import.meta.env.VITE_OLLAMA_URL ?? 'http://localhost:11434',
  ollama_model: import.meta.env.VITE_OLLAMA_MODEL ?? 'llama2',
  koboldai_url: import.meta.env.VITE_KOBOLDAI_URL ?? 'http://localhost:5001',
  koboldai_use_extra: import.meta.env.VITE_KOBOLDAI_USE_EXTRA ?? 'false',
  koboldai_stop_sequence: import.meta.env.VITE_KOBOLDAI_STOP_SEQUENCE ?? '(End)||[END]||Note||***||You:||User:||</s>',
  tts_muted: 'false',
  tts_backend: import.meta.env.VITE_TTS_BACKEND ?? 'openai_tts',
  stt_backend: import.meta.env.VITE_STT_BACKEND ?? 'whisper_openai',
  vision_backend: import.meta.env.VITE_VISION_BACKEND ?? 'vision_openai',
  vision_system_prompt: import.meta.env.VITE_VISION_SYSTEM_PROMPT ?? `You are a friendly human named Amica. Describe the image in detail. Let's start the conversation.`,
  vision_openai_apikey: import.meta.env.VITE_VISION_OPENAI_APIKEY ?? 'default',
  vision_openai_url: import.meta.env.VITE_VISION_OPENAI_URL ?? 'https://api-01.heyamica.com',
  vision_openai_model: import.meta.env.VITE_VISION_OPENAI_URL ?? 'gpt-4-vision-preview',
  vision_llamacpp_url: import.meta.env.VITE_VISION_LLAMACPP_URL ?? 'http://127.0.0.1:8081',
  vision_ollama_url: import.meta.env.VITE_VISION_OLLAMA_URL ?? 'http://localhost:11434',
  vision_ollama_model: import.meta.env.VITE_VISION_OLLAMA_MODEL ?? 'llava',
  whispercpp_url: import.meta.env.VITE_WHISPERCPP_URL ?? 'http://localhost:8080',
  openai_whisper_apikey: import.meta.env.VITE_OPENAI_WHISPER_APIKEY ?? 'default',
  openai_whisper_url: import.meta.env.VITE_OPENAI_WHISPER_URL ?? 'https://api-01.heyamica.com',
  openai_whisper_model: import.meta.env.VITE_OPENAI_WHISPER_MODEL ?? 'whisper-1',
  openai_tts_apikey: import.meta.env.VITE_OPENAI_TTS_APIKEY ?? 'default',
  openai_tts_url: import.meta.env.VITE_OPENAI_TTS_URL ?? 'https://api-01.heyamica.com',
  openai_tts_model: import.meta.env.VITE_OPENAI_TTS_MODEL ?? 'tts-1',
  openai_tts_voice: import.meta.env.VITE_OPENAI_TTS_VOICE ?? 'nova',
  rvc_url: import.meta.env.VITE_RVC_URL ?? 'http://localhost:8001/voice2voice',
  rvc_enabled: import.meta.env.VITE_RVC_ENABLED ?? 'false',
  rvc_model_name: import.meta.env.VITE_RVC_MODEL_NAME ?? 'model_name.pth',
  rvc_f0_upkey: import.meta.env.VITE_RVC_F0_UPKEY ?? '0',
  rvc_f0_method: import.meta.env.VITE_RVC_METHOD ?? 'pm',
  rvc_index_path: import.meta.env.VITE_RVC_INDEX_PATH ?? 'none',
  rvc_index_rate: import.meta.env.VITE_RVC_INDEX_RATE ?? '0.66',
  rvc_filter_radius: import.meta.env.VITE_RVC_FILTER_RADIUS ?? '3',
  rvc_resample_sr: import.meta.env.VITE_RVC_RESAMPLE_SR ?? '0',
  rvc_rms_mix_rate: import.meta.env.VITE_RVC_RMS_MIX_RATE ?? '1',
  rvc_protect: import.meta.env.VITE_RVC_PROTECT ?? '0.33',
  coquiLocal_url: import.meta.env.VITE_COQUILOCAL_URL ?? 'http://localhost:5002',
  coquiLocal_voiceid: import.meta.env.VITE_COQUILOCAL_VOICEID ?? 'p240',
  localXTTS_url: import.meta.env.VITE_LOCALXTTS_URL ?? 'http://127.0.0.1:7851/api/tts-generate',
  piper_url: import.meta.env.VITE_PIPER_URL ?? 'https://i-love-amica.com:5000/tts',
  elevenlabs_apikey: import.meta.env.VITE_ELEVENLABS_APIKEY ??'',
  elevenlabs_voiceid: import.meta.env.VITE_ELEVENLABS_VOICEID ?? '21m00Tcm4TlvDq8ikWAM',
  elevenlabs_model: import.meta.env.VITE_ELEVENLABS_MODEL ?? 'eleven_monolingual_v1',
  speecht5_speaker_embedding_url: import.meta.env.VITE_SPEECHT5_SPEAKER_EMBEDDING_URL ?? '/speecht5_speaker_embeddings/cmu_us_slt_arctic-wav-arctic_a0001.bin',
  coqui_apikey: import.meta.env.VITE_COQUI_APIKEY ?? "",
  coqui_voice_id: import.meta.env.VITE_COQUI_VOICEID ?? "71c6c3eb-98ca-4a05-8d6b-f8c2b5f9f3a3",
  name: import.meta.env.VITE_NAME ?? 'Amica',
  system_prompt: import.meta.env.VITE_SYSTEM_PROMPT ?? `You will behave as a friendly human named Amica and engage in conversation with the user. There are five types of emotions: 'neutral' which indicates normality, 'happy' which indicates joy, 'angry' which indicates anger, 'sad' which indicates sadness, and 'relaxed' which indicates calmness.
The format of each message is as follows:
[neutral|happy|angry|sad|relaxed] {message}

Here are some examples:
[neutral] Hello. [happy] How are you doing?
[happy] Isn't this outfit cute?
[happy] Lately, I'm obsessed with clothes from this shop!
[sad] Sorry, I forgot.
[sad] Is there anything interesting lately?
[angry] What? Don't keep it a secret, that's not fair!
[neutral] What are your plans for summer vacation? [happy] Should we go to the beach?

Please respond with only one appropriate message. Please do not use overly polite language. Please be open about yourself. Let's start the conversation.`,
  scenario_url: import.meta.env.VITE_SCENARIO_URL ?? '/scenarios/test1.js',
};

// Store for configuration loaded from /config endpoint
let loadedConfig: Record<string, string> = {};
let configLoaded = false;
let configError: string | null = null;

/**
 * Load configuration from /config endpoint
 * Called once on app initialization
 */
export async function loadConfig(): Promise<void> {
  if (configLoaded) {
    return;
  }

  try {
    const response = await fetch('/config');

    if (response.ok) {
      const data: AmicaConfig = await response.json();

      // Flatten configuration from metadata if present
      if (data.metadata) {
        Object.entries(data.metadata).forEach(([key, value]) => {
          loadedConfig[key] = value;
        });
      }

      // Also merge direct keys (for TOML-based config)
      Object.entries(data).forEach(([key, value]) => {
        if (key !== 'metadata' && typeof value === 'string') {
          loadedConfig[key] = value;
        }
      });

      // If personaName is present, use it for 'name' config
      if (data.personaName) {
        loadedConfig.name = data.personaName;
      }

      console.log('[Config] Loaded configuration from /config endpoint');
    } else if (response.status === 404) {
      console.log('[Config] No /config endpoint found, using defaults');
    } else {
      console.warn('[Config] Failed to load config:', response.statusText);
      configError = `HTTP ${response.status}: ${response.statusText}`;
    }
  } catch (error) {
    console.warn('[Config] Error loading config:', error);
    configError = error instanceof Error ? error.message : 'Unknown error';
  }

  configLoaded = true;
}

/**
 * Get configuration value with fallback chain:
 * 1. Loaded config from /config endpoint
 * 2. Defaults
 */
export function config(key: string): string {
  // Check loaded config first
  if (loadedConfig.hasOwnProperty(key)) {
    return loadedConfig[key];
  }

  // Fall back to defaults
  if (defaults.hasOwnProperty(key)) {
    return (<any>defaults)[key];
  }

  throw new Error(`config key not found: ${key}`);
}

/**
 * Get default value for a config key
 */
export function defaultConfig(key: string): string {
  if (defaults.hasOwnProperty(key)) {
    return (<any>defaults)[key];
  }

  throw new Error(`config key not found: ${key}`);
}

/**
 * Check if config has been loaded
 */
export function isConfigLoaded(): boolean {
  return configLoaded;
}

/**
 * Get config loading error if any
 */
export function getConfigError(): string | null {
  return configError;
}

/**
 * Set configuration value (TEST ONLY)
 * This is a test utility function that allows tests to override config values.
 * DO NOT use in production code.
 */
export function setConfig(key: string, value: string): void {
  loadedConfig[key] = value;
}
