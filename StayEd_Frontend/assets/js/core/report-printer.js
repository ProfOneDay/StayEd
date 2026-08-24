class ReportPrinter {
  static escape(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[ch]);
  }

  static cell(value) {
    if (value === null || value === undefined || value === "") return "—";
    if (typeof value === "object" && "html" in value) return value.html;
    return this.escape(value);
  }

  static riskBadge(risk) {
    const cls = { High: "high", Moderate: "moderate", Low: "low" }[risk] || "neutral";
    return { html: `<span class="badge badge-${cls}">${this.escape(risk || "Not Yet Assessed")}</span>` };
  }

  static open({ title, subtitle, meta = [], sections = [] }) {
    const win = window.open("", "_blank");

    if (!win) {
      if (window.Toast) Toast.error("Please allow pop-ups to generate the report.");
      return;
    }

    win.document.open();
    win.document.write(this.render({ title, subtitle, meta, sections }));
    win.document.close();
  }

  static render({ title, subtitle, meta, sections }) {
    const generated = new Date().toLocaleString("en-PH", {
      dateStyle: "long",
      timeStyle: "short",
    });

    return `<!doctype html>
<html>
<head>
<meta charset="UTF-8">
<title>${this.escape(title)} | StayEd</title>
<style>
  :root {
    --st-primary: #12355b;
    --st-secondary: #006a68;
    --st-outline-variant: #c3c6cf;
    --st-text-secondary: #43474e;
  }
  * { box-sizing: border-box; }
  body {
    font-family: 'Inter', Arial, sans-serif;
    color: #111a36;
    margin: 0;
    padding: 32px 40px 56px;
  }
  .report-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 24px;
    border-bottom: 3px solid var(--st-primary);
    padding-bottom: 16px;
    margin-bottom: 20px;
  }
  .report-brand { font-weight: 700; color: var(--st-primary); font-size: 18px; }
  .report-header p { margin: 4px 0 0; color: var(--st-text-secondary); font-size: 13px; }
  .report-header-right { text-align: right; }
  .report-header h1 {
    font-family: 'Libre Franklin', sans-serif;
    font-size: 21px;
    color: var(--st-primary);
    margin: 0;
  }
  .report-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 16px 32px;
    margin-bottom: 26px;
    font-size: 13px;
  }
  .report-meta .label {
    display: block;
    color: #73777f;
    font-size: 10.5px;
    text-transform: uppercase;
    letter-spacing: .04em;
    margin-bottom: 2px;
  }
  .report-meta .value { font-weight: 600; }
  .report-section { margin-bottom: 28px; page-break-inside: avoid; }
  .report-section h2 {
    font-size: 14.5px;
    color: var(--st-primary);
    border-bottom: 1px solid var(--st-outline-variant);
    padding-bottom: 6px;
    margin: 0 0 10px;
  }
  table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  th, td { text-align: left; padding: 7px 10px; border-bottom: 1px solid #e3e5ea; vertical-align: top; }
  th { background: #f8f9fb; font-weight: 600; color: var(--st-text-secondary); }
  .badge {
    display: inline-block;
    padding: 2px 9px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
    white-space: nowrap;
  }
  .badge-high { background: rgba(186,26,26,.1); color: #ba1a1a; }
  .badge-moderate { background: rgba(243,148,34,.12); color: #a8620f; }
  .badge-low { background: rgba(107,191,89,.15); color: #3d7a30; }
  .badge-neutral { background: rgba(115,119,127,.12); color: #43474e; }
  .empty-note { color: #73777f; font-style: italic; padding: 4px 0 8px; margin: 0; }
  .print-toolbar {
    position: sticky;
    top: 0;
    background: #fff;
    padding: 0 0 20px;
    margin-bottom: 4px;
    display: flex;
    justify-content: flex-end;
  }
  .print-toolbar button {
    border: 1px solid var(--st-primary);
    background: var(--st-primary);
    color: #fff;
    padding: 9px 20px;
    border-radius: 4px;
    font-weight: 600;
    font-size: 13px;
    cursor: pointer;
    font-family: inherit;
  }
  .print-toolbar button:hover { opacity: .9; }
  @media print {
    .print-toolbar { display: none; }
    body { padding: 0 8px; }
  }
</style>
</head>
<body>
  <div class="print-toolbar"><button onclick="window.print()">Print / Save as PDF</button></div>
  <div class="report-header">
    <div>
      <div class="report-brand">StayEd</div>
      <p>${this.escape(subtitle || "ALS/ALC Learner Monitoring System")}</p>
    </div>
    <div class="report-header-right">
      <h1>${this.escape(title)}</h1>
      <p>Generated ${this.escape(generated)}</p>
    </div>
  </div>
  <div class="report-meta">
    ${meta.map((m) => `<div><span class="label">${this.escape(m.label)}</span><span class="value">${this.escape(m.value)}</span></div>`).join("")}
  </div>
  ${sections.map((s) => this.renderSection(s)).join("")}
</body>
</html>`;
  }

  static renderSection(section) {
    if (section.type === "html") {
      return `<div class="report-section">${section.title ? `<h2>${this.escape(section.title)}</h2>` : ""}${section.html}</div>`;
    }

    const rows = section.rows || [];

    if (!rows.length) {
      return `<div class="report-section"><h2>${this.escape(section.title)}</h2><p class="empty-note">${this.escape(section.emptyText || "No records found.")}</p></div>`;
    }

    return `
      <div class="report-section">
        <h2>${this.escape(section.title)}</h2>
        <table>
          <thead><tr>${section.columns.map((c) => `<th>${this.escape(c)}</th>`).join("")}</tr></thead>
          <tbody>${rows.map((r) => `<tr>${r.map((v) => `<td>${this.cell(v)}</td>`).join("")}</tr>`).join("")}</tbody>
        </table>
      </div>`;
  }
}

window.ReportPrinter = ReportPrinter;
