import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { DEFAULT_GEMINI_MODEL, generateStudyMaterial, generateStudyMaterialFromText } from "@/lib/gemini";
import { store } from "@/lib/store";
import { getOptionalClient } from "@/lib/supabase/server";
import { getStudyTemplate, STUDY_TEMPLATES } from "@/lib/study-templates";
import { StudyMaterial } from "@/types";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lectureId = searchParams.get("lectureId");

  if (!lectureId) {
    return NextResponse.json({
      templates: STUDY_TEMPLATES,
      materials: store.getAllStudyMaterials().filter((m) => !m.lectureId),
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
    const { lectureId, sourceName, text, templateId } = body as {
      lectureId?: string;
      sourceName?: string;
      text?: string;
      templateId?: string;
    };

    if (!templateId) {
      return NextResponse.json({ error: "templateId is required" }, { status: 400 });
    }

    const template = getStudyTemplate(templateId);
    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const now = new Date().toISOString();
    let generated: { title: string; description: string; contentMarkdown: string };
    let material: StudyMaterial;

    if (lectureId) {
      const lecture = store.getLecture(lectureId);
      if (!lecture) {
        return NextResponse.json({ error: "Lecture not found" }, { status: 404 });
      }
      const supabase = await getOptionalClient();
      const audioFiles = (
        await Promise.all(lecture.audioFileIds.map((id) => store.getAudioFile(supabase, id)))
      ).filter((file): file is NonNullable<typeof file> => file !== undefined);

      generated = await generateStudyMaterial(lecture, audioFiles, template);
      material = {
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
    } else {
      const trimmedText = text?.trim();
      if (!trimmedText) {
        return NextResponse.json(
          { error: "Provide either lectureId or text" },
          { status: 400 }
        );
      }
      const cleanSourceName = sourceName?.trim() || "Pasted text";

      generated = await generateStudyMaterialFromText(cleanSourceName, trimmedText, template);
      material = {
        id: uuidv4(),
        sourceName: cleanSourceName,
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
    }

    store.addStudyMaterial(material);

    return NextResponse.json({ material });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
