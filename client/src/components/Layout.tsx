import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Eye, ShieldAlert, Menu, X, Building2, Plug, FileInput, ScrollText, LayoutDashboard, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [systemInfo, setSystemInfo] = useState<any>(null);

  useEffect(() => {
    fetch("/api/system/info").then(r => r.json()).then(setSystemInfo).catch(() => {});
  }, []);

  const navItems = [
    { name: "Dashboard", path: "/admin", icon: LayoutDashboard },
    { name: "Organisaties", path: "/admin/organizations", icon: Building2 },
    { name: "ARGOS", path: "/admin/triage", icon: Eye },
    { name: "Import", path: "/admin/import", icon: FileInput },
    { name: "Connectors", path: "/admin/connectors", icon: Plug },
    { name: "Gateway Logs", path: "/admin/gateway-logs", icon: ScrollText },
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
        <Link to="/admin" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
          <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center border border-primary/20">
            <ShieldAlert className="w-5 h-5 text-primary" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-mono font-bold tracking-tight text-lg">ORFHEUSS <span className="text-muted-foreground font-normal">| ADMIN</span></span>
            <span className="text-[9px] font-mono text-muted-foreground/60 tracking-widest">BEHEER CONSOLE v2.0</span>
          </div>
        </Link>

        <nav className="hidden lg:flex items-center gap-0.5 overflow-x-auto">
          {navItems.map((item) => (
            <Link key={item.path} to={item.path} className={cn(
              "px-3 py-2 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap",
              location.pathname === item.path 
                ? "bg-primary/10 text-primary border border-primary/20" 
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}>
              <item.icon className="w-3.5 h-3.5" />
              {item.name}
            </Link>
          ))}
          <Link to="/" className={cn(
            "px-3 py-2 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ml-2 border border-primary/20 text-primary hover:bg-primary/10"
          )}>
            <Monitor className="w-3.5 h-3.5" />
            CVI Voorkant
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/30 border border-white/5">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-mono text-muted-foreground">
              {systemInfo ? `${systemInfo.organizations} ORG · ${systemInfo.scopes} SCOPE` : "LOADING..."}
            </span>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="lg:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
      </header>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-background/95 backdrop-blur-sm lg:hidden pt-20 px-6">
          <nav className="flex flex-col gap-2">
            {navItems.map((item) => (
              <Link 
                key={item.path} 
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "px-4 py-3 rounded-md text-base font-medium transition-colors flex items-center gap-3",
                  location.pathname === item.path 
                    ? "bg-primary/10 text-primary border border-primary/20" 
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </Link>
            ))}
            <Link 
              to="/"
              onClick={() => setMobileMenuOpen(false)}
              className="px-4 py-3 rounded-md text-base font-medium transition-colors flex items-center gap-3 mt-4 border border-primary/20 text-primary hover:bg-primary/10"
            >
              <Monitor className="w-5 h-5" />
              CVI Voorkant
            </Link>
          </nav>
        </div>
      )}

      <main className="relative z-10 pt-24 pb-12 px-4 md:px-6 max-w-7xl mx-auto">
        {children}
      </main>
    </div>
  );
}
