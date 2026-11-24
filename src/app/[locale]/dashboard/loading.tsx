export default function DashboardLoading() {
    return (
        <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Loading workspace">
            <div className="space-y-2">
                <div className="h-4 w-32 rounded bg-muted" />
                <div className="h-8 w-64 rounded bg-muted" />
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {[0, 1, 2, 3].map((idx) => (
                    <div
                        key={idx}
                        className="h-28 rounded-md border border-border bg-card p-4 space-y-3"
                    >
                        <div className="h-3 w-24 rounded bg-muted" />
                        <div className="h-8 w-20 rounded bg-muted" />
                    </div>
                ))}
            </div>

            <div className="flex gap-2 overflow-hidden">
                {[0, 1, 2, 3].map((idx) => (
                    <div key={idx} className="h-11 w-32 shrink-0 rounded-md bg-muted" />
                ))}
            </div>

            <div className="space-y-3">
                {[0, 1, 2].map((idx) => (
                    <div
                        key={idx}
                        className="h-24 rounded-md border border-border bg-card p-4"
                    />
                ))}
            </div>
        </div>
    );
}
