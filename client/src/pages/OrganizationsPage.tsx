import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Plus, Trash2, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const SECTORS = [
  { value: "healthcare", label: "Gezondheidszorg" },
  { value: "finance", label: "Financieel" },
  { value: "education", label: "Onderwijs" },
  { value: "government", label: "Overheid" },
  { value: "technology", label: "Technologie" },
  { value: "legal", label: "Juridisch" },
  { value: "energy", label: "Energie" },
  { value: "transport", label: "Transport" },
  { value: "retail", label: "Retail" },
  { value: "manufacturing", label: "Productie" },
  { value: "other", label: "Overig" },
];

const GATE_PROFILES = [
  { value: "GENERAL", label: "Algemeen", desc: "Blokkeert destructieve imperatieven" },
  { value: "CLINICAL", label: "Klinisch", desc: "Blokkeert medicatie/procedures/triage" },
  { value: "FINANCIAL", label: "Financieel", desc: "Blokkeert fraude/witwas-indicaties" },
  { value: "LEGAL", label: "Juridisch", desc: "Blokkeert strafrechtelijke context" },
  { value: "EDUCATIONAL", label: "Educatief", desc: "Escaleert beoordelingen/toetsing" },
  { value: "CUSTOM", label: "Aangepast", desc: "Standaard filtering, uitbreidbaar" },
];

type Organization = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sector: string;
  gateProfile: string;
  createdAt: string;
};

type Scope = { id: string; name: string; status: string | null; orgId: string | null };

