"use client";

import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/language-provider";

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="flex gap-1">
      {(["en", "es", "ca"] as const).map((lang) => (
        <Button
          key={lang}
          variant={language === lang ? "secondary" : "ghost"}
          size="sm"
          className="h-7 w-9 px-0 uppercase text-xs font-bold"
          onClick={() => setLanguage(lang)}
        >
          {lang}
        </Button>
      ))}
    </div>
  );
}
