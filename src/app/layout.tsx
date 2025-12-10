import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { LanguageProvider } from "@/components/language-provider";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({ subsets: ["latin"] });

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
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased bg-dot-pattern",
          inter.className
        )}
      >
        {/* Embolica els children amb el Provider */}
        <LanguageProvider>
          {children}
          <Toaster position="top-center" richColors closeButton />
        </LanguageProvider>
      </body>
    </html>
  );
}
