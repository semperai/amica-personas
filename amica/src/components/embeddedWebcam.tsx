import { useCallback, useContext, useState, useRef, useEffect } from "react";
import Webcam from "react-webcam";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";
import { ChatContext } from "@/features/chat/chatContext";
import { Upload, Camera, RefreshCw, X } from "lucide-react";
import { clsx } from "clsx";

export function EmbeddedWebcam({
  setWebcamEnabled,
}: {
  setWebcamEnabled: (enabled: boolean) => void;
}) {
  const { chat: bot } = useContext(ChatContext);
  const webcamRef = useRef<Webcam>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [cameraDisabled, setCameraDisabled] = useState(false);
  const [imageData, setImageData] = useState("");
  const [imageMode, setImageMode] = useState<"webcam" | "uploader">("webcam");
  const imgRef = useRef<HTMLImageElement>(null);

  useKeyboardShortcut("Escape", () => {
    setWebcamEnabled(false);
  });

  const processImageFromCanvas = async (data: string) => {
    const canvas = document.createElement('canvas');
    canvas.width = imgRef.current!.width;
    canvas.height = imgRef.current!.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return "";

    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => {
        ctx.drawImage(img, 0, 0, imgRef.current!.width, imgRef.current!.height);
        resolve();
      };
      img.onerror = reject;
      img.src = data;
    });
    return canvas.toDataURL('image/jpeg').replace('data:image/jpeg;base64,', '');
  };

  useEffect(() => {
    const handleImageDataChange = async () => {
      if (imageData) {
        const fixedImageData = imageMode === "webcam"
          ? imageData.replace('data:image/jpeg;base64,', '')
          : await processImageFromCanvas(imageData);
        await bot.getVisionResponse(fixedImageData);
        setCameraDisabled(false);
        setImageData("");
        setWebcamEnabled(false);
      }
    };

    handleImageDataChange();
  }, [imageData, imageMode, bot]);

  const capture = useCallback(() => {
      if (webcamRef.current === null) {
        return;
      }

      let imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        setCameraDisabled(true);
        setImageData(imageSrc);
        setImageMode('webcam');
      }
    },
    [webcamRef]
  );

  const imgFileInputRef = useRef<HTMLInputElement>(null);
  const handleClickOpenImgFile = useCallback(() => {
    imgFileInputRef.current?.click();
  }, []);

  const handleChangeImgFile = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.match("image.*")) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCameraDisabled(true);
        setImageMode("uploader");
        setImageData(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
  };

  return (
    <div className="fixed right-2 top-2 z-[11]">
      <div className="bg-white/80 backdrop-blur-xl border border-white/30 rounded-lg shadow-lg overflow-hidden">
        {/* Close button */}
        <button
          onClick={() => setWebcamEnabled(false)}
          className="absolute top-2 right-2 z-20 p-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-900 text-white transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Video/Image */}
        <div className="relative">
          {!cameraDisabled && (
            <Webcam
              ref={webcamRef}
              audio={false}
              width={320}
              height={240}
              screenshotFormat="image/jpeg"
              videoConstraints={{
                facingMode,
              }}
              className="block"
            />
          )}
          {cameraDisabled && (
            <img
              ref={imgRef}
              src={imageData}
              alt="Captured image"
              width={320}
              height={240}
              className={clsx(
                "block",
                cameraDisabled && "animate-pulse"
              )}
            />
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-2 p-2 bg-white/50 backdrop-blur-xl border-t border-white/30">
          <button
            onClick={handleClickOpenImgFile}
            disabled={cameraDisabled}
            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors text-slate-900"
          >
            <Upload className="h-5 w-5" />
          </button>

          <button
            onClick={() => capture()}
            disabled={cameraDisabled}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors text-white"
          >
            <Camera className="h-5 w-5" />
          </button>

          <button
            onClick={toggleFacingMode}
            disabled={cameraDisabled}
            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors text-slate-900"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
        </div>
      </div>

      <input
        type="file"
        className="hidden"
        accept=".jpeg, .jpg, .png, .webp, .heic"
        ref={imgFileInputRef}
        onChange={handleChangeImgFile}
      />
    </div>
  );
}
