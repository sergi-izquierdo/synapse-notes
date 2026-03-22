import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const { count, error } = await supabase
    .from("notes")
    .select("*", { count: "exact", head: true });

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch note count" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    totalNotes: count ?? 0,
    timestamp: new Date().toISOString(),
  });
}
