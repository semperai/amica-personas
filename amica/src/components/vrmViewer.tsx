import * as THREE from "three";
import { useContext, useCallback, useState, useEffect } from "react";
import { ViewerContext } from "@/features/scene3d/SceneCoordinatorContext";
import { buildUrl } from "@/utils/resolveAssetUrl";
import { config } from "@/utils/config";
import { useVrmStoreContext } from "@/features/vrmStore/vrmStoreContext";
import { ChatContext } from "@/features/chat/chatContext";
import { globalHookManager } from "@/features/hooks";
import clsx from "clsx";

export default function VrmViewer({ chatMode }: { chatMode: boolean }) {
  const { chat: bot } = useContext(ChatContext);
  const { viewer } = useContext(ViewerContext);
  const { getCurrentVrm, vrmList, vrmListAddFile, isLoadingVrmList } =
    useVrmStoreContext();
  const [loadingError, setLoadingError] = useState(false);
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
        new Promise(async (resolve, reject) => {
          await viewer.setup(canvas);

          try {
            await viewer.scenario.loadScenario(config('scenario_url'), viewer, globalHookManager);
            resolve(true);
          } catch (e) {
            reject(e);
          }
        })
          .then((loaded) => {
            if (loaded) {
              console.log("[VRM] vrm loaded");
              setLoadingError(false);
            }
          })
          .catch((e) => {
            console.error("[VRM] vrm loading error", e);
            setLoadingError(true);
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
            "absolute left-0 top-0 flex h-full w-full items-center justify-center bg-black bg-opacity-50"
          }>
          <div className={"text-2xl text-white"}>
            Error loading VRM model...
          </div>
        </div>
      )}
    </div>
  );
}
