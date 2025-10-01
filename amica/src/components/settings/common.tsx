import { ReactElement } from 'react';

import {
  AdjustmentsHorizontalIcon,
  ChatBubbleOvalLeftEllipsisIcon,
  IdentificationIcon,
  LanguageIcon,
  UsersIcon,
  CommandLineIcon,
  RocketLaunchIcon,
  FaceSmileIcon,
  MusicalNoteIcon,
  PowerIcon,
  PhotoIcon,
  FilmIcon,
  SpeakerWaveIcon,
  DocumentTextIcon,
  Cog6ToothIcon,
  PencilSquareIcon,
  PencilIcon,
  EyeDropperIcon,
  EyeIcon,
  SwatchIcon,
  MoonIcon,
  SunIcon,
  CogIcon,
} from '@heroicons/react/24/outline';

export function basicPage(
  title: string,
  description: React.ReactNode,
  children: React.ReactNode,
) {
  return (
    <>
      <div className="rounded bg-white/40 backdrop-blur-xl border border-white/30 p-3">
        <h2 className="text-sm font-bold text-slate-900 w-full">{title}</h2>
        <p className="w-full mt-1 mb-2 text-slate-600 text-xs leading-relaxed">{description}</p>

        <div className="mt-3">
          {children}
        </div>
      </div>
    </>
  );
}

export function BasicPage({
  title,
  description,
  children,
}: {
  title: string,
  description: React.ReactNode,
  children: React.ReactNode,
}) {
  return (
    <>
      <div className="rounded bg-white/40 backdrop-blur-xl border border-white/30 p-3">
        <h2 className="text-sm font-bold text-slate-900 w-full">{title}</h2>
        <p className="w-full mt-1 mb-2 text-slate-600 text-xs leading-relaxed">{description}</p>

        <div className="mt-3">
          {children}
        </div>
      </div>
    </>
  );
}

export function FormRow({label, children}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="sm:col-span-3 max-w-md">
      <label className="block text-xs font-semibold text-slate-900 mb-1.5">
        {label}
      </label>
      <div>
        {children}
      </div>
    </div>
  );
}

export function basename(path: string) {
  const a = path.split("/");
  return a[a.length - 1];
}

export function thumbPrefix(path: string) {
  const a = path.split("/");
  a[a.length - 1] = "thumb-" + a[a.length - 1];
  return a.join("/");
}

export function hashCode(str: string): string {
  var hash = 0, i = 0, len = str.length;
  while ( i < len ) {
      hash  = ((hash << 5) - hash + str.charCodeAt(i++)) << 0;
  }
  return hash.toString();
}

export type Link = {
  key: string;
  label: string;
  icon?: ReactElement;
  className?: string;
}

export function getLinkFromPage(page: string) {
  return {
    key: page,
    label: getLabelFromPage(page),
    icon: getIconFromPage(page),
    className: getClassNameFromPage(page),
  };
}

export function pagesToLinks(keys: string[]): Link[] {
  const links: Link[] = [];
  for (const key of keys) {
    links.push(getLinkFromPage(key));
  }
  return links;
}

export type PageProps = {
  setPage: (page: string) => void;
  breadcrumbs: Link[];
  setBreadcrumbs: (breadcrumbs: Link[]) => void;
}

