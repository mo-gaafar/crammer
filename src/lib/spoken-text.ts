const SYMBOL_WORD_REPLACEMENTS: Array<[RegExp, string]> = [
  [/&/g, " and "],
  [/@/g, " at "],
  [/%/g, " percent "],
  [/\+/g, " plus "],
  [/=/g, " equals "],
];

const UNSPOKEN_FORMATTING_SYMBOLS = /[*_`#~^|<>\u2022\u00b7]/g;
const BRACKETS = /[\[\]{}]/g;
const BULLET_OR_RULE_PREFIX = /^\s*[-\u2013\u2014]+\s+/gm;

export function cleanForSpokenFlow(text: string): string {
  let cleaned = text;

  for (const [pattern, replacement] of SYMBOL_WORD_REPLACEMENTS) {
    cleaned = cleaned.replace(pattern, replacement);
  }

  return cleaned
    .replace(BULLET_OR_RULE_PREFIX, "")
    .replace(UNSPOKEN_FORMATTING_SYMBOLS, "")
    .replace(BRACKETS, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
