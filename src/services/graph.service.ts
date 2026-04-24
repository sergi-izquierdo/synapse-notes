import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type GraphNode = {
    id: number;
    title: string;
    tags: string[];
    starred: boolean;
    created_at: string;
};

export type GraphLink = {
    source: number;
    target: number;
    weight: number;
    kind: "tag" | "embed" | "link";
};

export type AdjacencyEntry = {
    neighbour: number;
    weight: number;
    kind: "tag" | "embed" | "link";
};

export type LoadedGraph = {
    nodes: GraphNode[];
    links: GraphLink[];
    adjacency: Map<number, AdjacencyEntry[]>;
};

export type NeighbourEntry = {
    id: number;
    title: string;
    tags: string[];
    hops: number;
    edge_kind: "tag" | "embed" | "link";
    edge_weight: number;
};

export type PathHop = { id: number; title: string; via?: string };

class GraphService {
    private cache: LoadedGraph | null = null;

    constructor(private client: SupabaseClient) {}

    async loadGraph(): Promise<LoadedGraph> {
        if (this.cache) return this.cache;
        const { data, error } = await this.client.rpc("get_note_graph");
        if (error || !data) {
            this.cache = { nodes: [], links: [], adjacency: new Map() };
            return this.cache;
        }
        const graph = data as { nodes: GraphNode[]; links: GraphLink[] };
        const adjacency = new Map<number, AdjacencyEntry[]>();
        for (const link of graph.links) {
            if (!adjacency.has(link.source)) adjacency.set(link.source, []);
            if (!adjacency.has(link.target)) adjacency.set(link.target, []);
            adjacency
                .get(link.source)!
                .push({
                    neighbour: link.target,
                    weight: link.weight,
                    kind: link.kind,
                });
            adjacency
                .get(link.target)!
                .push({
                    neighbour: link.source,
                    weight: link.weight,
                    kind: link.kind,
                });
        }
        this.cache = { nodes: graph.nodes, links: graph.links, adjacency };
        return this.cache;
    }

    async neighbours(
        noteId: number,
        depth: number,
        limit: number,
    ): Promise<NeighbourEntry[] | null> {
        const graph = await this.loadGraph();
        if (!graph.adjacency.has(noteId)) return null;

        // BFS up to `depth`, keeping the first edge encountered per
        // neighbour — i.e. the most direct one — so the weight/kind
        // reported reflects the shortest link, not whichever was seen
        // last during expansion.
        const found = new Map<
            number,
            { hops: number; weight: number; kind: "tag" | "embed" | "link" }
        >();
        const frontier: Array<{ id: number; hops: number }> = [
            { id: noteId, hops: 0 },
        ];
        const seen = new Set<number>([noteId]);

        while (frontier.length > 0) {
            const { id, hops } = frontier.shift()!;
            if (hops >= depth) continue;
            const edges = graph.adjacency.get(id) ?? [];
            for (const edge of edges) {
                if (seen.has(edge.neighbour)) continue;
                seen.add(edge.neighbour);
                found.set(edge.neighbour, {
                    hops: hops + 1,
                    weight: edge.weight,
                    kind: edge.kind,
                });
                frontier.push({ id: edge.neighbour, hops: hops + 1 });
            }
        }

        const byId = new Map(graph.nodes.map((n) => [n.id, n]));
        return Array.from(found.entries())
            .sort((a, b) => b[1].weight - a[1].weight)
            .slice(0, limit)
            .map(([id, meta]) => {
                const node = byId.get(id);
                return {
                    id,
                    title: node?.title ?? "(unknown)",
                    tags: node?.tags ?? [],
                    hops: meta.hops,
                    edge_kind: meta.kind,
                    edge_weight: Number(meta.weight.toFixed(3)),
                };
            });
    }

    async shortestPath(
        fromId: number,
        toId: number,
        maxHops: number,
    ): Promise<{ status: "ok"; hops: number; chain: PathHop[] } | { status: "missing" } | { status: "no_path" } | { status: "same" }> {
        if (fromId === toId) return { status: "same" };
        const graph = await this.loadGraph();
        if (!graph.adjacency.has(fromId) || !graph.adjacency.has(toId)) {
            return { status: "missing" };
        }

        const pred = new Map<
            number,
            { from: number; kind: "tag" | "embed" | "link"; weight: number }
        >();
        const seen = new Set<number>([fromId]);
        const q: Array<{ id: number; hops: number }> = [
            { id: fromId, hops: 0 },
        ];
        let found = false;
        while (q.length > 0) {
            const { id, hops } = q.shift()!;
            if (hops >= maxHops) continue;
            const edges = graph.adjacency.get(id) ?? [];
            for (const edge of edges) {
                if (seen.has(edge.neighbour)) continue;
                seen.add(edge.neighbour);
                pred.set(edge.neighbour, {
                    from: id,
                    kind: edge.kind,
                    weight: edge.weight,
                });
                if (edge.neighbour === toId) {
                    found = true;
                    break;
                }
                q.push({ id: edge.neighbour, hops: hops + 1 });
            }
            if (found) break;
        }

        if (!found) return { status: "no_path" };

        const byId = new Map(graph.nodes.map((n) => [n.id, n]));
        const chain: PathHop[] = [];
        let cur = toId;
        while (cur !== fromId) {
            const p = pred.get(cur)!;
            chain.unshift({
                id: cur,
                title: byId.get(cur)?.title ?? "(unknown)",
                via: `${p.kind} (w=${p.weight.toFixed(2)}) from ${p.from}`,
            });
            cur = p.from;
        }
        chain.unshift({
            id: fromId,
            title: byId.get(fromId)?.title ?? "(unknown)",
        });
        return { status: "ok", hops: chain.length - 1, chain };
    }
}

export function createGraphService(client: SupabaseClient) {
    return new GraphService(client);
}
