import { NextResponse } from "next/server";
import { ensureAppStateTable, getSupabaseAdmin, stateKey } from "@/app/lib/supabase";

export async function GET(req: Request) {
  try {
    await ensureAppStateTable();
    const { searchParams } = new URL(req.url);
    const key = stateKey(searchParams.get("key") || "data");
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("app_state")
      .select("value")
      .eq("key", key)
      .maybeSingle();

    if (error) {
      console.error("state GET", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data?.value ?? null);
  } catch (err) {
    console.error("state GET", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load state" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    await ensureAppStateTable();
    const { searchParams } = new URL(req.url);
    const key = stateKey(searchParams.get("key") || "data");
    const body = await req.json();
    const supabase = getSupabaseAdmin();

    const { error } = await supabase.from("app_state").upsert(
      {
        key,
        value: body,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );

    if (error) {
      console.error("state POST", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("state POST", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save state" },
      { status: 500 }
    );
  }
}
