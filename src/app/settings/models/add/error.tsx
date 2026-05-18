"use client";

export default function ModelsAddError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 p-8 gap-4">
      <p className="text-muted-foreground">添加模型页面加载失败</p>
      <button
        onClick={reset}
        className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors"
      >
        重试
      </button>
    </div>
  );
}
