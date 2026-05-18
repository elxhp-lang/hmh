export default function DashboardLoading() {
  return (
    <div className="flex-1 space-y-4 p-8 pt-6 animate-pulse">
      <div className="h-8 w-48 bg-muted rounded" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 bg-muted rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-64 bg-muted rounded-xl" />
        <div className="h-64 bg-muted rounded-xl" />
      </div>
    </div>
  );
}
