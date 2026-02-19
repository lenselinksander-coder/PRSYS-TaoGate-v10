import type { Scope, InsertScope } from "@shared/schema";

export async function fetchObservations(context?: string, scopeId?: string) {
  const params = new URLSearchParams();
  if (scopeId) params.set("scopeId", scopeId);
  else if (context) params.set("context", context);
  const qs = params.toString();
  const res = await fetch(`/api/observations${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error("Failed to fetch observations");
  return res.json();
}

export async function fetchStats(context?: string, scopeId?: string) {
  const params = new URLSearchParams();
  if (scopeId) params.set("scopeId", scopeId);
  else if (context) params.set("context", context);
  const qs = params.toString();
  const res = await fetch(`/api/observations/stats${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error("Failed to fetch stats");
  return res.json();
}

export async function createObservation(data: { text: string; status: string; category: string; escalation: string | null; context: string; scopeId?: string; olympiaRuleId?: string | null; olympiaAction?: string | null; olympiaLayer?: string | null }) {
  const res = await fetch("/api/observations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create observation");
  return res.json();
}

export async function fetchScopes(): Promise<Scope[]> {
  const res = await fetch("/api/scopes");
  if (!res.ok) throw new Error("Failed to fetch scopes");
  return res.json();
}

export async function fetchScope(id: string): Promise<Scope> {
  const res = await fetch(`/api/scopes/${id}`);
  if (!res.ok) throw new Error("Failed to fetch scope");
  return res.json();
}

export async function fetchDefaultScope(): Promise<Scope | null> {
  const res = await fetch("/api/scopes/default");
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to fetch default scope");
  return res.json();
}

export async function createScope(data: InsertScope): Promise<Scope> {
  const res = await fetch("/api/scopes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create scope");
  return res.json();
}

export async function updateScope(id: string, data: Partial<InsertScope>): Promise<Scope> {
  const res = await fetch(`/api/scopes/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update scope");
  return res.json();
}

export async function deleteScope(id: string): Promise<void> {
  const res = await fetch(`/api/scopes/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete scope");
}

export async function resolveOlympia(scopeId: string, domain?: string, category?: string) {
  const res = await fetch("/api/olympia/resolve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scopeId, domain, category }),
  });
  if (!res.ok) throw new Error("Failed to resolve rules");
  return res.json();
}

export type ClassifyResult = {
  status: string;
  category: string;
  escalation: string | null;
  olympiaRuleId: string | null;
  olympiaAction: string | null;
  olympiaLayer: string | null;
  olympiaRule: { ruleId: string; layer: string; title: string; action: string; source?: string; article?: string } | null;
  olympiaHasConflict: boolean;
  olympiaPressure: number | "INFINITE";
};

export async function classifyText(text: string, scopeId: string): Promise<ClassifyResult> {
  const res = await fetch("/api/classify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, scopeId }),
  });
  if (!res.ok) throw new Error("Failed to classify");
  return res.json();
}
