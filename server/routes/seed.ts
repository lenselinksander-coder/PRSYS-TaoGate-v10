import type { Express } from "express";
import { storage } from "../storage";
import type { InsertScope } from "@shared/schema";

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function registerSeedRoutes(app: Express): void {
  app.post("/api/seed-demo", async (_req, res) => {
    try {
      const existingOrgs = await storage.getOrganizations();
      const existingScopes = await storage.getScopes();

      const orgDefs = [
        { name: "Erasmus MC", slug: "erasmus-mc", description: "Academisch Ziekenhuis", sector: "healthcare", gateProfile: "CLINICAL" },
        { name: "Kraaijenvanger", slug: "kraaijenvanger", description: "Architectenbureau", sector: "other", gateProfile: "CUSTOM" },
      ];

      const createdOrgs: Record<string, string> = {};
      for (const def of orgDefs) {
        const existing = existingOrgs.find(o => o.slug === def.slug);
        if (existing) { createdOrgs[def.name] = existing.id; }
        else { const org = await storage.createOrganization(def); createdOrgs[def.name] = org.id; }
      }

      type ScopeDef = {
        name: string; description: string; orgName: string | null; isDefault: string;
        categories: unknown[]; documents: unknown[]; rules: unknown[];
      };

      const scopeDefs: ScopeDef[] = [
        {
          name: "LEYEN", description: "EU AI Act — Deterministische pre-governance classificatie voor AI-systemen.", orgName: null, isDefault: "true",
          categories: [
            { name: "POLITICAL_MANIPULATION", color: "", label: "Politieke Manipulatie (Verboden)", status: "BLOCK", keywords: ["kiezers manipuleren","stemgedrag beïnvloeden","politieke profilering","electorale manipulatie","kiezers targeting","politieke polarisatie","desinformatie campagne","nepnieuws verspreiden","verkiezingsfraude ai","stemadvies manipulatie","publieke opinie manipuleren","politieke microtargeting","voter suppression","election interference","political deepfake"], escalation: "AI Office / Toezichthouder" },
            { name: "PERSONAL_DATA_PROCESSING", color: "", label: "Persoonsgegevens Verwerking (AVG/GDPR)", status: "BLOCK", keywords: ["naam verzamelen","e-mail opslaan","bsn database","medisch dossier exporteren","telefoonnummer lijst","adres verkopen","persoonsgegevens delen","biometrische gegevens bewaren","geboortedatum profileren","locatiegegevens scrapen"], escalation: "Data Protection Officer" },
            { name: "EU_AI_PROHIBITED", color: "", label: "Verboden AI (Onaanvaardbaar Risico)", status: "BLOCK", keywords: ["social scoring","sociaal kredietsysteem","manipulatie","subliminal","kwetsbare groepen uitbuiting","biometrische massa-identificatie","real-time biometrie","gezichtsherkenning massa","emotieherkenning werkplek","emotieherkenning onderwijs","predictive policing","voorspellend politiewerk","gedragsmanipulatie","dark patterns ai","scoring overheidsdiensten"], escalation: "AI Office / Toezichthouder" },
            { name: "EU_AI_HIGH_RISK", color: "", label: "Hoog Risico (Annex III)", status: "ESCALATE_HUMAN", keywords: ["biometrisch","kritieke infrastructuur","onderwijs toelating","werkgelegenheid selectie","kredietbeoordeling","rechtshandhaving","migratie","asiel","rechtspraak ai","medisch hulpmiddel","veiligheidssysteem","sollicitatie ai","cv screening ai","grenscontrole","autonome besluitvorming","geautomatiseerde beslissing","bijzondere persoonsgegevens","kwetsbare groepen","fundamentele rechten","critical infrastructure"], escalation: "DPO / Legal / Conformiteitsbeoordelaar" },
            { name: "EU_AI_GPAI", color: "", label: "General Purpose AI", status: "ESCALATE_REGULATORY", keywords: ["foundation model","large language model","llm","gpt","general purpose","generatieve ai","chatbot breed inzetbaar","systemisch risico","training data","compute threshold","10^25 flops","gpai","basismodel"], escalation: "AI Office / DPO" },
            { name: "EU_AI_LIMITED_RISK", color: "", label: "Beperkt Risico (Transparantie)", status: "PASS_WITH_TRANSPARENCY", keywords: ["chatbot","deepfake","ai-gegenereerde content","synthetische media","transparantieverplichting","ai-label","ai-disclosure","emotieherkenning beperkt","biometrische categorisatie","ai-interactie melding"], escalation: "Transparantieverplichting" },
            { name: "EU_AI_MINIMAL", color: "", label: "Minimaal Risico", status: "PASS", keywords: ["spamfilter","ai gaming","aanbevelingssysteem","zoekalgoritme","autocorrect","vertaalsoftware","voorraadoptimalisatie","routeplanning","beeldverbetering","contentfilter"], escalation: null },
            { name: "PRIVACY_DOSSIER", color: "", label: "Privacy / Dossier", status: "ESCALATE_HUMAN", keywords: ["dossier","medisch dossier","patiëntgegevens","ouders","avg","wgbo","beroepsgeheim","inzagerecht","deel_dossier"], escalation: "DPO" },
          ],
          documents: [
            { type: "visiedocument", title: "EU AI Act — Scope Visie MC LEYEN", content: "MC LEYEN implementeert deterministische pre-governance classificatie voor AI-systemen conform de EU AI Act (Verordening (EU) 2024/1689).\n\nDe TaoGate observeert en classificeert. De mens autoriseert." },
            { type: "mandaat", title: "Mandaat — Menselijk Toezicht", content: "Conform Artikel 14 EU AI Act is menselijk toezicht verplicht voor alle hoog-risico AI-systemen." },
            { type: "protocol", title: "Protocol — Conformiteitsbeoordeling", content: "Verplichte checks voor hoog-risico AI-systemen: Risicomanagementsysteem, Data governance, Technische documentatie, Registratie in EU-databank, DPIA, Transparantie, Menselijk toezicht, Nauwkeurigheid." },
            { type: "huisregel", title: "Huisregel — Mechanica Mapping", content: "ORFHEUSS Mechanica Layer: Regeldruk MINIMAAL -> PASS, LAAG -> PASS_WITH_TRANSPARENCY, HOOG -> ESCALATE_HUMAN, VARIABEL -> ESCALATE_REGULATORY, ONEINDIG -> BLOCK." },
          ],
          rules: [
            { layer: "EU", title: "Verboden AI — Politieke Manipulatie", action: "BLOCK", domain: "AI", ruleId: "EU_AI_ART_5_POL", source: "EU AI Act", article: "Artikel 5(1)(a)", description: "AI-systemen die manipulatieve of misleidende technieken inzetten om stemgedrag of politieke overtuigingen te beïnvloeden zijn verboden.", overridesLowerLayers: true },
            { layer: "EU", title: "AVG — Onrechtmatige verwerking persoonsgegevens", action: "BLOCK", domain: "PRIVACY", ruleId: "EU_AVG_ART_6", source: "AVG/GDPR", article: "Artikel 6/Artikel 9", description: "Verwerking van persoonsgegevens zonder rechtmatige grondslag is verboden. Bijzondere categorieën (medisch, biometrisch, BSN) vereisen expliciete toestemming of wettelijke grondslag.", overridesLowerLayers: true },
            { layer: "EU", title: "Verboden AI-praktijken", action: "BLOCK", domain: "AI", ruleId: "EU_AI_ART_5", source: "EU AI Act", article: "Artikel 5", description: "AI-systemen voor sociale scoring, manipulatieve technieken, biometrische classificatie op gevoelige kenmerken, en voorspellende politie zijn verboden.", overridesLowerLayers: true },
            { layer: "EU", title: "Hoog-risico AI-systemen", action: "ESCALATE_HUMAN", domain: "AI", ruleId: "EU_AI_ART_6", source: "EU AI Act", article: "Artikel 6-7", description: "AI-systemen in kritieke infrastructuur, onderwijs, werkgelegenheid, rechtshandhaving en migratie vereisen conformiteitsbeoordeling.", overridesLowerLayers: true },
            { layer: "EU", title: "Transparantieverplichtingen", action: "PASS_WITH_TRANSPARENCY", domain: "AI", ruleId: "EU_AI_ART_50", source: "EU AI Act", article: "Artikel 50", description: "AI-systemen die interageren met personen moeten transparant zijn.", overridesLowerLayers: true },
            { layer: "EU", title: "GPAI-modellen", action: "ESCALATE_REGULATORY", domain: "AI", ruleId: "EU_AI_ART_51", source: "EU AI Act", article: "Artikel 51-56", description: "Aanbieders van General Purpose AI-modellen moeten technische documentatie bijhouden.", overridesLowerLayers: true },
            { layer: "EU", title: "Minimaal-risico AI", action: "PASS", domain: "AI", ruleId: "EU_AI_ART_95", source: "EU AI Act", article: "Artikel 95", description: "AI-systemen met minimaal risico mogen vrij worden ingezet.", overridesLowerLayers: false },
            { layer: "NATIONAL", title: "UAVG biometrische gegevens", action: "BLOCK", domain: "AI", ruleId: "NL_UAVG_BIO", source: "UAVG (NL)", article: "Art. 29", description: "Verwerking van biometrische gegevens ter identificatie is verboden.", overridesLowerLayers: true },
            { layer: "NATIONAL", title: "WGBO AI in zorg", action: "ESCALATE_HUMAN", domain: "AI", ruleId: "NL_WGBO_AI", source: "WGBO (NL)", article: "Art. 7:448 BW", description: "AI-ondersteuning bij medische besluitvorming vereist informatie aan de patiënt.", overridesLowerLayers: false },
            { layer: "NATIONAL", title: "AP toezicht algoritmes", action: "ESCALATE_REGULATORY", domain: "AI", ruleId: "NL_AP_ALGO", source: "Autoriteit Persoonsgegevens", article: "AVG Art. 35", description: "De AP houdt toezicht op geautomatiseerde besluitvorming.", overridesLowerLayers: false },
            { layer: "REGIONAL", title: "GGD regionaal protocol AI", action: "PASS_WITH_TRANSPARENCY", domain: "AI", ruleId: "REG_GGD_AI", source: "GGD Protocol", article: "Regionaal", description: "Regionale GGD-protocollen voor AI-gebruik.", overridesLowerLayers: false },
            { layer: "MUNICIPAL", title: "Gemeentelijk algoritmeregister", action: "PASS_WITH_TRANSPARENCY", domain: "AI", ruleId: "MUN_ALGO_REG", source: "Gemeentelijke verordening", article: "Lokaal", description: "Gemeente vereist registratie van algoritmes.", overridesLowerLayers: false },
          ],
        },
        {
          name: "Erasmus", description: "Erasmus MC — Klinisch AI governance scope", orgName: "Erasmus MC", isDefault: "true",
          categories: [
            { name: "Observation", color: "text-green-400", label: "Observatie", status: "PASS", keywords: [] as string[], escalation: null },
            { name: "PRIVACY_DOSSIER", color: "", label: "Privacy / Dossier", status: "ESCALATE_HUMAN", keywords: ["dossier","medisch dossier","patiëntgegevens","ouders","avg","wgbo","beroepsgeheim","inzagerecht","deel_dossier"], escalation: "DPO" },
            { name: "BIOMETRIC_BLOCK", color: "", label: "Biometrische Identificatie (Verboden)", status: "BLOCK", keywords: ["gezichtsherkenning","facial recognition","gezichtsprofiel","biometrische identificatie commercieel"], escalation: "AI Office / Toezichthouder" },
          ],
          documents: [] as unknown[],
          rules: [
            { layer: "EU", title: "Verboden AI-praktijken", action: "BLOCK", domain: "AI", ruleId: "EU_AI_ART_5", source: "EU AI Act", article: "Artikel 5", description: "AI-systemen voor sociale scoring zijn verboden.", overridesLowerLayers: true },
            { layer: "EU", title: "Hoog-risico AI-systemen", action: "ESCALATE_HUMAN", domain: "AI", ruleId: "EU_AI_ART_6", source: "EU AI Act", article: "Artikel 6-7", description: "AI in kritieke infrastructuur vereist conformiteitsbeoordeling.", overridesLowerLayers: true },
            { layer: "EU", title: "Transparantieverplichtingen", action: "PASS_WITH_TRANSPARENCY", domain: "AI", ruleId: "EU_AI_ART_50", source: "EU AI Act", article: "Artikel 50", description: "AI-systemen moeten transparant zijn.", overridesLowerLayers: true },
            { layer: "EU", title: "GPAI-modellen", action: "ESCALATE_REGULATORY", domain: "AI", ruleId: "EU_AI_ART_51", source: "EU AI Act", article: "Artikel 51-56", description: "GPAI-modellen vereisen documentatie.", overridesLowerLayers: true },
            { layer: "EU", title: "Minimaal-risico AI", action: "PASS", domain: "AI", ruleId: "EU_AI_ART_95", source: "EU AI Act", article: "Artikel 95", description: "Minimaal risico AI mag vrij ingezet.", overridesLowerLayers: false },
            { layer: "NATIONAL", title: "UAVG biometrische gegevens", action: "BLOCK", domain: "AI", ruleId: "NL_UAVG_BIO", source: "UAVG (NL)", article: "Art. 29", description: "Biometrische gegevens verboden.", overridesLowerLayers: true },
            { layer: "NATIONAL", title: "WGBO AI in zorg", action: "ESCALATE_HUMAN", domain: "AI", ruleId: "NL_WGBO_AI", source: "WGBO (NL)", article: "Art. 7:448 BW", description: "AI in zorg vereist patiëntinformatie.", overridesLowerLayers: false },
            { layer: "NATIONAL", title: "AP toezicht algoritmes", action: "ESCALATE_REGULATORY", domain: "AI", ruleId: "NL_AP_ALGO", source: "Autoriteit Persoonsgegevens", article: "AVG Art. 35", description: "AP houdt toezicht op algoritmes.", overridesLowerLayers: false },
            { layer: "REGIONAL", title: "GGD regionaal protocol AI", action: "PASS_WITH_TRANSPARENCY", domain: "AI", ruleId: "REG_GGD_AI", source: "GGD Protocol", article: "Regionaal", description: "GGD-protocollen voor AI.", overridesLowerLayers: false },
            { layer: "MUNICIPAL", title: "Gemeentelijk algoritmeregister", action: "PASS_WITH_TRANSPARENCY", domain: "AI", ruleId: "MUN_ALGO_REG", source: "Gemeentelijke verordening", article: "Lokaal", description: "Gemeente algoritmeregister.", overridesLowerLayers: false },
          ],
        },
      ];

      const created: string[] = [];
      for (const def of scopeDefs) {
        const existing = existingScopes.find(s => s.name === def.name);
        if (existing) { created.push(`${def.name} (already exists)`); continue; }
        const orgId = def.orgName ? createdOrgs[def.orgName] || null : null;
        await storage.createScope({
          name: def.name, description: def.description, orgId,
          categories: def.categories as InsertScope["categories"],
          documents: def.documents as InsertScope["documents"],
          rules: def.rules as InsertScope["rules"],
          isDefault: def.isDefault,
        });
        created.push(`${def.name} (created, org: ${def.orgName || "none"})`);
      }

      const finalOrgs = await storage.getOrganizations();
      const finalScopes = await storage.getScopes();
      return res.json({
        success: true,
        organizations: finalOrgs.map(o => ({ name: o.name, gateProfile: o.gateProfile })),
        scopes: created,
        totals: { organizations: finalOrgs.length, scopes: finalScopes.length },
      });
    } catch (err: unknown) {
      return res.status(500).json({ error: errMsg(err) });
    }
  });
}