export function getIconFromPage(page: string): ReactElement {
  switch(page) {
    case 'appearance':          return <FaceSmileIcon className="h-4 w-4 flex-none text-slate-700" aria-hidden="true" />;
    case 'chatbot':             return <ChatBubbleOvalLeftEllipsisIcon className="h-4 w-4 flex-none text-slate-700" aria-hidden="true" />;
    case 'language':            return <LanguageIcon className="h-4 w-4 flex-none text-slate-700" aria-hidden="true" />;
    case 'tts':                 return <MusicalNoteIcon className="h-4 w-4 flex-none text-slate-700" aria-hidden="true" />;
    case 'stt':                 return <PencilIcon className="h-4 w-4 flex-none text-slate-700" aria-hidden="true" />;
    case 'vision':              return <EyeIcon className="h-4 w-4 flex-none text-slate-700" aria-hidden="true" />;
    case 'reset_settings':      return <PowerIcon className="h-4 w-4 flex-none text-rose-600" aria-hidden="true" />;
    case 'developer':           return <CommandLineIcon className="h-4 w-4 flex-none text-emerald-600" aria-hidden="true" />;
    case 'community':           return <RocketLaunchIcon className="h-4 w-4 flex-none text-slate-700" aria-hidden="true" />;

    case 'background_img':      return <PhotoIcon className="h-4 w-4 flex-none text-slate-700" aria-hidden="true" />;
    case 'background_color':      return <SwatchIcon className="h-4 w-4 flex-none text-slate-700" aria-hidden="true" />;
    case 'background_video':    return <FilmIcon className="h-4 w-4 flex-none text-slate-700" aria-hidden="true" />;
    case 'character_model':     return <UsersIcon className="h-4 w-4 flex-none text-slate-700" aria-hidden="true" />;
    case 'character_animation': return <AdjustmentsHorizontalIcon className="h-4 w-4 flex-none text-slate-700" aria-hidden="true" />;

    case 'chatbot_backend':     return <Cog6ToothIcon className="h-4 w-4 flex-none text-slate-700" aria-hidden="true" />;
    case 'arbius_llm_settings': return <AdjustmentsHorizontalIcon className="h-4 w-4 flex-none text-slate-700" aria-hidden="true" />;
    case 'chatgpt_settings':    return <AdjustmentsHorizontalIcon className="h-4 w-4 flex-none text-slate-700" aria-hidden="true" />;
    case 'llamacpp_settings':   return <AdjustmentsHorizontalIcon className="h-4 w-4 flex-none text-slate-700" aria-hidden="true" />;
    case 'ollama_settings':     return <AdjustmentsHorizontalIcon className="h-4 w-4 flex-none text-slate-700" aria-hidden="true" />;
    case 'koboldai_settings':   return <AdjustmentsHorizontalIcon className="h-4 w-4 flex-none text-slate-700" aria-hidden="true" />;
    case 'name':                return <IdentificationIcon className="h-4 w-4 flex-none text-slate-700" aria-hidden="true" />;
    case 'system_prompt':       return <DocumentTextIcon className="h-4 w-4 flex-none text-slate-700" aria-hidden="true" />;

    case 'tts_backend':         return <SpeakerWaveIcon className="h-4 w-4 flex-none text-slate-700" aria-hidden="true" />;
    case 'elevenlabs_settings': return <AdjustmentsHorizontalIcon className="h-4 w-4 flex-none text-slate-700" aria-hidden="true" />;
    case 'speecht5_settings':   return <AdjustmentsHorizontalIcon className="h-4 w-4 flex-none text-slate-700" aria-hidden="true" />;
    case 'openai_tts_settings': return <AdjustmentsHorizontalIcon className="h-4 w-4 flex-none text-slate-700" aria-hidden="true" />;
    case 'piper_settings': return <AdjustmentsHorizontalIcon className="h-4 w-4 flex-none text-slate-700" aria-hidden="true" />;
    case 'rvc_settings': return <CogIcon className="h-4 w-4 flex-none text-slate-700" aria-hidden="true" />;
    case 'coquiLocal_settings': return <AdjustmentsHorizontalIcon className="h-4 w-4 flex-none text-slate-700" aria-hidden="true" />;
    case 'localXTTS_settings': return <AdjustmentsHorizontalIcon className="h-4 w-4 flex-none text-slate-700" aria-hidden="true" />;

    case 'stt_backend':         return <PencilSquareIcon className="h-4 w-4 flex-none text-slate-700" aria-hidden="true" />;
    case 'stt_wake_word':  return <MoonIcon className="h-4 w-4 flex-none text-slate-700" aria-hidden="true" />;
    case 'whisper_openai_settings':  return <AdjustmentsHorizontalIcon className="h-4 w-4 flex-none text-slate-700" aria-hidden="true" />;
    case 'whispercpp_settings': return <AdjustmentsHorizontalIcon className="h-4 w-4 flex-none text-slate-700" aria-hidden="true" />;

    case 'vision_backend':           return <EyeDropperIcon className="h-4 w-4 flex-none text-slate-700" aria-hidden="true" />;
    case 'vision_llamacpp_settings': return <AdjustmentsHorizontalIcon className="h-4 w-4 flex-none text-slate-700" aria-hidden="true" />;
    case 'vision_ollama_settings':   return <AdjustmentsHorizontalIcon className="h-4 w-4 flex-none text-slate-700" aria-hidden="true" />;
    case 'vision_openai_settings':   return <AdjustmentsHorizontalIcon className="h-4 w-4 flex-none text-slate-700" aria-hidden="true" />;
    case 'vision_system_prompt':     return <DocumentTextIcon className="h-4 w-4 flex-none text-slate-700" aria-hidden="true" />;
  }

  return <></>;
}

