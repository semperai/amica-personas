/**
 * JSON-RPC 2.0 Protocol for Amica
 *
 * This protocol enables external services to interact with Amica's hooks system
 * and trigger any action that Amica can perform.
 */

import { HookEvent, HookEventMap } from '@/features/hooks/hookEvents';
import { Message } from '@/features/chat/messages';

/**
 * JSON-RPC 2.0 Request
 */
export interface JsonRpcRequest<T = any> {
  jsonrpc: '2.0';
  method: string;
  params?: T;
  id: string | number | null;
}

/**
 * JSON-RPC 2.0 Response
 */
export interface JsonRpcResponse<T = any> {
  jsonrpc: '2.0';
  result?: T;
  error?: JsonRpcError;
  id: string | number | null;
}

/**
 * JSON-RPC 2.0 Error
 */
export interface JsonRpcError {
  code: number;
  message: string;
  data?: any;
}

/**
 * JSON-RPC 2.0 Notification (no response expected)
 */
export interface JsonRpcNotification<T = any> {
  jsonrpc: '2.0';
  method: string;
  params?: T;
}

/**
 * Standard JSON-RPC Error Codes
 */
export enum JsonRpcErrorCode {
  ParseError = -32700,
  InvalidRequest = -32600,
  MethodNotFound = -32601,
  InvalidParams = -32602,
  InternalError = -32603,
  // Application errors start at -32000
  HookRegistrationFailed = -32000,
  HookNotFound = -32001,
  ActionFailed = -32002,
  StateNotAvailable = -32003,
  ConfigError = -32004,
  ChatError = -32005,
  ViewerError = -32006,
  ScenarioError = -32007,
}

// =============================================================================
// METHOD PARAMETERS
// =============================================================================

/**
 * Hook Registration Parameters
 */
export interface RegisterHookParams {
  event: HookEvent;
  priority?: number;
  timeout?: number;
  condition?: string; // JavaScript expression that evaluates to boolean
  callbackUrl?: string; // URL to POST hook events to
}

/**
 * Hook Trigger Parameters
 */
export interface TriggerHookParams<T extends HookEvent = HookEvent> {
  event: T;
  data: HookEventMap[T];
}

/**
 * Chat Message Parameters
 */
export interface SendMessageParams {
  message: string;
  role?: 'user' | 'assistant' | 'system';
}

/**
 * Chat Stream Parameters
 */
export interface CreateChatStreamParams {
  messages: Message[];
}

/**
 * Expression Change Parameters
 */
export interface SetExpressionParams {
  expression: string;
}

/**
 * Animation Parameters
 */
export interface PlayAnimationParams {
  animationUrl: string;
  loop?: boolean;
  fadeTime?: number;
}

/**
 * Audio Input Parameters
 */
export interface SendAudioParams {
  audio: string; // base64 encoded audio data
  format?: 'wav' | 'mp3' | 'ogg' | 'webm' | 'pcm';
  sampleRate?: number;
  transcribe?: boolean; // If true, transcribe and send as message
}

/**
 * STT Parameters
 */
export interface TranscribeAudioParams {
  audio: string; // base64 encoded audio or Float32Array
  format?: 'wav' | 'mp3' | 'ogg' | 'webm' | 'pcm';
  sampleRate?: number;
}

/**
 * Audio Playback Parameters
 */
export interface AudioPlaybackParams {
  audio: string; // base64 encoded audio data (ArrayBuffer)
  screenplay?: {
    expression?: string;
    talk?: { message: string; style?: string; emotion?: string };
  };
}

/**
 * TTS Parameters
 */
export interface SpeakTextParams {
  text: string;
  style?: string;
  emotion?: string;
}

/**
 * Emotion Parameters
 */
export interface SetEmotionParams {
  emotion: string;
  intensity?: number; // 0-1
  duration?: number; // milliseconds, 0 for permanent
}

/**
 * Look At Parameters
 */
export interface LookAtParams {
  target?: { x: number; y: number; z: number };
  enabled?: boolean;
  autoLookAt?: boolean;
}

/**
 * Vision Parameters
 */
export interface ProcessVisionParams {
  imageData: string; // base64 encoded image
}

/**
 * Config Parameters
 */
export interface GetConfigParams {
  key: string;
}

export interface SetConfigParams {
  key: string;
  value: string;
}

export interface UpdateConfigParams {
  config: Record<string, string>;
}

/**
 * Scenario Parameters
 */
export interface LoadScenarioParams {
  scenarioUrl: string;
}

export interface UnloadScenarioParams {
  scenarioName?: string;
}

/**
 * Transform Parameters (position, rotation, scale)
 */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Transform {
  position?: Vec3;
  rotation?: Vec3; // Euler angles in radians
  scale?: Vec3;
}

