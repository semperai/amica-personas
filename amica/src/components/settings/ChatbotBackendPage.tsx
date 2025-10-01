import { BasicPage, Link, FormRow, getLinkFromPage } from './common';
import { updateConfig } from "@/utils/config";

const chatbotBackends = [
  {key: "echo",       label: "Echo"},
  {key: "arbius_llm", label: "Arbius"},
  {key: "chatgpt",    label: "ChatGPT"},
  {key: "llamacpp",   label: "LLama.cpp"},
  {key: "ollama",     label: "Ollama"},
  {key: "koboldai",   label: "KoboldAI"},
];

function idToTitle(id: string): string {
  return chatbotBackends[chatbotBackends.findIndex((engine) => engine.key === id)].label;
}

export function ChatbotBackendPage({
  chatbotBackend,
  setChatbotBackend,
  setSettingsUpdated,
  setPage,
  breadcrumbs,
  setBreadcrumbs,
}: {
  chatbotBackend: string;
  setChatbotBackend: (backend: string) => void;
  setSettingsUpdated: (updated: boolean) => void;
  setPage: (page: string) => void;
  breadcrumbs: Link[];
  setBreadcrumbs: (breadcrumbs: Link[]) => void;
}) {

  return (
    <BasicPage
      title="Chatbot Backend"
      description="Select the chatbot backend to use. Echo simply responds with what you type, it is used for testing and demonstration. ChatGPT is a commercial chatbot API from OpenAI, however there are multiple compatible API providers which can be used in lieu of OpenAI. LLama.cpp is a free and open source chatbot backend."
    >
      <div className="space-y-3">
        <FormRow label="Chatbot Backend">
          <select
            className="block w-full rounded px-2.5 py-1.5 text-xs text-slate-900 bg-white/50 backdrop-blur-xl border border-white/30 focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-transparent transition-all cursor-pointer"
            value={chatbotBackend}
            onChange={(event: React.ChangeEvent<any>) => {
              setChatbotBackend(event.target.value);
              updateConfig("chatbot_backend", event.target.value);
              setSettingsUpdated(true);
            }}
          >
            {chatbotBackends.map((engine) => (
              <option key={engine.key} value={engine.key}>{engine.label}</option>
            ))}
          </select>
        </FormRow>

        { ["arbius_llm", "chatgpt", "llamacpp", "ollama", "koboldai"].includes(chatbotBackend) && (
          <FormRow label={`Configure ${idToTitle(chatbotBackend)}`}>
            <button
              type="button"
              className="rounded px-3 py-1.5 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 transition-all cursor-pointer"
              onClick={() => {
                setPage(`${chatbotBackend}_settings`);
                setBreadcrumbs(breadcrumbs.concat([getLinkFromPage(`${chatbotBackend}_settings`)]));
              }}
            >
              Configure {idToTitle(chatbotBackend)}
            </button>
          </FormRow>
        )}
      </div>
    </BasicPage>
  );
}
