import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const supabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function POST(request: NextRequest) {
  if (supabaseConfigured) {
    const { mode, email, password } = await request.json().catch(() => ({}));

    if (!email || !password || (mode !== "signin" && mode !== "signup")) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } =
      mode === "signup"
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    // Email confirmation is required (ENABLE_EMAIL_AUTOCONFIRM=false): signUp
    // succeeds but returns no session until the user clicks the confirmation link.
    return NextResponse.json({ ok: true, needsConfirmation: !data.session });
  }

  const { key } = await request.json().catch(() => ({}));
  const secret = process.env.APP_SECRET_KEY;

  if (!secret) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  if (key !== secret) {
    return NextResponse.json({ error: "Invalid key" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("crammer_auth", "ok", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    secure: false,
  });
  return response;
}

export async function DELETE() {
  if (supabaseConfigured) {
    const supabase = await createClient();
    await supabase.auth.signOut();
    return NextResponse.json({ ok: true });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.delete("crammer_auth");
  return response;
}
