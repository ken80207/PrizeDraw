"use client";

import { useRef, useState, useCallback } from "react";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

interface ImageUploadProps {
  onUpload: (url: string) => void;
  currentUrl?: string;
  label?: string;
  compact?: boolean;
}

export function ImageUpload({ onUpload, currentUrl, label, compact = false }: ImageUploadProps) {
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

      const objectUrl = URL.createObjectURL(file);
      setPreview(objectUrl);
      setProgress(0);

      try {
        const formData = new FormData();
        formData.append("file", file);

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

  if (compact) {
    // Inline compact version for use inside table cells
    return (
      <div className="space-y-1">
        <div
          role="button"
          tabIndex={0}
          onClick={openFilePicker}
          onKeyDown={(e) => e.key === "Enter" && openFilePicker()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`relative flex h-10 w-20 cursor-pointer items-center justify-center overflow-hidden rounded-lg border transition-colors ${
            isDragging
              ? "border-indigo-500 bg-indigo-50"
              : "border-slate-200 bg-slate-50 hover:border-indigo-300"
          }`}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="預覽" className="h-full w-full object-cover" />
          ) : (
            <span className="text-lg">📷</span>
          )}

          {progress !== null && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80">
              <div className="w-4/5 overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-1 rounded-full bg-indigo-600 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

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

  return (
    <div className="space-y-2">
      {label && (
        <p className="mb-1 block text-sm font-medium text-slate-700">{label}</p>
      )}

      <div
        role="button"
        tabIndex={0}
        onClick={openFilePicker}
        onKeyDown={(e) => e.key === "Enter" && openFilePicker()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`relative flex min-h-28 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors ${
          isDragging
            ? "border-indigo-500 bg-indigo-50"
            : "border-slate-300 bg-slate-50 hover:border-indigo-400 hover:bg-indigo-50/30"
        }`}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="預覽"
            className="max-h-40 w-full rounded object-contain p-2"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 p-4 text-center">
            <span className="text-2xl">📷</span>
            <p className="text-xs text-slate-500">點擊上傳或拖放圖片</p>
            <p className="text-xs text-slate-400">JPEG / PNG / WebP，最大 5MB</p>
          </div>
        )}

        {progress !== null && (
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-lg bg-white/80">
            <div className="w-2/3 overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-2 rounded-full bg-indigo-600 transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-2 text-xs font-medium text-indigo-600">{progress}%</p>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {preview && progress === null && (
        <button
          type="button"
          onClick={openFilePicker}
          className="text-xs text-indigo-600 hover:underline"
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
