import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { DEFAULT_GEMINI_MODEL, generateStudyMaterial } from "@/lib/gemini";
import { store } from "@/lib/store";
import { getStudyTemplate, STUDY_TEMPLATES } from "@/lib/study-templates";
import { StudyMaterial } from "@/types";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lectureId = searchParams.get("lectureId");

  if (!lectureId) {
    return NextResponse.json({
      templates: STUDY_TEMPLATES,
    });
  }

  return NextResponse.json({
    templates: STUDY_TEMPLATES,
    materials: store.getStudyMaterialsForLecture(lectureId),
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { lectureId, templateId } = body as { lectureId?: string; templateId?: string };

    if (!lectureId || !templateId) {
      return NextResponse.json(
        { error: "lectureId and templateId are required" },
        { status: 400 }
      );
    }

    const lecture = store.getLecture(lectureId);
    if (!lecture) {
      return NextResponse.json({ error: "Lecture not found" }, { status: 404 });
    }

    const template = getStudyTemplate(templateId);
    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const audioFiles = lecture.audioFileIds
      .map((id) => store.getAudioFile(id))
      .filter((file): file is NonNullable<typeof file> => file !== undefined);

    const generated = await generateStudyMaterial(lecture, audioFiles, template);
    const now = new Date().toISOString();
    const material: StudyMaterial = {
      id: uuidv4(),
      lectureId,
      templateId,
      type: template.type,
      title: generated.title,
      description: generated.description,
      contentMarkdown: generated.contentMarkdown,
      provider: "gemini",
      model: DEFAULT_GEMINI_MODEL,
      createdAt: now,
      updatedAt: now,
    };

    store.addStudyMaterial(material);

    return NextResponse.json({ material });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
