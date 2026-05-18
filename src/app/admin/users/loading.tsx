export default function AdminUsersLoading() {
  return (
    <div className="flex-1 p-6 animate-pulse space-y-4">
      <div className="h-8 w-32 bg-muted rounded" />
      <div className="h-10 bg-muted rounded-lg" />
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex gap-4 p-4 border rounded-lg items-center">
          <div className="h-10 w-10 bg-muted rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/4 bg-muted rounded" />
            <div className="h-3 w-1/3 bg-muted rounded" />
          </div>
          <div className="h-8 w-16 bg-muted rounded" />
        </div>
      ))}
    </div>
  );
}
