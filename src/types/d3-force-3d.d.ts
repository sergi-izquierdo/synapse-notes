// Minimal ambient types for `d3-force-3d` — the library ships no
// .d.ts and we only consume a narrow slice of its API inside the
// graph viewer (per-node X/Y/radial pulls). Anything we don't use
// here is intentionally left `any` to avoid maintaining a mirror of
// the full d3-force surface.
declare module "d3-force-3d" {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type ForceFn = any;

    export function forceX(x?: number): ForceFn;
    export function forceY(y?: number): ForceFn;
    export function forceRadial(
        radius: number,
        x?: number,
        y?: number,
    ): ForceFn;
    export function forceCollide(radius?: number): ForceFn;
}
