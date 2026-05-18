export default function AgentCreateLoading() {
  return (
    <div className="flex h-full animate-pulse">
      <div className="flex-1 flex flex-col p-4 gap-4">
        <div className="h-8 w-40 bg-muted rounded" />
        <div className="flex-1 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className={`h-16 bg-muted rounded-lg ${i % 2 === 0 ? "w-3/4" : "w-1/2 ml-auto"}`}
            />
          ))}
        </div>
        <div className="h-12 bg-muted rounded-lg" />
      </div>
      <div className="w-80 border-l p-4 space-y-3 hidden lg:block">
        <div className="h-6 w-24 bg-muted rounded" />
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-16 bg-muted rounded-lg" />
        ))}
      </div>
    </div>
  );
}
