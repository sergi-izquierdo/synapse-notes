"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/language-provider";

export default function AuthError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    const { t } = useLanguage();

    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
            <h2 className="text-lg font-semibold text-foreground">
                {t.errors.title}
            </h2>
            <p className="max-w-md text-sm text-muted-foreground">
                {t.errors.authMessage}
            </p>
            <Button onClick={reset} data-test="auth-error-retry">
                {t.errors.retry}
            </Button>
        </div>
    );
}
