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
import { forceCollide, forceX, forceY } from "d3-force-3d";
import { useTheme } from "next-themes";

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
    kind: "tag" | "embed" | "link";
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

// Canvas helper: paints the "starred" ornament around a node. Two
// layers, outside to inside:
//   1. Soft amber glow drawn via shadowBlur on a stroked ring —
//      visible even on light community colors because the glow
//      sits outside the disc.
//   2. Bright amber ring (stroke) hugging the disc's edge —
//      1.75 px wide, drawn with a thin white pre-stroke so it
//      reads on dark backgrounds too.
// No fill inside the disc so the community color stays legible
// and the hover aura (drawn separately when isHovered) doesn't
// fight for the same space.
function paintStarredRing(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    R: number,
    backingColor: string,
) {
    ctx.save();

    // Outer glow — canvas shadowBlur is cheap when you stroke a
    // transparent path, and it radiates beyond the disc so the
    // favourite status reads at a glance on either theme.
    ctx.shadowColor = "rgba(245, 194, 74, 0.9)";
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(cx, cy, R + 2.25, 0, 2 * Math.PI);
    ctx.lineWidth = 1.75;
    ctx.strokeStyle = "rgba(245, 194, 74, 0.95)";
    ctx.stroke();

    // Contrast backing: dark in dark mode, light in light mode.
    // On dark the backing reads as a subtle drop-shadow under the
    // amber ring; on light it's a thin white halo that keeps the
    // amber from melting into near-amber community colors.
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(cx, cy, R + 2.25, 0, 2 * Math.PI);
    ctx.lineWidth = 0.6;
    ctx.strokeStyle = backingColor;
    ctx.stroke();

    ctx.restore();
}

