export default function MaterialHistoryLoading() {
  return (
    <div className="flex-1 p-6 animate-pulse space-y-6">
      <div className="h-8 w-32 bg-muted rounded" />
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="aspect-video bg-muted rounded-lg" />
            <div className="h-4 w-3/4 bg-muted rounded" />
            <div className="h-3 w-1/2 bg-muted rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
