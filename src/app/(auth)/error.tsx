"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function AuthError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
            <h2 className="text-lg font-semibold text-foreground">
                S&apos;ha produït un error
            </h2>
            <p className="max-w-md text-sm text-muted-foreground">
                No s&apos;ha pogut carregar aquesta pàgina. Torna-ho a intentar
                o actualitza la finestra.
            </p>
            <Button onClick={reset} data-test="auth-error-retry">
                Reintenta
            </Button>
        </div>
    );
}
