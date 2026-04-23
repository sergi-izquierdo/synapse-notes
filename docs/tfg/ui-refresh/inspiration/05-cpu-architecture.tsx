// Source: 21st.dev — CPU Architecture (animated SVG)
// Dependencies: none beyond React + Tailwind (no framer-motion, pure SVG/CSS)
// Companion CSS: animation classes + offset-path keyframes — see block at bottom.
// Conflict with anti-patterns: gradient colors (#08F, #FFD800, #FF008B, #22c55e,
// #f97316, #06b6d4, #f43f5e, #830CD1) include pink/violet (#830CD1 and #FF008B).
// Retune to Midnight Cartography: parchment-gold, topographic-green, and a
// couple of neutral accents. No purple/pink.
//
// Use case at Synapse Notes: diagram for the Disseny / §9.3 chapter of the
// TFG memoir ("Arquitectura del servidor MCP") — animated illustration of how
// a request flows through auth, the MCP server, the NotesService, and Postgres
// with RLS. Much more striking than a static C4 diagram and does not need any
// backend integration.

import { cn } from "@/lib/utils";
import React from "react";

export interface CpuArchitectureSvgProps {
    className?: string;
    width?: string;
    height?: string;
    text?: string;
    showCpuConnections?: boolean;
    lineMarkerSize?: number;
    animateText?: boolean;
    animateLines?: boolean;
    animateMarkers?: boolean;
}

const CpuArchitecture = ({
    className,
    width = "100%",
    height = "100%",
    text = "CPU",
    showCpuConnections = true,
    animateText = true,
    lineMarkerSize = 18,
    animateLines = true,
    animateMarkers = true,
}: CpuArchitectureSvgProps) => {
    return (
        <svg
            className={cn("text-muted", className)}
            width={width}
            height={height}
            viewBox="0 0 200 100"
        >
            {/* Paths */}
            <g
                stroke="currentColor"
                fill="none"
                strokeWidth="0.3"
                strokeDasharray="100 100"
                pathLength="100"
                markerStart="url(#cpu-circle-marker)"
            >
                <path strokeDasharray="100 100" pathLength="100" d="M 10 20 h 79.5 q 5 0 5 5 v 30" />
                <path strokeDasharray="100 100" pathLength="100" d="M 180 10 h -69.7 q -5 0 -5 5 v 30" />
                <path d="M 130 20 v 21.8 q 0 5 -5 5 h -10" />
                <path d="M 170 80 v -21.8 q 0 -5 -5 -5 h -50" />
                <path strokeDasharray="100 100" pathLength="100" d="M 135 65 h 15 q 5 0 5 5 v 10 q 0 5 -5 5 h -39.8 q -5 0 -5 -5 v -20" />
                <path d="M 94.8 95 v -36" />
                <path d="M 88 88 v -15 q 0 -5 -5 -5 h -10 q -5 0 -5 -5 v -5 q 0 -5 5 -5 h 14" />
                <path d="M 30 30 h 25 q 5 0 5 5 v 6.5 q 0 5 5 5 h 20" />
                {animateLines && (
                    <animate attributeName="stroke-dashoffset" from="100" to="0" dur="1s" fill="freeze" calcMode="spline" keySplines="0.25,0.1,0.5,1" keyTimes="0; 1" />
                )}
            </g>

            {/* Light orbs (full code in original 21st.dev snippet — retune the
               gradient colours before use: avoid #830CD1 / #FF008B purple/pink. */}

            {/* CPU Box */}
            <g>
                {showCpuConnections && (
                    <g fill="url(#cpu-connection-gradient)">
                        <rect x="93" y="37" width="2.5" height="5" rx="0.7" />
                        <rect x="104" y="37" width="2.5" height="5" rx="0.7" />
                        <rect x="116.3" y="44" width="2.5" height="5" rx="0.7" transform="rotate(90 116.25 45.5)" />
                        <rect x="122.8" y="44" width="2.5" height="5" rx="0.7" transform="rotate(90 116.25 45.5)" />
                        <rect x="104" y="16" width="2.5" height="5" rx="0.7" transform="rotate(180 105.25 39.5)" />
                        <rect x="114.5" y="16" width="2.5" height="5" rx="0.7" transform="rotate(180 105.25 39.5)" />
                        <rect x="80" y="-13.6" width="2.5" height="5" rx="0.7" transform="rotate(270 115.25 19.5)" />
                        <rect x="87" y="-13.6" width="2.5" height="5" rx="0.7" transform="rotate(270 115.25 19.5)" />
                    </g>
                )}
                <rect x="85" y="40" width="30" height="20" rx="2" fill="#181818" filter="url(#cpu-light-shadow)" />
                <text x="92" y="52.5" fontSize="7" fill={animateText ? "url(#cpu-text-gradient)" : "white"} fontWeight="600" letterSpacing="0.05em">
                    {text}
                </text>
            </g>

            {/* Defs omitted for brevity — see the original 21st.dev source for the
               full 8 masks, 8 radial gradients, filter, marker, and text gradient. */}
        </svg>
    );
};

export { CpuArchitecture };

/* Required globals.css additions:
.cpu-architecture {
    offset-anchor: 10px 0px;
    animation: animation-path;
    animation-iteration-count: infinite;
    animation-timing-function: cubic-bezier(0.75, -0.01, 0, 0.99);
}
.cpu-line-1 { offset-path: path("M 10 20 h 79.5 q 5 0 5 5 v 30"); animation-duration: 5s; animation-delay: 1s; }
.cpu-line-2 { offset-path: path("M 180 10 h -69.7 q -5 0 -5 5 v 40"); animation-delay: 6s; animation-duration: 2s; }
.cpu-line-3 { offset-path: path("M 130 20 v 21.8 q 0 5 -5 5 h -25"); animation-delay: 4s; animation-duration: 6s; }
.cpu-line-4 { offset-path: path("M 170 80 v -21.8 q 0 -5 -5 -5 h -65"); animation-delay: 3s; animation-duration: 3s; }
.cpu-line-5 { offset-path: path("M 135 65 h 15 q 5 0 5 5 v 10 q 0 5 -5 5 h -39.8 q -5 0 -5 -5 v -35"); animation-delay: 9s; animation-duration: 4s; }
.cpu-line-6 { offset-path: path("M 94.8 95 v -46"); animation-delay: 3s; animation-duration: 7s; }
.cpu-line-7 { offset-path: path("M 88 88 v -15 q 0 -5 -5 -5 h -10 q -5 0 -5 -5 v -5 q 0 -5 5 -5 h 28"); animation-delay: 4s; animation-duration: 4s; }
.cpu-line-8 { offset-path: path("M 30 30 h 25 q 5 0 5 5 v 6.5 q 0 5 5 5 h 35"); animation-delay: 3s; animation-duration: 3s; }
@keyframes animation-path { 0% { offset-distance: 0%; } 100% { offset-distance: 100%; } }
*/
