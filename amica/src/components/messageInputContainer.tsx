import { lazy, useCallback, useEffect, useState, Suspense } from "react";

// necessary because of VAD in MessageInput
const DynamicMessageInput = lazy(() =>
  import("@/components/messageInput")
);

/**
 * Provides text input and voice input
 *
 * Automatically send when speech recognition is completed,
 * and disable input while generating response text
 */
export const MessageInputContainer = ({
  isChatProcessing,
}: {
  isChatProcessing: boolean;
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
      />
    </Suspense>
  );
};
