import { NextRequest, NextResponse } from "next/server";
import { markdownTableToCsv } from "@/lib/anki-export";
import { store } from "@/lib/store";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const material = store.getStudyMaterial(params.id);
  if (!material) {
    return NextResponse.json({ error: "Study material not found" }, { status: 404 });
  }
  if (material.type !== "flashcards") {
    return NextResponse.json(
      { error: "Anki export is only available for flashcards materials" },
      { status: 400 }
    );
  }

  let csv: string;
  try {
    csv = markdownTableToCsv(material.contentMarkdown);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const filename = `${material.title.replace(/[^a-z0-9]+/gi, "_").toLowerCase() || "flashcards"}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
