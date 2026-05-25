'use client';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="glass-card p-8 max-w-md w-full space-y-4 text-center">
        <p className="text-white/50 text-sm">Something went wrong loading this dashboard.</p>
        {error.message && (
          <p className="text-xs text-white/30 font-mono">{error.message}</p>
        )}
        <button
          onClick={reset}
          className="glass-button px-4 py-2 text-sm text-white/70 hover:text-white transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
