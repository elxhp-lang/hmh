export default function VideoLoading() {
  return (
    <div className="flex-1 p-6 animate-pulse">
      <div className="h-8 w-32 bg-muted rounded mb-6" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="h-10 w-full bg-muted rounded-lg" />
          <div className="h-32 bg-muted rounded-lg" />
          <div className="h-10 w-full bg-muted rounded-lg" />
        </div>
        <div className="space-y-4">
          <div className="h-40 bg-muted rounded-lg" />
          <div className="h-24 bg-muted rounded-lg" />
          <div className="h-6 w-20 bg-muted rounded" />
        </div>
      </div>
    </div>
  );
}
