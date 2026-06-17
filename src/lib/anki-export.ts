function splitTableRow(row: string): string[] {
  return row
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isSeparatorRow(cells: string[]): boolean {
  return cells.every((cell) => /^:?-{2,}:?$/.test(cell));
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Converts the first GitHub-flavored Markdown table found in `markdown` into
 * CSV. Used to export the flashcards study template (Front | Back | Topic)
 * for direct import into Anki.
 */
export function markdownTableToCsv(markdown: string): string {
  const lines = markdown.split("\n").filter((line) => line.includes("|"));
  if (lines.length < 2) {
    throw new Error("No Markdown table found to export");
  }

  const header = splitTableRow(lines[0]);
  const rows: string[][] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = splitTableRow(lines[i]);
    if (isSeparatorRow(cells)) continue;
    if (cells.length === 0 || (cells.length === 1 && cells[0] === "")) continue;
    rows.push(cells);
  }

  if (rows.length === 0) {
    throw new Error("Markdown table has no data rows to export");
  }

  const csvLines = [header, ...rows].map((cells) => cells.map(csvEscape).join(","));
  return csvLines.join("\n");
}