export default function OrganizationsPage() {
  const navigate = useNavigate();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", slug: "", description: "", sector: "other", gateProfile: "GENERAL" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scopes, setScopes] = useState<Scope[]>([]);
  const [mountingOrgId, setMountingOrgId] = useState<string | null>(null);
  const [orgActiveScopes, setOrgActiveScopes] = useState<Record<string, string>>({});

  const loadOrgs = () => {
    fetch("/api/organizations").then(r => r.json()).then((data: Organization[]) => {
      setOrgs(data);
      data.forEach(org => {
        fetch(`/api/organizations/${org.id}/active-scope`)
          .then(r => r.json())
          .then(({ scope }) => {
            if (scope) {
              setOrgActiveScopes(prev => ({ ...prev, [org.id]: scope.name }));
            }
          })
          .catch(() => {});
      });
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadOrgs();
    fetch("/api/scopes").then(r => r.json()).then((data: Scope[]) => setScopes(data)).catch(() => {});
  }, []);

  const handleCreate = async () => {
    setError(null);
    if (!form.name || !form.slug) { setError("Naam en slug zijn verplicht"); return; }
    setSaving(true);
    try {
      const r = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      // r.json() kan gooien als de server geen geldige JSON stuurt (bijv. HTML foutpagina in WebKit)
      let data: Record<string, unknown>;
      try {
        data = await r.json();
      } catch {
        throw new Error("Server stuurde een ongeldige respons — controleer de verbinding");
      }
      if (!r.ok) {
        // data.error is altijd een string via de server (of data.message voor Express-fouten)
        const msg = typeof data.error === "string"
          ? data.error
          : (data.message as string | undefined) ?? "Aanmaken mislukt";
        throw new Error(msg);
      }
      // Gate kan HTTP 202 sturen (ESCALATE/TGA4): r.ok maar geen DB-write
      if (data.status && data.status !== "PASS" && data.status !== "PASS_WITH_TRANSPARENCY") {
        throw new Error((data.reason as string | undefined) ?? "Aanmaken vereist aanvullende goedkeuring (gate)");
      }
      setShowForm(false);
      setForm({ name: "", slug: "", description: "", sector: "other", gateProfile: "GENERAL" });
      loadOrgs();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/organizations/${id}`, { method: "DELETE" });
    loadOrgs();
  };

  const slugify = (str: string) => str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 data-testid="text-page-title" className="text-2xl font-bold font-mono flex items-center gap-3">
            <Building2 className="w-6 h-6 text-blue-400" />
            Organisaties
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Elke organisatie krijgt eigen scopes, connectors en een gate-profiel</p>
        </div>
        <Button data-testid="button-add-org" onClick={() => setShowForm(!showForm)} size="sm">
          <Plus className="w-4 h-4 mr-1" /> Nieuwe Organisatie
        </Button>
      </div>

      {showForm && (
        <div className="mb-6 rounded-xl bg-card/50 border border-border/40 p-5">
          <h3 className="font-bold mb-4">Organisatie Aanmaken</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Naam</label>
              <Input
                data-testid="input-org-name"
                value={form.name}
                onChange={e => { setForm({ ...form, name: e.target.value, slug: slugify(e.target.value) }); }}
                placeholder="Bijv. Erasmus MC"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Slug (uniek)</label>
              <Input
                data-testid="input-org-slug"
                value={form.slug}
                onChange={e => setForm({ ...form, slug: e.target.value })}
                placeholder="bijv. erasmus-mc"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Beschrijving</label>
              <Input
                data-testid="input-org-description"
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Optioneel"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Sector</label>
              <select
                data-testid="select-org-sector"
                value={form.sector}
                onChange={e => setForm({ ...form, sector: e.target.value })}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                {SECTORS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-muted-foreground block mb-1">Gate-Profiel</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {GATE_PROFILES.map(gp => (
                  <button
                    key={gp.value}
                    data-testid={`button-gate-${gp.value.toLowerCase()}`}
                    onClick={() => setForm({ ...form, gateProfile: gp.value })}
                    className={`text-left p-3 rounded-lg border text-sm transition-all ${
                      form.gateProfile === gp.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border/40 hover:border-border"
                    }`}
                  >
                    <div className="font-medium">{gp.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{gp.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
          {error && <div className="mt-3 text-sm text-red-400">{error}</div>}
          <div className="mt-4 flex gap-2">
            <Button data-testid="button-save-org" onClick={handleCreate} disabled={saving} size="sm">
              {saving ? "Opslaan..." : "Opslaan"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Annuleren</Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-20 rounded-xl bg-card/50 border border-border/40 animate-pulse" />)}
        </div>
      ) : orgs.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Building2 className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>Nog geen organisaties aangemaakt</p>
          <p className="text-sm mt-1">Maak een organisatie aan om te beginnen</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orgs.map(org => (
            <div key={org.id}>
              <div
                data-testid={`card-org-${org.id}`}
                className="rounded-xl bg-card/50 border border-border/40 p-5 flex items-center justify-between hover:border-primary/30 transition-colors cursor-pointer"
                onClick={() => navigate(`/admin/scopes?orgId=${org.id}`)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-blue-400/10 flex items-center justify-center border border-blue-400/20">
                    <Building2 className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <div className="font-bold">{org.name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                      <span className="font-mono">{org.slug}</span>
                      <span>·</span>
                      <span>{SECTORS.find(s => s.value === org.sector)?.label || org.sector}</span>
                      <span>·</span>
                      <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 text-[10px] font-mono">
                        {org.gateProfile}
                      </span>
                    </div>
                    {org.description && <div className="text-xs text-muted-foreground mt-1">{org.description}</div>}
                  </div>
                </div>
                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                  {orgActiveScopes[org.id] && (
                    <span className="text-xs font-mono px-2 py-1 rounded bg-green-500/10 border border-green-500/20 text-green-400">
                      ● {orgActiveScopes[org.id]}
                    </span>
                  )}
                  <Button
                    data-testid={`button-mount-scope-${org.id}`}
                    variant="outline"
                    size="sm"
                    className="text-xs h-7"
                    onClick={(e) => { e.stopPropagation(); setMountingOrgId(mountingOrgId === org.id ? null : org.id); }}
                  >
                    Mount scope
                  </Button>
                  <Button
                    data-testid={`button-delete-org-${org.id}`}
                    variant="ghost"
                    size="icon"
                    onClick={(e) => { e.stopPropagation(); handleDelete(org.id); }}
                    className="text-muted-foreground hover:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              {mountingOrgId === org.id && (
                <div className="mx-1 mb-2 p-4 rounded-xl border border-primary/20 bg-card/80" onClick={e => e.stopPropagation()}>
                  <div className="text-xs font-bold mb-3 text-muted-foreground uppercase tracking-wider">Scope mounten voor {org.name}</div>
                  <div className="space-y-2">
                    {scopes.filter(s => s.status === "LOCKED").map(s => (
                      <button
                        key={s.id}
                        data-testid={`button-select-scope-${s.id}`}
                        className="w-full text-left px-3 py-2 rounded-lg border border-border/40 hover:border-primary/40 text-sm flex items-center justify-between"
                        onClick={async () => {
                          await fetch(`/api/organizations/${org.id}/mount`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ scopeId: s.id }),
                          });
                          setOrgActiveScopes(prev => ({ ...prev, [org.id]: s.name }));
                          setMountingOrgId(null);
                        }}
                      >
                        <span className="font-mono font-medium">{s.name}</span>
                        <span className="text-xs text-green-400">LOCKED</span>
                      </button>
                    ))}
                    {scopes.filter(s => s.status === "LOCKED").length === 0 && (
                      <div className="text-sm text-muted-foreground">Geen LOCKED scopes beschikbaar. Lock eerst een scope.</div>
                    )}
                  </div>
                  {orgActiveScopes[org.id] && (
                    <button
                      data-testid={`button-unmount-scope-${org.id}`}
                      className="mt-3 text-xs text-red-400 hover:text-red-300"
                      onClick={async () => {
                        await fetch(`/api/organizations/${org.id}/mount`, { method: "DELETE" });
                        setOrgActiveScopes(prev => { const n = { ...prev }; delete n[org.id]; return n; });
                      }}
                    >
                      Ontkoppel huidige scope
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
