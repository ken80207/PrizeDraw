"use client";

import { useRef, useState, useCallback } from "react";
import { useTranslations } from "next-intl";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

interface ImageUploadProps {
  onUpload: (url: string) => void;
  currentUrl?: string;
  label?: string;
}

export function ImageUpload({ onUpload, currentUrl, label }: ImageUploadProps) {
  const t = useTranslations("imageUpload");
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);

      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError(t("fileTypeError"));
        return;
      }

      if (file.size > MAX_SIZE_BYTES) {
        setError(t("fileSizeError"));
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
                reject(new Error(t("responseError")));
              }
            } else {
              reject(new Error(`${t("uploadFailed")} (${xhr.status})`));
            }
          });

          xhr.addEventListener("error", () => reject(new Error(t("networkError"))));
          xhr.addEventListener("abort", () => reject(new Error(t("abortError"))));

          xhr.send(formData);
        });

        setProgress(100);
        onUpload(url);
        // Keep preview as the local blob URL until component re-renders with the real URL
      } catch (err) {
        setError(err instanceof Error ? err.message : t("uploadFailed"));
        setPreview(currentUrl ?? null);
      } finally {
        setProgress(null);
      }
    },
    [currentUrl, onUpload, t],
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
        <p className="text-sm font-medium text-on-surface">{label}</p>
      )}

      <div
        role="button"
        tabIndex={0}
        onClick={openFilePicker}
        onKeyDown={(e) => e.key === "Enter" && openFilePicker()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`relative flex min-h-28 w-full cursor-pointer flex-col items-center justify-center rounded-xl transition-colors ${
          isDragging
            ? "bg-primary/10"
            : "bg-surface-container-lowest hover:bg-surface-container-high"
        }`}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt={t("preview")}
            className="max-h-40 w-full rounded-lg object-contain p-2"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-center p-4">
            <span className="material-symbols-outlined text-3xl text-on-surface-variant">add_photo_alternate</span>
            <p className="text-sm font-medium text-on-surface-variant">
              {t("dragDrop")}
            </p>
            <p className="text-xs text-on-surface-variant/50">
              {t("formats")}
            </p>
          </div>
        )}

        {/* Progress overlay */}
        {progress !== null && (
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-surface-dim/80 backdrop-blur-sm">
            <div className="w-2/3 overflow-hidden rounded-full bg-surface-container-highest">
              <div
                className="h-2 rounded-full bg-gradient-to-r from-primary to-primary-container transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-2 text-xs font-bold text-primary">{progress}%</p>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <p className="text-xs text-error">{error}</p>
      )}

      {/* Change button when preview is shown */}
      {preview && progress === null && (
        <button
          type="button"
          onClick={openFilePicker}
          className="text-xs text-primary hover:underline"
        >
          {t("changeImage")}
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
