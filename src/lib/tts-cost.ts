import type { TtsCostEstimate } from "@/types";

const WORDS_PER_AUDIO_MINUTE = 150;
const APPROX_CHARS_PER_TEXT_TOKEN = 4;
const GEMINI_AUDIO_TOKENS_PER_SECOND = 25;

const DEEPGRAM_AURA_1_USD_PER_1K_CHARS = 0.015;
const GEMINI_FLASH_TTS_INPUT_USD_PER_1M_TOKENS = 0.5;
const GEMINI_FLASH_TTS_OUTPUT_USD_PER_1M_TOKENS = 10;

export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

export function estimateTtsCost(script: string): TtsCostEstimate {
  const characterCount = script.length;
  const wordCount = countWords(script);
  const estimatedAudioMinutes = wordCount / WORDS_PER_AUDIO_MINUTE;
  const estimatedAudioSeconds = estimatedAudioMinutes * 60;
  const estimatedGeminiInputTokens = Math.ceil(characterCount / APPROX_CHARS_PER_TEXT_TOKEN);
  const estimatedGeminiOutputTokens = Math.ceil(
    estimatedAudioSeconds * GEMINI_AUDIO_TOKENS_PER_SECOND
  );

  return {
    characterCount,
    wordCount,
    estimatedAudioMinutes,
    providers: {
      deepgram: {
        model: "Aura-1",
        estimatedUsd: (characterCount / 1_000) * DEEPGRAM_AURA_1_USD_PER_1K_CHARS,
        billingBasis: "$0.0150 per 1k characters",
      },
      gemini: {
        model: "Gemini 2.5 Flash Preview TTS",
        estimatedUsd:
          (estimatedGeminiInputTokens / 1_000_000) *
            GEMINI_FLASH_TTS_INPUT_USD_PER_1M_TOKENS +
          (estimatedGeminiOutputTokens / 1_000_000) *
            GEMINI_FLASH_TTS_OUTPUT_USD_PER_1M_TOKENS,
        billingBasis: "$0.50 per 1M text input tokens + $10.00 per 1M audio output tokens",
      },
    },
  };
}

export function formatUsd(amount: number): string {
  if (amount > 0 && amount < 0.01) return "<$0.01";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