/**
 * Model Parameters
 */
export interface LoadModelParams {
  modelUrl: string;
  onProgress?: boolean; // If true, send progress events
}

export interface SetTransformParams {
  position?: Vec3;
  rotation?: Vec3;
  scale?: Vec3;
}

/**
 * Room Parameters
 */
export interface LoadRoomParams {
  roomUrl: string;
  position?: Vec3;
  rotation?: Vec3;
  scale?: Vec3;
  onProgress?: boolean;
}

export interface LoadSplatParams {
  splatUrl: string;
  position?: Vec3;
  rotation?: Vec3;
  scale?: Vec3;
}

/**
 * Lighting Parameters
 */
export interface SetLightingParams {
  directional?: {
    enabled?: boolean;
    color?: number; // hex color
    intensity?: number;
    position?: Vec3;
  };
  ambient?: {
    enabled?: boolean;
    color?: number;
    intensity?: number;
  };
}

/**
 * Background Parameters
 */
export interface SetBackgroundParams {
  color?: number; // hex color
  alpha?: number; // 0-1 transparency
  type?: 'color' | 'skybox' | 'equirectangular';
  texture?: string; // URL for skybox/equirectangular
}

/**
 * Physics Parameters
 */
export interface SetPhysicsParams {
  enabled?: boolean;
  gravity?: Vec3;
}

/**
 * XR Parameters
 */
export interface StartXRSessionParams {
  mode?: 'immersive-vr' | 'immersive-ar' | 'inline';
  referenceSpaceType?: 'local' | 'local-floor' | 'bounded-floor' | 'unbounded';
}

export interface SetFoveationParams {
  level: number; // 0-1
}

export interface SetFramebufferScaleParams {
  scale: number; // e.g. 1.0, 1.5, 2.0
}

/**
 * Camera Parameters
 */
export interface SetCameraParams {
  position?: { x: number; y: number; z: number };
  target?: { x: number; y: number; z: number };
  fov?: number;
}

/**
 * Batch Action Parameters
 */
export interface BatchActionsParams {
  actions: JsonRpcRequest[];
  sequential?: boolean; // If true, run in sequence; if false, run in parallel
}

// =============================================================================
// RESPONSE TYPES
// =============================================================================

export interface RegisterHookResult {
  hookId: string;
  event: HookEvent;
}

export interface UnregisterHookResult {
  success: boolean;
  hookId: string;
}

export interface TriggerHookResult<T extends HookEvent = HookEvent> {
  event: T;
  data: HookEventMap[T];
  executedHooks: number;
}

export interface GetHookMetricsResult {
  hookId: string;
  calls: number;
  totalDuration: number;
  avgDuration: number;
  errors: number;
  lastError?: string;
}

export interface ChatMessageResult {
  messageId: string;
  response?: string;
  processing: boolean;
}

export interface ChatStreamResult {
  streamId: string;
  status: 'started' | 'processing' | 'completed' | 'error';
}

export interface GetChatStateResult {
  messageList: Message[];
  currentUserMessage: string;
  currentAssistantMessage: string;
  processing: boolean;
  speaking: boolean;
}

export interface GetViewerStateResult {
  isReady: boolean;
  hasModel: boolean;
  hasRoom: boolean;
  currentExpression?: string;
  currentAnimation?: string;
  cameraPosition?: { x: number; y: number; z: number };
  cameraTarget?: { x: number; y: number; z: number };
}

export interface GetConfigResult {
  key: string;
  value: string;
}

export interface GetAllConfigResult {
  config: Record<string, string>;
}

export interface ScenarioResult {
  scenarioName?: string;
  loaded: boolean;
}

export interface ModelLoadResult {
  modelUrl: string;
  loaded: boolean;
}

export interface InterruptResult {
  interrupted: boolean;
  streamIdx: number;
}

export interface BatchActionsResult {
  results: JsonRpcResponse[];
  errors: number;
  succeeded: number;
}

// =============================================================================
// AVAILABLE METHODS
// =============================================================================

/**
 * All available JSON-RPC methods in Amica
 */
