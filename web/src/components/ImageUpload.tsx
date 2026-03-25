"use client";

import { useRef, useState, useCallback } from "react";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

interface ImageUploadProps {
  onUpload: (url: string) => void;
  currentUrl?: string;
  label?: string;
}

export function ImageUpload({ onUpload, currentUrl, label }: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);

      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError("僅支援 JPEG、PNG 或 WebP 格式");
        return;
      }

      if (file.size > MAX_SIZE_BYTES) {
        setError("圖片大小不可超過 5MB");
        return;
      }

      // Local preview
      const objectUrl = URL.createObjectURL(file);
      setPreview(objectUrl);
      setProgress(0);

      try {
        const formData = new FormData();
        formData.append("file", file);

        // Use XMLHttpRequest to track upload progress
        const url = await new Promise<string>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", "/api/v1/storage/upload");

          xhr.upload.addEventListener("progress", (event) => {
            if (event.lengthComputable) {
              setProgress(Math.round((event.loaded / event.total) * 100));
            }
          });

          xhr.addEventListener("load", () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const data = JSON.parse(xhr.responseText) as { url: string };
                resolve(data.url);
              } catch {
                reject(new Error("伺服器回應格式錯誤"));
              }
            } else {
              reject(new Error(`上傳失敗 (${xhr.status})`));
            }
          });

          xhr.addEventListener("error", () => reject(new Error("網路錯誤，請稍後再試")));
          xhr.addEventListener("abort", () => reject(new Error("上傳已取消")));

          xhr.send(formData);
        });

        setProgress(100);
        onUpload(url);
        // Keep preview as the local blob URL until component re-renders with the real URL
      } catch (err) {
        setError(err instanceof Error ? err.message : "上傳失敗");
        setPreview(currentUrl ?? null);
      } finally {
        setProgress(null);
      }
    },
    [currentUrl, onUpload],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset input value so the same file can be re-selected
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const openFilePicker = () => inputRef.current?.click();

  return (
    <div className="space-y-2">
      {label && (
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</p>
      )}

      <div
        role="button"
        tabIndex={0}
        onClick={openFilePicker}
        onKeyDown={(e) => e.key === "Enter" && openFilePicker()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`relative flex min-h-28 w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors ${
          isDragging
            ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20"
            : "border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 hover:border-indigo-400 hover:bg-indigo-50/40 dark:hover:bg-indigo-900/10"
        }`}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="預覽"
            className="max-h-40 w-full rounded-lg object-contain p-2"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-center p-4">
            <span className="text-3xl">📷</span>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
              拖放圖片至此，或點擊瀏覽
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              支援 JPEG / PNG / WebP，最大 5MB
            </p>
          </div>
        )}

        {/* Progress overlay */}
        {progress !== null && (
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-white/80 dark:bg-gray-900/80">
            <div className="w-2/3 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
              <div
                className="h-2 rounded-full bg-indigo-600 transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-2 text-xs font-medium text-indigo-600">{progress}%</p>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}

      {/* Change button when preview is shown */}
      {preview && progress === null && (
        <button
          type="button"
          onClick={openFilePicker}
          className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          更換圖片
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        onChange={handleInputChange}
        className="sr-only"
      />
    </div>
  );
}
