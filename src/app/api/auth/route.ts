import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { key } = await request.json().catch(() => ({}));
  const secret = process.env.APP_SECRET_KEY;

  if (!secret) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  if (key !== secret) {
    return NextResponse.json({ error: "Invalid key" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("crammer_auth", secret, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete("crammer_auth");
  return response;
}
