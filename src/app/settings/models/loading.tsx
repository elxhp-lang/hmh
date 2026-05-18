export default function ModelsLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-6 w-32 bg-muted rounded" />
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-24 bg-muted rounded-lg" />
      ))}
    </div>
  );
}
