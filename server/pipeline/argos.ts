import type { PipelineStep } from "./types";

export function runArgos(input: string): PipelineStep {
  const t = Date.now();
  const trimmed = input.trim();
  const inputLength = trimmed.length;
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;

  return {
    name: "Argos",
    symbol: "👁",
    role: "Observe — input detectie en normalisatie",
    decision: inputLength > 0 ? "OBSERVED" : "EMPTY",
    detail: inputLength > 0
      ? `Input ontvangen: ${wordCount} woorden, ${inputLength} tekens.`
      : "Lege invoer gedetecteerd.",
    durationMs: Date.now() - t,
  };
}
