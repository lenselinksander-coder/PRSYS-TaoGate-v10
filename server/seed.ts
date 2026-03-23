import { storage } from "./storage";

export async function seedIndiaScope() {
  const orgs = await storage.getOrganizations();
  let indiaOrg = orgs.find(o => o.slug === "taogate-india");
  if (!indiaOrg) {
    indiaOrg = await storage.createOrganization({
      name: "TaoGate India",
      slug: "taogate-india",
      description: "Vehicle Insurance Fraud Triage — IRDAI/IIB governance scope voor de Indiase markt",
      sector: "insurance",
      gateProfile: "FRAUD_TRIAGE",
    });
  }

  const existingScopes = await storage.getScopesByOrg(indiaOrg.id);
  if (existingScopes.some(s => s.name === "TaoGate Goes India")) return;

  await storage.createScope({
    name: "TaoGate Goes India",
    description: "Vehicle Insurance Fraud Triage Scope v1.0 — IRDAI FMU rapportage + IIB cautionregister + auto-approve drempel",
    status: "LOCKED",
    orgId: indiaOrg.id,
    categories: [
      {
        name: "IIB_CAUTIONREGISTER",
        label: "IIB Cautionregister Treffer",
        status: "ESCALATE_REGULATORY",
        keywords: [
          "cautionlist", "iib", "blacklist treffer", "cautionregister", "fraud history",
          "previous fraud", "fraudeur", "fraud register", "iib hit", "iib match",
          "known fraudster", "eerder fraude", "gemarkeerde verzekerde",
        ],
        escalation: "IRDAI FMU / IIB Compliance",
      },
      {
        name: "DUPLICATE_CLAIM",
        label: "Duplicate Claim / Dubbele Aanvraag",
        status: "BLOCK",
        keywords: [
          "duplicate claim", "dubbele claim", "already claimed", "al ingediend",
          "multiple policies same incident", "meerdere polissen zelfde incident",
          "overlapping claim", "previously settled", "reeds vergoed",
          "duplicate registration", "same vehicle same date",
        ],
        escalation: "Fraudeafdeling",
      },
      {
        name: "SOFT_FRAUD",
        label: "Soft Fraud / Overdrijving",
        status: "ESCALATE_HUMAN",
        keywords: [
          "overdrijving", "exaggeration", "inflated repair cost", "opgeklopte reparatie",
          "staged accident", "geënsceneerde aanrijding", "neppe schade",
          "fake damage", "repair invoice mismatch", "inconsistente verklaring",
          "inconsistent statement", "getuige onbekend", "unknown witness",
          "delayed reporting", "te laat gemeld", "no police report",
        ],
        escalation: "Schade-expert / Investigatie",
      },
      {
        name: "AUTO_APPROVE",
        label: "Standaard Schade (Onder Drempel)",
        status: "PASS",
        keywords: [
          "minor damage", "kleine schade", "windshield", "voorruit", "fender bender",
          "lichte aanrijding", "third party minor", "under threshold", "onder drempel",
          "standard claim", "standaard claim", "no injury", "geen letsel",
          "clean history", "schone history",
        ],
        escalation: null,
      },
      {
        name: "COMPLEX_INVESTIGATION",
        label: "Complexe Schade / Onderzoek Vereist",
        status: "ESCALATE_HUMAN",
        keywords: [
          "total loss", "totaal verlies", "bodily injury", "letselschade",
          "fatality", "dodelijk", "theft", "diefstal", "fire damage", "brandschade",
          "flood damage", "waterschade", "natural disaster", "natuurramp",
          "high value claim", "hoge claim waarde", "commercial vehicle", "bedrijfsvoertuig",
          "disputed liability", "aansprakelijkheid betwist",
        ],
        escalation: "Senior Schade-expert",
      },
      {
        name: "IRDAI_REPORTING",
        label: "IRDAI Meldplicht Drempel",
        status: "ESCALATE_REGULATORY",
        keywords: [
          "irdai threshold", "fmu reporting", "regulatory report", "mandatory disclosure",
          "meldplichtige fraude", "irdai fmu", "fraud management unit",
          "suspicious activity report", "sar insurance", "systemic fraud",
          "organised fraud ring", "georganiseerde fraudering",
        ],
        escalation: "IRDAI FMU",
      },
    ],
    documents: [
      {
        type: "visiedocument",
        title: "TaoGate Goes India — Vehicle Insurance Fraud Triage Scope v1.0",
        content: `## Visie
TaoGate India hanteert een gelaagde triage-aanpak voor vehicle insurance claims op de Indiase markt.
Elk claim doorloopt een geautomatiseerde gate-check op basis van IIB cautionregister, IRDAI FMU-drempels en interne fraudepatronen.

## Kernprincipes
- Auto-approve onder de drempel (standaard schades < INR 50.000)
- IIB cautionregister-hits leiden altijd tot IRDAI-escalatie
- Menselijke review verplicht bij letsel, diefstal en total loss
- IRDAI FMU-rapportage bij georganiseerde fraude of systeemfraude

## Scope
Vehicle insurance (motorvoertuigen) op de Indiase markt, onder toezicht van IRDAI.`,
      },
      {
        type: "mandaat",
        title: "Mandaat — TaoGate Auto-Approve Drempel India",
        content: `## Mandaat Auto-Approve

### Drempelwaarde
Claims tot en met **INR 50.000** zonder rode vlaggen worden automatisch goedgekeurd door TaoGate.

### Voorwaarden voor auto-approve
1. Geen IIB cautionregister-hit op verzekerde of voertuig
2. Geen duplicate claim signaal
3. Schade valt in categorie PASS (kleine schade, geen letsel)
4. Polis actief en premie betaald

### Uitzonderingen
- Altijd menselijke review bij letsel (ongeacht bedrag)
- Altijd menselijke review bij total loss
- Bij twijfel: escaleer naar schade-expert

**Geldig vanaf:** 2024-01-01
**Bevoegd door:** TaoGate India Operations Board`,
      },
      {
        type: "protocol",
        title: "Protocol — IRDAI FMU Escalatie & Frauderapportage",
        content: `## IRDAI FMU Escalatieprotocol

### 1. Meldplicht
Conform IRDAI (Protection of Policyholders' Interests) Regulations is elke verzekeraar verplicht vermoedens van verzekeringsfraude te melden bij de Fraud Management Unit (FMU) van IRDAI.

### 2. Drempels voor verplichte melding
- Georganiseerde fraude (meer dan 3 gerelateerde claims)
- Totale fraudewaarde > INR 5 lakh
- IIB cautionregister-hit gecombineerd met actieve claim

### 3. Escalatieprocedure
1. TaoGate genereert ESCALATE_REGULATORY beslissing
2. Compliance officer ontvangt notificatie binnen 24 uur
3. FMU-rapport ingediend binnen 7 werkdagen
4. IIB-update na bevestiging fraude

### 4. Documentatie
Alle escalaties worden vastgelegd in het WORM-auditlog van TaoGate.

**Referentie:** IRDAI Circular No. IRDA/SDD/CIR/FRAUD/2013
**Versie:** 2.1`,
      },
    ],
    rules: [
      {
        ruleId: "IRDAI_IIB_BLOCK",
        layer: "NATIONAL",
        domain: "FRAUD",
        title: "IIB Cautionregister — Escalatie Verplicht",
        description: "Elke claim waarbij de verzekerde of het voertuig voorkomt in het IIB Cautionregister vereist verplichte escalatie naar IRDAI FMU.",
        action: "ESCALATE_REGULATORY",
        overridesLowerLayers: true,
        source: "IIB / IRDAI",
        article: "IRDAI FMU Circular 2013",
      },
      {
        ruleId: "IRDAI_DUPLICATE_BLOCK",
        layer: "NATIONAL",
        domain: "FRAUD",
        title: "Duplicate Claims — Geblokkeerd",
        description: "Duplicate claims (zelfde voertuig + zelfde incident op meerdere polissen) worden direct geblokkeerd en doorgestuurd naar de fraudeafdeling.",
        action: "BLOCK",
        overridesLowerLayers: true,
        source: "IRDAI Anti-Fraud Policy",
        article: "IRDAI Reg. 2013, Art. 7",
      },
      {
        ruleId: "TAOGATE_AUTO_APPROVE",
        layer: "REGIONAL",
        domain: "CLAIMS",
        title: "Auto-Approve Drempel — Kleine Schades",
        description: "Claims tot INR 50.000 zonder rode vlaggen worden automatisch goedgekeurd conform het TaoGate India Operations Mandaat.",
        action: "PASS",
        overridesLowerLayers: false,
        source: "TaoGate India Operations Board",
        article: "Mandaat v1.0, §2",
      },
      {
        ruleId: "IRDAI_INJURY_HUMAN",
        layer: "NATIONAL",
        domain: "CLAIMS",
        title: "Letselschade — Menselijke Review Verplicht",
        description: "Claims met bodily injury of fatality vereisen altijd menselijke beoordeling door een senior schade-expert, ongeacht claimwaarde.",
        action: "ESCALATE_HUMAN",
        overridesLowerLayers: true,
        source: "IRDAI Motor Insurance Guidelines",
        article: "IRDAI Motor Tariff, Art. 12",
      },
      {
        ruleId: "IRDAI_FMU_REPORT",
        layer: "NATIONAL",
        domain: "FRAUD",
        title: "IRDAI FMU Meldplicht",
        description: "Georganiseerde fraude en systeemfraude boven INR 5 lakh moeten worden gemeld bij IRDAI FMU binnen 7 werkdagen.",
        action: "ESCALATE_REGULATORY",
        overridesLowerLayers: true,
        source: "IRDAI",
        article: "IRDA/SDD/CIR/FRAUD/2013",
      },
      {
        ruleId: "TAOGATE_SOFT_FRAUD_REVIEW",
        layer: "REGIONAL",
        domain: "FRAUD",
        title: "Soft Fraud — Expert Review",
        description: "Claims met indicatoren van overdrijving of staged accidents worden doorgestuurd naar een schade-expert voor nader onderzoek.",
        action: "ESCALATE_HUMAN",
        overridesLowerLayers: false,
        source: "TaoGate India Fraud Policy",
        article: "Intern Protocol v2.1",
      },
    ],
    isDefault: null,
  });
}

