export default function LearningLibraryLoading() {
  return (
    <div className="flex-1 p-6 animate-pulse space-y-6">
      <div className="h-8 w-32 bg-muted rounded" />
      <div className="flex gap-4">
        <div className="h-10 w-80 bg-muted rounded-lg" />
        <div className="h-10 w-20 bg-muted rounded-lg" />
      </div>
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-48 bg-muted rounded-lg" />
        ))}
      </div>
    </div>
  );
}
