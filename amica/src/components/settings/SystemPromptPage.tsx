
import { BasicPage, FormRow, ResetToDefaultButton } from './common';
import { updateConfig, defaultConfig } from "@/utils/config";

export function SystemPromptPage({
  systemPrompt,
  setSystemPrompt,
  setSettingsUpdated,
}: {
  systemPrompt: string;
  setSystemPrompt: (prompt: string) => void;
  setSettingsUpdated: (updated: boolean) => void;
}) {

  return (
    <BasicPage
      title="System Prompt Settings"
      description="Configure the system prompt. Alter the prompt to change your character's personality. You can share your character's personality using the share button!"
    >
      <div className="space-y-2">
        <FormRow label={"System Prompt"}>
          <textarea
            value={systemPrompt}
            rows={6}
            className="block w-full rounded px-2.5 py-1.5 text-xs text-slate-900 bg-white/50 backdrop-blur-xl border border-white/30 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-transparent transition-all resize-none"
            onChange={(event: React.ChangeEvent<any>) => {
              event.preventDefault();
              setSystemPrompt(event.target.value);
              updateConfig("system_prompt", event.target.value);
              setSettingsUpdated(true);
           }} />

          { systemPrompt !== defaultConfig("system_prompt") && (
            <div className="mt-2">
              <ResetToDefaultButton onClick={() => {
                setSystemPrompt(defaultConfig("system_prompt"));
                updateConfig("system_prompt", defaultConfig("system_prompt"));
                setSettingsUpdated(true);
                }}
              />
            </div>
          )}
        </FormRow>
      </div>
    </BasicPage>
  );
}
