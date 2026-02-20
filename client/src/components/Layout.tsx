import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Eye, Activity, ShieldAlert, Menu, X, Info, BookOpen, Layers, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { name: "ARGOS (TaoGate)", path: "/", icon: Eye },
    { name: "INGEST", path: "/ingest", icon: Search },
    { name: "SCOPES", path: "/scopes", icon: Layers },
    { name: "OLYMPIA (Decathlon)", path: "/olympia", icon: Activity },
    { name: "LEXICON", path: "/lexicon", icon: BookOpen },
    { name: "PROTOCOL", path: "/manual", icon: Info },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/20">
      <div 
        className="fixed inset-0 z-0 opacity-10 pointer-events-none mix-blend-screen"
        style={{
          backgroundImage: `url(/assets/resonance-bg.png)`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      />
      
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-md h-16 flex items-center px-4 md:px-6 justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center border border-primary/20">
            <ShieldAlert className="w-5 h-5 text-primary" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-mono font-bold tracking-tight text-lg">ORFHEUSS <span className="text-muted-foreground font-normal">| CONSOLE</span></span>
            <span className="text-[9px] font-mono text-muted-foreground/60 tracking-widest">PRSYS — Paontologisch Resonantie Systeem</span>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <Link key={item.path} href={item.path} className={cn(
              "px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2",
              location === item.path 
                ? "bg-primary/10 text-primary border border-primary/20" 
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}>
              <item.icon className="w-4 h-4" />
              {item.name}
            </Link>
          ))}
        </nav>

        <Button 
          variant="ghost" 
          size="icon" 
          className="md:hidden"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>

        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/30 border border-white/5">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-mono text-muted-foreground">SYSTEM: NOMINAL</span>
        </div>
      </header>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-background/95 backdrop-blur-sm md:hidden pt-20 px-6">
          <nav className="flex flex-col gap-2">
            {navItems.map((item) => (
              <Link 
                key={item.path} 
                href={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "px-4 py-3 rounded-md text-base font-medium transition-colors flex items-center gap-3",
                  location === item.path 
                    ? "bg-primary/10 text-primary border border-primary/20" 
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </Link>
            ))}
          </nav>
        </div>
      )}

      <main className="relative z-10 pt-24 pb-12 px-4 md:px-6 max-w-7xl mx-auto">
        {children}
      </main>
    </div>
  );
}
