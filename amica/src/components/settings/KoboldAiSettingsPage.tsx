import { BasicPage, FormRow, NotUsingAlert } from './common';
import { TextInput } from '@/components/textInput';
import { SwitchBox } from '@/components/switchBox';
import { config, updateConfig } from "@/utils/config";

export function KoboldAiSettingsPage({
  koboldAiUrl,
  setKoboldAiUrl,
  koboldAiUseExtra,
  setKoboldAiUseExtra,
  koboldAiStopSequence,
  setKoboldAiStopSequence,
  setSettingsUpdated,
}: {
  koboldAiUrl: string;
  setKoboldAiUrl: (url: string) => void;
  koboldAiUseExtra: boolean;
  setKoboldAiUseExtra: (value: boolean) => void;
  koboldAiStopSequence: string;
  setKoboldAiStopSequence: (value: string) => void;
  setSettingsUpdated: (updated: boolean) => void;
}) {
  return (
    <BasicPage
      title={"KoboldAI" + " "+ "Settings"}
      description={"KoboldCpp is an easy-to-use AI text-generation software for GGML and GGUF models."}
    >
      { config("chatbot_backend") !== "koboldai" && (
        <NotUsingAlert>
          You are not currently using KoboldAI as your ChatBot backend. These settings will not be used.
        </NotUsingAlert>
      ) }
      <ul role="list" className="divide-y divide-gray-100 max-w-xs">
        <li className="py-4">
          <FormRow label={"API URL"}>
            <TextInput
              value={koboldAiUrl}
              onChange={(event: React.ChangeEvent<any>) => {
                setKoboldAiUrl(event.target.value);
                updateConfig("koboldai_url", event.target.value);
                setSettingsUpdated(true);
              }}
            />
          </FormRow>
        </li>
        <li className="py-4">
          <FormRow label={"STOP SEQUENCE"}>
            <TextInput
              value={koboldAiStopSequence}
              onChange={(event: React.ChangeEvent<any>) => {
                setKoboldAiStopSequence(event.target.value);
                updateConfig("koboldai_stop_sequence", event.target.value);
                setSettingsUpdated(true);
              }}
            />
          </FormRow>
        </li>
        <li className="py-4">
          <FormRow label="Use Koboldcpp">
            <SwitchBox
              value={koboldAiUseExtra}
              label="Use Extra (enables streaming)"
              onChange={(value: boolean) => {
                setKoboldAiUseExtra(value);
                updateConfig("koboldai_use_extra", value.toString());
                setSettingsUpdated(true);
              }}
            />
          </FormRow>
        </li>
      </ul>
    </BasicPage>
  );
}
