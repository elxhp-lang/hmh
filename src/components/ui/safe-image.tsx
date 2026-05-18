// ============================================================
// src/components/ui/safe-image.tsx — Step 0.1
// ============================================================
// SafeImage: next/image 的安全包裹组件
//
// 做了什么:
//   1. 用 onError 回调捕获图片加载失败（第三方删图、链接失效、非图片 URL）
//   2. 失败后自动降级为灰色占位符 + 图标，保持布局完整
//   3. 不改 next.config.ts 的 remotePatterns（保留 hostname:'*' 的灵活性）
//
// 不做什么:
//   不限制图片来源（用户上传的外部链接、多平台视频封面等一切来源均放行）
//   不改变任何业务逻辑（纯包裹层）
// ============================================================

"use client";

import NextImage, { type ImageProps } from "next/image";
import { useState } from "react";
import { ImageOff } from "lucide-react";

type SafeImageProps = Omit<ImageProps, "onError"> & {
  fallbackText?: string;
};

/**
 * SafeImage — 带加载失败兜底的图片组件
 *
 * 用法与 next/image 完全相同，额外支持:
 *   - fallbackText: 加载失败时展示的占位文本
 *   - 自动 onError → 灰色占位符 + ImageOff 图标
 *
 * @example
 *   <SafeImage src="/logo.svg" alt="Logo" width={32} height={32} />
 *   <SafeImage src={tosUrl} alt="封面" width={320} height={180} fallbackText="加载失败" />
 */
export function SafeImage({
  fallbackText,
  alt = "",
  className,
  style,
  width,
  height,
  ...props
}: SafeImageProps) {
  const [errored, setErrored] = useState(false);

  if (errored) {
    return (
      <div
        className={`flex items-center justify-center gap-1 bg-muted text-muted-foreground rounded ${className ?? ""}`}
        style={{
          width: typeof width === "number" ? width : undefined,
          height: typeof height === "number" ? height : undefined,
          minWidth: 48,
          minHeight: 48,
          ...(style as React.CSSProperties),
        }}
        role="img"
        aria-label={fallbackText ?? alt ?? "图片加载失败"}
      >
        <ImageOff className="h-4 w-4 flex-shrink-0" />
        {fallbackText && (
          <span className="text-xs truncate max-w-[80%]">{fallbackText}</span>
        )}
      </div>
    );
  }

  return (
    <NextImage
      {...props}
      alt={alt}
      width={width}
      height={height}
      className={className}
      style={style}
      onError={() => setErrored(true)}
    />
  );
}
