import React, { useState, useEffect } from 'react';
import { BasicPage, FormRow, NotUsingAlert } from './common';
import { TextInput } from "@/components/textInput";
import { config, updateConfig } from "@/utils/config";
import { coquiLocalVoiceIdList } from '@/features/coquiLocal/coquiLocal';

export function CoquiLocalSettingsPage({
  coquiLocalUrl,
  setCoquiLocalUrl,
  setSettingsUpdated,
  coquiLocalVoiceId,
  setCoquiLocalVoiceId
}: {
  coquiLocalUrl: string;
  coquiLocalVoiceId: string;
  setCoquiLocalUrl: (key: string) => void;
  setSettingsUpdated: (updated: boolean) => void;
  setCoquiLocalVoiceId: (key: string) => void;
}) {
  const [voiceList, setVoiceList] = useState<string[]>([]);

  useEffect(() => {
    async function fetchVoiceList() {
      try {
        const data = await coquiLocalVoiceIdList();
        if (data && data.list) {
          setVoiceList(data.list);
        }
      } catch (error) {
        console.error('Error fetching voice list:', error);
      }
    }
    fetchVoiceList();
  }, []);

  return (
    <BasicPage
      title="CoquiLocal Settings"
      description="Configure Coqui (Local), this is running Coqui locally, and no Coqui API (where the company has stopped providing an API service."
    >
      { config("tts_backend") !== "coquiLocal" && (
        <NotUsingAlert>
          You are not currently using CoquiLocal as your TTS backend. These settings will not be used.
        </NotUsingAlert>
      ) }
      <ul role="list" className="divide-y divide-gray-100 max-w-xs">
        <li className="py-4">
          <FormRow label="URL">
            <TextInput
              value={coquiLocalUrl}
              onChange={(event: React.ChangeEvent<any>) => {
                setCoquiLocalUrl(event.target.value);
                updateConfig("coquiLocal_url", event.target.value);
                setSettingsUpdated(true);
              }}
            />
          </FormRow>
        </li>
        <li className="py-4">
          <FormRow label="Voice ID">
            <select
              value={coquiLocalVoiceId}
              onChange={(event: React.ChangeEvent<any>) => {
                event.preventDefault();
                setCoquiLocalVoiceId(event.target.value);
                updateConfig("coquiLocal_voiceid", event.target.value);
                setSettingsUpdated(true);
              }}
            >
              {voiceList.map((voiceId) =>
                <option
                  key={voiceId}
                  value={voiceId}
                >
                  {voiceId}
                </option>
              )}
            </select>
          </FormRow>
        </li>
      </ul>
    </BasicPage>
  );
}
