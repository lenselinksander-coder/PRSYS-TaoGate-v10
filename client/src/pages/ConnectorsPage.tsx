import { useEffect, useState } from "react";
import { Plug, Plus, Trash2, Copy, Check, Zap, Database, Webhook } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Connector = {
  id: string;
  orgId: string;
  name: string;
  type: string;
  provider: string | null;
  description: string | null;
  apiKey: string;
  status: string;
  lastUsedAt: string | null;
  createdAt: string;
};

type Organization = {
  id: string;
  name: string;
  slug: string;
};

const TYPE_INFO: Record<string, { label: string; icon: any; color: string }> = {
  AI_AGENT: { label: "AI Agent", icon: Zap, color: "text-purple-400" },
  DATA_SOURCE: { label: "Databron", icon: Database, color: "text-blue-400" },
  WEBHOOK: { label: "Webhook", icon: Webhook, color: "text-amber-400" },
};

export default function ConnectorsPage() {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ orgId: "", name: "", type: "AI_AGENT", provider: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadData = async () => {
    const [cRes, oRes] = await Promise.all([
      fetch("/api/connectors").then(r => r.json()),
      fetch("/api/organizations").then(r => r.json()),
    ]);
    setConnectors(cRes);
    setOrgs(oRes);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleCreate = async () => {
    setError(null);
    if (!form.orgId || !form.name) { setError("Organisatie en naam zijn verplicht"); return; }
    setSaving(true);
    try {
      const r = await fetch("/api/connectors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Aanmaken mislukt");
      setNewApiKey(data.apiKey);
      setShowForm(false);
      setForm({ orgId: "", name: "", type: "AI_AGENT", provider: "", description: "" });
      loadData();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/connectors/${id}`, { method: "DELETE" });
    loadData();
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getOrgName = (orgId: string) => orgs.find(o => o.id === orgId)?.name || orgId;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 data-testid="text-page-title" className="text-2xl font-bold font-mono flex items-center gap-3">
            <Plug className="w-6 h-6 text-purple-400" />
            Connectors
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Registreer externe AI-agents, databronnen en webhooks met API-sleutels</p>
        </div>
        <Button data-testid="button-add-connector" onClick={() => setShowForm(!showForm)} size="sm">
          <Plus className="w-4 h-4 mr-1" /> Nieuwe Connector
        </Button>
      </div>

      {newApiKey && (
        <div className="mb-6 rounded-xl bg-green-500/10 border border-green-500/30 p-5">
          <h3 className="font-bold text-green-400 mb-2">API-sleutel aangemaakt</h3>
          <p className="text-sm text-muted-foreground mb-3">Kopieer deze sleutel nu — je kunt hem later niet meer zien.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-background/50 rounded px-3 py-2 text-sm font-mono break-all">{newApiKey}</code>
            <Button size="sm" variant="outline" onClick={() => copyKey(newApiKey)}>
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
          <Button size="sm" variant="ghost" className="mt-2" onClick={() => setNewApiKey(null)}>Sluiten</Button>
        </div>
      )}

      {showForm && (
        <div className="mb-6 rounded-xl bg-card/50 border border-border/40 p-5">
          <h3 className="font-bold mb-4">Connector Registreren</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Organisatie</label>
              <select
                data-testid="select-connector-org"
                value={form.orgId}
                onChange={e => setForm({ ...form, orgId: e.target.value })}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Kies organisatie...</option>
                {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Naam</label>
              <Input
                data-testid="input-connector-name"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="Bijv. ChatGPT Agent"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Type</label>
              <div className="flex gap-2">
                {Object.entries(TYPE_INFO).map(([key, info]) => (
                  <button
                    key={key}
                    data-testid={`button-type-${key.toLowerCase()}`}
                    onClick={() => setForm({ ...form, type: key })}
                    className={`flex-1 p-2 rounded-lg border text-xs transition-all text-center ${
                      form.type === key ? "border-primary bg-primary/10 text-primary" : "border-border/40 hover:border-border"
                    }`}
                  >
                    <info.icon className={`w-4 h-4 mx-auto mb-1 ${info.color}`} />
                    {info.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Provider</label>
              <Input
                data-testid="input-connector-provider"
                value={form.provider}
                onChange={e => setForm({ ...form, provider: e.target.value })}
                placeholder="Bijv. OpenAI, Anthropic, Custom"
              />
            </div>
          </div>
          {error && <div className="mt-3 text-sm text-red-400">{error}</div>}
          <div className="mt-4 flex gap-2">
            <Button data-testid="button-save-connector" onClick={handleCreate} disabled={saving} size="sm">
              {saving ? "Registreren..." : "Registreren & API-sleutel genereren"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Annuleren</Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-20 rounded-xl bg-card/50 border border-border/40 animate-pulse" />)}
        </div>
      ) : connectors.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Plug className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>Nog geen connectors geregistreerd</p>
          <p className="text-sm mt-1">Registreer een connector om externe agents te koppelen</p>
        </div>
      ) : (
        <div className="space-y-3">
          {connectors.map(c => {
            const info = TYPE_INFO[c.type] || TYPE_INFO.AI_AGENT;
            return (
              <div
                key={c.id}
                data-testid={`card-connector-${c.id}`}
                className="rounded-xl bg-card/50 border border-border/40 p-5 flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg bg-purple-400/10 flex items-center justify-center border border-purple-400/20`}>
                    <info.icon className={`w-5 h-5 ${info.color}`} />
                  </div>
                  <div>
                    <div className="font-bold flex items-center gap-2">
                      {c.name}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                        c.status === "ACTIVE" ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"
                      }`}>{c.status}</span>
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                      <span>{getOrgName(c.orgId)}</span>
                      <span>·</span>
                      <span>{info.label}</span>
                      {c.provider && <><span>·</span><span>{c.provider}</span></>}
                      <span>·</span>
                      <span className="font-mono text-[10px]">{c.apiKey}</span>
                    </div>
                    {c.lastUsedAt && (
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        Laatst gebruikt: {new Date(c.lastUsedAt).toLocaleString("nl-NL")}
                      </div>
                    )}
                  </div>
                </div>
                <Button
                  data-testid={`button-delete-connector-${c.id}`}
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(c.id)}
                  className="text-muted-foreground hover:text-red-400"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-8 rounded-xl bg-card/30 border border-border/30 p-5">
        <h3 className="font-bold font-mono mb-3">Universele Gateway — Hoe te gebruiken</h3>
        <p className="text-sm text-muted-foreground mb-3">
          Externe agents sturen intents naar de gateway. Het systeem past automatisch het gate-profiel, scope-classificatie en OLYMPIA-regelresolutie toe.
        </p>
        <pre className="bg-background/50 rounded-lg p-4 text-xs font-mono overflow-x-auto">
{`POST /api/gateway/classify
Headers:
  x-api-key: orf_your_api_key_here
  Content-Type: application/json

Body:
{
  "text": "Uw intent of observatie hier",
  "scopeId": "optioneel-scope-id"
}

Response:
{
  "decision": "PASS | PASS_WITH_TRANSPARENCY | ESCALATE_HUMAN | BLOCK",
  "gate": { "status": "...", "layer": "...", "reason": "..." },
  "scope": { "category": "...", "escalation": "..." },
  "olympia": { "ruleId": "...", "layer": "...", "action": "..." },
  "organization": "Organisatie Naam",
  "gateProfile": "GENERAL"
}`}
        </pre>
      </div>
    </div>
  );
}
