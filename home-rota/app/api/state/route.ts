import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key") || "data";
  const data = await kv.get(`home-rota:${key}`);
  return NextResponse.json(data ?? null);
}

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key") || "data";
  const body = await req.json();
  await kv.set(`home-rota:${key}`, body);
  return NextResponse.json({ ok: true });
}