export async function seedDefaultScopes() {
  const existing = await storage.getDefaultScope();
  if (existing) return;

  const orgs = await storage.getOrganizations();
  let defaultOrg = orgs.find(o => o.slug === "orfheuss-demo");
  if (!defaultOrg) {
    defaultOrg = await storage.createOrganization({
      name: "ORFHEUSS Demo",
      slug: "orfheuss-demo",
      description: "Standaard demonstratie-organisatie met klinisch gate-profiel (EU AI Act + IC governance)",
      sector: "healthcare",
      gateProfile: "CLINICAL",
    });
  }

  await storage.createScope({
    name: "LEYEN",
    description: "EU AI Act + IC klinische governance scope",
    status: "LOCKED",
    orgId: defaultOrg.id,
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
    rules: [
      {
        ruleId: "EU_AI_ART_5",
        layer: "EU",
        domain: "AI",
        title: "Verboden AI-praktijken",
        description: "AI-systemen voor sociale scoring, manipulatieve technieken, biometrische classificatie op gevoelige kenmerken, en voorspellende politie zijn verboden.",
        action: "BLOCK",
        overridesLowerLayers: true,
        source: "EU AI Act",
        article: "Artikel 5",
      },
      {
        ruleId: "EU_AI_ART_6",
        layer: "EU",
        domain: "AI",
        title: "Hoog-risico AI-systemen",
        description: "AI-systemen in kritieke infrastructuur, onderwijs, werkgelegenheid, rechtshandhaving en migratie vereisen conformiteitsbeoordeling.",
        action: "ESCALATE_HUMAN",
        overridesLowerLayers: true,
        source: "EU AI Act",
        article: "Artikel 6-7",
      },
      {
        ruleId: "EU_AI_ART_50",
        layer: "EU",
        domain: "AI",
        title: "Transparantieverplichtingen",
        description: "AI-systemen die interageren met personen, emotieherkenning, biometrische categorisering en deepfakes moeten transparant zijn.",
        action: "PASS_WITH_TRANSPARENCY",
        overridesLowerLayers: true,
        source: "EU AI Act",
        article: "Artikel 50",
      },
      {
        ruleId: "EU_AI_ART_51",
        layer: "EU",
        domain: "AI",
        title: "GPAI-modellen",
        description: "Aanbieders van General Purpose AI-modellen moeten technische documentatie bijhouden en samenwerken met toezichthouders.",
        action: "ESCALATE_REGULATORY",
        overridesLowerLayers: true,
        source: "EU AI Act",
        article: "Artikel 51-56",
      },
      {
        ruleId: "EU_AI_ART_95",
        layer: "EU",
        domain: "AI",
        title: "Minimaal-risico AI",
        description: "AI-systemen met minimaal risico mogen vrij worden ingezet. Vrijwillige gedragscodes worden aangemoedigd.",
        action: "PASS",
        overridesLowerLayers: false,
        source: "EU AI Act",
        article: "Artikel 95",
      },
      {
        ruleId: "NL_UAVG_BIO",
        layer: "NATIONAL",
        domain: "AI",
        title: "UAVG biometrische gegevens",
        description: "Verwerking van biometrische gegevens ter identificatie is verboden tenzij noodzakelijk voor authenticatie of beveiliging.",
        action: "BLOCK",
        overridesLowerLayers: true,
        source: "UAVG (NL)",
        article: "Art. 29",
      },
      {
        ruleId: "NL_WGBO_AI",
        layer: "NATIONAL",
        domain: "AI",
        title: "WGBO AI in zorg",
        description: "AI-ondersteuning bij medische besluitvorming vereist informatie aan de patiënt en toestemming. De arts blijft eindverantwoordelijk.",
        action: "ESCALATE_HUMAN",
        overridesLowerLayers: false,
        source: "WGBO (NL)",
        article: "Art. 7:448 BW",
      },
      {
        ruleId: "NL_AP_ALGO",
        layer: "NATIONAL",
        domain: "AI",
        title: "AP toezicht algoritmes",
        description: "De Autoriteit Persoonsgegevens houdt toezicht op geautomatiseerde besluitvorming. Organisaties moeten een DPIA uitvoeren bij hoog-risico AI.",
        action: "ESCALATE_REGULATORY",
        overridesLowerLayers: false,
        source: "Autoriteit Persoonsgegevens",
        article: "AVG Art. 35",
      },
      {
        ruleId: "REG_GGD_AI",
        layer: "REGIONAL",
        domain: "AI",
        title: "GGD regionaal protocol AI",
        description: "Regionale GGD-protocollen voor AI-gebruik in publieke gezondheid. Aanvullende transparantie-eisen bij contactonderzoek.",
        action: "PASS_WITH_TRANSPARENCY",
        overridesLowerLayers: false,
        source: "GGD Protocol",
        article: "Regionaal",
      },
      {
        ruleId: "MUN_ALGO_REG",
        layer: "MUNICIPAL",
        domain: "AI",
        title: "Gemeentelijk algoritmeregister",
        description: "Gemeente vereist registratie van algoritmes in het openbaar algoritmeregister. Publieke verantwoording.",
        action: "PASS_WITH_TRANSPARENCY",
        overridesLowerLayers: false,
        source: "Gemeentelijke verordening",
        article: "Lokaal",
      },
    ],
    isDefault: "true",
  });
}
