import OpenAI from "openai";
import { z } from "zod";

export const taoGateSchema = z.object({
  imperativeHit: z.boolean(),
  medicationHit: z.boolean(),
  procedureHit: z.boolean(),
  triageHit: z.boolean(),
  adviceRequestHit: z.boolean(),
  uncertaintyHit: z.boolean(),
  pressure: z.enum(["NORMAL", "ELEVATED", "CRITICAL"]),
  matched: z.array(z.string()),
});

const TAOGATE_SYSTEM_PROMPT = `Je bent de cognitieve governance-engine van TaoGate, actief op de Intensive Care. Jouw enige taak is het syntactisch en semantisch scheiden van objectieve klinische waarnemingen enerzijds, en sturende acties of kritieke impliciete druk (Implicit Pressure) anderzijds. Je voert géén medische diagnose uit.
ANALYSE-REGELS:
1. PURE OBSERVATIE (PASS): Feitelijke staat zonder acuut levensgevaar.
2. EXPLICIET COMMANDO (STOP): Bevat een imperatief of procedurele sturing. imperativeHit = true.
3. IMPLICIT PRESSURE (CRITICAL): De input is een observatie, maar beschrijft levensbedreigende terugval of falende logistiek. Geen expliciet commando, maar de druk is extreem. pressure = "CRITICAL".
Je MOET antwoorden met een valide JSON-object dat exact overeenkomt met het gevraagde schema.`;

export async function evaluateImplicitPressure(text: string): Promise<z.infer<typeof taoGateSchema> | null> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) return null;

  try {
    const client = new OpenAI({ apiKey, baseURL: "https://api.perplexity.ai" });
    const response = await client.chat.completions.create({
      model: "sonar",
      messages: [
        { role: "system", content: TAOGATE_SYSTEM_PROMPT },
        { role: "user", content: text },
      ],
      temperature: 0,
    });

    const raw = response.choices?.[0]?.message?.content?.trim();
    if (!raw) return null;

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = taoGateSchema.safeParse(JSON.parse(jsonMatch[0]));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function routeImplicitPressure(signalen: z.infer<typeof taoGateSchema>): {
  override: boolean;
  status: string;
  escalation: string | null;
  olympia: string;
  layer: string;
  pressure: string;
  reason: string;
} | null {
  const isPureObservation = !signalen.imperativeHit && !signalen.medicationHit && !signalen.procedureHit;
  const isImplicitPressure = isPureObservation && signalen.pressure === "CRITICAL";

  if (isImplicitPressure) {
    return {
      override: true,
      status: "BLOCK",
      escalation: "HUMAN_IC_TEAM",
      olympia: "EU_AI_ART_5",
      layer: "CLINICAL_SAFETY_NET",
      pressure: "CRITICAL",
      reason: "Kritieke klinische druk (Implicit Pressure) gedetecteerd in passieve observatie.",
    };
  }

  if (!isPureObservation) {
    return {
      override: true,
      status: "BLOCK",
      escalation: "HUMAN_IC_TEAM",
      olympia: "CLINICAL_MEDICATION_ORDER",
      layer: "CLINICAL",
      pressure: signalen.pressure,
      reason: "Directe opdracht of imperatief gedetecteerd. Observatie-only toegestaan.",
    };
  }

  return null;
}
