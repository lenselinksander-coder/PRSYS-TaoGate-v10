import { queryClient } from "./queryClient";

export async function fetchObservations(context?: string) {
  const params = context ? `?context=${encodeURIComponent(context)}` : "";
  const res = await fetch(`/api/observations${params}`);
  if (!res.ok) throw new Error("Failed to fetch observations");
  return res.json();
}

export async function fetchStats(context?: string) {
  const params = context ? `?context=${encodeURIComponent(context)}` : "";
  const res = await fetch(`/api/observations/stats${params}`);
  if (!res.ok) throw new Error("Failed to fetch stats");
  return res.json();
}

export async function createObservation(data: { text: string; status: string; category: string; context: string }) {
  const res = await fetch("/api/observations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create observation");
  return res.json();
}
