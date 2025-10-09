import {
  Fragment,
  useContext,
  useEffect,
  useState,
} from "react";
import { Menu, Transition } from '@headlessui/react'
import { clsx } from "clsx";
import {
  CloudArrowDownIcon,
  CodeBracketSquareIcon,
  CubeIcon,
  CubeTransparentIcon,
  LanguageIcon,
  MicrophoneIcon,
  ShareIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  Squares2X2Icon,
  SquaresPlusIcon,
  VideoCameraIcon,
  VideoCameraSlashIcon,
} from "@heroicons/react/24/outline";
import { IconBrain } from '@tabler/icons-react';

import { MenuButton } from "@/components/menuButton";
import { MicrophoneSettings } from "@/components/MicrophoneSettings";
import { AssistantText } from "@/components/assistantText";
import { Alert } from "@/components/alert";
import { UserText } from "@/components/userText";
import { ChatLog } from "@/components/ChatHistory";
import VrmViewer from "@/components/vrmViewer";
import { MessageInputContainer } from "@/components/LazyMessageInput";
import { LoadingProgress } from "@/components/loadingProgress";
import { DebugPane } from "@/components/DebugPanel";
import { EmbeddedWebcam } from "@/components/embeddedWebcam";
import { Moshi } from "@/features/moshi/components/Moshi";

import { ViewerContext } from "@/features/scene3d/SceneCoordinatorContext";
import { Message, Role } from "@/features/chat/messages";
import { ChatContext } from "@/features/chat/chatContext";
import { AlertContext } from "@/features/alert/alertContext";

import { config } from '@/utils/config';
import { VrmStoreProvider } from "@/features/vrmStore/vrmStoreContext";
import { ChatModeText } from "@/components/ChatHistoryOverlay";

function detectVRHeadset() {
  const userAgent = navigator.userAgent.toLowerCase();

  // Meta Quest detection
  // Quest 2 and 3 both use "oculus" in their user agent
  const isQuest = userAgent.includes('oculus') ||
                  userAgent.includes('quest 2') ||
                  userAgent.includes('quest 3');

  // Vision Pro detection
  // visionOS is the specific identifier for Apple Vision Pro
  const isVisionPro = userAgent.includes('visionos') ||
                      userAgent.includes('xros');

  // Detailed device information
  let deviceInfo = {
    isVRDevice: isQuest || isVisionPro,
    deviceType: '',
    browserInfo: userAgent
  };

  if (isQuest) {
    deviceInfo.deviceType = 'quest-3';
    if (userAgent.includes('quest 3')) {
      deviceInfo.deviceType = 'quest-3';
    } else if (userAgent.includes('quest 2')) {
      deviceInfo.deviceType = 'quest-2';
    }
  } else if (isVisionPro) {
    deviceInfo.deviceType = 'vision-pro';
  }

  return deviceInfo;
}