export type AmicaMethod =
  // Hook Management
  | 'hooks.register'
  | 'hooks.unregister'
  | 'hooks.unregisterAll'
  | 'hooks.trigger'
  | 'hooks.list'
  | 'hooks.getMetrics'
  | 'hooks.enable'
  | 'hooks.disable'
  | 'hooks.clear'

  // Chat Actions
  | 'chat.sendMessage'
  | 'chat.createStream'
  | 'chat.interrupt'
  | 'chat.getState'
  | 'chat.getMessageList'
  | 'chat.setMessageList'
  | 'chat.isAwake'
  | 'chat.getIdleTime'

  // Audio Input
  | 'audio.send'
  | 'audio.transcribe'
  | 'audio.playback'

  // Character Actions
  | 'character.setExpression'
  | 'character.setEmotion'
  | 'character.playAnimation'
  | 'character.speak'
  | 'character.stopSpeaking'
  | 'character.loadModel'
  | 'character.lookAt'
  | 'character.setAutoLookAt'
  | 'character.setAutoBlink'

  // Vision Actions
  | 'vision.processImage'
  | 'vision.captureScreenshot'

  // Config Management
  | 'config.get'
  | 'config.set'
  | 'config.getAll'
  | 'config.update'

  // Scenario Management
  | 'scenario.load'
  | 'scenario.unload'
  | 'scenario.getState'

  // Model Management
  | 'model.load'
  | 'model.unload'
  | 'model.setPosition'
  | 'model.setRotation'
  | 'model.setScale'
  | 'model.getTransform'

  // Room/Environment Management
  | 'room.load'
  | 'room.unload'
  | 'room.setPosition'
  | 'room.setRotation'
  | 'room.setScale'
  | 'room.getTransform'
  | 'room.loadSplat'

  // Viewer/Scene Management
  | 'viewer.getState'
  | 'viewer.setCamera'
  | 'viewer.screenshot'
  | 'viewer.resetCamera'
  | 'viewer.setBackground'
  | 'viewer.setLighting'
  | 'viewer.setPhysics'

  // VR/XR Management
  | 'xr.startSession'
  | 'xr.endSession'
  | 'xr.getSessionState'
  | 'xr.setFoveation'
  | 'xr.setFramebufferScale'

  // Event Subscriptions
  | 'events.subscribe'
  | 'events.unsubscribe'
  | 'events.listSubscriptions'

  // Utility Methods
  | 'system.ping'
  | 'system.getVersion'
  | 'system.getCapabilities'
  | 'system.batch';

/**
 * Method to Params mapping
 */
export interface MethodParamsMap {
  // Hook Management
  'hooks.register': RegisterHookParams;
  'hooks.unregister': { hookId: string };
  'hooks.unregisterAll': { event: HookEvent };
  'hooks.trigger': TriggerHookParams;
  'hooks.list': { event?: HookEvent };
  'hooks.getMetrics': { hookId?: string; event?: HookEvent };
  'hooks.enable': void;
  'hooks.disable': void;
  'hooks.clear': void;

  // Chat Actions
  'chat.sendMessage': SendMessageParams;
  'chat.createStream': CreateChatStreamParams;
  'chat.interrupt': void;
  'chat.getState': void;
  'chat.getMessageList': void;
  'chat.setMessageList': { messages: Message[] };
  'chat.isAwake': void;
  'chat.getIdleTime': void;

  // Audio Input
  'audio.send': SendAudioParams;
  'audio.transcribe': TranscribeAudioParams;
  'audio.playback': AudioPlaybackParams;

  // Character Actions
  'character.setExpression': SetExpressionParams;
  'character.setEmotion': SetEmotionParams;
  'character.playAnimation': PlayAnimationParams;
  'character.speak': SpeakTextParams;
  'character.stopSpeaking': void;
  'character.loadModel': LoadModelParams;
  'character.lookAt': LookAtParams;
  'character.setAutoLookAt': { enabled: boolean };
  'character.setAutoBlink': { enabled: boolean };

  // Vision Actions
  'vision.processImage': ProcessVisionParams;
  'vision.captureScreenshot': void;

  // Config Management
  'config.get': GetConfigParams;
  'config.set': SetConfigParams;
  'config.getAll': void;
  'config.update': UpdateConfigParams;

  // Scenario Management
  'scenario.load': LoadScenarioParams;
  'scenario.unload': UnloadScenarioParams;
  'scenario.getState': void;

  // Model Management
  'model.load': LoadModelParams;
  'model.unload': void;
  'model.setPosition': { position: Vec3 };
  'model.setRotation': { rotation: Vec3 };
  'model.setScale': { scale: Vec3 };
  'model.getTransform': void;

  // Room Management
  'room.load': LoadRoomParams;
  'room.unload': void;
  'room.setPosition': { position: Vec3 };
  'room.setRotation': { rotation: Vec3 };
  'room.setScale': { scale: Vec3 };
  'room.getTransform': void;
  'room.loadSplat': LoadSplatParams;

  // Viewer Management
  'viewer.getState': void;
  'viewer.setCamera': SetCameraParams;
  'viewer.screenshot': void;
  'viewer.resetCamera': void;
  'viewer.setBackground': SetBackgroundParams;
  'viewer.setLighting': SetLightingParams;
  'viewer.setPhysics': SetPhysicsParams;

