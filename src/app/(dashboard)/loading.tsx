// Skeleton shell rendered while the dashboard RSC awaits its data.
// Mirrors the real layout (chat rail + main column + card grid) so
// the transition into content doesn't jolt the viewport.

export default function DashboardLoading() {
    return (
        <div className="flex h-screen w-full overflow-hidden">
            {/* Chat rail */}
            <aside className="hidden md:flex w-[520px] flex-col border-r bg-background/50 backdrop-blur-xl h-full">
                <div className="p-4 border-b border-border/60 flex items-center justify-between">
                    <div className="h-5 w-24 rounded bg-muted animate-pulse" />
                    <div className="h-8 w-14 rounded bg-muted animate-pulse" />
                </div>
                <div className="flex flex-1 overflow-hidden">
                    <div className="w-48 border-r border-border/60 bg-muted/20 flex flex-col py-2 px-1 gap-1.5">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div
                                key={i}
                                className="h-6 rounded-md bg-muted animate-pulse"
                                style={{ animationDelay: `${i * 80}ms` }}
                            />
                        ))}
                    </div>
                    <div className="flex-1 flex flex-col p-4 gap-3">
                        <div className="h-10 w-3/4 rounded-lg bg-muted animate-pulse" />
                        <div className="h-10 w-1/2 self-end rounded-lg bg-primary/30 animate-pulse" />
                        <div className="h-10 w-2/3 rounded-lg bg-muted animate-pulse" />
                    </div>
                </div>
            </aside>

            {/* Main column */}
            <main className="flex-1 flex flex-col h-full overflow-hidden">
                <div className="flex-1 overflow-y-auto">
                    <div className="container mx-auto max-w-5xl p-6 space-y-8">
                        <div className="h-16 rounded-lg bg-muted/60 animate-pulse" />
                        <div className="h-[220px] rounded-2xl border bg-muted/40 animate-pulse" />
                        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <div
                                    key={i}
                                    className="h-[220px] rounded-lg border border-border/60 bg-card/60 animate-pulse"
                                    style={{ animationDelay: `${i * 60}ms` }}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
