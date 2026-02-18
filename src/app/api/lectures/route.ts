import { NextResponse } from "next/server";
import { store } from "@/lib/store";

export async function GET() {
  const lectures = store.getAllLectures();
  return NextResponse.json({ lectures });
}
