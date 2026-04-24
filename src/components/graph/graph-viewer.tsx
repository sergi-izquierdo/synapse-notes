"use client";

import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft, Loader2, Search, Star } from "lucide-react";
import { UndirectedGraph } from "graphology";
import louvain from "graphology-communities-louvain";
import seedrandom from "seedrandom";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type GraphNode = {
    id: number;
    title: string;
    tags: string[];
    starred: boolean;
    created_at: string;
    community?: number;
    // Injected by force-graph during simulation
    x?: number;
    y?: number;
};

type GraphLink = {
    source: number | GraphNode;
    target: number | GraphNode;
    weight: number;
    kind: "tag" | "embed";
};

type GraphData = {
    nodes: GraphNode[];
    links: GraphLink[];
    meta?: { nodeCount?: number; linkCount?: number };
};

// react-force-graph-2d touches `window` on import — load only on the
// client to keep Next.js SSR happy.
const ForceGraph2D = dynamic(
    () => import("react-force-graph-2d").then((m) => m.default),
    { ssr: false },
);

// Palette of distinct community colours that read well on both dark
// navy and frost light backgrounds. Hand-picked so adjacent indices
// are visually separable without relying on a rainbow.
const COMMUNITY_PALETTE = [
    "#e7a13c", // primary amber
    "#6fb3d3", // steel blue
    "#b99ae0", // soft violet
    "#7ec99b", // sage green
    "#e08e9d", // muted rose
    "#c9c36f", // warm yellow
    "#9fb9cc", // cool slate
    "#d8a36b", // ochre
    "#86c0ae", // teal green
    "#b8a58e", // taupe
];

function communityColor(community: number | undefined): string {
    if (community === undefined) return "#6b7280";
    return COMMUNITY_PALETTE[community % COMMUNITY_PALETTE.length]!;
}

