import type { Metadata } from "next";
import { Inter_Tight, JetBrains_Mono, Literata, Young_Serif } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { LanguageProvider } from "@/components/language-provider";
import { ThemeProvider } from "next-themes";
import { MotionConfig } from "framer-motion";
import { Toaster } from "@/components/ui/sonner";

// Midnight Cartography typography stack.
// - Young Serif: display headings (the cartographic/editorial voice).
// - Literata: body/editor reading surface (optical sizing, Google Fonts).
// - Inter Tight: UI chrome (buttons, labels, dense nav). The Tight
//   family has more character than regular Inter.
// - JetBrains Mono: metadata, timestamps, tool-call footnote ids.
const displayFont = Young_Serif({
    subsets: ["latin"],
    weight: "400",
    variable: "--font-display",
    display: "swap",
});

const bodyFont = Literata({
    subsets: ["latin"],
    weight: ["400", "500", "600", "700"],
    style: ["normal", "italic"],
    variable: "--font-body",
    display: "swap",
});

const sansFont = Inter_Tight({
    subsets: ["latin"],
    weight: ["400", "500", "600", "700"],
    variable: "--font-sans",
    display: "swap",
});

const monoFont = JetBrains_Mono({
    subsets: ["latin"],
    weight: ["400", "500", "600"],
    variable: "--font-mono",
    display: "swap",
});

export const metadata: Metadata = {
    title: "Synapse Notes",
    description: "El teu segon cervell potenciat per IA",
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="ca" suppressHydrationWarning>
            <body
                className={cn(
                    "min-h-screen bg-background font-sans antialiased",
                    sansFont.variable,
                    bodyFont.variable,
                    displayFont.variable,
                    monoFont.variable,
                )}
            >
                <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
                    <LanguageProvider>
                        {/* Respect OS-level prefers-reduced-motion. With
                            reducedMotion="user", Motion skips transform/
                            opacity/scale transitions for users who asked
                            their system to reduce motion. */}
                        <MotionConfig reducedMotion="user">
                            {children}
                            <Toaster position="top-center" richColors closeButton />
                        </MotionConfig>
                    </LanguageProvider>
                </ThemeProvider>
            </body>
        </html>
    );
}
