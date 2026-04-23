"use client";

import { useLanguage } from "@/components/language-provider";
import { LanguageSwitcher } from "@/components/language-switcher";
import { BrainCircuit, Sun, Moon, Settings } from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";

export function DashboardHeader({ userEmail }: { userEmail: string }) {
  const { t } = useLanguage();
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-card/80 backdrop-blur-md p-4 rounded-lg border border-border/60 sticky top-4 z-10 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="bg-primary/10 p-2 rounded-lg">
          <BrainCircuit className="h-6 w-6 text-primary" aria-label="Synapse Notes logo" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {t.dashboard.title}
          </h1>
          <p className="text-xs text-muted-foreground font-mono">{userEmail}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          aria-label="Toggle theme"
        >
          <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </button>
        <LanguageSwitcher />
        <Link
          href="/settings"
          className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          aria-label="Settings"
        >
          <Settings className="h-5 w-5" />
        </Link>
      </div>
    </div>
  );
}
