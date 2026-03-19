import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
} from "@/components/ui/command";
import {
  LayoutDashboard,
  Building2,
  Eye,
  Layers,
  Map,
  FileInput,
  Plug,
  Activity,
  ScrollText,
  Zap,
  Monitor,
  Keyboard,
} from "lucide-react";

const NAV_ITEMS = [
  { name: "Dashboard", path: "/admin", icon: LayoutDashboard, shortcut: "G D" },
  { name: "Organisaties", path: "/admin/organizations", icon: Building2, shortcut: "G O" },
  { name: "ARGOS (Triage)", path: "/admin/triage", icon: Eye, shortcut: "G A" },
  { name: "Scopes", path: "/admin/scopes", icon: Layers, shortcut: "G S" },
  { name: "Castra", path: "/admin/castra", icon: Map, shortcut: "G C" },
  { name: "Import", path: "/admin/import", icon: FileInput, shortcut: "G I" },
  { name: "Connectors", path: "/admin/connectors", icon: Plug, shortcut: "G N" },
  { name: "OLYMPIA", path: "/admin/olympia", icon: Activity, shortcut: "G Y" },
  { name: "Gateway Logs", path: "/admin/gateway-logs", icon: ScrollText, shortcut: "G L" },
  { name: "Ingest", path: "/admin/ingest", icon: Zap, shortcut: "G Z" },
  { name: "CVI Voorkant", path: "/", icon: Monitor, shortcut: "G V" },
];

const GO_KEY_MAP: Record<string, string> = {};
NAV_ITEMS.forEach(item => {
  const key = item.shortcut.split(" ")[1]?.toLowerCase();
  if (key) GO_KEY_MAP[key] = item.path;
});

export function useGlobalShortcuts() {
  const navigate = useNavigate();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [goMode, setGoMode] = useState(false);
  const goTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const goModeRef = useRef(false);

  useEffect(() => {
    goModeRef.current = goMode;
  }, [goMode]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen(prev => !prev);
        return;
      }

      if (e.key === "?" && !isInput && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setHelpOpen(prev => !prev);
        return;
      }

      if (e.key === "Escape") {
        setHelpOpen(false);
        return;
      }

      if (isInput) return;

      if (goModeRef.current) {
        const path = GO_KEY_MAP[e.key.toLowerCase()];
        if (path) {
          e.preventDefault();
          navigate(path);
        }
        setGoMode(false);
        if (goTimerRef.current) clearTimeout(goTimerRef.current);
        goTimerRef.current = null;
        return;
      }

      if (e.key === "g" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        setGoMode(true);
        if (goTimerRef.current) clearTimeout(goTimerRef.current);
        goTimerRef.current = setTimeout(() => setGoMode(false), 1500);
        return;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate]);

  return { paletteOpen, setPaletteOpen, helpOpen, setHelpOpen, goMode };
}

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();

  const runAction = useCallback(
    (path: string) => {
      onOpenChange(false);
      navigate(path);
    },
    [navigate, onOpenChange]
  );

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Zoek module of actie..." data-testid="input-command-palette" />
      <CommandList>
        <CommandEmpty>Geen resultaten gevonden.</CommandEmpty>
        <CommandGroup heading="Navigatie">
          {NAV_ITEMS.map(item => (
            <CommandItem
              key={item.path}
              onSelect={() => runAction(item.path)}
              data-testid={`cmd-nav-${item.name.toLowerCase().replace(/[\s()]/g, '-')}`}
            >
              <item.icon className="mr-2 h-4 w-4" />
              <span>{item.name}</span>
              <CommandShortcut>{item.shortcut}</CommandShortcut>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Acties">
          <CommandItem onSelect={() => { onOpenChange(false); navigate("/admin/triage"); }}>
            <Eye className="mr-2 h-4 w-4" />
            <span>Nieuwe analyse starten</span>
            <CommandShortcut>G A</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => { onOpenChange(false); navigate("/admin/import"); }}>
            <FileInput className="mr-2 h-4 w-4" />
            <span>Dataset importeren</span>
            <CommandShortcut>G I</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

const ALL_SHORTCUTS = [
  { keys: "⌘K / Ctrl+K", desc: "Command palette openen" },
  { keys: "?", desc: "Sneltoetsen weergeven" },
  { keys: "G → D", desc: "Ga naar Dashboard" },
  { keys: "G → A", desc: "Ga naar ARGOS (Triage)" },
  { keys: "G → S", desc: "Ga naar Scopes" },
  { keys: "G → O", desc: "Ga naar Organisaties" },
  { keys: "G → I", desc: "Ga naar Import" },
  { keys: "G → N", desc: "Ga naar Connectors" },
  { keys: "G → Y", desc: "Ga naar OLYMPIA" },
  { keys: "G → L", desc: "Ga naar Gateway Logs" },
  { keys: "G → C", desc: "Ga naar Castra" },
  { keys: "G → Z", desc: "Ga naar Ingest" },
  { keys: "G → V", desc: "Ga naar CVI Voorkant" },
  { keys: "Esc", desc: "Dialoog sluiten" },
  { keys: "⌘Enter / Ctrl+Enter", desc: "Analyseer (op Triage-pagina)" },
  { keys: "⌘S / Ctrl+S", desc: "Opslaan (op Scopes-pagina)" },
];

export function ShortcutHelp({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
      data-testid="dialog-shortcut-help"
    >
      <div
        className="bg-card border border-primary/30 rounded-lg p-6 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
        style={{ boxShadow: "0 0 24px rgba(0,255,65,0.15)" }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Keyboard className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold font-mono text-primary">Sneltoetsen</h2>
        </div>
        <div className="space-y-1">
          {ALL_SHORTCUTS.map(s => (
            <div key={s.keys} className="flex items-center justify-between py-1.5 border-b border-border/20 last:border-0">
              <span className="text-sm text-muted-foreground">{s.desc}</span>
              <kbd className="font-mono text-xs px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 whitespace-nowrap">
                {s.keys}
              </kbd>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-4 text-center">
          Druk <kbd className="font-mono px-1 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">Esc</kbd> om te sluiten
        </p>
      </div>
    </div>
  );
}

export function GoModeIndicator({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[90] px-4 py-2 rounded-lg bg-primary/20 border border-primary/40 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2 duration-200">
      <span className="text-sm font-mono text-primary">
        G → wacht op toets...
      </span>
    </div>
  );
}
