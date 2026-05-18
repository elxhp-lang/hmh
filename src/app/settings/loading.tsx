export default function SettingsLoading() {
  return (
    <div className="flex-1 p-6 animate-pulse space-y-6 max-w-2xl">
      <div className="h-8 w-32 bg-muted rounded" />
      <div className="space-y-4">
        <div className="h-6 w-24 bg-muted rounded" />
        <div className="h-10 bg-muted rounded-lg" />
        <div className="h-10 bg-muted rounded-lg" />
      </div>
      <div className="space-y-4">
        <div className="h-6 w-24 bg-muted rounded" />
        <div className="h-20 bg-muted rounded-lg" />
      </div>
    </div>
  );
}
