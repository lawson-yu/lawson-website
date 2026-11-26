"use client";

import { useRef, useState, type ChangeEvent, type RefObject } from "react";
import { resolveMediaUrl } from "@/lib/media-url";

type UploadResponse = {
  key?: string;
  url?: string;
  error?: string;
};

async function uploadMediaFile(file: File, kind: "cover" | "body"): Promise<{ key: string; url: string }> {
  const formData = new FormData();
  formData.set("kind", kind);
  formData.set("file", file);

  const response = await fetch("/api/admin/media", {
    method: "POST",
    body: formData,
  });
  const payload = (await response.json().catch(() => ({}))) as UploadResponse;
  if (!response.ok || !payload.key || !payload.url) {
    throw new Error(payload.error || "图片上传失败，请稍后重试。");
  }
  return { key: payload.key, url: payload.url };
}

export function CoverImageField({
  id,
  name,
  label = "封面图片",
  initialValue = "",
  helpText = "可留空。上传后自动裁剪为 1200×630 JPEG，并保存相对路径。",
}: {
  id: string;
  name: string;
  label?: string;
  initialValue?: string;
  helpText?: string;
}) {
  const [value, setValue] = useState(initialValue);
  const [previewUrl, setPreviewUrl] = useState<string | null>(() => resolveMediaUrl(initialValue));
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploading(true);
    setStatus(null);
    try {
      const uploaded = await uploadMediaFile(file, "cover");
      setValue(uploaded.key);
      setPreviewUrl(uploaded.url);
      setStatus({ kind: "success", text: "封面已上传，保存后生效。" });
    } catch (error) {
      setStatus({
        kind: "error",
        text: error instanceof Error ? error.message : "封面上传失败。",
      });
    } finally {
      setUploading(false);
    }
  }

  function handleKeyChange(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.value;
    setValue(next);
    setPreviewUrl(resolveMediaUrl(next));
  }

  function handleClear() {
    setValue("");
    setPreviewUrl(null);
    setStatus({ kind: "success", text: "已清除封面，保存后生效。" });
  }

  return (
    <div className="media-field">
      <label htmlFor={id}>{label}</label>
      <div className="media-field__controls">
        <input
          id={id}
          name={name}
          value={value}
          onChange={handleKeyChange}
          placeholder="media/2026/11/cover.jpg"
          autoComplete="off"
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          onChange={handleFileChange}
          hidden
          aria-label="选择封面图片文件"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? "上传中…" : "上传封面"}
        </button>
        {value && (
          <button type="button" onClick={handleClear} disabled={uploading}>
            清除封面
          </button>
        )}
      </div>
      <p className="media-field__help">{helpText}</p>
      {status && (
        <p className="media-field__status" role="status" aria-live="polite" data-kind={status.kind}>
          {status.text}
        </p>
      )}
      {previewUrl && (
        <div className="media-field__preview">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="封面预览" />
        </div>
      )}
    </div>
  );
}

export function MarkdownImageButton({
  textareaRef,
}: {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
}) {
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploading(true);
    setStatus(null);
    try {
      const uploaded = await uploadMediaFile(file, "body");
      const alt = file.name.replace(/\.[^.]+$/, "").replace(/[[\]]/g, "").trim() || "插图";
      const snippet = `![${alt}](${uploaded.key})`;
      const textarea = textareaRef.current;
      if (textarea) {
        const start = textarea.selectionStart ?? textarea.value.length;
        const end = textarea.selectionEnd ?? start;
        const prefix = start > 0 && !textarea.value.slice(0, start).endsWith("\n") ? "\n\n" : "";
        const suffix = end < textarea.value.length && !textarea.value.slice(end).startsWith("\n") ? "\n\n" : "\n";
        const insertion = `${prefix}${snippet}${suffix}`;
        textarea.setRangeText(insertion, start, end, "end");
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
        textarea.focus();
      }
      setStatus({ kind: "success", text: `已插入正文图片：${uploaded.key}` });
    } catch (error) {
      setStatus({
        kind: "error",
        text: error instanceof Error ? error.message : "正文图片上传失败。",
      });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="media-toolbar">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        onChange={handleFileChange}
        hidden
        aria-label="选择正文图片文件"
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? "上传中…" : "插入正文图片"}
      </button>
      {status && (
        <span className="media-field__status" role="status" aria-live="polite" data-kind={status.kind}>
          {status.text}
        </span>
      )}
    </div>
  );
}