  // XR Management
  'xr.startSession': StartXRSessionParams;
  'xr.endSession': void;
  'xr.getSessionState': void;
  'xr.setFoveation': SetFoveationParams;
  'xr.setFramebufferScale': SetFramebufferScaleParams;

  // Event Subscriptions
  'events.subscribe': { events: HookEvent[] };
  'events.unsubscribe': { events: HookEvent[] };
  'events.listSubscriptions': void;

  // Utility Methods
  'system.ping': void;
  'system.getVersion': void;
  'system.getCapabilities': void;
  'system.batch': BatchActionsParams;
}

/**
 * Method to Result mapping
 */
export interface MethodResultMap {
  // Hook Management
  'hooks.register': RegisterHookResult;
  'hooks.unregister': UnregisterHookResult;
  'hooks.unregisterAll': { success: boolean; event: HookEvent };
  'hooks.trigger': TriggerHookResult;
  'hooks.list': { hooks: Array<{ hookId: string; event: HookEvent; priority: number }> };
  'hooks.getMetrics': GetHookMetricsResult | GetHookMetricsResult[];
  'hooks.enable': { enabled: boolean };
  'hooks.disable': { enabled: boolean };
  'hooks.clear': { success: boolean };

  // Chat Actions
  'chat.sendMessage': ChatMessageResult;
  'chat.createStream': ChatStreamResult;
  'chat.interrupt': InterruptResult;
  'chat.getState': GetChatStateResult;
  'chat.getMessageList': { messages: Message[] };
  'chat.setMessageList': { success: boolean };
  'chat.isAwake': { awake: boolean };
  'chat.getIdleTime': { idleTime: number };

  // Audio Input
  'audio.send': { success: boolean; transcription?: string };
  'audio.transcribe': { transcript: string; success: boolean };
  'audio.playback': { success: boolean; playing: boolean };

  // Character Actions
  'character.setExpression': { expression: string; success: boolean };
  'character.setEmotion': { emotion: string; success: boolean };
  'character.playAnimation': { animation: string; success: boolean };
  'character.speak': { speaking: boolean; success: boolean };
  'character.stopSpeaking': { success: boolean };
  'character.loadModel': ModelLoadResult;
  'character.lookAt': { success: boolean };
  'character.setAutoLookAt': { enabled: boolean; success: boolean };
  'character.setAutoBlink': { enabled: boolean; success: boolean };

  // Vision Actions
  'vision.processImage': { response: string; success: boolean };
  'vision.captureScreenshot': { imageData: string };

  // Config Management
  'config.get': GetConfigResult;
  'config.set': { success: boolean; key: string; value: string };
  'config.getAll': GetAllConfigResult;
  'config.update': { success: boolean; updated: number };

  // Scenario Management
  'scenario.load': ScenarioResult;
  'scenario.unload': ScenarioResult;
  'scenario.getState': ScenarioResult;

  // Model Management
  'model.load': { success: boolean; loaded: boolean; modelUrl: string };
  'model.unload': { success: boolean };
  'model.setPosition': { success: boolean; position: Vec3 };
  'model.setRotation': { success: boolean; rotation: Vec3 };
  'model.setScale': { success: boolean; scale: Vec3 };
  'model.getTransform': Transform;

  // Room Management
  'room.load': { success: boolean; loaded: boolean; roomUrl: string };
  'room.unload': { success: boolean };
  'room.setPosition': { success: boolean; position: Vec3 };
  'room.setRotation': { success: boolean; rotation: Vec3 };
  'room.setScale': { success: boolean; scale: Vec3 };
  'room.getTransform': Transform;
  'room.loadSplat': { success: boolean; loaded: boolean };

  // Viewer Management
  'viewer.getState': GetViewerStateResult;
  'viewer.setCamera': { success: boolean };
  'viewer.screenshot': { imageData: string };
  'viewer.resetCamera': { success: boolean };
  'viewer.setBackground': { success: boolean };
  'viewer.setLighting': { success: boolean };
  'viewer.setPhysics': { success: boolean };

  // XR Management
  'xr.startSession': { success: boolean; sessionActive: boolean; mode?: string };
  'xr.endSession': { success: boolean };
  'xr.getSessionState': { active: boolean; mode?: string };
  'xr.setFoveation': { success: boolean; level: number };
  'xr.setFramebufferScale': { success: boolean; scale: number };

  // Event Subscriptions
  'events.subscribe': { subscribed: HookEvent[]; count: number };
  'events.unsubscribe': { unsubscribed: HookEvent[]; count: number };
  'events.listSubscriptions': { subscriptions: HookEvent[] };

  // Utility Methods
  'system.ping': { pong: boolean; timestamp: number };
  'system.getVersion': { version: string; build: string };
  'system.getCapabilities': { methods: AmicaMethod[]; hooks: HookEvent[] };
  'system.batch': BatchActionsResult;
}
