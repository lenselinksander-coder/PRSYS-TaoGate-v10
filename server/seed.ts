import { storage } from "./storage";

export async function seedDefaultScopes() {
  const existing = await storage.getDefaultScope();
  if (existing) return;

  await storage.createScope({
    name: "LEYEN",
    description: "EU AI Act + IC klinische governance scope",
    status: "LOCKED",
    categories: [
      {
        name: "EU_AI_PROHIBITED",
        label: "Verboden AI (Onaanvaardbaar Risico)",
        status: "BLOCK",
        keywords: [
          "social scoring", "sociaal kredietsysteem", "manipulatie", "subliminal",
          "kwetsbare groepen uitbuiting", "biometrische massa-identificatie",
          "real-time biometrie", "gezichtsherkenning massa", "emotieherkenning werkplek",
          "emotieherkenning onderwijs", "predictive policing", "voorspellend politiewerk",
          "gedragsmanipulatie", "dark patterns ai", "scoring overheidsdiensten",
        ],
        escalation: "AI Office / Toezichthouder",
      },
      {
        name: "EU_AI_HIGH_RISK",
        label: "Hoog Risico (Annex III)",
        status: "ESCALATE_HUMAN",
        keywords: [
          "biometrisch", "kritieke infrastructuur", "onderwijs toelating",
          "werkgelegenheid selectie", "kredietbeoordeling", "rechtshandhaving",
          "migratie", "asiel", "rechtspraak ai", "medisch hulpmiddel",
          "veiligheidssysteem", "sollicitatie ai", "cv screening ai",
          "grenscontrole", "autonome besluitvorming", "geautomatiseerde beslissing",
          "bijzondere persoonsgegevens", "kwetsbare groepen", "fundamentele rechten",
          "critical infrastructure",
        ],
        escalation: "DPO / Legal / Conformiteitsbeoordelaar",
      },
      {
        name: "EU_AI_GPAI",
        label: "General Purpose AI",
        status: "ESCALATE_REGULATORY",
        keywords: [
          "foundation model", "large language model", "llm", "gpt", "general purpose",
          "generatieve ai", "chatbot breed inzetbaar", "systemisch risico",
          "training data", "compute threshold", "10^25 flops", "gpai", "basismodel",
        ],
        escalation: "AI Office / DPO",
      },
      {
        name: "EU_AI_LIMITED_RISK",
        label: "Beperkt Risico (Transparantie)",
        status: "PASS_WITH_TRANSPARENCY",
        keywords: [
          "chatbot", "deepfake", "ai-gegenereerde content", "synthetische media",
          "transparantieverplichting", "ai-label", "ai-disclosure",
          "emotieherkenning beperkt", "biometrische categorisatie", "ai-interactie melding",
        ],
        escalation: "Transparantieverplichting",
      },
      {
        name: "EU_AI_MINIMAL",
        label: "Minimaal Risico",
        status: "PASS",
        keywords: [
          "spamfilter", "ai gaming", "aanbevelingssysteem", "zoekalgoritme",
          "autocorrect", "vertaalsoftware", "voorraadoptimalisatie", "routeplanning",
          "beeldverbetering", "contentfilter",
        ],
        escalation: null,
      },
      {
        name: "PRIVACY_DOSSIER",
        label: "Privacy / Dossier",
        status: "ESCALATE_HUMAN",
        keywords: [
          "dossier", "medisch dossier", "patiëntgegevens", "ouders",
          "avg", "wgbo", "beroepsgeheim", "inzagerecht", "deel_dossier",
        ],
        escalation: "DPO",
      },
    ],
    documents: [],
    rules: [],
    isDefault: "true",
  });
}
