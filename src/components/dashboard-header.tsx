"use client";

import { useLanguage } from "@/components/language-provider";
import { LanguageSwitcher } from "@/components/language-switcher";
import { BrainCircuit } from "lucide-react";

export function DashboardHeader({ userEmail }: { userEmail: string }) {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-background/60 backdrop-blur-md p-4 rounded-xl border sticky top-4 z-10 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="bg-primary/10 p-2 rounded-lg">
          <BrainCircuit className="h-6 w-6 text-primary" />
        </div>
        <div>
          {/* Títol amb Gradient */}
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-primary to-violet-600 bg-clip-text text-transparent">
            {t.dashboard.title}
          </h1>
          <p className="text-xs text-muted-foreground font-mono">{userEmail}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <LanguageSwitcher />
      </div>
    </div>
  );
}
