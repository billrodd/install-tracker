import React, { useEffect, useMemo, useState } from "react";
import { getTechnicians } from "../api/getTechnicians";

// Optional: keep your existing types here if you had them.
// This component focuses on showing/using live technicians.

type Technician = {
  id: string | number;
  name: string;
  active?: boolean;
  // raw?: any  // uncomment if you want to inspect raw payloads
};

export default function InstallTracker() {
  // --- Live technicians state ---
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loadingTechs, setLoadingTechs] = useState(true);
  const [techError, setTechError] = useState<string | null>(null);

  // --- Simple UI state (search + active filter) ---
  const [query, setQuery] = useState("");
  const [showActiveOnly, setShowActiveOnly] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoadingTechs(true);
        const list = await getTechnicians();
        if (!cancelled) setTechnicians(list);
      } catch (err: any) {
        if (!cancelled) setTechError(err?.message ?? "Failed to load technicians");
      } finally {
        if (!cancelled) setLoadingTechs(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Filtered & sorted list
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return technicians
      .filter(t => (showActiveOnly ? (t.active ?? true) : true))
      .filter(t => (q ? (t.name || "").toLowerCase().includes(q) : true))
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [technicians, query, showActiveOnly]);

  return (
    <div className="mx-auto max-w-5xl p-4">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold">Install Tracker</h1>
        <p className="text-sm text-gray-500">
          Technicians are loaded live from ServiceTitan.
        </p>
      </header>

      {/* Controls */}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search technicians…"
          className="w-full rounded border px-3 py-2 sm:max-w-xs"
        />
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showActiveOnly}
            onChange={e => setShowActiveOnly(e.target.checked)}
          />
          Show active only
        </label>
      </div>

      {/* Status states */}
      {loadingTechs && (
        <div className="rounded border px-3 py-2 text-sm text-gray-600">
          Loading technicians…
        </div>
      )}
      {techError && (
        <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          Error: {techError}
        </div>
      )}

      {/* List */}
      {!loadingTechs && !techError && (
        <>
          <div className="mb-2 text-sm text-gray-500">
            Showing {filtered.length} of {technicians.length} technicians
          </div>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(t => (
              <li
                key={String(t.id)}
                className="rounded-lg border px-3 py-2 shadow-sm"
              >
                <div className="font-medium">{t.name || "Unnamed"}</div>
                <div className="text-xs text-gray-500">ID: {String(t.id)}</div>
                <div className="mt-1 text-xs">
                  Status:{" "}
                  <span className={t.active ? "text-green-600" : "text-gray-500"}>
                    {t.active ? "Active" : "Inactive"}
                  </span>
                </div>
              </li>
            ))}
          </ul>

          {/* (Optional) Debug raw payloads */}
          {/* <pre className="mt-4 overflow-auto rounded bg-gray-50 p-3 text-xs">
            {JSON.stringify(technicians, null, 2)}
          </pre> */}
        </>
      )}
    </div>
  );
}
