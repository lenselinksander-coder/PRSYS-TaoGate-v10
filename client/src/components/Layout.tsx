import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Eye, ShieldAlert, Menu, X, Building2, Plug, FileInput, ScrollText, LayoutDashboard, Monitor, Activity, Zap, Layers, Map, Keyboard, Triangle, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useGlobalShortcuts, CommandPalette, ShortcutHelp, GoModeIndicator } from "@/components/CommandPalette";

type NavItem = { name: string; path: string; icon: any };

const navSections: { label: string; items: NavItem[] }[] = [
  {
    label: "BEHEER",
    items: [
      { name: "Dashboard", path: "/admin", icon: LayoutDashboard },
      { name: "Organisaties", path: "/admin/organizations", icon: Building2 },
      { name: "Scopes", path: "/admin/scopes", icon: Layers },
      { name: "Register", path: "/admin/algoritmeregister", icon: BookOpen },
    ],
  },
  {
    label: "DATA",
    items: [
      { name: "Import", path: "/admin/import", icon: FileInput },
      { name: "Ingest", path: "/admin/ingest", icon: Zap },
      { name: "Connectors", path: "/admin/connectors", icon: Plug },
    ],
  },
  {
    label: "BEWAKING",
    items: [
      { name: "ARGOS", path: "/admin/triage", icon: Eye },
      { name: "Gateway Logs", path: "/admin/gateway-logs", icon: ScrollText },
      { name: "Vectoren", path: "/admin/vector", icon: Triangle },
    ],
  },
  {
    label: "SYSTEEM",
    items: [
      { name: "Castra", path: "/admin/castra", icon: Map },
      { name: "OLYMPIA", path: "/admin/olympia", icon: Activity },
    ],
  },
  {
    label: "INTERFACE",
    items: [
      { name: "CVI Voorkant", path: "/", icon: Monitor },
    ],
  },
];

