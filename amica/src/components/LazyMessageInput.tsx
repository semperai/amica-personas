import { lazy, useCallback, useEffect, useState, Suspense } from "react";

// necessary because of VAD in MessageInput
const DynamicMessageInput = lazy(() =>
  import("@/components/ChatInput")
);

/**
 * Provides text input and voice input
 *
 * Automatically send when speech recognition is completed,
 * and disable input while generating response text
 */
export const MessageInputContainer = ({
  isChatProcessing,
  audioDevices,
  selectedDeviceId,
  micEnabled,
}: {
  isChatProcessing: boolean;
  audioDevices?: MediaDeviceInfo[];
  selectedDeviceId?: string;
  micEnabled?: boolean;
}) => {
  const [userMessage, setUserMessage] = useState("");

  useEffect(() => {
    if (!isChatProcessing) {
      setUserMessage("");
    }
  }, [isChatProcessing]);

  return (
    <Suspense fallback={<div />}>
      <DynamicMessageInput
        userMessage={userMessage}
        setUserMessage={setUserMessage}
        isChatProcessing={isChatProcessing}
        onChangeUserMessage={(e) => setUserMessage(e.target.value)}
        audioDevices={audioDevices}
        selectedDeviceId={selectedDeviceId}
        micEnabled={micEnabled}
      />
    </Suspense>
  );
};
