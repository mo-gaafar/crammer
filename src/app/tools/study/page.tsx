"use client";

import { useEffect, useMemo, useState } from "react";
import { estimateTtsCost } from "@/lib/tts-cost";
import type { StudyMaterial, StudyTemplate } from "@/types";

function countWords(text: string): number {
  return estimateTtsCost(text).wordCount;
}

export default function StudyMaterialsToolPage() {
  const [templates, setTemplates] = useState<StudyTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("study-guide-core");
  const [sourceName, setSourceName] = useState("Pasted text");
  const [pastedText, setPastedText] = useState("");
  const [materials, setMaterials] = useState<StudyMaterial[]>([]);
  const [activeMaterial, setActiveMaterial] = useState<StudyMaterial | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/study-materials")
      .then((r) => r.json())
      .then((d) => {
        setTemplates(d.templates ?? []);
        if (d.templates?.[0]?.id) setSelectedTemplateId(d.templates[0].id);
        setMaterials(d.materials ?? []);
        if (d.materials?.length > 0) setActiveMaterial(d.materials[0]);
      })
      .catch(() => {});
  }, []);

  const activeWordCount = useMemo(
    () => (activeMaterial ? countWords(activeMaterial.contentMarkdown).toLocaleString() : "0"),
    [activeMaterial]
  );
  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  async function handleGenerate() {
    if (!pastedText.trim()) return;
    setGenerating(true);
    setError(null);

    try {
      const res = await fetch("/api/study-materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceName: sourceName || "Pasted text",
          text: pastedText,
          templateId: selectedTemplateId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");

      const material: StudyMaterial = data.material;
      setMaterials((prev) => [material, ...prev]);
      setActiveMaterial(material);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGenerating(false);
    }
  }

  async function handleCopy() {
    if (!activeMaterial) return;
    await navigator.clipboard.writeText(activeMaterial.contentMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownload() {
    if (!activeMaterial) return;
    const blob = new Blob(
      [`${activeMaterial.title}\n\n${activeMaterial.description}\n\n${activeMaterial.contentMarkdown}`],
      { type: "text/markdown" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeMaterial.title.replace(/[^a-z0-9]/gi, "_")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      <div className="text-center space-y-3">
        <h1 className="text-3xl font-bold text-stone-900">Text → Study Materials</h1>
        <p className="text-stone-600 max-w-xl mx-auto">
          Paste any notes, textbook excerpt, or slides text. Pick a template and Gemini will turn
          it into a study guide, flashcards, a quiz, a glossary, or a cram sheet.
        </p>
      </div>

      <div className="card space-y-4">
        <h2 className="section-title text-sm">Choose a Template</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {templates.map((template) => (
            <button
              key={template.id}
              onClick={() => setSelectedTemplateId(template.id)}
              disabled={generating}
              className={`text-left p-4 rounded-xl border-2 transition-all ${
                selectedTemplateId === template.id
                  ? "border-espresso-500 bg-espresso-500/10"
                  : "border-stone-300 bg-stone-100/50 hover:border-stone-400"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="font-medium text-stone-800 text-sm">{template.name}</div>
                <span className={template.source === "community" ? "badge-green" : "badge-indigo"}>
                  {template.source}
                </span>
              </div>
              <div className="text-stone-500 text-xs mt-2 leading-relaxed">
                {template.description}
              </div>
              {template.exports.includes("anki-csv") && (
                <div className="text-emerald-400 text-xs mt-2">Supports Anki export</div>
              )}
            </button>
          ))}
        </div>

        <input
          value={sourceName}
          onChange={(e) => setSourceName(e.target.value)}
          disabled={generating}
          className="input text-sm"
          placeholder="Source name (e.g. Chapter 4 notes)"
        />
        <textarea
          value={pastedText}
          onChange={(e) => {
            setPastedText(e.target.value);
            if (sourceName === "Pasted text") {
              const firstWords = e.target.value.trim().split(/\s+/).slice(0, 6).join(" ");
              if (firstWords) setSourceName(firstWords);
            }
          }}
          disabled={generating}
          className="input min-h-40 resize-y text-sm leading-relaxed"
          placeholder="Paste lecture notes, textbook excerpts, slides text, or any study material here..."
        />

        {error && (
          <div className="bg-red-950/50 border border-red-800 rounded-lg p-3 text-red-300 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={!pastedText.trim() || generating || !selectedTemplate}
          className="btn-primary flex items-center gap-2"
        >
          {generating ? (
            <>
              <span className="animate-spin">⚙️</span>
              Gemini is building the material...
            </>
          ) : (
            <>
              <span>✨</span>
              Generate {selectedTemplate?.name ?? "Material"}
            </>
          )}
        </button>
      </div>

      {materials.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          <span className="text-xs text-stone-500 self-center">Generated:</span>
          {materials.map((material) => (
            <button
              key={material.id}
              onClick={() => setActiveMaterial(material)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                activeMaterial?.id === material.id
                  ? "border-espresso-500 text-espresso-700 bg-espresso-500/10"
                  : "border-stone-300 text-stone-600 hover:border-stone-500"
              }`}
            >
              {material.sourceName ?? material.title}
            </button>
          ))}
        </div>
      )}

      {activeMaterial && !generating && (
        <div className="card space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-bold text-stone-900 text-lg leading-snug">{activeMaterial.title}</h3>
              <p className="text-stone-600 text-sm mt-1">{activeMaterial.description}</p>
              <div className="flex items-center gap-3 mt-2">
                <span className="badge-indigo">{activeMaterial.type.replace(/_/g, " ")}</span>
                <span className="text-xs text-stone-500">{activeWordCount} words</span>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={handleCopy} className="btn-secondary text-xs py-1.5 px-3">
                {copied ? "✅ Copied" : "📋 Copy"}
              </button>
              <button onClick={handleDownload} className="btn-secondary text-xs py-1.5 px-3">
                ⬇️ Markdown
              </button>
              {activeMaterial.type === "flashcards" && (
                <a
                  href={`/api/study-materials/${activeMaterial.id}/anki-csv`}
                  download
                  className="btn-secondary text-xs py-1.5 px-3"
                >
                  🗂️ Anki CSV
                </a>
              )}
            </div>
          </div>

          <textarea
            readOnly
            value={activeMaterial.contentMarkdown}
            spellCheck={false}
            className="large-text-viewer max-h-[500px]"
            aria-label="Generated study material"
          />
        </div>
      )}

      {generating && (
        <div className="card flex items-center justify-center py-16 space-y-4 flex-col text-center">
          <div className="text-5xl animate-pulse-slow">✨</div>
          <p className="text-stone-700 font-medium">Gemini is shaping your material...</p>
        </div>
      )}

      {materials.length === 0 && !generating && (
        <div className="card text-center py-12 space-y-3 text-stone-500">
          <div className="text-4xl">📚</div>
          <p>No study materials generated yet. Paste some text and hit Generate.</p>
        </div>
      )}
    </div>
  );
}
