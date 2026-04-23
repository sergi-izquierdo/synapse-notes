"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function DashboardError({
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
                {error.message ||
                    "Alguna cosa ha anat malament carregant aquesta pàgina."}
            </p>
            <Button onClick={reset} data-test="dashboard-error-retry">
                Reintenta
            </Button>
        </div>
    );
}
