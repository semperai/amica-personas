import React, {
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useState,
  useRef,
} from "react";
import { Transition } from '@headlessui/react'
import {
  ChevronRightIcon,
  ArrowUturnLeftIcon,
  HomeIcon,
  XMarkIcon,
} from '@heroicons/react/20/solid';

import { CheckCircleIcon } from '@heroicons/react/24/outline';

import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";
import { TextButton } from "@/components/textButton";
import { ViewerContext } from "@/features/vrmViewer/viewerContext";
import { config, updateConfig } from "@/utils/config";


import { Link } from "./settings/common";

import { MenuPage } from './settings/MenuPage';
import { LanguagePage } from './settings/LanguagePage';
import { ResetSettingsPage } from './settings/ResetSettingsPage';
import { DeveloperPage } from './settings/DeveloperPage';
import { CommunityPage } from './settings/CommunityPage';

import { BackgroundImgPage } from './settings/BackgroundImgPage';
import { BackgroundColorPage } from './settings/BackgroundColorPage';
import { BackgroundVideoPage } from './settings/BackgroundVideoPage';
import { CharacterModelPage } from './settings/CharacterModelPage';
import { CharacterAnimationPage } from './settings/CharacterAnimationPage';

import { ChatbotBackendPage } from './settings/ChatbotBackendPage';
import { ArbiusLLMSettingsPage } from './settings/ArbiusLLMSettingsPage';
import { ChatGPTSettingsPage } from './settings/ChatGPTSettingsPage';
import { LlamaCppSettingsPage } from './settings/LlamaCppSettingsPage';
import { OllamaSettingsPage } from './settings/OllamaSettingsPage';
import { KoboldAiSettingsPage } from './settings/KoboldAiSettingsPage';

import { TTSBackendPage } from './settings/TTSBackendPage';
import { ElevenLabsSettingsPage } from './settings/ElevenLabsSettingsPage';
import { SpeechT5SettingsPage } from './settings/SpeechT5SettingsPage';
import { OpenAITTSSettingsPage } from './settings/OpenAITTSSettingsPage';
import { PiperSettingsPage } from './settings/PiperSettingsPage';
import { CoquiLocalSettingsPage } from './settings/CoquiLocalSettingsPage';
import { LocalXTTSSettingsPage } from "./settings/LocalXTTSSettingsPage";

import { RVCSettingsPage } from './settings/RVCSettingsPage';

import { STTBackendPage } from './settings/STTBackendPage';
import { STTWakeWordSettingsPage } from './settings/STTWakeWordSettingsPage';

import { WhisperOpenAISettingsPage } from './settings/WhisperOpenAISettingsPage';
import { WhisperCppSettingsPage } from './settings/WhisperCppSettingsPage';

import { VisionBackendPage } from './settings/VisionBackendPage';
import { VisionLlamaCppSettingsPage } from './settings/VisionLlamaCppSettingsPage';
import { VisionOllamaSettingsPage } from './settings/VisionOllamaSettingsPage';
import { VisionOpenAISettingsPage } from './settings/VisionOpenAISettingsPage';
import { VisionSystemPromptPage } from './settings/VisionSystemPromptPage';

import { NamePage } from './settings/NamePage';
import { SystemPromptPage } from './settings/SystemPromptPage';
import { useVrmStoreContext } from "@/features/vrmStore/vrmStoreContext";

