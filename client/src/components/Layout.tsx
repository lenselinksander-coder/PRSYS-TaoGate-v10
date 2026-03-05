import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Eye, ShieldAlert, Menu, X, Building2, Plug, FileInput, ScrollText, LayoutDashboard, Monitor, Map } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { MatrixRain } from "@/components/MatrixRain";

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
    { name: "Castra", path: "/admin/castra", icon: Map },
    { name: "Import", path: "/admin/import", icon: FileInput },
    { name: "Connectors", path: "/admin/connectors", icon: Plug },
    { name: "Gateway Logs", path: "/admin/gateway-logs", icon: ScrollText },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground font-mono selection:bg-primary/20">
      {/* Matrix rain — fixed background layer */}
      <MatrixRain opacity={0.05} />

      {/* Header */}
      <header
        className="fixed top-0 left-0 right-0 z-50 border-b border-primary/30 bg-background/90 backdrop-blur-md h-16 flex items-center px-4 md:px-6 justify-between"
        style={{ boxShadow: "0 1px 0 rgba(0,255,65,0.20), 0 4px 24px rgba(0,0,0,0.8)" }}
      >
        <Link to="/admin" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
          <div
            className="w-8 h-8 flex items-center justify-center border border-primary/50"
            style={{ boxShadow: "0 0 8px #00ff41, inset 0 0 8px rgba(0,255,65,0.08)" }}
          >
            <ShieldAlert className="w-5 h-5 text-primary neon-text" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-mono font-bold tracking-tight text-lg text-primary neon-text">
              ORFHEUSS <span className="text-muted-foreground font-normal">| ADMIN</span>
            </span>
            <span className="text-[9px] font-mono tracking-[0.3em] neon-text text-primary/70">
              BEHEER CONSOLE v2.0
            </span>
          </div>
        </Link>

        <nav className="hidden lg:flex items-center gap-0.5 overflow-x-auto">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "px-3 py-2 text-xs font-mono font-medium transition-all flex items-center gap-1.5 whitespace-nowrap border",
                location.pathname === item.path
                  ? "border-primary/60 text-primary neon-text bg-primary/5"
                  : "border-transparent text-muted-foreground hover:text-primary hover:border-primary/30 hover:bg-primary/5",
              )}
            >
              <item.icon className="w-3.5 h-3.5" />
              {item.name}
            </Link>
          ))}
          <Link
            to="/"
            className="px-3 py-2 text-xs font-mono font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ml-2 border border-accent/40 neon-orange hover:bg-accent/10"
          >
            <Monitor className="w-3.5 h-3.5" />
            CVI Voorkant
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <div
            className="hidden md:flex items-center gap-2 px-3 py-1.5 border border-primary/20 bg-black/60"
            style={{ boxShadow: "0 0 6px rgba(0,255,65,0.12)" }}
          >
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse neon-text" />
            <span className="text-xs font-mono text-primary/70">
              {systemInfo
                ? `${systemInfo.organizations} ORG · ${systemInfo.scopes} SCOPE`
                : "CONNECTING..."}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden border border-primary/30 text-primary hover:bg-primary/10"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
      </header>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-black/97 backdrop-blur-sm lg:hidden pt-20 px-6 border border-primary/20">
          <nav className="flex flex-col gap-2">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "px-4 py-3 text-base font-mono font-medium transition-all flex items-center gap-3 border",
                  location.pathname === item.path
                    ? "border-primary/60 text-primary neon-text bg-primary/5"
                    : "border-transparent text-muted-foreground hover:text-primary hover:border-primary/30",
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </Link>
            ))}
            <Link
              to="/"
              onClick={() => setMobileMenuOpen(false)}
              className="px-4 py-3 text-base font-mono font-medium transition-all flex items-center gap-3 mt-4 border border-accent/40 neon-orange hover:bg-accent/10"
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
