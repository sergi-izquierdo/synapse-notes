# Memoir figures

Mermaid sources for the memoir's diagrams. Each `.mmd` file produces
a corresponding `.svg` via the Mermaid CLI:

```bash
# install once (global)
npm install -g @mermaid-js/mermaid-cli

# build all figures
for f in *.mmd; do
  mmdc -i "$f" -o "${f%.mmd}.svg" --backgroundColor transparent
done
```

The `.tex` files reference figures via `\IfFileExists{path}{...}{...}`
so the LaTeX build does not fail when the SVG is missing — useful
when working from a machine without Node/Mermaid (e.g. the laptop
without LaTeX where a memoir editing pass might happen). Generate
the SVGs on the main PC before producing a final PDF.

## Files

| Source | Used by | What it shows |
|---|---|---|
| `c4-context.mmd` | §9.1 / `\ref{fig:c4-context}` | C4 nivell 1 — actors externs |
| `c4-containers.mmd` | §9.1 / `\ref{fig:c4-containers}` | C4 nivell 2 — containers Next.js + Supabase + APIs |
| `mcp-oauth-sequence.mmd` | §9.3 / `\ref{fig:mcp-oauth-sequence}` | OAuth + primera crida MCP |