export const Settings = ({
  onClickClose,
}: {
  onClickClose: () => void;
}) => {
  const { viewer } = useContext(ViewerContext);
  const { vrmList, vrmListAddFile } = useVrmStoreContext();
  useKeyboardShortcut("Escape", onClickClose);

  const [page, setPage] = useState('main_menu');
  const [breadcrumbs, setBreadcrumbs] = useState<Link[]>([]);
  const [showNotification, setShowNotification] = useState(false);
  const [settingsUpdated, setSettingsUpdated] = useState(false);

  const [chatbotBackend, setChatbotBackend] = useState(config("chatbot_backend"));
  const [arbiusLLMModelId, setArbiusLLMModelId] = useState(config("arbius_llm_model_id"));
  const [openAIApiKey, setOpenAIApiKey] = useState(config("openai_apikey"));
  const [openAIUrl, setOpenAIUrl] = useState(config("openai_url"));
  const [openAIModel, setOpenAIModel] = useState(config("openai_model"));
  const [llamaCppUrl, setLlamaCppUrl] = useState(config("llamacpp_url"));
  const [llamaCppStopSequence, setLlamaCppStopSequence] = useState(config("llamacpp_stop_sequence"));
  const [ollamaUrl, setOllamaUrl] = useState(config("ollama_url"));
  const [ollamaModel, setOllamaModel] = useState(config("ollama_model"));
  const [koboldAiUrl, setKoboldAiUrl] = useState(config("koboldai_url"));
  const [koboldAiUseExtra, setKoboldAiUseExtra] = useState<boolean>(config("koboldai_use_extra") === 'true' ? true : false);
  const [koboldAiStopSequence, setKoboldAiStopSequence] = useState(config("koboldai_stop_sequence"));

  const [ttsBackend, setTTSBackend] = useState(config("tts_backend"));
  const [elevenlabsApiKey, setElevenlabsApiKey] = useState(config("elevenlabs_apikey"));
  const [elevenlabsVoiceId, setElevenlabsVoiceId] = useState(config("elevenlabs_voiceid"));

  const [speechT5SpeakerEmbeddingsUrl, setSpeechT5SpeakerEmbeddingsUrl] = useState(config("speecht5_speaker_embedding_url"));

  const [openAITTSApiKey, setOpenAITTSApiKey] = useState(config("openai_tts_apikey"));
  const [openAITTSUrl, setOpenAITTSUrl] = useState(config("openai_tts_url"));
  const [openAITTSModel, setOpenAITTSModel] = useState(config("openai_tts_model"));
  const [openAITTSVoice, setOpenAITTSVoice] = useState(config("openai_tts_voice"));

  const [piperUrl, setPiperUrl] = useState(config("piper_url"));

  const [rvcUrl, setRvcUrl] = useState(config("rvc_url"));
  const [rvcEnabled, setRvcEnabled] = useState<boolean>(config("rvc_enabled") === 'true' ? true : false);
  const [rvcModelName, setRvcModelName] = useState(config("rvc_model_name"));
  const [rvcIndexPath, setRvcIndexPath] = useState(config("rvc_index_path"));
  const [rvcF0upKey, setRvcF0UpKey] = useState<number>(parseInt(config("rvc_f0_upkey")));
  const [rvcF0Method, setRvcF0Method] = useState(config("rvc_f0_method"));
  const [rvcIndexRate, setRvcIndexRate] = useState(config("rvc_index_rate"));
  const [rvcFilterRadius, setRvcFilterRadius] = useState<number>(parseInt(config("rvc_filter_radius")));
  const [rvcResampleSr, setRvcResampleSr] = useState<number>(parseInt(config("rvc_resample_sr")));
  const [rvcRmsMixRate, setRvcRmsMixRate] = useState<number>(parseInt(config("rvc_rms_mix_rate")));
  const [rvcProtect, setRvcProtect] = useState<number>(parseInt(config("rvc_protect")));

  const [coquiLocalUrl, setCoquiLocalUrl] = useState(config("coquiLocal_url"));
  const [coquiLocalVoiceId, setCoquiLocalVoiceId] = useState(config("coquiLocal_voiceid"));

  const [localXTTSUrl, setLocalXTTSUrl] = useState(config("localXTTS_url"));

  const [visionBackend, setVisionBackend] = useState(config("vision_backend"));
  const [visionLlamaCppUrl, setVisionLlamaCppUrl] = useState(config("vision_llamacpp_url"));
  const [visionOllamaUrl, setVisionOllamaUrl] = useState(config("vision_ollama_url"));
  const [visionOllamaModel, setVisionOllamaModel] = useState(config("vision_ollama_model"));
  const [visionOpenAIApiKey, setVisionOpenAIApiKey] = useState(config("vision_openai_apikey"));
  const [visionOpenAIUrl, setVisionOpenAIUrl] = useState(config("vision_openai_url"));
  const [visionOpenAIModel, setVisionOpenAIModel] = useState(config("vision_openai_model"));
  const [visionSystemPrompt, setVisionSystemPrompt] = useState(config("vision_system_prompt"));

  const [bgUrl, setBgUrl] = useState(config("bg_url"));
  const [bgColor, setBgColor] = useState(config("bg_color"));
  const [vrmUrl, setVrmUrl] = useState(config("vrm_url"));
  const [vrmHash, setVrmHash] = useState(config("vrm_hash"));
  const [vrmSaveType, setVrmSaveType] = useState(config('vrm_save_type'));
  const [youtubeVideoID, setYoutubeVideoID] = useState(config("youtube_videoid"));
  const [animationUrl, setAnimationUrl] = useState(config("animation_url"));
  const [animationProcedural, setAnimationProcedural] = useState<boolean>(config("animation_procedural") === 'true' ? true : false);

  const [sttBackend, setSTTBackend] = useState(config("stt_backend"));
  const [sttWakeWordEnabled, setSTTWakeWordEnabled] = useState<boolean>(config("wake_word_enabled") === 'true' ? true : false);
  const [sttWakeWord, setSTTWakeWord] = useState(config("wake_word"));
  
  const [whisperOpenAIUrl, setWhisperOpenAIUrl] = useState(config("openai_whisper_url"));
  const [whisperOpenAIApiKey, setWhisperOpenAIApiKey] = useState(config("openai_whisper_apikey"));
  const [whisperOpenAIModel, setWhisperOpenAIModel] = useState(config("openai_whisper_model"));
  const [whisperCppUrl, setWhisperCppUrl] = useState(config("whispercpp_url"));

  const [timeBeforeIdle, setTimeBeforeIdle] = useState<number>(parseInt(config("time_before_idle_sec")));
  const [minTimeInterval,setMinTimeInterval] = useState<number>(parseInt(config("min_time_interval_sec")));
  const [maxTimeInterval, setMaxTimeInterval] = useState<number>(parseInt(config("max_time_interval_sec")));
  const [timeToSleep, setTimeToSleep] = useState<number>(parseInt(config("time_to_sleep_sec")));
  const [idleTextPrompt, setIdleTextPrompt] = useState(config("idle_text_prompt"));

  const [name, setName] = useState(config("name"));
  const [systemPrompt, setSystemPrompt] = useState(config("system_prompt"));

  const [debugGfx, setDebugGfx] = useState<boolean>(config("debug_gfx") === 'true' ? true : false);
  const [mtoonDebugMode, setMtoonDebugMode] = useState(config("mtoon_debug_mode"));
  const [mtoonMaterialType, setMtoonMaterialType] = useState(config('mtoon_material_type'));
  const [useWebGPU, setUseWebGPU] = useState<boolean>(config("use_webgpu") === 'true' ? true : false);

  const vrmFileInputRef = useRef<HTMLInputElement>(null);
  const handleClickOpenVrmFile = useCallback(() => {
    vrmFileInputRef.current?.click();
  }, []);

  const bgImgFileInputRef = useRef<HTMLInputElement>(null);
  const handleClickOpenBgImgFile = useCallback(() => {
    bgImgFileInputRef.current?.click();
  }, []);

  const topMenuRef = useRef<HTMLDivElement>(null);
  const backButtonRef = useRef<HTMLDivElement>(null);
  const mainMenuRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  const handleChangeVrmFile = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files) return;

      const file = files[0];
      if (!file) return;

      const file_type = file.name.split(".").pop();

      if (file_type === "vrm") {
        vrmListAddFile(file, viewer);
      }

      event.target.value = "";
    },
    [viewer]
  );

  function handleChangeBgImgFile(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files) return;

    const file = files[0];
    if (!file) return;

    const file_type = file.name.split(".").pop();

    if (! file.type.match('image.*')) return;

    let reader = new FileReader();
    reader.onload = (function (_) {
      return function (e) {
        const url = e.target?.result;
        if (! url) return;

        document.body.style.backgroundImage = `url(${url})`;

        if ((url as string).length < 2_000_000) {
          updateConfig("youtube_videoid", "");
          updateConfig("bg_url", url as string);
          setShowNotification(true);
        } else {
          // TODO notify with warning how this cant be saved to localstorage
        }
      };
    })(file);

    reader.readAsDataURL(file);

    event.target.value = "";
  }

  useEffect(() => {
    const timeOutId = setTimeout(() => {
      if (settingsUpdated) {
        setShowNotification(true);
        setTimeout(() => {
          setShowNotification(false);
        }, 5000);
      }
    }, 1000);
    return () => clearTimeout(timeOutId);
  }, [
    chatbotBackend,
    arbiusLLMModelId,
    openAIApiKey, openAIUrl, openAIModel,
    llamaCppUrl, llamaCppStopSequence,
    ollamaUrl, ollamaModel,
    koboldAiUrl, koboldAiUseExtra, koboldAiStopSequence,
    ttsBackend,
    elevenlabsApiKey, elevenlabsVoiceId,
    speechT5SpeakerEmbeddingsUrl,
    openAITTSApiKey, openAITTSUrl, openAITTSModel, openAITTSVoice,
    piperUrl,
    rvcUrl,rvcEnabled,rvcModelName,rvcIndexPath,rvcF0upKey,rvcF0Method,rvcIndexRate,rvcFilterRadius,,rvcResampleSr,rvcRmsMixRate,rvcProtect,
    coquiLocalUrl,coquiLocalVoiceId,
    localXTTSUrl,
    visionBackend,
    visionLlamaCppUrl,
    visionOllamaUrl, visionOllamaModel,
    visionOpenAIApiKey, visionOpenAIUrl, visionOpenAIModel,
    visionSystemPrompt,
    bgColor,
    bgUrl, vrmHash, vrmUrl, youtubeVideoID, animationUrl, animationProcedural,
    sttBackend,
    whisperOpenAIApiKey, whisperOpenAIModel, whisperOpenAIUrl,
    whisperCppUrl,
    , timeBeforeIdle, minTimeInterval, maxTimeInterval, timeToSleep, idleTextPrompt,
    name,
    systemPrompt,
    debugGfx, mtoonDebugMode, mtoonMaterialType, useWebGPU,
    sttWakeWordEnabled, sttWakeWord,
  ]);

  useEffect(() => {
    function click(e: MouseEvent) {
      const target = e.target as HTMLElement;
      // console.log('click', target);
      if (mainMenuRef.current?.contains(target)) {
        // console.log('mainMenuRef click');
        return;
      }
      if (backButtonRef.current?.contains(target)) {
        // console.log('backButtonRef click');
        return;
      }
      if (topMenuRef.current?.contains(target)) {
        // console.log('topMenuRef click');
        return;
      }
      if (notificationsRef.current?.contains(target)) {
        // console.log('notificationsRef click');
        return;
      }

      // console.log('click outside to close');
      onClickClose();
    }
    document.addEventListener('click', click, { capture: true });

    return () => {
      document.removeEventListener('click', click, { capture: true });
    };
  }, [
    topMenuRef,
    backButtonRef,
    mainMenuRef,
    notificationsRef
  ]);

  function handleMenuClick(link: Link) {
    setPage(link.key)
    setBreadcrumbs([...breadcrumbs, link]);
  }

  function renderPage() {
    switch(page) {
    case 'main_menu':
      return <MenuPage
        keys={["appearance", "chatbot", "tts", "stt", "vision", "developer", "reset_settings", "community"]}
        menuClick={handleMenuClick} />;

    case 'appearance':
      return <MenuPage
        keys={["background_img", "background_color", "background_video", "character_model", "character_animation"]}
        menuClick={handleMenuClick} />;

    case 'chatbot':
      return <MenuPage
        keys={["chatbot_backend", "name", "system_prompt", "arbius_llm_settings", "chatgpt_settings", "llamacpp_settings", "ollama_settings", "koboldai_settings"]}
        menuClick={handleMenuClick} />;

    case 'language':
      return <LanguagePage
        setSettingsUpdated={setSettingsUpdated}
      />;

    case 'tts':
      return <MenuPage
        keys={["tts_backend", "elevenlabs_settings", "speecht5_settings", "coquiLocal_settings", "openai_tts_settings", "piper_settings", "localXTTS_settings", "rvc_settings"]}
        menuClick={handleMenuClick} />;

    case 'stt':
      return <MenuPage
        keys={["stt_backend", "stt_wake_word", "whisper_openai_settings", "whispercpp_settings"]}
        menuClick={handleMenuClick} />;

    case 'vision':
      return <MenuPage
        keys={["vision_backend", "vision_llamacpp_settings", "vision_ollama_settings", "vision_openai_settings", "vision_system_prompt"]}
        menuClick={handleMenuClick} />;

    case 'reset_settings':
      return <ResetSettingsPage />;

    case 'developer':
      return <DeveloperPage
        debugGfx={debugGfx}
        setDebugGfx={setDebugGfx}
        mtoonDebugMode={mtoonDebugMode}
        setMtoonDebugMode={setMtoonDebugMode}
        mtoonMaterialType={mtoonMaterialType}
        setMtoonMaterialType={setMtoonMaterialType}
        useWebGPU={useWebGPU}
        setUseWebGPU={setUseWebGPU}
        setSettingsUpdated={setSettingsUpdated}
      />;

    case 'community':
      return <CommunityPage />

    case 'background_img':
      return <BackgroundImgPage
        bgUrl={bgUrl}
        setBgUrl={setBgUrl}
        setSettingsUpdated={setSettingsUpdated}
        handleClickOpenBgImgFile={handleClickOpenBgImgFile}
        />

    case 'background_color':
      return <BackgroundColorPage
        bgColor={bgColor}
        setBgColor={setBgColor}
        setSettingsUpdated={setSettingsUpdated}
        />

    case 'background_video':
      return <BackgroundVideoPage
        youtubeVideoID={youtubeVideoID}
        setYoutubeVideoID={setYoutubeVideoID}
        setSettingsUpdated={setSettingsUpdated}
        />;

    case 'character_model':
      return <CharacterModelPage
        viewer={viewer}
        vrmHash={vrmHash}
        vrmUrl={vrmUrl}
        vrmSaveType={vrmSaveType}
        vrmList={vrmList}
        setVrmHash={setVrmHash}
        setVrmUrl={setVrmUrl}
        setVrmSaveType={setVrmSaveType}
        setSettingsUpdated={setSettingsUpdated}
        handleClickOpenVrmFile={handleClickOpenVrmFile}
        />

    case 'character_animation':
      return <CharacterAnimationPage
        viewer={viewer}
        animationUrl={animationUrl}
        setAnimationUrl={setAnimationUrl}
        animationProcedural={animationProcedural}
        setAnimationProcedural={setAnimationProcedural}
        setSettingsUpdated={setSettingsUpdated}
        />

    case 'chatbot_backend':
      return <ChatbotBackendPage
        chatbotBackend={chatbotBackend}
        setChatbotBackend={setChatbotBackend}
        setSettingsUpdated={setSettingsUpdated}
        setPage={setPage}
        breadcrumbs={breadcrumbs}
        setBreadcrumbs={setBreadcrumbs}
        />

    case 'arbius_llm_settings':
      return <ArbiusLLMSettingsPage
        arbiusLLMModelId={arbiusLLMModelId}
        setArbiusLLMModelId={setArbiusLLMModelId}
        setSettingsUpdated={setSettingsUpdated}
        />

    case 'chatgpt_settings':
      return <ChatGPTSettingsPage
        openAIApiKey={openAIApiKey}
        setOpenAIApiKey={setOpenAIApiKey}
        openAIUrl={openAIUrl}
        setOpenAIUrl={setOpenAIUrl}
        openAIModel={openAIModel}
        setOpenAIModel={setOpenAIModel}
        setSettingsUpdated={setSettingsUpdated}
        />

    case 'llamacpp_settings':
      return <LlamaCppSettingsPage
        llamaCppUrl={llamaCppUrl}
        setLlamaCppUrl={setLlamaCppUrl}
        llamaCppStopSequence={llamaCppStopSequence}
        setLlamaCppStopSequence={setLlamaCppStopSequence}
        setSettingsUpdated={setSettingsUpdated}
        />

    case 'ollama_settings':
      return <OllamaSettingsPage
        ollamaUrl={ollamaUrl}
        setOllamaUrl={setOllamaUrl}
        ollamaModel={ollamaModel}
        setOllamaModel={setOllamaModel}
        setSettingsUpdated={setSettingsUpdated}
        />

    case 'koboldai_settings':
      return <KoboldAiSettingsPage
        koboldAiUrl={koboldAiUrl}
        setKoboldAiUrl={setKoboldAiUrl}
        koboldAiUseExtra={koboldAiUseExtra}
        setKoboldAiUseExtra={setKoboldAiUseExtra}
        koboldAiStopSequence={koboldAiStopSequence}
        setKoboldAiStopSequence={setKoboldAiStopSequence}
        setSettingsUpdated={setSettingsUpdated}
        />

    case 'tts_backend':
      return <TTSBackendPage
        ttsBackend={ttsBackend}
        setTTSBackend={setTTSBackend}
        setSettingsUpdated={setSettingsUpdated}
        setPage={setPage}
        breadcrumbs={breadcrumbs}
        setBreadcrumbs={setBreadcrumbs}
        />

    case 'elevenlabs_settings':
      return <ElevenLabsSettingsPage
        elevenlabsApiKey={elevenlabsApiKey}
        setElevenlabsApiKey={setElevenlabsApiKey}
        elevenlabsVoiceId={elevenlabsVoiceId}
        setElevenlabsVoiceId={setElevenlabsVoiceId}
        setSettingsUpdated={setSettingsUpdated}
        />

    case 'speecht5_settings':
      return <SpeechT5SettingsPage
        speechT5SpeakerEmbeddingsUrl={speechT5SpeakerEmbeddingsUrl}
        setSpeechT5SpeakerEmbeddingsUrl={setSpeechT5SpeakerEmbeddingsUrl}
        setSettingsUpdated={setSettingsUpdated}
        />

    case 'openai_tts_settings':
      return <OpenAITTSSettingsPage
        openAITTSApiKey={openAITTSApiKey}
        setOpenAITTSApiKey={setOpenAITTSApiKey}
        openAITTSUrl={openAITTSUrl}
        setOpenAITTSUrl={setOpenAITTSUrl}
        openAITTSModel={openAITTSModel}
        setOpenAITTSModel={setOpenAITTSModel}
        openAITTSVoice={openAITTSVoice}
        setOpenAITTSVoice={setOpenAITTSVoice}
        setSettingsUpdated={setSettingsUpdated}
        />

    case 'piper_settings':
      return <PiperSettingsPage
        piperUrl={piperUrl}
        setPiperUrl={setPiperUrl}
        setSettingsUpdated={setSettingsUpdated}
        />
    
    case 'coquiLocal_settings':
      return <CoquiLocalSettingsPage
        coquiLocalUrl={coquiLocalUrl}
        coquiLocalVoiceId={coquiLocalVoiceId}
        setCoquiLocalVoiceId={setCoquiLocalVoiceId}
        setCoquiLocalUrl={setCoquiLocalUrl}
        setSettingsUpdated={setSettingsUpdated}
        />

    case 'localXTTS_settings':
      return <LocalXTTSSettingsPage
        localXTTSUrl={localXTTSUrl}
        setLocalXTTSUrl={setLocalXTTSUrl}
        setSettingsUpdated={setSettingsUpdated}
        />

    case 'rvc_settings':
      return <RVCSettingsPage
        rvcUrl={rvcUrl}
        rvcEnabled={rvcEnabled}
        rvcModelName={rvcModelName}
        rvcIndexPath={rvcIndexPath}
        rvcF0upKey={rvcF0upKey}
        rvcF0Method={rvcF0Method}
        rvcIndexRate={rvcIndexRate}
        rvcFilterRadius={rvcFilterRadius}
        rvcResampleSr={rvcResampleSr}
        rvcRmsMixRate={rvcRmsMixRate}
        rvcProtect={rvcProtect}
        setRvcUrl={setRvcUrl}
        setRvcEnabled={setRvcEnabled}
        setRvcModelName={setRvcModelName}
        setRvcIndexPath={setRvcIndexPath}
        setRvcF0upKey={setRvcF0UpKey}
        setRvcF0Method={setRvcF0Method}
        setRvcIndexRate={setRvcIndexRate}
        setRvcFilterRadius={setRvcFilterRadius}
        setRvcResampleSr={setRvcResampleSr}
        setRvcRmsMixRate={setRvcRmsMixRate}
        setRvcProtect={setRvcProtect}
        setSettingsUpdated={setSettingsUpdated}
        />

    case'stt_backend':
      return <STTBackendPage
        sttBackend={sttBackend}
        setSTTBackend={setSTTBackend}
        setSettingsUpdated={setSettingsUpdated}
        setPage={setPage}
        breadcrumbs={breadcrumbs}
        setBreadcrumbs={setBreadcrumbs}
        />

    case'stt_wake_word':
      return <STTWakeWordSettingsPage
        sttWakeWordEnabled={sttWakeWordEnabled}
        sttWakeWord={sttWakeWord}
        timeBeforeIdle={timeBeforeIdle}
        setSTTWakeWordEnabled={setSTTWakeWordEnabled}
        setSTTWakeWord={setSTTWakeWord}
        setTimeBeforeIdle={setTimeBeforeIdle}
        setSettingsUpdated={setSettingsUpdated}
        />

    case 'whisper_openai_settings':
      return <WhisperOpenAISettingsPage
        whisperOpenAIUrl={whisperOpenAIUrl}
        setWhisperOpenAIUrl={setWhisperOpenAIUrl}
        whisperOpenAIApiKey={whisperOpenAIApiKey}
        setWhisperOpenAIApiKey={setWhisperOpenAIApiKey}
        whisperOpenAIModel={whisperOpenAIModel}
        setWhisperOpenAIModel={setWhisperOpenAIModel}
        setSettingsUpdated={setSettingsUpdated}
        />

    case 'whispercpp_settings':
      return <WhisperCppSettingsPage
        whisperCppUrl={whisperCppUrl}
        setWhisperCppUrl={setWhisperCppUrl}
        setSettingsUpdated={setSettingsUpdated}
        />

    case 'vision_backend':
      return <VisionBackendPage
        visionBackend={visionBackend}
        setVisionBackend={setVisionBackend}
        setSettingsUpdated={setSettingsUpdated}
        setPage={setPage}
        breadcrumbs={breadcrumbs}
        setBreadcrumbs={setBreadcrumbs}
        />

    case 'vision_llamacpp_settings':
      return <VisionLlamaCppSettingsPage
        visionLlamaCppUrl={visionLlamaCppUrl}
        setVisionLlamaCppUrl={setVisionLlamaCppUrl}
        setSettingsUpdated={setSettingsUpdated}
        />

    case 'vision_ollama_settings':
      return <VisionOllamaSettingsPage
        visionOllamaUrl={visionOllamaUrl}
        setVisionOllamaUrl={setVisionOllamaUrl}
        visionOllamaModel={visionOllamaModel}
        setVisionOllamaModel={setVisionOllamaModel}
        setSettingsUpdated={setSettingsUpdated}
        />

    case 'vision_openai_settings':
      return <VisionOpenAISettingsPage
        visionOpenAIApiKey={visionOpenAIApiKey}
        setVisionOpenAIApiKey={setVisionOpenAIApiKey}
        visionOpenAIUrl={visionOpenAIUrl}
        setVisionOpenAIUrl={setVisionOpenAIUrl}
        visionOpenAIModel={visionOpenAIModel}
        setVisionOpenAIModel={setVisionOpenAIModel}
        setSettingsUpdated={setSettingsUpdated}
        />

    case 'vision_system_prompt':
      return <VisionSystemPromptPage
        visionSystemPrompt={visionSystemPrompt}
        setVisionSystemPrompt={setVisionSystemPrompt}
        setSettingsUpdated={setSettingsUpdated}
        />

    case 'system_prompt':
      return <SystemPromptPage
        systemPrompt={systemPrompt}
        setSystemPrompt={setSystemPrompt}
        setSettingsUpdated={setSettingsUpdated}
        />

    case 'name':
      return <NamePage
        name={name}
        setName={setName}
        setSettingsUpdated={setSettingsUpdated}
        />

    default:
      throw new Error('page not found');
    }
  }

  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-200"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
        onClick={onClickClose}
      ></div>

      {/* Modal Container */}
      <div className="relative w-full max-w-xl max-h-[80vh] bg-white/95 backdrop-blur-xl shadow-2xl rounded-lg overflow-hidden flex flex-col z-50">
        {/* Header with Breadcrumbs */}
        <div
          className="flex-shrink-0 bg-slate-900/95 backdrop-blur-xl text-white px-3 py-2 border-b border-slate-700/30"
          ref={topMenuRef}
        >
          <div className="flex items-center justify-between">
            <nav aria-label="Breadcrumb" className="flex items-center min-w-0">
              <ol role="list" className="flex items-center space-x-1.5">
                <li className="flex">
                  <span
                    onClick={() => {
                      if (breadcrumbs.length === 0) {
                        onClickClose();
                        return;
                      }
                      setPage('main_menu');
                      setBreadcrumbs([]);
                    }}
                    className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <HomeIcon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                  </span>
                </li>

                {breadcrumbs.map((breadcrumb) => (
                  <li key={breadcrumb.key} className="flex">
                    <div className="flex items-center">
                      <ChevronRightIcon className="h-3.5 w-3.5 flex-shrink-0 text-slate-600" aria-hidden="true" />
                      <span
                        onClick={() => {
                          setPage(breadcrumb.key);
                          const nb = [];
                          for (let b of breadcrumbs) {
                            nb.push(b);
                            if (b.key === breadcrumb.key) {
                              break;
                            }
                          }
                          setBreadcrumbs(nb);
                        }}
                        className="ml-1.5 text-xs font-medium text-slate-300 hover:text-white cursor-pointer transition-colors"
                      >
                        {breadcrumb.label}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            </nav>

            <button
              onClick={onClickClose}
              className="bg-white/10 hover:bg-white/20 text-white rounded p-1 transition-colors cursor-pointer ml-2 flex-shrink-0"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto bg-transparent">
          <div className="p-3">
            {/* Page Content */}
            <div ref={mainMenuRef}>
              { renderPage() }
            </div>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div
        aria-live="assertive"
        className="pointer-events-none fixed bottom-0 right-0 flex items-end px-6 py-6 z-[60]"
        ref={notificationsRef}
      >
        <Transition
          show={showNotification}
          as={Fragment}
          enter="transform ease-out duration-300 transition"
          enterFrom="translate-y-2 opacity-0"
          enterTo="translate-y-0 opacity-100"
          leave="transition ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="pointer-events-auto overflow-hidden rounded bg-white/80 backdrop-blur-xl shadow-lg border border-white/40 px-3 py-2">
            <div className="flex items-center gap-2">
              <CheckCircleIcon className="h-4 w-4 text-emerald-500 flex-shrink-0" aria-hidden="true" />
              <p className="text-xs font-semibold text-slate-900">Saved</p>
              <button
                type="button"
                className="inline-flex rounded text-slate-400 hover:text-slate-600 transition-colors cursor-pointer ml-2"
                onClick={() => {
                  setShowNotification(false)
                }}
              >
                <XMarkIcon className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </Transition>
      </div>

      <input
        type="file"
        className="hidden"
        accept=".vrm"
        ref={vrmFileInputRef}
        onChange={handleChangeVrmFile}
      />
      <input
        type="file"
        className="hidden"
        accept=".jpg,.jpeg,.png,.gif,.webp"
        ref={bgImgFileInputRef}
        onChange={handleChangeBgImgFile}
      />
    </div>
  );
};
