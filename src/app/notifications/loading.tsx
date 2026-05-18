export default function NotificationsLoading() {
  return (
    <div className="flex-1 p-6 animate-pulse space-y-4">
      <div className="h-8 w-32 bg-muted rounded" />
      {[...Array(6)].map((_, i) => (
        <div key={i} className="flex gap-4 p-4 border rounded-lg">
          <div className="h-10 w-10 bg-muted rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-3/4 bg-muted rounded" />
            <div className="h-3 w-1/4 bg-muted rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
