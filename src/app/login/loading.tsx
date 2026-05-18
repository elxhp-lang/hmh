export default function LoginLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center animate-pulse">
      <div className="w-full max-w-md space-y-6 p-8">
        <div className="h-10 w-32 bg-muted rounded mx-auto" />
        <div className="h-6 w-48 bg-muted rounded mx-auto" />
        <div className="space-y-4">
          <div className="h-10 bg-muted rounded-lg" />
          <div className="h-10 bg-muted rounded-lg" />
          <div className="h-10 bg-muted rounded-lg" />
        </div>
      </div>
    </div>
  );
}
