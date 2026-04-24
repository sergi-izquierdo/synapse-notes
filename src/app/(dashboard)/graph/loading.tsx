import { Loader2 } from "lucide-react";

export default function GraphLoading() {
    return (
        <div className="flex h-screen w-full items-center justify-center bg-background">
            <Loader2
                aria-label="Loading graph"
                className="h-6 w-6 animate-spin text-muted-foreground"
            />
        </div>
    );
}
