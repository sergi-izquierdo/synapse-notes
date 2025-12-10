"use client";

import { useLanguage } from "@/components/language-provider";
import { LanguageSwitcher } from "@/components/language-switcher";

export function DashboardHeader({ userEmail }: { userEmail: string }) {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-3xl font-bold tracking-tight text-primary">
        {t.dashboard.title}
      </h1>
      <div className="flex items-center gap-3 text-muted-foreground">
        <span className="text-sm">{userEmail}</span>
        <LanguageSwitcher />
      </div>
    </div>
  );
}
