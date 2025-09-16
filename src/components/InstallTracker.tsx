import React, { useEffect, useMemo, useState } from "react";

type InstallRecord = {
  date: string;              // legacy: equals installDate (kept for compatibility)
  installDate: string;       // ISO "YYYY-MM-DD"
  soldDate: string;          // ISO "YYYY-MM-DD"
  invoiceAmount: number;     // 💰
  customerName: string;
  installerName: string;
  soldByTech: string;
};

const TECHS = ["Austin", "Adam", "Tim", "Kaleb", "Hunter", "Miguel"] as const;
const INSTALLERS = ["Mike", "Steven", "Bubba", "Josh"] as const;

// ---------- Demo data generator (deterministic per date) ----------
function seededRandom(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 48271) % 2147483647) / 2147483647;
}
function strSeed(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}
function randomName(rng: () => number) {
  const first = ["Amy","Ben","Chloe","David","Elena","Frank","Grace","Hector","Ivy","Jake","Kara","Liam","Maya","Nolan","Olivia","Parker","Quinn","Riley","Sofia","Ty","Uma","Vince","Wes","Xena","Yara","Zane"];
  const last  = ["Baker","Lopez","Nguyen","Khan","Foster","Smith","Johnson","Williams","Brown","Jones","Garcia","Miller","Davis","Rodriguez","Martinez","Hernandez","Moore","Taylor","Anderson","Thomas"];
  return `${pick(rng, last)}, ${pick(rng, first)}`;
}
function dollars(rng: () => number, min=1200, max=5200, step=50) {
  const range = Math.floor((max - min) / step);
  return min + Math.floor(rng() * (range + 1)) * step;
}
function addDaysISO(baseISO: string, deltaDays: number) {
  const d = new Date(baseISO + "T00:00:00");
  d.setDate(d.getDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

/**
 * Demo data for a given date:
 * - EXACTLY 2 installs per installer (Mike, Steven, Bubba, Josh).
 */
async function fetchInstallsDemo(dateISO: string): Promise<InstallRecord[]> {
  const rng = seededRandom(strSeed(dateISO));
  const records: InstallRecord[] = [];

  for (const installer of INSTALLERS) {
    const installsForThisInstaller = 2; // ← exactly two per installer
    for (let k = 0; k < installsForThisInstaller; k++) {
      const installDate = dateISO;
      // sold 3–28 days before install (deterministic)
      const soldOffset = -(3 + Math.floor(rng() * 26));
      const soldDate = addDaysISO(installDate, soldOffset);

      records.push({
        date: installDate, // legacy
        installDate,
        soldDate,
        invoiceAmount: dollars(rng),
        customerName: randomName(rng),
        installerName: installer,
        soldByTech: pick(rng, TECHS),
      });
    }
  }

  // Simulate network latency
  await new Promise(r => setTimeout(r, 120));
  return records;
}
// -----------------------------------------------------------------

type GroupMode = "tech" | "installer";
type SummaryRow = { name: string; count: number; total: number; commission: number };

export default function InstallTracker() {
  // Daily mode date
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));

  // Range mode state
  const [useRange, setUseRange] = useState<boolean>(false);
  const [rangeStart, setRangeStart] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [rangeEnd, setRangeEnd] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [pendingRangeOpen, setPendingRangeOpen] = useState<boolean>(false); // UI panel visibility

  // Data
  const [allData, setAllData] = useState<InstallRecord[]>([]);

  // Filters
  const [selectedTechs, setSelectedTechs] = useState<string[]>([...TECHS]);
  const [selectedInstallers, setSelectedInstallers] = useState<string[]>([...INSTALLERS]);

  // Grouping
  const [groupMode, setGroupMode] = useState<GroupMode>("tech"); // default: group by Sales Tech

  // Load data for either a single day or date range
  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!useRange) {
        const data = await fetchInstallsDemo(date);
        if (!cancelled) setAllData(data);
        return;
      }
      // Range mode: generate for each date in [rangeStart, rangeEnd]
      const [start, end] = normalizeRange(rangeStart, rangeEnd);
      const dates = enumerateDatesInclusive(start, end);
      const chunks: InstallRecord[][] = [];
      for (const d of dates) {
        // eslint-disable-next-line no-await-in-loop
        const data = await fetchInstallsDemo(d);
        if (cancelled) return;
        chunks.push(data);
      }
      if (!cancelled) setAllData(chunks.flat());
    }

    load();
    return () => { cancelled = true; };
  }, [date, useRange, rangeStart, rangeEnd]);

  // Helpers for range
  function normalizeRange(a: string, b: string): [string, string] {
    return a <= b ? [a, b] : [b, a];
  }
  function enumerateDatesInclusive(startISO: string, endISO: string): string[] {
    const arr: string[] = [];
    const start = new Date(startISO + "T00:00:00");
    const end = new Date(endISO + "T00:00:00");
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      arr.push(d.toISOString().slice(0, 10));
    }
    return arr;
  }

  const allTechs = TECHS as unknown as string[];
  const allInstallers = INSTALLERS as unknown as string[];

  const allTechsSelected = selectedTechs.length === allTechs.length && allTechs.length > 0;
  const allInstallersSelected = selectedInstallers.length === allInstallers.length && allInstallers.length > 0;

  // Apply both filters: must match selected technician AND selected installer
  const filtered = useMemo(
    () =>
      allData.filter(
        d => selectedTechs.includes(d.soldByTech) && selectedInstallers.includes(d.installerName)
      ),
    [allData, selectedTechs, selectedInstallers]
  );

  // Group by either Sales Tech (default) or Installer
  const grouped = useMemo(() => {
    const keyFor = (r: InstallRecord) => (groupMode === "tech" ? r.soldByTech : r.installerName);
    const map = new Map<string, InstallRecord[]>();
    for (const r of filtered) {
      const k = keyFor(r);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(r);
    }
    const groupLabels = Array.from(map.keys()).sort((a, b) => a.localeCompare(b));
    return groupLabels.map(label => {
      const rows = (map.get(label) ?? []).slice().sort((a, b) => b.invoiceAmount - a.invoiceAmount);
      const subtotal = rows.reduce((sum, r) => sum + r.invoiceAmount, 0);
      return { label, rows, subtotal };
    });
  }, [filtered, groupMode]);

  // Derived: summaries for Date Range mode (sorted by Total desc)
  const showInstallerSummary = useRange && groupMode === "installer";
  const installerSummary: SummaryRow[] = useMemo(() => {
    if (!showInstallerSummary) return [];
    const rate = 0.075;
    return grouped
      .map(g => {
        const count = g.rows.length;
        const total = g.subtotal;
        const commission = +(total * rate).toFixed(2);
        return { name: g.label, count, total, commission };
      })
      .sort((a, b) => b.total - a.total);
  }, [grouped, showInstallerSummary]);

  const showTechSummary = useRange && groupMode === "tech";
  const techSummary: SummaryRow[] = useMemo(() => {
    if (!showTechSummary) return [];
    const rate = 0.05;
    return grouped
      .map(g => {
        const count = g.rows.length;
        const total = g.subtotal;
        const commission = +(total * rate).toFixed(2);
        return { name: g.label, count, total, commission };
      })
      .sort((a, b) => b.total - a.total);
  }, [grouped, showTechSummary]);

  // Tech filter toggles
  function toggleTech(t: string) {
    setSelectedTechs(prev => (prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]));
  }
  function toggleAllTechs() {
    setSelectedTechs(allTechsSelected ? [] : [...allTechs]);
  }

  // Installer filter toggles
  function toggleInstaller(i: string) {
    setSelectedInstallers(prev => (prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]));
  }
  function toggleAllInstallers() {
    setSelectedInstallers(allInstallersSelected ? [] : [...allInstallers]);
  }

  // Date navigation (single-day mode)
  function shiftDate(days: number) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().slice(0, 10));
  }
  function goToday() {
    setDate(new Date().toISOString().slice(0, 10));
    setUseRange(false); // snap back to single-day Today view
  }

  // Range switching
  function applyRange() {
    const [s, e] = normalizeRange(rangeStart, rangeEnd);
    setRangeStart(s);
    setRangeEnd(e);
    setUseRange(true);
    setPendingRangeOpen(false);
  }
  function exitRange() {
    setUseRange(false);
  }

  // CSV export (includes Sold/Install dates)
  const commissionRate = groupMode === "tech" ? 0.05 : 0.075;
  function exportCSV() {
    const headers = [
      "Group",
      "Sales Tech",
      "Invoice $$",
      "COMMISSION",
      "Customer",
      "Installer",
      "Sold Date",
      "Install Date",
    ];
    const lines: (string | number)[][] = [headers];
    for (const g of grouped) {
      for (const r of g.rows) {
        const commission = r.invoiceAmount * commissionRate;
        lines.push([
          g.label,
          r.soldByTech,
          r.invoiceAmount,
          +commission.toFixed(2),
          r.customerName,
          r.installerName,
          r.soldDate,
          r.installDate,
        ]);
      }
      lines.push([
        `Subtotal for ${g.label}`,
        "",
        g.subtotal,
        +(g.subtotal * commissionRate).toFixed(2),
        "",
        "",
        "",
        "",
      ]);
    }
    const csv = lines.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `installs_${useRange ? `${rangeStart}_to_${rangeEnd}` : date}_${groupMode}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Single toggle button: label shows what it'll switch TO
  const toggleLabel = groupMode === "tech" ? "Sort by Installer" : "Sort by Technician";
  function toggleGrouping() {
    setGroupMode(prev => (prev === "tech" ? "installer" : "tech"));
  }

  // Presentational consistency
  const cellStyle: React.CSSProperties = { textAlign: "center", padding: "8px 10px" };

  // Dynamic column labels & cell values
  const leftHeader = groupMode === "tech" ? "Technician" : "Installer";
  const rightHeader = groupMode === "tech" ? "Installer (name)" : "Technician (name)";

  // Compute grand totals for summary (used in footer)
  const summaryRows = (showInstallerSummary ? installerSummary : showTechSummary ? techSummary : []) as SummaryRow[];
  const grand = summaryRows.length
    ? summaryRows.reduce(
        (acc, r) => {
          acc.count += r.count;
          acc.total += r.total;
          acc.commission += r.commission;
          return acc;
        },
        { count: 0, total: 0, commission: 0 }
      )
    : { count: 0, total: 0, commission: 0 };

  return (
    <div style={{ maxWidth: 1200, margin: "24px auto", padding: 16 }}>
      <h2>Install Tracker (Demo)</h2>

      {/* ======= TOP BAR ======= */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
        {/* Left: Sort toggle */}
        <button onClick={toggleGrouping}>{toggleLabel}</button>

        {/* Middle: Date controls */}
        {!useRange ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={() => shiftDate(-1)}>◀</button>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} />
            <button onClick={() => shiftDate(1)}>▶</button>
            <button onClick={goToday}>Today</button>
            <button onClick={() => setPendingRangeOpen(v => !v)} title="Open date range">Date Range…</button>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <strong>Range:</strong>
            <input type="date" value={rangeStart} onChange={e => setRangeStart(e.target.value)} />
            <span>to</span>
            <input type="date" value={rangeEnd} onChange={e => setRangeEnd(e.target.value)} />
            <button onClick={applyRange}>Use Range</button>
            <button onClick={exitRange}>Single Day</button>
            <button onClick={goToday}>Today</button>
          </div>
        )}

        {/* Right: Export */}
        <div style={{ marginLeft: "auto" }}>
          <button onClick={exportCSV}>Export CSV</button>
        </div>
      </div>

      {/* Optional inline range selector panel when in single-day mode */}
      {!useRange && pendingRangeOpen && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 8, border: "1px solid #ddd", borderRadius: 8, marginBottom: 12 }}>
          <strong>Pick Range:</strong>
          <input type="date" value={rangeStart} onChange={e => setRangeStart(e.target.value)} />
          <span>to</span>
          <input type="date" value={rangeEnd} onChange={e => setRangeEnd(e.target.value)} />
          <button onClick={applyRange}>Use Range</button>
        </div>
      )}

      {/* ======= SECOND ROW: Filters side-by-side (Tech left, Installer right) ======= */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "start", marginBottom: 12 }}>
        {/* Filters: Technicians (left) */}
        <div style={{ border: "1px solid #ddd", padding: "8px 10px", borderRadius: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
            <input type="checkbox" checked={allTechsSelected} onChange={toggleAllTechs} id="selectAllTechs" />
            <label htmlFor="selectAllTechs"><strong>Select all technicians</strong></label>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {allTechs.map(t => (
              <label key={t} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <input type="checkbox" checked={selectedTechs.includes(t)} onChange={() => toggleTech(t)} />
                {t}
              </label>
            ))}
          </div>
        </div>

        {/* Filters: Installers (right) */}
        <div style={{ border: "1px solid #ddd", padding: "8px 10px", borderRadius: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
            <input type="checkbox" checked={allInstallersSelected} onChange={toggleAllInstallers} id="selectAllInstallers" />
            <label htmlFor="selectAllInstallers"><strong>Select all installers</strong></label>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {allInstallers.map(i => (
              <label key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <input type="checkbox" checked={selectedInstallers.includes(i)} onChange={() => toggleInstaller(i)} />
                {i}
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* ======= SUMMARY (Range-only, sorted by Total desc) ======= */}
      {(showInstallerSummary || showTechSummary) && (
        <div style={{ marginBottom: 12 }}>
          <h3 style={{ margin: "6px 0" }}>
            {showInstallerSummary ? "Installer Totals (Range)" : "Technician Totals (Range)"}
          </h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={cellStyle}>{showInstallerSummary ? "Installer" : "Technician"}</th>
                  <th style={cellStyle}># Installs</th>
                  <th style={cellStyle}>Total Invoices</th>
                  <th style={cellStyle}>COMMISSION</th>
                </tr>
              </thead>
              <tbody>
                {summaryRows.map((s) => (
                  <tr key={s.name}>
                    <td style={cellStyle}>{s.name}</td>
                    <td style={cellStyle}>{s.count}</td>
                    <td style={cellStyle}>${s.total.toLocaleString()}</td>
                    <td style={cellStyle}>${s.commission.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td style={{ ...cellStyle, fontWeight: 700 }}>Grand Total</td>
                  <td style={{ ...cellStyle, fontWeight: 700 }}>{grand.count}</td>
                  <td style={{ ...cellStyle, fontWeight: 700 }}>${grand.total.toLocaleString()}</td>
                  <td style={{ ...cellStyle, fontWeight: 700 }}>${grand.commission.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ======= DETAILED TABLE ======= */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={cellStyle}>{leftHeader}</th>
              <th style={cellStyle}>Invoice $$</th>
              <th style={cellStyle}>COMMISSION</th>
              <th style={cellStyle}>Customer</th>
              <th style={cellStyle}>Sold Date</th>
              <th style={cellStyle}>Install Date</th>
              <th style={cellStyle}>{rightHeader}</th>
            </tr>
          </thead>
          <tbody>
            {grouped.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: "center", padding: 16 }}>No installs found</td></tr>
            ) : (
              grouped.map((g, gi) => {
                const rowClass = gi % 2 === 0 ? "group-a" : "group-b";
                const rate = groupMode === "tech" ? 0.05 : 0.075;
                return g.rows.length === 0 ? null : (
                  <React.Fragment key={g.label}>
                    {g.rows.map((row, i) => {
                      const commission = row.invoiceAmount * rate;
                      const leftValue = groupMode === "tech" ? row.soldByTech : row.installerName;
                      const rightValue = groupMode === "tech" ? `(${row.installerName})` : `(${row.soldByTech})`;
                      return (
                        <tr key={g.label + i} className={rowClass}>
                          <td style={cellStyle}>{leftValue}</td>
                          <td style={cellStyle}>${row.invoiceAmount.toLocaleString()}</td>
                          <td style={cellStyle}>${commission.toFixed(2)}</td>
                          <td style={cellStyle}>{row.customerName}</td>
                          <td style={cellStyle}>{row.soldDate}</td>
                          <td style={cellStyle}>{row.installDate}</td>
                          <td style={cellStyle}>{rightValue}</td>
                        </tr>
                      );
                    })}
                    <tr className={rowClass}>
                      <td style={{ ...cellStyle, fontWeight: 600 }}>
                        Subtotal for {groupMode === "tech" ? `Tech: ${g.label}` : `Installer: ${g.label}`}
                        {useRange ? " (range)" : ""}
                      </td>
                      <td style={{ ...cellStyle, fontWeight: 600 }}>${g.subtotal.toLocaleString()}</td>
                      <td style={{ ...cellStyle, fontWeight: 600 }}>
                        ${((g.subtotal) * (groupMode === "tech" ? 0.05 : 0.075)).toFixed(2)}
                      </td>
                      <td style={cellStyle}></td>
                      <td style={cellStyle}></td>
                      <td style={cellStyle}></td>
                      <td style={cellStyle}></td>
                    </tr>
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