export function GraphViewer() {
    const [data, setData] = useState<GraphData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [hoverNode, setHoverNode] = useState<GraphNode | null>(null);
    const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
    const [dims, setDims] = useState({ width: 0, height: 0 });
    const containerRef = useRef<HTMLDivElement>(null);

    // Theme-aware palette. The canvas paints labels, edges and
    // feedback colours as plain rgba strings — they're not CSS
    // variables, so we resolve the theme at React level and swap
    // the whole palette on toggle. `resolvedTheme` folds the
    // `system` preference into either "light" or "dark".
    const { resolvedTheme } = useTheme();
    const isDark = resolvedTheme !== "light"; // default to dark during SSR / unresolved
    // Memoised so the object identity only flips when the theme
    // changes — keeps the useCallback below stable between renders.
    const palette = useMemo(() => isDark
        ? {
              canvasBg: "color-mix(in oklch, var(--background) 92%, black)",
              labelFill: "rgba(255, 255, 255, 0.82)",
              labelFillHover: "rgba(255, 255, 255, 1)",
              edgeTagIdle: "rgba(180, 200, 230, 0.22)",
              edgeTagActive: "rgba(180, 200, 230, 0.55)",
              edgeEmbedIdle: "rgba(231, 161, 60, 0.28)",
              edgeEmbedActive: "rgba(231, 161, 60, 0.65)",
              edgeLinkIdle: "rgba(185, 154, 224, 0.4)",
              edgeLinkActive: "rgba(185, 154, 224, 0.85)",
              edgeDim: "rgba(180, 200, 230, 0.04)",
              starRingBacking: "rgba(12, 18, 28, 0.65)",
              inactiveAlpha: 0.15,
          }
        : {
              canvasBg: "color-mix(in oklch, var(--background) 96%, black)",
              labelFill: "rgba(30, 35, 45, 0.85)",
              labelFillHover: "rgba(10, 15, 25, 1)",
              edgeTagIdle: "rgba(80, 100, 130, 0.35)",
              edgeTagActive: "rgba(40, 60, 100, 0.7)",
              edgeEmbedIdle: "rgba(180, 110, 20, 0.42)",
              edgeEmbedActive: "rgba(170, 100, 15, 0.8)",
              edgeLinkIdle: "rgba(130, 95, 185, 0.55)",
              edgeLinkActive: "rgba(100, 65, 160, 0.85)",
              edgeDim: "rgba(50, 60, 80, 0.08)",
              starRingBacking: "rgba(255, 255, 255, 0.75)",
              inactiveAlpha: 0.25,
          }, [isDark]);
    // State-backed ref so our physics setup effect fires the moment
    // the dynamically-imported ForceGraph2D assigns its imperative
    // handle. A plain useRef wouldn't trigger a re-render, so an
    // effect depending only on `data` would see `.current === null`
    // on first pass and silently no-op before the forces ever get
    // configured.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [fgInstance, setFgInstance] = useState<any>(null);

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

    // Obsidian-style physics: per-node gravitational pull toward the
    // origin gives every node a virtual "home" position. Combined
    // with short-range repulsion (distanceMax-capped charge), the
    // equilibrium is a compact cluster where:
    //   - short distances: repulsion dominates → nodes space out
    //   - long distances:  gravity dominates   → nodes return
    //
    // The pull is LINEAR in distance (forceX/forceY), so a node
    // dragged 500 px away feels ~6x the restoring force of one 80 px
    // out — that's what gives the "tethered" feel on release.
    //
    // Strength 0.25 + velocityDecay 0.5 means a node released from
    // 500 px returns to the cluster in ~1s. Going much lower than
    // that produces the "drifts but never arrives" feel (the
    // simulation cools before it can close the gap).
    useEffect(() => {
        if (!fgInstance || !data) return;
        // Three forces balance here:
        //
        //   1. charge  — long-range repulsion so truly-orphan nodes
        //      (zero edges) feel the cluster pushing them outward.
        //      Previously capped at 260 px, which meant once an
        //      orphan drifted inside that radius it felt no pushback
        //      at all and gravity happily slid it through the
        //      cluster centre. Raised cap to 500 px (≈ canvas width)
        //      and softened strength so the ripple from a drag still
        //      dies off quickly.
        //
        //   2. gravity (forceX/Y) — per-node pull toward origin so
        //      nothing drifts to infinity; releases tethered.
        //
        //   3. collide — hard geometric disc-disc resolution so
        //      orphans literally can't share pixels with cluster
        //      nodes. 38 px is generous: node radii are 4-6 px, but
        //      the drawn label often extends ~30-40 px below, so
        //      this keeps labels from crashing too.
        const charge = fgInstance.d3Force("charge");
        if (charge) {
            charge.strength(-55);
            charge.distanceMax(500);
        }
        const link = fgInstance.d3Force("link");
        if (link) {
            link.distance(55);
            link.strength(0.8);
        }
        fgInstance.d3Force("x", forceX(0).strength(0.07));
        fgInstance.d3Force("y", forceY(0).strength(0.07));
        fgInstance.d3Force("collide", forceCollide(38).strength(0.95));
        fgInstance.d3ReheatSimulation();
    }, [data, fgInstance]);

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

                // Build a graphology graph so we can run Louvain on
                // it. Seeded RNG so community indices stay stable
                // across reloads — without seeding, the same user
                // would see the colour palette reshuffle on every
                // visit, which breaks trust that "blue cluster"
                // means anything.
                //
                // Louvain runs on tag + embed edges ONLY. `link`
                // edges are user-authored directional backlinks and
                // shouldn't merge two notes into the same community
                // just because one references the other — a backlink
                // from a shopping note to an unrelated note about
                // code shouldn't repaint the target yellow. The
                // backlink's meaning is carried by the arrow, not by
                // the cluster colour.
                const g = new UndirectedGraph();
                raw.nodes.forEach((n) => g.addNode(String(n.id), n));
                raw.links.forEach((l) => {
                    if (l.kind === "link") return;
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
    const searchIds = useMemo(() => {
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

    // Precomputed adjacency for the hover-focus feature. On hover we
    // dim everything except the focused node and its direct
    // neighbours (Obsidian-style). Building this once per data
    // change is O(E) and keeps the render hot-path lookup-free.
    const adjacency = useMemo(() => {
        const map = new Map<number, Set<number>>();
        if (!data) return map;
        for (const n of data.nodes) map.set(n.id, new Set());
        for (const l of data.links) {
            const s = typeof l.source === "object" ? l.source.id : l.source;
            const t = typeof l.target === "object" ? l.target.id : l.target;
            map.get(s)?.add(t);
            map.get(t)?.add(s);
        }
        return map;
    }, [data]);

    // `focusIds`: the 1-hop neighbourhood around the currently
    // hovered / selected node. When set, every node outside this
    // neighbourhood is dimmed regardless of search state, and every
    // edge not incident to a focus member fades out. When null, no
    // hover focus is active and only the search filter applies.
    const focusIds = useMemo(() => {
        const anchor = selectedNode ?? hoverNode;
        if (!anchor) return null;
        const ids = new Set<number>([anchor.id]);
        const nbrs = adjacency.get(anchor.id);
        if (nbrs) for (const n of nbrs) ids.add(n);
        return ids;
    }, [adjacency, hoverNode, selectedNode]);

    // Composite: a node is considered "active" (rendered at full
    // brightness) iff it passes both the search filter (if any) and
    // the hover focus filter (if any). When neither is set every
    // node is active.
    const isActive = useCallback(
        (id: number): boolean => {
            if (searchIds && !searchIds.has(id)) return false;
            if (focusIds && !focusIds.has(id)) return false;
            return true;
        },
        [searchIds, focusIds],
    );
    const anyFilterActive = searchIds !== null || focusIds !== null;

    const nodeCanvasObject = useCallback(
        (
            node: GraphNode,
            ctx: CanvasRenderingContext2D,
            globalScale: number,
        ) => {
            if (node.x == null || node.y == null) return;
            const active = isActive(node.id);
            const isHovered = hoverNode?.id === node.id;
            const isSelected = selectedNode?.id === node.id;
            const baseRadius = 5;

            // Dimming rule: any active filter (search or hover focus)
            // pushes non-active nodes down to palette.inactiveAlpha.
            // Dark mode can push harder (0.15) because the dim
            // contrast is huge; light mode needs a softer 0.25 so
            // dimmed nodes don't disappear into the background.
            ctx.globalAlpha = active ? 1 : palette.inactiveAlpha;

            // Aura only for the *focus anchor* itself (hovered or
            // selected). Used to mean "all starred nodes" too, but
            // that made the hover cue invisible on favourites — the
            // star glyph below is the stable indicator for starred
            // now, and the aura is reserved for interaction feedback.
            if (isSelected || isHovered) {
                ctx.beginPath();
                ctx.arc(node.x, node.y, baseRadius + 4, 0, 2 * Math.PI);
                ctx.fillStyle = "rgba(231, 161, 60, 0.22)";
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

            // Starred marker: amber ring + soft outer glow drawn
            // OUTSIDE the disc. Doesn't fight the community color
            // for the pixel space inside the node, stays visible on
            // any background thanks to the shadowBlur, and leaves
            // the inner disc untouched so hover feedback still
            // reads consistently across starred and non-starred.
            if (node.starred) {
                paintStarredRing(
                    ctx,
                    node.x,
                    node.y,
                    baseRadius,
                    palette.starRingBacking,
                );
            }

            // Labels only when zoomed in enough, to keep the overview
            // readable at low zoom. Matches Obsidian's "fade text
            // below threshold" behaviour. We also show the label for
            // the hover anchor and its neighbours regardless of
            // zoom, so the focused sub-graph is readable.
            const forceLabel =
                focusIds !== null && focusIds.has(node.id);
            if ((globalScale > 1.6 && active) || forceLabel) {
                const label =
                    node.title.length > 36
                        ? node.title.slice(0, 36) + "…"
                        : node.title;
                const fontSize =
                    (isHovered ? 12 : 11) /
                    Math.max(globalScale, forceLabel ? 1 : 1.6);
                ctx.font = `${fontSize}px "Inter Tight", system-ui, sans-serif`;
                ctx.textAlign = "center";
                ctx.textBaseline = "top";
                ctx.fillStyle = isHovered
                    ? palette.labelFillHover
                    : palette.labelFill;
                ctx.fillText(label, node.x, node.y + baseRadius + 2);
            }

            ctx.globalAlpha = 1;
        },
        [isActive, hoverNode, selectedNode, focusIds, palette],
    );

    // Palette keyed by edge kind:
    //   embed → amber  (inferred, embedding similarity)
    //   tag   → slate  (inferred, shared tag)
    //   link  → violet (EXTRACTED, user-authored [[N]] backlink)
    // Actual rgba values come from the theme palette computed above.
    const baseLinkColor = useCallback(
        (kind: GraphLink["kind"], active: boolean) => {
            if (kind === "embed")
                return active
                    ? palette.edgeEmbedActive
                    : palette.edgeEmbedIdle;
            if (kind === "link")
                return active
                    ? palette.edgeLinkActive
                    : palette.edgeLinkIdle;
            return active ? palette.edgeTagActive : palette.edgeTagIdle;
        },
        [palette],
    );

    const linkColor = useCallback(
        (link: GraphLink) => {
            if (!anyFilterActive) {
                return baseLinkColor(link.kind, false);
            }
            const s =
                typeof link.source === "object" ? link.source.id : link.source;
            const t =
                typeof link.target === "object" ? link.target.id : link.target;
            // An edge is "on" when both endpoints pass every active
            // filter. Edges crossing the focus boundary fade out so
            // the attention goes to the hovered subgraph.
            const edgeActive = isActive(s) && isActive(t);
            if (!edgeActive) return palette.edgeDim;
            return baseLinkColor(link.kind, true);
        },
        [anyFilterActive, isActive, baseLinkColor, palette],
    );

    return (
        <div className="flex h-screen w-full overflow-hidden bg-background">
            {/* Main canvas */}
            <main
                ref={containerRef}
                className="relative flex-1"
                style={{ backgroundColor: palette.canvasBg }}
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
                        ref={setFgInstance as any}
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
                        /* Only EXTRACTED backlinks get an arrowhead.
                           Tag + embed edges are symmetric, so drawing
                           arrows on them would misrepresent the edge
                           semantics. 7 px is large enough to read at
                           default zoom without dominating node discs. */
                        linkDirectionalArrowLength={((l: GraphLink) =>
                            l.kind === "link" ? 7 : 0) as any}
                        linkDirectionalArrowRelPos={0.78}
                        linkDirectionalArrowColor={((l: GraphLink) =>
                            l.kind === "link"
                                ? "rgba(185, 154, 224, 1)"
                                : "transparent") as any}
                        cooldownTicks={200}
                        d3AlphaDecay={0.02}
                        d3VelocityDecay={0.5}
                        warmupTicks={40}
                        onNodeHover={((n: GraphNode | null) =>
                            setHoverNode(n)) as any}
                        onNodeClick={((n: GraphNode) =>
                            setSelectedNode(n)) as any}
                        onNodeDragEnd={(() => {
                            // Kick the simulation back to a high
                            // alpha so the dragged node has enough
                            // "heat" to ride the gravity force all
                            // the way back to the cluster.
                            fgInstance?.d3ReheatSimulation?.();
                        }) as any}
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
                                style={{ background: palette.edgeEmbedActive }}
                            />
                            <span className="text-muted-foreground">
                                Embedding similarity
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span
                                className="inline-block h-2.5 w-6 rounded"
                                style={{ background: palette.edgeTagActive }}
                            />
                            <span className="text-muted-foreground">
                                Shared tag
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span
                                className="inline-block h-2.5 w-6 rounded"
                                style={{ background: palette.edgeLinkActive }}
                            />
                            <span className="text-muted-foreground">
                                Backlink <span className="opacity-60">[[N]]</span>
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
        const out: Array<{ node: GraphNode; kind: GraphLink["kind"]; weight: number }> = [];
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
