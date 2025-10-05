import { useState, useEffect } from 'react';
import { MicrophoneIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';

interface MicrophoneSettingsProps {
  audioDevices: MediaDeviceInfo[];
  selectedDeviceId: string;
  onDeviceChange: (deviceId: string) => void;
  autosendEnabled: boolean;
  onAutosendToggle: () => void;
  micEnabled: boolean;
  onMicToggle: () => void;
  isOpen: boolean;
  onClose: () => void;
}

export function MicrophoneSettings({
  audioDevices,
  selectedDeviceId,
  onDeviceChange,
  autosendEnabled,
  onAutosendToggle,
  micEnabled,
  onMicToggle,
  isOpen,
  onClose,
}: MicrophoneSettingsProps) {
  if (!isOpen) return null;

  return (
    <div className="absolute left-full ml-2 top-0 bg-white/90 backdrop-blur-md shadow-lg rounded-md p-3 min-w-[250px] z-20">
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-900">Microphone Settings</h3>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-900 text-lg leading-none"
          >
            ×
          </button>
        </div>

        {/* Microphone Enable/Disable */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-700">Enable Microphone</span>
          <button
            onClick={onMicToggle}
            className={clsx(
              'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
              micEnabled ? 'bg-rose-500' : 'bg-slate-300'
            )}
          >
            <span
              className={clsx(
                'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                micEnabled ? 'translate-x-5' : 'translate-x-0.5'
              )}
            />
          </button>
        </div>

        {/* Auto-send Toggle */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-700">Auto-send from Mic</span>
          <button
            onClick={onAutosendToggle}
            disabled={!micEnabled}
            className={clsx(
              'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
              !micEnabled && 'opacity-50 cursor-not-allowed',
              autosendEnabled && micEnabled ? 'bg-rose-500' : 'bg-slate-300'
            )}
          >
            <span
              className={clsx(
                'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                autosendEnabled && micEnabled ? 'translate-x-5' : 'translate-x-0.5'
              )}
            />
          </button>
        </div>

        {/* Device Selector */}
        {audioDevices.length > 0 && (
          <div className="space-y-1.5">
            <label className="text-xs text-slate-700 block">Input Device</label>
            <select
              value={selectedDeviceId}
              onChange={(e) => onDeviceChange(e.target.value)}
              disabled={!micEnabled}
              className={clsx(
                'w-full px-2 py-1.5 text-xs text-slate-900 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-rose-500',
                !micEnabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              <option value="default">Default Microphone</option>
              {audioDevices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
