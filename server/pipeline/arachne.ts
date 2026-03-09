import type { PipelineStep } from "./types";

// I6: onafhankelijke evaluator voor V(E) in CoVe — weefselbreuk-detectie executiestructuur
export function evaluateArachne(input: string): string {
  const hasImperative = /\b(verwijder|delete|stop|blokkeer|override|forceer|immediately|nu uitvoeren)\b/i.test(input);
  return hasImperative ? "ESCALATE_HUMAN" : "PASS";
}

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
