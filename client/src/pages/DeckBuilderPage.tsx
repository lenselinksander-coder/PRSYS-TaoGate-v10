// client/src/pages/DeckBuilderPage.tsx
//
// Tape Deck Builder — toewijzen van LOCKED scopes als tape-scopes (met tapeNumber)
// voor een organisatie.
//
// Workflow:
//   1. Selecteer een organisatie.
//   2. Bekijk de scope-bibliotheek (alleen LOCKED scopes).
//   3. Wijs een tapeNumber toe (0 = Tape 0, verplicht EU-fundament).
//   4. Sla op via PATCH /api/scopes/:id.

import { useState, useEffect } from "react";
import { Layers, Building2, Hash, Save, Shield, CheckCircle, AlertTriangle, Info, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Scope, Organization } from "@shared/schema";

// ── Types ────────────────────────────────────────────────────────────────────

interface TapeAssignment {
  scopeId: string;
  tapeNumber: number | null;
  isTapeScope: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function DecisionBadge({ decision }: { decision: string }) {
  const config: Record<string, { variant: "secondary" | "destructive" | "outline"; label: string }> = {
    PASS: { variant: "secondary", label: "PASS" },
    PASS_WITH_TRANSPARENCY: { variant: "outline", label: "PASS+T" },
    ESCALATE_HUMAN: { variant: "outline", label: "ESC-H" },
    ESCALATE_REGULATORY: { variant: "outline", label: "ESC-R" },
    BLOCK: { variant: "destructive", label: "BLOCK" },
  };
  const c = config[decision] ?? { variant: "outline" as const, label: decision };
  return <Badge variant={c.variant}>{c.label}</Badge>;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DeckBuilderPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [scopes, setScopes] = useState<Scope[]>([]);
  const [assignments, setAssignments] = useState<Map<string, TapeAssignment>>(new Map());
  const [saving, setSaving] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  // Laad organisaties
  useEffect(() => {
    fetch("/api/organizations")
      .then(r => r.json())
      .then((data: Organization[]) => setOrganizations(data))
      .catch(() => setOrganizations([]));
  }, []);

  // Laad scopes bij org-selectie
  useEffect(() => {
    if (!selectedOrgId) { setScopes([]); return; }
    fetch(`/api/scopes?orgId=${encodeURIComponent(selectedOrgId)}`)
      .then(r => r.json())
      .then((data: Scope[]) => {
        const locked = data.filter((s: Scope) => s.status === "LOCKED");
        setScopes(locked);
        // Initialiseer assignments vanuit bestaande DB-waarden
        const map = new Map<string, TapeAssignment>();
        for (const s of locked) {
          map.set(s.id, {
            scopeId: s.id,
            tapeNumber: s.tapeNumber ?? null,
            isTapeScope: s.isTapeScope ?? false,
          });
        }
        setAssignments(map);
      })
      .catch(() => setScopes([]));
  }, [selectedOrgId]);

  function setTapeNumber(scopeId: string, value: string) {
    const num = value === "" ? null : parseInt(value, 10);
    setAssignments(prev => {
      const next = new Map(prev);
      const existing = next.get(scopeId) ?? { scopeId, tapeNumber: null, isTapeScope: false };
      next.set(scopeId, { ...existing, tapeNumber: num, isTapeScope: num !== null });
      return next;
    });
  }

  function toggleTapeScope(scopeId: string) {
    setAssignments(prev => {
      const next = new Map(prev);
      const existing = next.get(scopeId) ?? { scopeId, tapeNumber: null, isTapeScope: false };
      const willBeActive = !existing.isTapeScope;
      next.set(scopeId, {
        ...existing,
        isTapeScope: willBeActive,
        tapeNumber: willBeActive ? (existing.tapeNumber ?? 1) : null,
      });
      return next;
    });
  }

  // Valideer: Tape 0 moet aanwezig zijn als er tapes actief zijn
  function validate(): string | null {
    const active = Array.from(assignments.values()).filter(a => a.isTapeScope);
    if (active.length === 0) return null;
    const hasTape0 = active.some(a => a.tapeNumber === 0);
    if (!hasTape0) return "Tape 0 is verplicht als EU-fundament. Wijs tapeNumber=0 toe aan een scope.";
    const nums = active.map(a => a.tapeNumber).filter(n => n !== null) as number[];
    const dupes = nums.filter((n, i) => nums.indexOf(n) !== i);
    if (dupes.length > 0) return `Dubbele tapeNummers: ${[...new Set(dupes)].join(", ")}. Elk tapeNumber moet uniek zijn.`;
    return null;
  }

  async function saveAssignment(scopeId: string) {
    const assignment = assignments.get(scopeId);
    if (!assignment) return;
    const validationError = validate();
    if (validationError) { setStatus(validationError); return; }
    setSaving(scopeId);
    setStatus(null);
    try {
      const res = await fetch(`/api/scopes/${scopeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tapeNumber: assignment.tapeNumber,
          isTapeScope: assignment.isTapeScope,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setStatus(`Opslaan mislukt: ${err.error ?? res.statusText}`);
      } else {
        setStatus(`Tape-instelling opgeslagen voor scope.`);
      }
    } catch (e: any) {
      setStatus(`Fout: ${e.message}`);
    } finally {
      setSaving(null);
    }
  }

  const validationError = validate();

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <Layers className="w-6 h-6 text-indigo-400" />
        <h1 className="text-2xl font-bold text-white">Tape Deck Builder</h1>
      </div>
      <p className="text-zinc-400 text-sm">
        Wijs LOCKED scopes toe als tape-scope. Tape 0 is het EU-rechtsfundament (verplicht).
        Hogere tapes voegen institutionele regels toe. Laagorde: EU &gt; NATIONAL &gt; REGIONAL &gt; MUNICIPAL.
      </p>

      {/* Org selectie */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-zinc-300 flex items-center gap-2">
            <Building2 className="w-4 h-4" /> Organisatie selecteren
          </CardTitle>
        </CardHeader>
        <CardContent>
          <select
            className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-md px-3 py-2 text-sm"
            value={selectedOrgId}
            onChange={e => setSelectedOrgId(e.target.value)}
          >
            <option value="">-- Kies een organisatie --</option>
            {organizations.map(org => (
              <option key={org.id} value={org.id}>{org.name} ({org.sector})</option>
            ))}
          </select>
        </CardContent>
      </Card>

      {/* Validatiefout */}
      {validationError && (
        <div className="flex items-center gap-2 text-amber-400 text-sm bg-amber-900/20 border border-amber-700 rounded-lg px-4 py-3">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {validationError}
        </div>
      )}

      {/* Status */}
      {status && !validationError && (
        <div className="flex items-center gap-2 text-zinc-300 text-sm bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3">
          <Info className="w-4 h-4" />
          {status}
        </div>
      )}

      {/* Scope-bibliotheek */}
      {selectedOrgId && scopes.length === 0 && (
        <p className="text-zinc-500 text-sm">Geen LOCKED scopes gevonden voor deze organisatie.</p>
      )}

      {scopes.map(scope => {
        const assignment = assignments.get(scope.id) ?? { scopeId: scope.id, tapeNumber: null, isTapeScope: false };
        const isActive = assignment.isTapeScope;
        const isT0 = assignment.tapeNumber === 0;

        return (
          <Card
            key={scope.id}
            className={`border transition-colors ${isActive ? "bg-zinc-900 border-indigo-700" : "bg-zinc-950 border-zinc-800"}`}
          >
            <CardContent className="pt-4">
              <div className="flex items-start gap-4">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <Lock className="w-3.5 h-3.5 text-zinc-500" />
                    <span className="font-medium text-white text-sm">{scope.name}</span>
                    {isT0 && <Badge variant="outline" className="text-indigo-400 border-indigo-500 text-xs">Tape 0 — EU Fundament</Badge>}
                  </div>
                  {scope.description && (
                    <p className="text-zinc-500 text-xs">{scope.description}</p>
                  )}
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(scope.categories ?? []).slice(0, 4).map((cat: any, i: number) => (
                      <DecisionBadge key={i} decision={cat.status} />
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* TapeNumber invoer */}
                  <div className="flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5 text-zinc-500" />
                    <Input
                      type="number"
                      min={0}
                      max={9}
                      placeholder="–"
                      className="w-16 h-8 text-sm bg-zinc-800 border-zinc-700 text-center"
                      value={assignment.tapeNumber ?? ""}
                      onChange={e => setTapeNumber(scope.id, e.target.value)}
                    />
                  </div>

                  {/* Tape-scope toggle */}
                  <Button
                    variant={isActive ? "default" : "outline"}
                    size="sm"
                    className={isActive ? "bg-indigo-600 hover:bg-indigo-700" : ""}
                    onClick={() => toggleTapeScope(scope.id)}
                  >
                    {isActive ? <CheckCircle className="w-3.5 h-3.5 mr-1" /> : <Shield className="w-3.5 h-3.5 mr-1" />}
                    {isActive ? "Actief" : "Inactief"}
                  </Button>

                  {/* Opslaan */}
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={saving === scope.id || !!validationError}
                    onClick={() => saveAssignment(scope.id)}
                  >
                    <Save className="w-3.5 h-3.5 mr-1" />
                    {saving === scope.id ? "Opslaan..." : "Opslaan"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