export default function Home() {
  // const { t, i18n } = useTranslation();
  // const currLang = i18n.resolvedLanguage;
  const { viewer } = useContext(ViewerContext);
  const { alert } = useContext(AlertContext);
  const { chat: bot } = useContext(ChatContext);

  const [chatSpeaking, setChatSpeaking] = useState(false);
  const [chatProcessing, setChatProcessing] = useState(false);
  const [chatLog, setChatLog] = useState<Message[]>([]);
  const [assistantMessage, setAssistantMessage] = useState("");
  const [userMessage, setUserMessage] = useState("");
  const [shownMessage, setShownMessage] = useState<Role>("system");

  // showContent exists to allow ssr
  // otherwise issues from usage of localStorage and window will occur
  const [showContent, setShowContent] = useState(false);


  const [showDebug, setShowDebug] = useState(false);
  const [showChatMode, setShowChatMode] = useState(false);

  // null indicates havent loaded config yet
  const [muted, setMuted] = useState<boolean|null>(null);
  const [webcamEnabled, setWebcamEnabled] = useState(false);
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);

  // Microphone settings
  const [showMicSettings, setShowMicSettings] = useState(false);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('default');

  // Initialize from localStorage if available, otherwise use config
  const [autosendEnabled, setAutosendEnabled] = useState(() => {
    const stored = localStorage.getItem('amica_autosend_from_mic');
    return stored !== null ? stored === 'true' : config('autosend_from_mic') === 'true';
  });

  const [micEnabled, setMicEnabled] = useState(() => {
    const stored = localStorage.getItem('amica_mic_enabled');
    return stored !== null ? stored === 'true' : config('stt_backend') !== 'none';
  });

  const [isARSupported, setIsARSupported] = useState(false);
  const [isVRSupported, setIsVRSupported] = useState(false);

  const [isVRHeadset, setIsVRHeadset] = useState(false);

  // Persist autosend preference to localStorage
  useEffect(() => {
    localStorage.setItem('amica_autosend_from_mic', autosendEnabled.toString());
  }, [autosendEnabled]);

  // Persist mic enabled preference to localStorage
  useEffect(() => {
    localStorage.setItem('amica_mic_enabled', micEnabled.toString());
  }, [micEnabled]);

  // Load audio devices
  useEffect(() => {
    const loadAudioDevices = async () => {
      // Guard: Check if navigator.mediaDevices is available
      if (!navigator.mediaDevices?.enumerateDevices) {
        console.warn('[Audio Devices] navigator.mediaDevices not available');
        return;
      }

      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(device => device.kind === 'audioinput');
        console.log('[Audio] Found', audioInputs.length, 'input devices');
        setAudioDevices(audioInputs);
      } catch (err) {
        console.error('[Audio Devices] Failed to enumerate devices:', err);
      }
    };

    loadAudioDevices();

    // Guard: Only add event listener if navigator.mediaDevices is available
    if (navigator.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', loadAudioDevices);
    }

    return () => {
      // Guard: Only remove event listener if navigator.mediaDevices is available
      if (navigator.mediaDevices?.removeEventListener) {
        navigator.mediaDevices.removeEventListener('devicechange', loadAudioDevices);
      }
    };
  }, []);

  useEffect(() => {
    if (muted === null) {
      setMuted(config('tts_muted') === 'true');
    }

    if (config("bg_color") !== '') {
      document.body.style.backgroundColor = config("bg_color");
    } else {
      document.body.style.backgroundImage = `url(${config("bg_url")})`;
    }

    if (window.navigator.xr && window.navigator.xr.isSessionSupported) {
      let deviceInfo = detectVRHeadset();
      setIsVRHeadset(deviceInfo.isVRDevice);

      window.navigator.xr.isSessionSupported('immersive-ar').then((supported) => {
        console.log('[XR] AR support:', supported);
        setIsARSupported(supported);
      });
      window.navigator.xr.isSessionSupported('immersive-vr').then((supported) => {
        console.log('[XR] VR support:', supported);
        setIsVRSupported(supported);
      });
    }
  }, []);


  function toggleTTSMute() {
    setMuted(prev => !prev)
  }

  const toggleState = (
    setFunc: React.Dispatch<React.SetStateAction<boolean>>,
    deps: React.Dispatch<React.SetStateAction<boolean>>[],
  ) => {
    setFunc(prev => {
      if (!prev) {
        deps.forEach(dep => dep(false));
      }
      return !prev;
    });
  };

  const toggleChatMode = () => {
    toggleState(setShowChatMode, []);
  };

  const toggleXR = async (immersiveType: XRSessionMode) => {
    console.log('[XR] Toggle', immersiveType);

    if (! window.navigator.xr) {
      console.error("WebXR not supported");
      return;
    }
    if (! await window.navigator.xr.isSessionSupported(immersiveType)) {
      console.error("Session not supported");
      return;
    }

    if (! viewer.isReady) {
      console.error("Viewer not ready");
      return;
    }

    // TODO should hand tracking be required?
    let optionalFeatures: string[] = [
      'hand-tracking',
      'local-floor',
    ];
    if (immersiveType === 'immersive-ar') {
      optionalFeatures.push('dom-overlay');
    }

    const sessionInit = {
      optionalFeatures,
      domOverlay: { root: document.body },
    };

    if (viewer.currentSession) {
      viewer.onSessionEnded();

      try {
        await viewer.currentSession.end();
      } catch (err) {
        // some times session already ended not due to user interaction
        console.warn(err);
      }

      // @ts-ignore
      if (window.navigator.xr.offerSession !== undefined) {
        // @ts-ignore
        const session = await navigator.xr?.offerSession(immersiveType, sessionInit);
        viewer.onSessionStarted(session, immersiveType);
      }
      return;
    }

    // @ts-ignore
    if (window.navigator.xr.offerSession !== undefined ) {
      // @ts-ignore
      const session = await navigator.xr?.offerSession(immersiveType, sessionInit);
      viewer.onSessionStarted(session, immersiveType);
      return;
    }

    try {
      const session = await window.navigator.xr.requestSession(immersiveType, sessionInit);

      viewer.onSessionStarted(session, immersiveType);
    } catch (err) {
      console.error(err);
    }

  }


  useEffect(() => {
    bot.initialize(
      viewer,
      alert,
      setChatLog,
      setUserMessage,
      setAssistantMessage,
      setShownMessage,
      setChatProcessing,
      setChatSpeaking,
    );

  }, [bot, viewer]);

  // this exists to prevent build errors with ssr
  useEffect(() => setShowContent(true), []);
  if (!showContent) return <></>;

  return (
    <div>
      { config("youtube_videoid") !== '' && (
        <div className="fixed video-container w-full h-full z-0">
          <iframe
            className="w-full h-full"
            src={`https://www.youtube.com/embed/${config("youtube_videoid")}?&autoplay=1&mute=1&playsinline=1&loop=1&controls=0&disablekb=1&fs=0&playlist=${config("youtube_videoid")}`}
            frameBorder="0"></iframe>
        </div>
      )}

      <LoadingProgress />

      { webcamEnabled && <EmbeddedWebcam setWebcamEnabled={setWebcamEnabled} /> }
      { showDebug && <DebugPane onClickClose={() => setShowDebug(false) }/> }

      <VrmStoreProvider>
        <VrmViewer chatMode={showChatMode}/>
      </VrmStoreProvider>

      <MessageInputContainer
        isChatProcessing={chatProcessing}
        audioDevices={audioDevices}
        selectedDeviceId={selectedDeviceId}
        micEnabled={micEnabled}
      />

      {/* main menu */}
      <div className="absolute z-10 m-2">
        <div className="grid grid-flow-col gap-[8px] place-content-end mt-2 bg-white/80 rounded-md backdrop-blur-md shadow-sm">
          <div className='flex flex-col justify-center items-center p-1 space-y-3'>
            { muted ? (
              <MenuButton
                large={isVRHeadset}
                icon={SpeakerXMarkIcon}
                onClick={toggleTTSMute}
                label="unmute"
              />
            ) : (
              <MenuButton
                large={isVRHeadset}
                icon={SpeakerWaveIcon}
                onClick={toggleTTSMute}
                label="mute"
              />
            )}

            <div className="relative">
              <MenuButton
                large={isVRHeadset}
                icon={MicrophoneIcon}
                onClick={() => setShowMicSettings(!showMicSettings)}
                label="microphone settings"
              />
              <MicrophoneSettings
                audioDevices={audioDevices}
                selectedDeviceId={selectedDeviceId}
                onDeviceChange={setSelectedDeviceId}
                autosendEnabled={autosendEnabled}
                onAutosendToggle={() => setAutosendEnabled(!autosendEnabled)}
                micEnabled={micEnabled}
                onMicToggle={() => setMicEnabled(!micEnabled)}
                isOpen={showMicSettings}
                onClose={() => setShowMicSettings(false)}
              />
            </div>

            { webcamEnabled ? (
              <MenuButton
                large={isVRHeadset}
                icon={VideoCameraIcon}
                onClick={() => setWebcamEnabled(false)}
                label="disable webcam"
              />
            ) : (
              <MenuButton
                large={isVRHeadset}
                icon={VideoCameraSlashIcon}
                onClick={() => setWebcamEnabled(true)}
                label="enable webcam"
              />
            )}

            <MenuButton
              large={isVRHeadset}
              icon={CubeTransparentIcon}
              disabled={!isARSupported}
              onClick={() => toggleXR('immersive-ar')}
              label="Augmented Reality"
            />

            <MenuButton
              large={isVRHeadset}
              icon={CubeIcon}
              disabled={!isVRSupported}
              onClick={() => toggleXR('immersive-vr')}
              label="Virtual Reality"
            />

            <MenuButton
              large={isVRHeadset}
              icon={CodeBracketSquareIcon}
              onClick={() => setShowDebug(true)}
              label="debug"
            />
          </div>
        </div>
      </div>

      {/*
      <Moshi
        workerAddr="https://orcsza38j78yrh-8998.proxy.runpod.net/"
        workerAuthId="amica"
        audioContext={null}
        worklet={null}
        onConversationEnd={() => {}}
        isBypass={false}
      />
      */}

      {/* Normal chat text */}
      {! showChatMode && (
        <>
          { shownMessage === 'assistant' && (
            <AssistantText message={assistantMessage} />
          )}
          { shownMessage === 'user' && (
            <UserText message={userMessage} />
          )}
        </>
      )}

      {/* Chat mode text */}
      {showChatMode && <ChatModeText messages={chatLog}/>}

      <Alert />
    </div>
  );
}
