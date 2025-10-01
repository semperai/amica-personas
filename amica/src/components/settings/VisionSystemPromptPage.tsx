import { BasicPage, FormRow, ResetToDefaultButton } from './common';
import { updateConfig, defaultConfig } from "@/utils/config";

export function VisionSystemPromptPage({
  visionSystemPrompt,
  setVisionSystemPrompt,
  setSettingsUpdated,
}: {
  visionSystemPrompt: string;
  setVisionSystemPrompt: (prompt: string) => void;
  setSettingsUpdated: (updated: boolean) => void;
}) {
  return (
    <BasicPage
      title={"Vision" + " " + "System Prompt" + " "+ "Settings"}
      description={"Configure the vision system prompt. This is the prompt that is used to generate the image descriptions."}
    >
      <div className="space-y-2">
        <FormRow label={"Vision System Prompt"}>
          <textarea
            value={visionSystemPrompt}
            rows={6}
            className="block w-full rounded px-2.5 py-1.5 text-xs text-slate-900 bg-white/50 backdrop-blur-xl border border-white/30 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-transparent transition-all resize-none"
            onChange={(event: React.ChangeEvent<any>) => {
              event.preventDefault();
              setVisionSystemPrompt(event.target.value);
              updateConfig("vision_system_prompt", event.target.value);
              setSettingsUpdated(true);
            }}
          />

          { visionSystemPrompt !== defaultConfig("vision_system_prompt") && (
            <div className="mt-2">
              <ResetToDefaultButton onClick={() => {
                setVisionSystemPrompt(defaultConfig("vision_system_prompt"));
                updateConfig("vision_system_prompt", defaultConfig("vision_system_prompt"));
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