function getLabelFromPage(page: string): string {

  switch(page) {
    case 'appearance':          return 'Appearance';
    case 'chatbot':             return 'ChatBot';
    case 'language':            return 'Language';
    case 'tts':                 return 'Text-to-Speech';
    case 'stt':                 return 'Speech-to-text';
    case 'vision':              return 'Vision';
    case 'reset_settings':      return 'Reset Settings';
    case 'developer':           return 'Developer';
    case 'community':           return 'Community';

    case 'background_img':      return 'Background Image';
    case 'background_color':    return 'Background Color';
    case 'background_video':    return 'Background Video';
    case 'character_model':     return 'Character Model';
    case 'character_animation': return 'Character Animation';

    case 'chatbot_backend':     return 'ChatBot Backend';
    case 'arbius_llm_settings': return 'Arbius';
    case 'chatgpt_settings':    return 'ChatGPT';
    case 'llamacpp_settings':   return 'LLama.cpp';
    case 'ollama_settings':     return 'Ollama';
    case 'koboldai_settings':   return 'KoboldAI';
    case 'name'         :       return 'Name';
    case 'system_prompt':       return 'System Prompt';

    case 'tts_backend':         return 'TTS Backend';
    case 'elevenlabs_settings': return 'ElevenLabs';
    case 'speecht5_settings':   return 'SpeechT5';
    case 'openai_tts_settings': return 'OpenAI';
    case 'piper_settings':      return 'Piper';
    case 'rvc_settings':        return 'RVC';
    case 'coquiLocal_settings': return 'Coqui Local';
    case 'localXTTS_settings':  return 'Alltalk';

    case 'vision_backend':           return 'Vision Backend';
    case 'vision_llamacpp_settings': return 'LLama.cpp';
    case 'vision_ollama_settings':   return 'Ollama';
    case 'vision_openai_settings':   return 'OpenAI';
    case 'vision_system_prompt':     return 'System Prompt';

    case 'stt_backend':             return 'STT Backend';
    case 'stt_wake_word':           return "Wake word";
    case 'whisper_openai_settings': return "Whisper (OpenAI)";
    case 'whispercpp_settings':     return "Whisper.cpp";
  }

  throw new Error(`unknown page label encountered ${page}`);
}

function getClassNameFromPage(page: string) {
  switch(page) {
    case 'reset_settings': return 'text-rose-600';
    case 'developer': return 'text-emerald-600';
  }

  return '';
}

export function ResetToDefaultButton({ onClick }: { onClick: () => void }) {
  return (
    <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center px-2 py-1 border border-rose-300 text-xs font-semibold rounded text-rose-700 bg-rose-50 hover:bg-rose-100 hover:border-rose-400 transition-colors cursor-pointer"
    >
      Reset
    </button>
  );
}

export function NotUsingAlert({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-amber-50/60 backdrop-blur-xl border border-amber-200/50 rounded p-2 text-xs text-amber-800">
      {children}
    </div>
  );
}
