export default function ProductLibraryLoading() {
  return (
    <div className="flex-1 p-6 animate-pulse space-y-6">
      <div className="h-8 w-32 bg-muted rounded" />
      <div className="flex gap-4">
        <div className="h-10 w-64 bg-muted rounded-lg" />
        <div className="h-10 w-24 bg-muted rounded-lg" />
      </div>
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="aspect-square bg-muted rounded-lg" />
        ))}
      </div>
    </div>
  );
}