const allNavItems = navSections.flatMap(s => s.items);

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [systemInfo, setSystemInfo] = useState<any>(null);
  const { paletteOpen, setPaletteOpen, helpOpen, setHelpOpen, goMode } = useGlobalShortcuts();

  useEffect(() => {
    fetch("/api/system/info").then(r => r.json()).then(setSystemInfo).catch(() => {});
  }, []);

  const isActive = (path: string) =>
    path === "/admin" ? location.pathname === "/admin" : location.pathname === path;

  return (
    <div className="min-h-screen font-mono" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      <header
        className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center px-4 md:px-6 justify-between"
        style={{
          background: "var(--bg-surface)",
          borderBottom: "1px solid var(--sr71-border)",
          boxShadow: "0 1px 0 rgba(212,160,23,0.06), 0 4px 24px rgba(0,0,0,0.6)",
        }}
      >
        <Link to="/admin" className="flex items-center gap-3 hover:opacity-90 transition-opacity" data-testid="link-admin-home">
          <div
            className="w-8 h-8 flex items-center justify-center"
            style={{ border: "1px solid var(--amber-dim)", boxShadow: "0 0 6px var(--amber-glow)" }}
          >
            <ShieldAlert className="w-5 h-5" style={{ color: "var(--amber)" }} />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-bold tracking-tight text-lg" style={{ color: "var(--text-primary)" }}>
              ORFHEUSS <span className="font-normal text-sm" style={{
                color: "var(--text-secondary)",
                border: "1px solid var(--sr71-border)",
                padding: "1px 6px",
                marginLeft: "6px",
                fontSize: "0.65rem",
                letterSpacing: "0.08em",
              }}>ADMIN</span>
            </span>
            <span className="text-[9px] tracking-[0.3em]" style={{ color: "var(--text-muted)" }}>
              BEHEER CONSOLE v2.0
            </span>
          </div>
        </Link>

        <nav className="hidden lg:flex items-center gap-0.5 overflow-x-auto">
          {navSections.map((section, si) => (
            <div key={section.label} className="flex items-center">
              {si > 0 && (
                <div className="w-px h-5 mx-1" style={{ background: "var(--sr71-border)" }} />
              )}
              {section.items.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  data-testid={`link-nav-${item.name.toLowerCase().replace(/\s+/g, "-")}`}
                  className="px-2.5 py-1.5 text-xs font-mono font-medium transition-all flex items-center gap-1.5 whitespace-nowrap"
                  style={isActive(item.path) ? {
                    color: "var(--amber)",
                    borderBottom: "2px solid var(--amber)",
                    background: "var(--amber-glow)",
                  } : {
                    color: "var(--text-secondary)",
                    borderBottom: "2px solid transparent",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive(item.path)) {
                      e.currentTarget.style.color = "var(--text-primary)";
                      e.currentTarget.style.background = "var(--bg-elevated)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive(item.path)) {
                      e.currentTarget.style.color = "var(--text-secondary)";
                      e.currentTarget.style.background = "transparent";
                    }
                  }}
                >
                  <item.icon className="w-3.5 h-3.5" />
                  {item.name}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setPaletteOpen(true)}
            data-testid="button-command-palette"
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 cursor-pointer transition-all"
            style={{
              background: "var(--bg-primary)",
              border: "1px solid var(--sr71-border)",
              color: "var(--text-secondary)",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--amber-dim)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--sr71-border)"; }}
          >
            <span className="text-xs font-mono">Zoek</span>
            <kbd className="text-[10px] font-mono px-1.5 py-0.5" style={{
              background: "var(--amber-glow)",
              color: "var(--amber-dim)",
              border: "1px solid var(--sr71-border)",
            }}>⌘K</kbd>
          </button>
          <button
            onClick={() => setHelpOpen(true)}
            data-testid="button-shortcut-help"
            className="hidden md:flex items-center justify-center w-8 h-8 cursor-pointer transition-all"
            style={{
              border: "1px solid var(--sr71-border)",
              background: "var(--bg-primary)",
              color: "var(--text-secondary)",
            }}
            title="Sneltoetsen (?)"
          >
            <Keyboard className="w-3.5 h-3.5" />
          </button>
          <div
            className="hidden md:flex items-center gap-2 px-3 py-1.5"
            style={{
              border: "1px solid var(--amber-dim)",
              background: "var(--bg-primary)",
            }}
          >
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--amber)" }} />
            <span className="text-xs font-mono" style={{ color: "var(--amber)" }}>
              {systemInfo
                ? `${systemInfo.organizations} ORG · ${systemInfo.scopes} SCOPE`
                : "CONNECTING..."}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            style={{ border: "1px solid var(--sr71-border)", color: "var(--text-primary)" }}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
      </header>

      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden pt-16 overflow-y-auto"
          style={{ background: "rgba(13,13,15,0.98)", backdropFilter: "blur(4px)" }}
        >
          <nav className="flex flex-col py-4">
            {navSections.map((section, si) => (
              <div key={section.label}>
                {si > 0 && <div className="mx-4 my-1" style={{ borderTop: "1px solid var(--sr71-border)" }} />}
                <span
                  className="block px-4 pt-4 pb-1 text-[0.65rem] font-mono uppercase"
                  style={{ color: "var(--amber-dim)", letterSpacing: "0.12em" }}
                >
                  {section.label}
                </span>
                {section.items.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    data-testid={`link-mobile-${item.name.toLowerCase().replace(/\s+/g, "-")}`}
                    className="px-4 py-3 text-base font-mono font-medium transition-all flex items-center gap-3"
                    style={isActive(item.path) ? {
                      color: "var(--amber)",
                      borderLeft: "2px solid var(--amber)",
                      paddingLeft: "14px",
                      background: "var(--amber-glow)",
                    } : {
                      color: "var(--text-primary)",
                      borderLeft: "2px solid transparent",
                    }}
                  >
                    <item.icon className="w-5 h-5" style={isActive(item.path) ? {} : { color: "var(--text-secondary)" }} />
                    {item.name}
                  </Link>
                ))}
              </div>
            ))}
          </nav>
        </div>
      )}

      <main className="relative z-10 pt-20 pb-12 px-4 md:px-6 max-w-7xl mx-auto">
        {children}
      </main>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <ShortcutHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
      <GoModeIndicator active={goMode} />
    </div>
  );
}
