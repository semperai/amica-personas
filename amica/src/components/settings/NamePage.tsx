import { BasicPage, FormRow, ResetToDefaultButton } from './common';
import { TextInput } from '@/components/textInput';
import { updateConfig, defaultConfig } from "@/utils/config";

export function NamePage({
  name,
  setName,
  setSettingsUpdated,
}: {
  name: string;
  setName: (name: string) => void;
  setSettingsUpdated: (updated: boolean) => void;
}) {
  return (
    <BasicPage
      title={"Name"}
      description={"Configure the avatars name. This is the name that is used to generate the chatbot response."}
    >
      <div className="space-y-2">
        <FormRow label={"Name"}>
          <TextInput
            value={name}
            onChange={(event: React.ChangeEvent<any>) => {
              setName(event.target.value);
              updateConfig("name", event.target.value);
              setSettingsUpdated(true);
            }}
          />

          { name !== defaultConfig("name") && (
            <div className="mt-2">
              <ResetToDefaultButton onClick={() => {
                setName(defaultConfig("name"));
                updateConfig("name", defaultConfig("name"));
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
