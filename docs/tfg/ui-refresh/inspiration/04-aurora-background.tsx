// Source: 21st.dev — Aurora Background (by Aceternity)
// Dependencies: none beyond Tailwind CSS (plus framer-motion for the demo)
// Tailwind config: requires injecting an `aurora` keyframe + `addVariablesForColors`
// base plugin — see the block at the bottom of this file.
//
// ⚠️ ANTI-PATTERN EXPLICIT. Aurora backgrounds are on the banned list from the
// UI-refresh brief ("no aurora, no violet gradients"). The default palette uses
// --blue-500, --indigo-300, --violet-200, --blue-400 — i.e. the "AI purple sky"
// aesthetic we explicitly rejected. If you still want to ship this, retune:
//   [--aurora:repeating-linear-gradient(100deg,
//     oklch(0.82 0.065 80) 10%,
//     oklch(0.58 0.075 150) 20%,
//     oklch(0.82 0.065 80) 30%)]
// to keep Midnight Cartography's parchment-gold + topographic-green. Even then
// this is a heavy decorative element — reserve for the public landing page,
// not for the dashboard.

"use client";
import { cn } from "@/lib/utils";
import React, { ReactNode } from "react";

interface AuroraBackgroundProps extends React.HTMLProps<HTMLDivElement> {
    children: ReactNode;
    showRadialGradient?: boolean;
}

export const AuroraBackground = ({
    className,
    children,
    showRadialGradient = true,
    ...props
}: AuroraBackgroundProps) => {
    return (
        <main>
            <div
                className={cn(
                    "relative flex flex-col  h-[100vh] items-center justify-center bg-zinc-50 dark:bg-zinc-900  text-slate-950 transition-bg",
                    className,
                )}
                {...props}
            >
                <div className="absolute inset-0 overflow-hidden">
                    <div
                        className={cn(
                            `
              [--white-gradient:repeating-linear-gradient(100deg,var(--white)_0%,var(--white)_7%,var(--transparent)_10%,var(--transparent)_12%,var(--white)_16%)]
              [--dark-gradient:repeating-linear-gradient(100deg,var(--black)_0%,var(--black)_7%,var(--transparent)_10%,var(--transparent)_12%,var(--black)_16%)]
              [--aurora:repeating-linear-gradient(100deg,var(--blue-500)_10%,var(--indigo-300)_15%,var(--blue-300)_20%,var(--violet-200)_25%,var(--blue-400)_30%)]
              [background-image:var(--white-gradient),var(--aurora)]
              dark:[background-image:var(--dark-gradient),var(--aurora)]
              [background-size:300%,_200%]
              [background-position:50%_50%,50%_50%]
              filter blur-[10px] invert dark:invert-0
              after:content-[""] after:absolute after:inset-0 after:[background-image:var(--white-gradient),var(--aurora)]
              after:dark:[background-image:var(--dark-gradient),var(--aurora)]
              after:[background-size:200%,_100%]
              after:animate-aurora after:[background-attachment:fixed] after:mix-blend-difference
              pointer-events-none
              absolute -inset-[10px] opacity-50 will-change-transform`,
                            showRadialGradient &&
                                `[mask-image:radial-gradient(ellipse_at_100%_0%,black_10%,var(--transparent)_70%)]`,
                        )}
                    ></div>
                </div>
                {children}
            </div>
        </main>
    );
};

/* Required tailwind.config.js extension (see original 21st.dev recipe):

const { default: flattenColorPalette } = require("tailwindcss/lib/util/flattenColorPalette");

module.exports = {
  theme: {
    extend: {
      animation: { aurora: "aurora 60s linear infinite" },
      keyframes: {
        aurora: {
          from: { backgroundPosition: "50% 50%, 50% 50%" },
          to: { backgroundPosition: "350% 50%, 350% 50%" },
        },
      },
    },
  },
  plugins: [addVariablesForColors],
};

function addVariablesForColors({ addBase, theme }) {
  const allColors = flattenColorPalette(theme("colors"));
  const newVars = Object.fromEntries(
    Object.entries(allColors).map(([key, val]) => [`--${key}`, val])
  );
  addBase({ ":root": newVars });
}
*/
