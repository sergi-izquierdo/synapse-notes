import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GraphViewer } from "@/components/graph/graph-viewer";

export const metadata = {
    title: "Note graph — Synapse Notes",
};

export default async function GraphPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return redirect("/login");
    return <GraphViewer />;
}
