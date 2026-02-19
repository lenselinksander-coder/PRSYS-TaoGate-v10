import { storage } from "./storage";
import type { ScopeCategory, ScopeDocument } from "@shared/schema";

const IC_CATEGORIES: ScopeCategory[] = [
  {
    name: "Observation",
    label: "Observatie",
    status: "PASS",
    escalation: null,
    keywords: [],
    color: "text-green-400",
  },
  {
    name: "Clinical_Intervention",
    label: "Klinische Interventie",
    status: "BLOCK",
    escalation: "Intensivist",
    keywords: ["intuberen", "start medicatie", "verhoog", "verlaag", "stop medicatie", "geef", "dien toe", "sedatie", "naar de ok", "opereren", "beademen", "extuberen", "bolus", "infuus"],
    color: "text-red-400",
  },
  {
    name: "Operational_Command",
    label: "Operationeel Commando",
    status: "BLOCK",
    escalation: "OvD",
    keywords: ["alarmeer", "stuur team", "activeer", "mobiliseer", "ontruim", "inzetten", "oproepen", "dispatch"],
    color: "text-orange-400",
  },
  {
    name: "Allocation",
    label: "Allocatie",
    status: "BLOCK",
    escalation: "IC-Hoofdarts",
    keywords: ["wijs bed", "verplaats patiënt", "bedindeling", "toewijzen", "transfereer", "overplaats", "bed toewijzen"],
    color: "text-amber-400",
  },
];

const IC_DOCUMENTS: ScopeDocument[] = [
  {
    type: "mandaat",
    title: "Mandaat Intensivist",
    content: "Klinische interventies — medicatie, beademing, procedures — vereisen autorisatie van de dienstdoende intensivist. ORFHEUSS classificeert, maar beslist nooit.",
  },
  {
    type: "mandaat",
    title: "Mandaat OvD",
    content: "Operationele commando's — teaminzet, alarmering, mobilisatie — vallen onder de Officier van Dienst. Coördinatie van middelen en personeel.",
  },
  {
    type: "mandaat",
    title: "Mandaat IC-Hoofdarts",
    content: "Allocatiebeslissingen — bedtoewijzing, patiëntverplaatsing, capaciteitsbeheer — vereisen autorisatie van het IC-hoofd.",
  },
  {
    type: "visiedocument",
    title: "IC Scope — TaoGate Classificatie",
    content: "De IC-scope definieert vier classificatiecategorieën: Observatie (PASS), Klinische Interventie (BLOCK → Intensivist), Operationeel Commando (BLOCK → OvD), en Allocatie (BLOCK → IC-Hoofdarts). De TaoGate observeert en classificeert — de mens autoriseert.",
  },
];

export async function seedDefaultScopes() {
  const existing = await storage.getScopes();
  if (existing.length > 0) return;

  await storage.createScope({
    name: "IC",
    description: "Intensive Care — klinische classificatie met escalatiepaden naar Intensivist, OvD en IC-Hoofdarts",
    categories: IC_CATEGORIES,
    documents: IC_DOCUMENTS,
    isDefault: "true",
  });

  console.log("[seed] Default IC scope created");
}
