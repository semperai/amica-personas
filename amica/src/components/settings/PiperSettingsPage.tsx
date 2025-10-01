import { BasicPage, FormRow, NotUsingAlert } from './common';
import { TextInput } from "@/components/textInput";
import { config, updateConfig } from "@/utils/config";

export function PiperSettingsPage({
    piperUrl,
    setPiperUrl,
    setSettingsUpdated,
}: {
    piperUrl: string;
    setPiperUrl: (key: string) => void;
    setSettingsUpdated: (updated: boolean) => void;
}) {
    return (
        <BasicPage
            title={"Piper" + " " + "Settings"}
            description={"Configure Piper"}
        >
            {config("tts_backend") !== "piper" && (
                <NotUsingAlert>
                    You are not currently using Piper as your TTS backend. These settings will not be used.
                </NotUsingAlert>
            )}
            <ul role="list" className="divide-y divide-gray-100 max-w-xs">
                <li className="py-4">
                    <FormRow label={"URL"}>
                        <TextInput
                            value={piperUrl}
                            onChange={(event: React.ChangeEvent<any>) => {
                                setPiperUrl(event.target.value);
                                updateConfig("piper_url", event.target.value);
                                setSettingsUpdated(true);
                            }}
                        />
                    </FormRow>
                </li>
            </ul>
        </BasicPage>
    );
}