export function GraphViewer() {
    const [data, setData] = useState<GraphData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [hoverNode, setHoverNode] = useState<GraphNode | null>(null);
    const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
    const [dims, setDims] = useState({ width: 0, height: 0 });
    const containerRef = useRef<HTMLDivElement>(null);

    // Measure the canvas container once mounted and on resize.
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const measure = () => {
            const rect = el.getBoundingClientRect();
            setDims({ width: rect.width, height: rect.height });
        };
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    // Fetch the graph and run Louvain for community colouring.
    useEffect(() => {
        let cancelled = false;
        fetch("/api/graph")
            .then((r) => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                return r.json();
            })
            .then((raw: GraphData) => {
                if (cancelled) return;

                // Build a graphology graph so we can run Louvain on it.
                // Seeded RNG so community indices stay stable across
                // reloads — without seeding, the same user would see
                // the colour palette reshuffle on every visit, which
                // breaks trust that "blue cluster" means anything.
                const g = new UndirectedGraph();
                raw.nodes.forEach((n) => g.addNode(String(n.id), n));
                raw.links.forEach((l) => {
                    const s = String(
                        typeof l.source === "object" ? l.source.id : l.source,
                    );
                    const t = String(
                        typeof l.target === "object" ? l.target.id : l.target,
                    );
                    if (s === t || !g.hasNode(s) || !g.hasNode(t)) return;
                    if (!g.hasEdge(s, t))
                        g.addEdge(s, t, { weight: l.weight });
                });

                const communities: Record<string, number> =
                    raw.nodes.length > 0
                        ? louvain(g, {
                              rng: seedrandom("synapse-notes-graph"),
                          })
                        : {};

                const withCommunities = raw.nodes.map((n) => ({
                    ...n,
                    community: communities[String(n.id)] ?? 0,
                }));

                setData({ ...raw, nodes: withCommunities });
            })
            .catch((err: unknown) => {
                if (cancelled) return;
                const msg = err instanceof Error ? err.message : String(err);
                setError(msg);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    // Dim non-matching nodes when a search term is active. The match
    // set is computed once per search/data change and passed to the
    // renderer via a closure.
    const highlightIds = useMemo(() => {
        if (!data || !search.trim()) return null;
        const q = search.trim().toLowerCase();
        const ids = new Set<number>();
        for (const n of data.nodes) {
            if (
                n.title.toLowerCase().includes(q) ||
                n.tags.some((t) => t.toLowerCase().includes(q))
            ) {
                ids.add(n.id);
            }
        }
        return ids;
    }, [data, search]);

    const nodeCanvasObject = useCallback(
        (
            node: GraphNode,
            ctx: CanvasRenderingContext2D,
            globalScale: number,
        ) => {
            if (node.x == null || node.y == null) return;
            const isHighlighted =
                highlightIds == null || highlightIds.has(node.id);
            const isHovered = hoverNode?.id === node.id;
            const isSelected = selectedNode?.id === node.id;
            const baseRadius = node.starred ? 6 : 4.5;

            ctx.globalAlpha = isHighlighted ? 1 : 0.18;

            // Glow halo around starred / hovered / selected nodes.
            if (isSelected || isHovered || node.starred) {
                ctx.beginPath();
                ctx.arc(node.x, node.y, baseRadius + 4, 0, 2 * Math.PI);
                ctx.fillStyle = "rgba(231, 161, 60, 0.18)";
                ctx.fill();
            }

            ctx.beginPath();
            ctx.arc(node.x, node.y, baseRadius, 0, 2 * Math.PI);
            ctx.fillStyle = communityColor(node.community);
            ctx.fill();

            if (isSelected) {
                ctx.lineWidth = 2 / globalScale;
                ctx.strokeStyle = "#e7a13c";
                ctx.stroke();
            }

            // Labels only when zoomed in enough, to keep the overview
            // readable at low zoom. Matches Obsidian's "fade text
            // below threshold" behaviour.
            if (globalScale > 1.6 && isHighlighted) {
                const label =
                    node.title.length > 36
                        ? node.title.slice(0, 36) + "…"
                        : node.title;
                const fontSize = 11 / globalScale;
                ctx.font = `${fontSize}px "Inter Tight", system-ui, sans-serif`;
                ctx.textAlign = "center";
                ctx.textBaseline = "top";
                ctx.fillStyle = "rgba(255, 255, 255, 0.72)";
                ctx.fillText(label, node.x, node.y + baseRadius + 2);
            }

            ctx.globalAlpha = 1;
        },
        [highlightIds, hoverNode, selectedNode],
    );

    const linkColor = useCallback(
        (link: GraphLink) => {
            if (!highlightIds) {
                return link.kind === "embed"
                    ? "rgba(231, 161, 60, 0.22)"
                    : "rgba(180, 200, 230, 0.18)";
            }
            const s =
                typeof link.source === "object" ? link.source.id : link.source;
            const t =
                typeof link.target === "object" ? link.target.id : link.target;
            const active = highlightIds.has(s) || highlightIds.has(t);
            return active
                ? link.kind === "embed"
                    ? "rgba(231, 161, 60, 0.5)"
                    : "rgba(180, 200, 230, 0.45)"
                : "rgba(180, 200, 230, 0.04)";
        },
        [highlightIds],
    );

    return (
        <div className="flex h-screen w-full overflow-hidden bg-background">
            {/* Main canvas */}
            <main
                ref={containerRef}
                className="relative flex-1 bg-[color-mix(in_oklch,var(--background)_92%,black)]"
            >
                {!data && !error && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                )}
                {error && (
                    <div className="absolute inset-0 flex items-center justify-center text-sm text-destructive">
                        {error}
                    </div>
                )}
                {data && dims.width > 0 && dims.height > 0 && (
                    <ForceGraph2D
                        /* eslint-disable @typescript-eslint/no-explicit-any */
                        graphData={data as any}
                        width={dims.width}
                        height={dims.height}
                        backgroundColor="transparent"
                        nodeCanvasObject={nodeCanvasObject as any}
                        nodePointerAreaPaint={((
                            node: GraphNode,
                            color: string,
                            ctx: CanvasRenderingContext2D,
                        ) => {
                            if (node.x == null || node.y == null) return;
                            ctx.fillStyle = color;
                            ctx.beginPath();
                            ctx.arc(node.x, node.y, 8, 0, 2 * Math.PI);
                            ctx.fill();
                        }) as any}
                        linkColor={linkColor as any}
                        linkWidth={((l: GraphLink) =>
                            0.4 + (l.weight ?? 0.5) * 1.2) as any}
                        cooldownTicks={120}
                        onNodeHover={((n: GraphNode | null) =>
                            setHoverNode(n)) as any}
                        onNodeClick={((n: GraphNode) =>
                            setSelectedNode(n)) as any}
                        onBackgroundClick={() => setSelectedNode(null)}
                        /* eslint-enable @typescript-eslint/no-explicit-any */
                    />
                )}
            </main>

            {/* Side panel */}
            <aside className="hidden md:flex w-[320px] flex-col border-l border-border/60 bg-background/80 backdrop-blur-sm">
                <div className="flex items-center gap-2 border-b border-border/60 p-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        asChild
                        className="h-8 w-8 -ml-2"
                    >
                        <Link href="/" aria-label="Back to notes">
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                    <h1 className="text-sm font-semibold tracking-tight">
                        Note graph
                    </h1>
                </div>

                <div className="relative p-4 border-b border-border/60">
                    <Search className="absolute left-7 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search nodes…"
                        className="pl-8 h-9 text-sm"
                        data-search-shortcut=""
                    />
                </div>

                {/* Stats + legend */}
                <div className="p-4 border-b border-border/60 space-y-3 text-xs">
                    <div className="flex items-center justify-between font-mono text-muted-foreground tabular-nums">
                        <span>Nodes</span>
                        <span>{data?.nodes.length ?? 0}</span>
                    </div>
                    <div className="flex items-center justify-between font-mono text-muted-foreground tabular-nums">
                        <span>Links</span>
                        <span>{data?.links.length ?? 0}</span>
                    </div>
                    <div className="pt-2 space-y-1">
                        <div className="flex items-center gap-2">
                            <span
                                className="inline-block h-2.5 w-6 rounded"
                                style={{ background: "rgba(231, 161, 60, 0.5)" }}
                            />
                            <span className="text-muted-foreground">
                                Embedding similarity
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span
                                className="inline-block h-2.5 w-6 rounded"
                                style={{
                                    background: "rgba(180, 200, 230, 0.45)",
                                }}
                            />
                            <span className="text-muted-foreground">
                                Shared tag
                            </span>
                        </div>
                    </div>
                </div>

                {/* Inspector — selected node details */}
                <div className="flex-1 overflow-y-auto p-4">
                    {selectedNode ? (
                        <NodeInspector
                            node={selectedNode}
                            data={data}
                        />
                    ) : hoverNode ? (
                        <NodePreview node={hoverNode} />
                    ) : (
                        <p className="text-xs text-muted-foreground italic">
                            Hover a node to preview, click to inspect, or pan /
                            zoom the canvas. Amber edges are embedding
                            similarity; slate edges are shared tags.
                        </p>
                    )}
                </div>
            </aside>
        </div>
    );
}

function NodePreview({ node }: { node: GraphNode }) {
    return (
        <div className="space-y-2">
            <div className="flex items-center gap-1.5">
                <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: communityColor(node.community) }}
                />
                <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
                    cluster {node.community}
                </p>
            </div>
            <p className="text-sm font-medium text-foreground">{node.title}</p>
            {node.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                    {node.tags.map((t) => (
                        <span
                            key={t}
                            className="text-[10px] px-1.5 py-0 rounded border border-border/60 text-muted-foreground bg-muted/30 uppercase tracking-wider font-mono"
                        >
                            {t}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}

function NodeInspector({
    node,
    data,
}: {
    node: GraphNode;
    data: GraphData | null;
}) {
    const neighbours = useMemo(() => {
        if (!data) return [];
        const out: Array<{ node: GraphNode; kind: "tag" | "embed"; weight: number }> = [];
        const byId = new Map(data.nodes.map((n) => [n.id, n]));
        for (const link of data.links) {
            const s = typeof link.source === "object" ? link.source.id : link.source;
            const t = typeof link.target === "object" ? link.target.id : link.target;
            if (s === node.id) {
                const nb = byId.get(t);
                if (nb) out.push({ node: nb, kind: link.kind, weight: link.weight });
            } else if (t === node.id) {
                const nb = byId.get(s);
                if (nb) out.push({ node: nb, kind: link.kind, weight: link.weight });
            }
        }
        out.sort((a, b) => b.weight - a.weight);
        return out.slice(0, 12);
    }, [data, node.id]);

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                    <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ background: communityColor(node.community) }}
                    />
                    <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
                        cluster {node.community}
                    </p>
                    {node.starred && (
                        <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                    )}
                </div>
                <p className="text-sm font-medium text-foreground">
                    {node.title}
                </p>
                {node.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                        {node.tags.map((t) => (
                            <span
                                key={t}
                                className="text-[10px] px-1.5 py-0 rounded border border-border/60 text-muted-foreground bg-muted/30 uppercase tracking-wider font-mono"
                            >
                                {t}
                            </span>
                        ))}
                    </div>
                )}
                <Button asChild variant="outline" size="sm" className="w-full mt-2">
                    <Link href={`/?note=${node.id}`}>Open note</Link>
                </Button>
            </div>
            {neighbours.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-border/60">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground font-mono">
                        Neighbours ({neighbours.length})
                    </p>
                    <ul className="space-y-1">
                        {neighbours.map(({ node: nb, kind, weight }) => (
                            <li
                                key={nb.id}
                                className={cn(
                                    "flex items-center gap-2 text-xs rounded px-1.5 py-1 hover:bg-muted/40",
                                )}
                            >
                                <span
                                    className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
                                    style={{
                                        background: communityColor(nb.community),
                                    }}
                                />
                                <span className="flex-1 truncate text-foreground">
                                    {nb.title}
                                </span>
                                <span
                                    className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground"
                                    title={`${kind} · weight ${weight.toFixed(2)}`}
                                >
                                    {kind}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
