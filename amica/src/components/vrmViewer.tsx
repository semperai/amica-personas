import * as THREE from "three";
import { useContext, useCallback, useState, useEffect } from "react";
import { ViewerContext } from "@/features/scene3d/SceneCoordinatorContext";
import { buildUrl } from "@/utils/resolveAssetUrl";
import { config } from "@/utils/config";
import { useVrmStoreContext } from "@/features/vrmStore/vrmStoreContext";
import { ChatContext } from "@/features/chat/chatContext";
import { globalHookManager } from "@/features/hooks";
import clsx from "clsx";

/**
 * VrmViewer Component
 *
 * The main 3D viewer component that renders VRM models on a canvas using Three.js.
 * Handles loading, displaying, and interacting with VRM avatars.
 *
 * Features:
 * - Renders VRM models in a 3D scene
 * - Supports drag-and-drop VRM file loading
 * - Monitors loading state via the global loading stage system
 * - Responsive canvas resizing based on chat mode
 * - Error handling for loading failures
 * - Fallback timeout if loading system doesn't activate
 *
 * The component coordinates with the LoadingProgress component by monitoring
 * `window.chatvrm_loading_stage` to determine when to show/hide the canvas.
 *
 * @param props - Component props
 * @param props.chatMode - Whether the viewer is in chat mode (affects positioning)
 * @returns A React component that renders the 3D VRM viewer
 */
export default function VrmViewer({ chatMode }: { chatMode: boolean }) {
  const { chat: bot } = useContext(ChatContext);
  const { viewer } = useContext(ViewerContext);
  const { getCurrentVrm, vrmList, vrmListAddFile, isLoadingVrmList } =
    useVrmStoreContext();
  const [loadingError, setLoadingError] = useState(false);
  const [loadingErrorDetails, setLoadingErrorDetails] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const isVrmLocal = "local" == config("vrm_save_type");

  useEffect(() => {
    viewer.render?.resizeChatMode(chatMode);

    const handleResize = () => {
      viewer.render?.resizeChatMode(chatMode);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [chatMode, viewer]);

  // Monitor loading completion
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    let observedActiveStage = false;
    let hasLoadingStageSystem = false;

    const interval = window.setInterval(() => {
      const loadingStage = (window as any).chatvrm_loading_stage ?? null;

      if (loadingStage !== null) {
        // Loading is active
        observedActiveStage = true;
        hasLoadingStageSystem = true;
        setIsLoading(true);
      } else if (observedActiveStage) {
        // Loading completed (was active, now null)
        setIsLoading(false);
      }
    }, 100);

    // Fallback: if loading stage system never activates, hide loading after 5 seconds
    const fallbackTimeout = window.setTimeout(() => {
      if (!hasLoadingStageSystem) {
        console.warn('[VrmViewer] Loading stage system not detected, using fallback');
        setIsLoading(false);
      }
    }, 5000);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(fallbackTimeout);
    };
  }, []);

  const canvasRef = useCallback(
    (canvas: HTMLCanvasElement) => {
      if (canvas && (!isVrmLocal || !isLoadingVrmList)) {
        (async () => {
          try {
            console.log('[VrmViewer] Setting up viewer...');
            await viewer.setup(canvas);

            console.log('[VrmViewer] Loading scenario from:', config('scenario_url'));
            await viewer.scenario.loadScenario(config('scenario_url'), viewer, globalHookManager);
            return true;
          } catch (e) {
            console.error('[VrmViewer] Setup or scenario loading failed:', e);
            throw e;
          }
        })()
          .then((loaded) => {
            if (loaded) {
              console.log("[VRM] vrm loaded successfully");
              setLoadingError(false);
              setIsLoading(false);
            }
          })
          .catch((e) => {
            console.error("[VRM] vrm loading error:", e);
            console.error("[VRM] error details:", {
              message: e?.message,
              stack: e?.stack,
              type: typeof e,
              stringified: String(e),
            });

            // Capture error details for display
            const errorMessage = e?.message || String(e) || "Unknown error";
            setLoadingErrorDetails(errorMessage);
            setLoadingError(true);
            setIsLoading(false);
          });

        // Replace VRM with Drag and Drop
        canvas.addEventListener("dragover", function (event) {
          event.preventDefault();
        });

        canvas.addEventListener("drop", function (event) {
          event.preventDefault();

          const files = event.dataTransfer?.files;
          if (!files) {
            return;
          }

          const file = files[0];
          if (!file) {
            return;
          }

          const file_type = file.name.split(".").pop();
          if (file_type === "vrm") {
            vrmListAddFile(file, viewer);
          }/* else if (file_type === "glb") {
            viewer.loadRoom(URL.createObjectURL(file));
          }*/
        });
      }
    },
    [
      vrmList.findIndex((value) =>
        value.hashEquals(getCurrentVrm()?.getHash() || ""),
      ) < 0,
      viewer,
    ],
  );

  return (
    <div
      className={clsx(
        "z-0 fixed left-0 top-0 h-full w-full",
        chatMode ? "left-[65%] top-[50%]" : "left-0 top-0",
      )}>
      <canvas
        ref={canvasRef}
        className={clsx(
          "h-full w-full",
          isLoading && "opacity-0"
        )}
      ></canvas>
      {/* Loading is handled by LoadingProgress component - no overlay needed here */}
      {loadingError && (
        <div
          className={
            "absolute left-0 top-0 flex h-full w-full items-center justify-center bg-black bg-opacity-90 p-4"
          }>
          <div className="max-w-2xl text-center">
            <div className="text-3xl text-red-500 mb-4">⚠️ Loading Error</div>
            <div className="text-xl text-white mb-4">
              Failed to load the application
            </div>
            <div className="text-sm text-gray-300 mb-6 font-mono bg-black bg-opacity-50 p-4 rounded break-words">
              {loadingErrorDetails}
            </div>
            <div className="text-sm text-gray-400 mb-4">
              Try refreshing the page. If the problem persists, check the browser console for more details.
            </div>
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg transition"
            >
              🔄 Reload Page
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
