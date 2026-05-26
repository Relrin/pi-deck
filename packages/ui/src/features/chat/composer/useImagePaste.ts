import { type ClipboardEvent, type DragEvent, useCallback } from "react";
import { useNotificationStore } from "../../_status/useNotificationStore.js";
import type { PromptImageDraft } from "../../intro/useIntroComposerStore.js";

const IMAGE_FILTER = {
  filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif"] }],
};

export interface UseImagePasteOptions {
  onImages: (images: PromptImageDraft[]) => void;
  /** Max bytes per image. Defaults to 10 MB. */
  maxBytes?: number;
}

export interface UseImagePasteResult {
  onPaste: (e: ClipboardEvent<HTMLElement>) => void;
  onDrop: (e: DragEvent<HTMLElement>) => void;
  onDragOver: (e: DragEvent<HTMLElement>) => void;
  /** Opens the OS file picker filtered to images, reads via preload bridge, and stages. */
  chooseImage: () => Promise<void>;
}

const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIMES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
/** Longest-side target for the thumbnail; preserves aspect ratio. */
const THUMB_MAX_DIM = 256;

/**
 * Composer-side image ingest: turn pasted / dropped image files into staged
 * `PromptImageDraft`s. Plain-text pastes pass through untouched.
 *
 * Why not bake this into the textarea component directly: both the intro composer and
 * the session composer need the same behavior, and the drop target is the composer SHELL
 * (so the user can drop on the chip row, not just the textarea).
 */
export function useImagePaste(opts: UseImagePasteOptions): UseImagePasteResult {
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;

  const ingest = useCallback(
    async (files: File[]) => {
      const images: PromptImageDraft[] = [];
      for (const file of files) {
        if (!ALLOWED_MIMES.has(file.type)) {
          useNotificationStore
            .getState()
            .error(`Unsupported image type: ${file.type || "unknown"}`);
          continue;
        }
        if (file.size > maxBytes) {
          const mb = (maxBytes / (1024 * 1024)).toFixed(0);
          useNotificationStore.getState().error(`Image too large — max ${mb} MB`);
          continue;
        }
        try {
          const draft = await fileToDraft(file);
          images.push(draft);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to read image";
          useNotificationStore.getState().error(`Couldn't attach image: ${message}`);
        }
      }
      if (images.length > 0) opts.onImages(images);
    },
    [maxBytes, opts.onImages],
  );

  const onPaste = useCallback(
    (e: ClipboardEvent<HTMLElement>) => {
      const items = e.clipboardData?.items;
      if (!items || items.length === 0) return;
      const files: File[] = [];
      for (const item of items) {
        if (item.kind !== "file") continue;
        const file = item.getAsFile();
        if (file?.type.startsWith("image/")) files.push(file);
      }
      if (files.length === 0) return;
      // Only swallow the paste when we actually found an image — plain-text paste must
      // still land in the textarea normally.
      e.preventDefault();
      void ingest(files);
    },
    [ingest],
  );

  const onDragOver = useCallback((e: DragEvent<HTMLElement>) => {
    if (!e.dataTransfer?.types.includes("Files")) return;
    // preventDefault is required to allow drop; copyMove signals to the OS that a drop is valid.
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const onDrop = useCallback(
    (e: DragEvent<HTMLElement>) => {
      const list = e.dataTransfer?.files;
      if (!list || list.length === 0) return;
      const files: File[] = [];
      for (let i = 0; i < list.length; i += 1) {
        const file = list[i];
        if (file?.type.startsWith("image/")) files.push(file);
      }
      if (files.length === 0) return;
      e.preventDefault();
      void ingest(files);
    },
    [ingest],
  );

  const chooseImage = useCallback(async () => {
    const picker = window.bridge?.openFile;
    const reader = window.bridge?.readImage;
    if (!picker || !reader) {
      useNotificationStore.getState().error("Image picker unavailable in this build");
      return;
    }
    let selected: string | undefined;
    try {
      selected = await picker(IMAGE_FILTER);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to open file dialog";
      useNotificationStore.getState().error(message);
      return;
    }
    if (!selected) return;
    try {
      const result = await reader(selected);
      if (result.byteSize > maxBytes) {
        const mb = (maxBytes / (1024 * 1024)).toFixed(0);
        useNotificationStore.getState().error(`Image too large — max ${mb} MB`);
        return;
      }
      const thumbnailDataUrl = await thumbnailFromBase64(result.data, result.mimeType);
      opts.onImages([
        {
          id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          mimeType: result.mimeType,
          data: result.data,
          thumbnailDataUrl,
          name: result.name,
          byteSize: result.byteSize,
        },
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to read image";
      useNotificationStore.getState().error(`Couldn't attach image: ${message}`);
    }
  }, [maxBytes, opts.onImages]);

  return { onPaste, onDrop, onDragOver, chooseImage };
}

async function fileToDraft(file: File): Promise<PromptImageDraft> {
  const buf = await file.arrayBuffer();
  const data = arrayBufferToBase64(buf);
  const mimeType = file.type;
  const thumbnailDataUrl = await renderThumbnail(file);
  return {
    id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    mimeType,
    data,
    thumbnailDataUrl,
    name: file.name || "Pasted image",
    byteSize: file.size,
  };
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  // Chunked to avoid blowing the JS arg-list size limit on multi-MB images.
  const bytes = new Uint8Array(buf);
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

async function thumbnailFromBase64(base64: string, mimeType: string): Promise<string> {
  // Cheapest path: turn base64 → Blob → File so we can reuse `renderThumbnail`. Avoids
  // hand-rolling a parallel pipeline for picker-sourced images.
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: mimeType });
  const file = new File([blob], "picked-image", { type: mimeType });
  return renderThumbnail(file);
}

async function renderThumbnail(file: File): Promise<string> {
  const bitmap = await loadBitmap(file);
  try {
    const { width, height } = scaleToFit(bitmap.width, bitmap.height, THUMB_MAX_DIM);
    if (typeof OffscreenCanvas !== "undefined") {
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return `data:${file.type};base64,${arrayBufferToBase64(await file.arrayBuffer())}`;
      }
      ctx.drawImage(bitmap as CanvasImageSource, 0, 0, width, height);
      const blob = await canvas.convertToBlob({ type: "image/webp", quality: 0.85 });
      return blobToDataUrl(blob);
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return `data:${file.type};base64,${arrayBufferToBase64(await file.arrayBuffer())}`;
    }
    ctx.drawImage(bitmap as CanvasImageSource, 0, 0, width, height);
    return canvas.toDataURL("image/webp", 0.85);
  } finally {
    if ("close" in bitmap && typeof bitmap.close === "function") bitmap.close();
  }
}

function scaleToFit(w: number, h: number, max: number): { width: number; height: number } {
  if (w <= max && h <= max) return { width: w, height: h };
  const ratio = w >= h ? max / w : max / h;
  return { width: Math.max(1, Math.round(w * ratio)), height: Math.max(1, Math.round(h * ratio)) };
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      // Fall through to <img> path.
    }
  }
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to decode image"));
    };
    img.src = url;
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("FileReader failed"));
    reader.readAsDataURL(blob);
  });
}
