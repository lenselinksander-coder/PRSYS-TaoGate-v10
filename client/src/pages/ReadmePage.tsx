import { useRef } from "react";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { Download, Printer, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";

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
    
    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
    pdf.save("ORFHEUSS_Leesmij.pdf");
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-4xl mx-auto pb-12">
      {/* Controls - Hidden when printing */}
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

      {/* Printable Content */}
      <div ref={contentRef} className="bg-white text-black p-12 shadow-sm rounded-none min-h-[297mm] print:shadow-none print:p-0">
        
        {/* Header */}
        <div className="border-b-4 border-black pb-6 mb-8">
          <h1 className="text-4xl font-bold uppercase tracking-tight mb-2">ORFHEUSS</h1>
          <p className="text-xl font-mono text-gray-600">De Leeswijzer (Jip en Janneke Editie)</p>
        </div>

        {/* Introduction */}
        <div className="prose prose-lg max-w-none text-gray-800">
          <p className="lead text-xl font-medium mb-6">
            Hoi! Je kijkt nu naar een heel slim systeem. Het heet ORFHEUSS.
            Het klinkt moeilijk, maar het werkt eigenlijk heel simpel.
          </p>

          <h2 className="text-2xl font-bold mt-8 mb-4 border-b border-gray-200 pb-2">1. Waarom hebben we dit?</h2>
          <p>
            Stel je voor: je hebt een hele snelle auto (dat is de organisatie).
            Als je alleen maar gas geeft, vlieg je uit de bocht.
            Je hebt ook remmen en een stuur nodig.
          </p>
          <p>
            Dit systeem is het dashboard van die auto. Het laat zien:
            <ul className="list-disc pl-6 mt-2">
              <li>Hoe hard je gaat.</li>
              <li>Of de auto het nog houdt.</li>
              <li>Wanneer je moet remmen.</li>
            </ul>
          </p>

          <h2 className="text-2xl font-bold mt-8 mb-4 border-b border-gray-200 pb-2">2. De Poortwachter (ARGOS)</h2>
          <p>
            Er is een onderdeel dat <strong>ARGOS</strong> heet. Denk aan een portier bij een club.
            Hij kijkt wie er naar binnen mag en wie niet.
          </p>
          <div className="bg-gray-100 p-4 rounded-lg my-4 border-l-4 border-black">
            <p className="font-bold mb-2">De Regels van de Portier:</p>
            <ul className="list-disc pl-6">
              <li><strong>Kijken mag (Observatie):</strong> "Hé, het regent buiten." → <span className="text-green-600 font-bold">GROEN LICHT</span>.</li>
              <li><strong>Doen mag niet zomaar (Interventie):</strong> "Iedereen naar binnen!" → <span className="text-red-600 font-bold">ROOD LICHT</span>.</li>
            </ul>
          </div>
          <p>
            Je mag alleen commanderen als je daar toestemming (mandaat) voor hebt. Anders zegt de portier: "Nee."
          </p>

          <h2 className="text-2xl font-bold mt-8 mb-4 border-b border-gray-200 pb-2">3. De Snelheidsmeter (OLYMPIA)</h2>
          <p>
            Dan is er nog <strong>OLYMPIA</strong>. Dat is de snelheidsmeter.
            Organisaties doen soms aan topsport. Hier zie je welke sport we aan het doen zijn.
          </p>
          
          <div className="grid grid-cols-2 gap-6 my-6">
            <div className="border border-gray-300 p-4 rounded">
              <h3 className="font-bold text-lg mb-2">De Sprint 🏃💨</h3>
              <p>Heel hard rennen. Je bent super snel, maar je wordt ook heel snel moe. Dit kun je niet de hele dag doen.</p>
            </div>
            <div className="border border-gray-300 p-4 rounded">
              <h3 className="font-bold text-lg mb-2">De Marathon 🏃...🏃</h3>
              <p>Rustig rennen, maar heel lang. Je wordt niet snel moe. Dit kun je wel de hele dag doen.</p>
            </div>
          </div>

          <p>
            Als de meter zegt dat je aan het <strong>Sprinten</strong> bent, maar je denkt dat je een <strong>Marathon</strong> loopt... dan gaat het mis. Dan krijg je blessures (burn-out, fouten).
          </p>

          <h2 className="text-2xl font-bold mt-8 mb-4 border-b border-gray-200 pb-2">4. Samenvatting</h2>
          <p className="font-medium">
            ORFHEUSS is er niet om je te plagen. Het is er om te zorgen dat we niet crashen.
            Het beschermt de mensen tegen te hard werken zonder rust.
          </p>

        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-gray-200 text-sm text-gray-500 flex justify-between">
          <span>ORFHEUSS Manifest v1.0</span>
          <span>Jip en Janneke Editie</span>
        </div>
      </div>
    </div>
  );
}
