export default function AgentHubLoading() {
  return (
    <div className="flex-1 p-6 animate-pulse space-y-6">
      <div className="h-8 w-32 bg-muted rounded" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-40 bg-muted rounded-xl" />
        ))}
      </div>
    </div>
  );
}
