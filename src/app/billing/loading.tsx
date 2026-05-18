export default function BillingLoading() {
  return (
    <div className="flex-1 p-6 animate-pulse space-y-6">
      <div className="h-8 w-32 bg-muted rounded" />
      <div className="grid gap-4 md:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 bg-muted rounded-xl" />
        ))}
      </div>
      <div className="space-y-2">
        <div className="h-8 bg-muted rounded" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 bg-muted rounded" />
        ))}
      </div>
    </div>
  );
}
