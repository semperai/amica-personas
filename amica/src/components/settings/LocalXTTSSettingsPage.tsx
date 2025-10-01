import { BasicPage, FormRow, NotUsingAlert } from './common';
import { TextInput } from "@/components/textInput";
import { config, updateConfig } from "@/utils/config";

export function LocalXTTSSettingsPage({
    localXTTSUrl,
    setLocalXTTSUrl,
    setSettingsUpdated,
}: {
    localXTTSUrl: string;
    setLocalXTTSUrl: (key: string) => void;
    setSettingsUpdated: (updated: boolean) => void;
}) {
    return (
        <BasicPage
            title="Alltalk TTS Settings"
            description="Configure Alltalk TTS"
        >
            {config("tts_backend") !== "localXTTS" && (
                <NotUsingAlert>
                    You are not currently using AllTalk TTS as your TTS backend. These settings will not be used.
                </NotUsingAlert>
            )}
            <ul role="list" className="divide-y divide-gray-100 max-w-xs">
                <li className="py-4">
                    <FormRow label="URL">
                        <TextInput
                            value={localXTTSUrl}
                            onChange={(event: React.ChangeEvent<any>) => {
                                setLocalXTTSUrl(event.target.value);
                                updateConfig("localXTTS_url", event.target.value);
                                setSettingsUpdated(true);
                            }}
                        />
                    </FormRow>
                </li>
            </ul>
        </BasicPage>
    );
}