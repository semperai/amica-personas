
import { BasicPage, FormRow, NotUsingAlert } from './common';
import { TextInput } from "@/components/textInput";
import { SecretTextInput } from "@/components/secretTextInput";
import { config, updateConfig } from "@/utils/config";

export function WhisperCppSettingsPage({
  whisperCppUrl,
  setWhisperCppUrl,
  setSettingsUpdated,
}: {
  whisperCppUrl: string;
  setWhisperCppUrl: (key: string) => void;
  setSettingsUpdated: (updated: boolean) => void;
}) {

  return (
    <BasicPage
      title={"Whisper.cpp" + " "+ "Settings"}
      description={t("Whisper_cpp_desc", "Configure Whisper.cpp")}
    >
      { config("stt_backend") !== "whispercpp" && (
        <NotUsingAlert>
          {t("not_using_alert", "You are not currently using {{name}} as your {{what}} backend. These settings will not be used.", {name: "Whisper.cpp", what: "STT"})}
        </NotUsingAlert>
      ) }
      <ul role="list" className="divide-y divide-gray-100 max-w-xs">
        <li className="py-4">
          <FormRow label={"URL"}>
            <TextInput
              value={whisperCppUrl}
              onChange={(event: React.ChangeEvent<any>) => {
                setWhisperCppUrl(event.target.value);
                updateConfig("whispercpp_url", event.target.value);
                setSettingsUpdated(true);
              }}
            />
          </FormRow>
        </li>
      </ul>
    </BasicPage>
  );
}
