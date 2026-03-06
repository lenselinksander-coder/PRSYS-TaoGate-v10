import type { PipelineStep } from "./types";

export function runArachne(input: string): PipelineStep {
  const t = Date.now();
  const sentences = input.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
  const hasImperative = /\b(verwijder|delete|stop|blokkeer|override|forceer|immediately|nu uitvoeren)\b/i.test(input);
  const detail = `${sentences} zin(nen), imperatief: ${hasImperative ? "JA" : "nee"}.`;

  return {
    name: "Arachne",
    symbol: "🕸",
    role: "Structure — syntax en intent-structuur analyse",
    decision: "STRUCTURED",
    detail,
    durationMs: Date.now() - t,
  };
}
