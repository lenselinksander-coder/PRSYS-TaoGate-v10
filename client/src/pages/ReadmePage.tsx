import { useRef } from "react";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { Download, Printer, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function ReadmePage() {
  const contentRef = useRef<HTMLDivElement>(null);

  const handleDownloadPDF = async () => {
    if (!contentRef.current) return;

    const canvas = await html2canvas(contentRef.current, {
      scale: 2,
      backgroundColor: "#ffffff",
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    let heightLeft = pdfHeight;
    let position = 0;
    const pageHeight = pdf.internal.pageSize.getHeight();

    pdf.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = -(pdfHeight - heightLeft);
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;
    }

    pdf.save("ORFHEUSS_Leeswijzer.pdf");
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-4xl mx-auto pb-12">
      <div className="mb-8 flex justify-between items-center print:hidden">
        <Button asChild variant="ghost" className="gap-2">
          <Link href="/manual">
            <ArrowLeft className="w-4 h-4" /> Terug naar Handleiding
          </Link>
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrint} className="gap-2">
            <Printer className="w-4 h-4" /> Print
          </Button>
          <Button onClick={handleDownloadPDF} className="gap-2 bg-primary text-primary-foreground">
            <Download className="w-4 h-4" /> Download PDF
          </Button>
        </div>
      </div>

      <div ref={contentRef} className="bg-white text-black p-12 shadow-sm rounded-none min-h-[297mm] print:shadow-none print:p-0">

        <div className="border-b-4 border-black pb-6 mb-8">
          <h1 className="text-4xl font-bold uppercase tracking-tight mb-2">ORFHEUSS</h1>
          <p className="text-lg font-mono text-gray-600">Leeswijzer — Governance Console voor organisaties</p>
          <p className="text-sm text-gray-400 mt-1">PRSYS (Paontologisch Resonantie Systeem) als runtime-architectuur</p>
        </div>

        <div className="prose prose-lg max-w-none text-gray-800">

          <h2 className="text-2xl font-bold mt-8 mb-4 border-b border-gray-200 pb-2">1. Wat is ORFHEUSS?</h2>
          <p>
            ORFHEUSS is een governance-console die organisaties helpt om regelgeving, risico's en verantwoordelijkheden
            gestructureerd te beheren. Het systeem classificeert invoer, toetst die aan juridische kaders op vier
            bestuursniveaus, en maakt zichtbaar waar grenzen, escalaties en verantwoordelijkheden liggen.
          </p>
          <p>
            Het systeem start als een blanco project. Er zijn geen voorgedefinieerde regels of categorieën.
            Alles begint bij het aanmaken van een Scope: de organisatorische context waarbinnen classificatie en
            regeltoetsing plaatsvinden. Zonder scope is er geen classificatie.
          </p>
          <p className="bg-gray-100 p-3 rounded border-l-4 border-black text-sm">
            Kernprincipe: <em>Zonder bron geen verhaal. Zonder verhaal geen data. Geen data geen sets.</em>
            Elke regel in het systeem moet herleidbaar zijn naar een verifieerbare bron.
          </p>

          <h2 className="text-2xl font-bold mt-8 mb-4 border-b border-gray-200 pb-2">2. Modules</h2>

          <h3 className="text-xl font-bold mt-6 mb-2">INGEST — Bronnenmotor</h3>
          <p>
            De INGEST-module is het startpunt voor het aanmaken van scopes. Er zijn twee werkwijzen:
          </p>
          <ul className="list-disc pl-6 mt-2">
            <li><strong>Automatisch:</strong> Het systeem doorzoekt actuele bronnen via Perplexity en levert
            onderzoeksresultaten met verifieerbare citaten. Op basis daarvan wordt een concept-scope (DRAFT)
            gegenereerd met regels, categorieën en bronvermeldingen.</li>
            <li><strong>Handmatig:</strong> U voert zelf regels, categorieën, bronnen en trefwoorden in. Geschikt
            voor situaties waar u bestaande documenten of interne kennis wilt vertalen naar een scope.</li>
          </ul>
          <p>
            Elke scope doorloopt een vaste cyclus: DRAFT (concept, bewerkbaar) naar LOCKED (vergrendeld, productie).
            Voordat een scope vergrendeld kan worden, doorloopt het systeem een preflight-controle die valideert of
            alle regels een bron hebben, of escalatiepaden zijn gedefinieerd, en of er ontbrekende informatie (gaps) is.
          </p>

          <h3 className="text-xl font-bold mt-6 mb-2">ARGOS — TaoGate (Pre-governance classificatie)</h3>
          <p>
            ARGOS is de poortwachter. Elke invoer wordt geclassificeerd op basis van trefwoorden uit de actieve scope.
            Het systeem kent vijf gate-beslissingen, van licht naar zwaar:
          </p>
          <table className="w-full text-sm mt-3 mb-3 border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-300">
                <th className="text-left py-2 pr-4">Beslissing</th>
                <th className="text-left py-2">Betekenis</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100">
                <td className="py-2 pr-4 font-mono font-bold text-green-700">PASS</td>
                <td className="py-2">Vrije doorgang. Geen risico gedetecteerd.</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-2 pr-4 font-mono font-bold text-blue-700">PASS + TRANSPARANTIE</td>
                <td className="py-2">Doorgang met informatieplicht. Gebruiker moet weten dat AI betrokken is.</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-2 pr-4 font-mono font-bold text-orange-600">ESCALATIE MENS</td>
                <td className="py-2">Menselijke beoordeling vereist voordat de invoer doorgaat.</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-2 pr-4 font-mono font-bold text-amber-700">ESCALATIE TOEZICHT</td>
                <td className="py-2">Toezichthouder (DPO, AI Office) moet betrokken worden.</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-2 pr-4 font-mono font-bold text-red-700">BLOCK</td>
                <td className="py-2">Verboden. Absolute grens, geen uitzonderingen.</td>
              </tr>
            </tbody>
          </table>
          <p>
            ARGOS voert tegelijkertijd een Olympia-toets uit: de classificatie wordt getoetst aan de regels in de
            scope om te bepalen welke juridische regel van toepassing is.
          </p>

          <h3 className="text-xl font-bold mt-6 mb-2">SCOPES — Organisatorisch scopebeheer</h3>
          <p>
            Elke organisatie definieert haar eigen scope (Management Console). Een scope bevat:
          </p>
          <ul className="list-disc pl-6 mt-2">
            <li><strong>Categorieën:</strong> met gate-status, trefwoorden en escalatiedoelen.</li>
            <li><strong>Regels:</strong> juridische basis met jurisdictielaag, domein, actie, bron en citaat.</li>
            <li><strong>Documenten:</strong> visiedocumenten, mandaten, huisregels, protocollen.</li>
            <li><strong>Status:</strong> DRAFT (bewerkbaar) of LOCKED (vergrendeld voor productie).</li>
          </ul>
          <p>
            Regels bevatten provenance-gegevens: de bron (wet/richtlijn), URL, specifiek artikel, citaat en
            Q-Triad classificatie (Mens×Mens, Mens×Systeem, Systeem×Systeem).
          </p>

          <h3 className="text-xl font-bold mt-6 mb-2">OLYMPIA — Rule Execution Layer</h3>
          <p>
            OLYMPIA lost conflicten op tussen regels uit vier jurisdictielagen:
          </p>
          <table className="w-full text-sm mt-3 mb-3 border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-300">
                <th className="text-left py-2 pr-4">Laag</th>
                <th className="text-left py-2 pr-4">Prioriteit</th>
                <th className="text-left py-2">Toelichting</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100">
                <td className="py-2 pr-4 font-bold">EU</td>
                <td className="py-2 pr-4">Hoogste</td>
                <td className="py-2">Europese verordeningen met directe werking (EU AI Act, AVG).</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-2 pr-4 font-bold">Nationaal</td>
                <td className="py-2 pr-4">Hoog</td>
                <td className="py-2">Nationale wetgeving die EU-regels implementeert (UAVG, WGBO).</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-2 pr-4 font-bold">Regionaal</td>
                <td className="py-2 pr-4">Gemiddeld</td>
                <td className="py-2">Provinciale en regionale protocollen (GGD-richtlijnen).</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-2 pr-4 font-bold">Gemeentelijk</td>
                <td className="py-2 pr-4">Laagste</td>
                <td className="py-2">Lokale verordeningen en beleidsregels.</td>
              </tr>
            </tbody>
          </table>

          <p className="bg-gray-100 p-3 rounded border-l-4 border-black text-sm mt-4">
            <strong>Conflictregels:</strong> (1) BLOCK wint altijd, ongeacht de laag. (2) Bij conflicten tussen
            lagen wint de hogere jurisdictie. (3) Regeldruk wordt berekend als de som van laaggewicht maal
            actiegewicht. BLOCK levert oneindige regeldruk.
          </p>

          <h2 className="text-2xl font-bold mt-8 mb-4 border-b border-gray-200 pb-2">3. Werkwijze</h2>

          <p>De standaard werkstroom is als volgt:</p>
          <ol className="list-decimal pl-6 mt-2">
            <li className="mb-2">
              <strong>Scope aanmaken via INGEST:</strong> Gebruik de automatische (Perplexity) of handmatige modus
              om een concept-scope te genereren. Voer regels, categorieën en bronnen in.
            </li>
            <li className="mb-2">
              <strong>Draft beoordelen:</strong> Controleer de gegenereerde regels en categorieën. Pas aan waar nodig.
              Let op de preflight-controle: alle regels moeten een bron hebben.
            </li>
            <li className="mb-2">
              <strong>Scope vergrendelen (LOCK):</strong> Na goedkeuring vergrendelt u de scope. Een vergrendelde
              scope is beschikbaar voor classificatie in ARGOS en OLYMPIA.
            </li>
            <li className="mb-2">
              <strong>Classificeren in ARGOS:</strong> Selecteer de vergrendelde scope en typ invoer. Het systeem
              classificeert automatisch en toont de gate-beslissing en de toepasselijke Olympia-regel.
            </li>
            <li className="mb-2">
              <strong>Regellandschap bekijken in OLYMPIA:</strong> Bekijk het overzicht van alle regels per
              jurisdictielaag, de regeldruk en eventuele conflicten.
            </li>
          </ol>

          <h2 className="text-2xl font-bold mt-8 mb-4 border-b border-gray-200 pb-2">4. Q-Triad</h2>
          <p>
            Elke regel kan worden geclassificeerd op het type frictie dat het adresseert:
          </p>
          <ul className="list-disc pl-6 mt-2">
            <li><strong>Mens×Mens:</strong> Frictie tussen mensen. Communicatie, samenwerking, conflicten.</li>
            <li><strong>Mens×Systeem:</strong> Frictie tussen mens en technologie of proces. Gebruiksvriendelijkheid,
            compliance-last, informatieoverdracht.</li>
            <li><strong>Systeem×Systeem:</strong> Frictie tussen systemen onderling. Interoperabiliteit, dataformaten,
            protocol-incompatibiliteit.</li>
          </ul>

          <h2 className="text-2xl font-bold mt-8 mb-4 border-b border-gray-200 pb-2">5. Kernbegrippen</h2>
          <table className="w-full text-sm mt-3 mb-3 border-collapse">
            <tbody>
              <tr className="border-b border-gray-100">
                <td className="py-2 pr-4 font-bold align-top w-40">Paontologie</td>
                <td className="py-2">Kruising van Merleau-Ponty (het lichaam als kennis) en Tao (de weg, de stroom).
                Organisaties als vliegwielen die op elkaar inwerken.</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-2 pr-4 font-bold align-top">Mandaat</td>
                <td className="py-2">Begrensde autorisatie met scope, vervaltijd en risicotolerantie. Relationeel,
                niet hiërarchisch. Geen mandaat betekent geen actie.</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-2 pr-4 font-bold align-top">Silent Violence</td>
                <td className="py-2">Onzichtbare schade die ontstaat wanneer systemen niet op elkaar zijn afgestemd.
                Niemand benoemt het, maar iedereen voelt het.</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-2 pr-4 font-bold align-top">Provenance</td>
                <td className="py-2">Herkomstgegevens bij elke regel en beslissing: bron, artikel, citaat, URL.
                Elke beslissing is herleidbaar.</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-2 pr-4 font-bold align-top">Regeldruk</td>
                <td className="py-2">De optelsom van alle regelgewichten in een scope. Hogere lagen en zwaardere
                acties wegen meer. BLOCK levert oneindige regeldruk.</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-2 pr-4 font-bold align-top">Preflight</td>
                <td className="py-2">Validatie voordat een scope vergrendeld wordt. Controleert of alle regels
                een bron hebben en of escalatiepaden zijn gedefinieerd.</td>
              </tr>
            </tbody>
          </table>

          <h2 className="text-2xl font-bold mt-8 mb-4 border-b border-gray-200 pb-2">6. Ontwerpprincipes</h2>
          <ul className="list-disc pl-6 mt-2">
            <li>Het systeem observeert en classificeert. De mens autoriseert en beslist.</li>
            <li>BLOCK is absoluut. Geen escalatie, geen uitzondering, geen override.</li>
            <li>Hogere jurisdictie wint bij conflict tussen lagen.</li>
            <li>Elke regel moet traceerbaar zijn naar een verifieerbare bron.</li>
            <li>Het spanningsveld tussen TaoGate (snelheid, trefwoorden) en Olympia (diepte, jurisdictie)
            dwingt bewustzijn af. Hoe dieper u kijkt, hoe scherper het inzicht.</li>
            <li>Zonder scope is er geen classificatie. Het systeem doet niets zonder organisatorische context.</li>
          </ul>

        </div>

        <div className="mt-16 pt-8 border-t border-gray-200 text-sm text-gray-500 flex justify-between">
          <span>ORFHEUSS Leeswijzer v2.0</span>
          <span>PRSYS Governance Console</span>
        </div>
      </div>
    </div>
  );
}
