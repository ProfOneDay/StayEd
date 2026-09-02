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

  static stripHtml(value) {
    if (value === null || value === undefined) return "";
    if (typeof value === "object" && "html" in value) {
      return String(value.html).replace(/<[^>]*>/g, "").trim();
    }
    return String(value).replace(/<[^>]*>/g, "").trim();
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

  static downloadCsv(filename, headers, rows) {
    const allRows = [headers, ...(rows || [])];
    const csvContent = allRows
      .map((row) =>
        row
          .map((cell) => `"${String(this.stripHtml(cell)).replace(/"/g, '""')}"`)
          .join(","),
      )
      .join("\r\n");

    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  static exportCsv({ filename, title, subtitle, meta = [], sections = [] }) {
    const lines = [];

    // Header information
    if (title) lines.push(`"${String(title).replace(/"/g, '""')}"`);
    if (subtitle) lines.push(`"${String(subtitle).replace(/"/g, '""')}"`);
    lines.push(`"Generated: ${new Date().toLocaleString("en-PH")}"`);
    lines.push("");

    // Metadata
    if (meta && meta.length) {
      lines.push('"Report Summary / Filters:"');
      meta.forEach((m) => {
        lines.push(`"${String(m.label).replace(/"/g, '""')}","${String(m.value).replace(/"/g, '""')}"`);
      });
      lines.push("");
    }

    // Sections
    sections.forEach((sec) => {
      if (sec.title) {
        lines.push(`"${String(sec.title).replace(/"/g, '""')}"`);
      }
      if (sec.columns && sec.columns.length) {
        lines.push(
          sec.columns
            .map((c) => `"${String(this.stripHtml(c)).replace(/"/g, '""')}"`)
            .join(","),
        );
      }
      const rows = sec.rows || [];
      if (rows.length) {
        rows.forEach((r) => {
          lines.push(
            r
              .map((c) => `"${String(this.stripHtml(c)).replace(/"/g, '""')}"`)
              .join(","),
          );
        });
      } else {
        lines.push(`"${String(sec.emptyText || "No records found.").replace(/"/g, '""')}"`);
      }
      lines.push("");
    });

    const csvContent = lines.join("\r\n");
    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeTitle = (filename || title || "StayEd_Report")
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .replace(/__+/g, "_");
    link.href = url;
    link.download = safeTitle.endsWith(".csv") ? safeTitle : `${safeTitle}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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

    const reportJson = JSON.stringify({ title, subtitle, meta, sections });

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
  .report-brand { font-weight: 700; color: var(--st-primary); font-size:1.125rem; }
  .report-header p { margin: 4px 0 0; color: var(--st-text-secondary); font-size:0.8125rem; }
  .report-header-right { text-align: right; }
  .report-header h1 {
    font-family: 'Libre Franklin', sans-serif;
    font-size:1.3125rem;
    color: var(--st-primary);
    margin: 0;
  }
  .report-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 16px 32px;
    margin-bottom: 26px;
    font-size:0.8125rem;
  }
  .report-meta .label {
    display: block;
    color: #73777f;
    font-size:0.65625rem;
    text-transform: uppercase;
    letter-spacing: .04em;
    margin-bottom: 2px;
  }
  .report-meta .value { font-weight: 600; }
  .report-section { margin-bottom: 28px; page-break-inside: avoid; }
  .report-section h2 {
    font-size:0.90625rem;
    color: var(--st-primary);
    border-bottom: 1px solid var(--st-outline-variant);
    padding-bottom: 6px;
    margin: 0 0 10px;
  }
  table { width: 100%; border-collapse: collapse; font-size:0.78125rem; }
  th, td { text-align: left; padding: 7px 10px; border-bottom: 1px solid #e3e5ea; vertical-align: top; }
  th { background: #f8f9fb; font-weight: 600; color: var(--st-text-secondary); }
  .badge {
    display: inline-block;
    padding: 2px 9px;
    border-radius: 999px;
    font-size:0.6875rem;
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
    gap: 12px;
  }
  .print-toolbar button {
    border: 1px solid var(--st-primary);
    background: var(--st-primary);
    color: #fff;
    padding: 9px 18px;
    border-radius: 4px;
    font-weight: 600;
    font-size:0.8125rem;
    cursor: pointer;
    font-family: inherit;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .print-toolbar button.btn-csv {
    background: #006a68;
    border-color: #006a68;
  }
  .print-toolbar button.btn-close {
    background: transparent;
    border-color: #43474e;
    color: #43474e;
  }
  .print-toolbar button.btn-close:hover {
    background: #f1f3f5;
    opacity: 1;
  }
  .print-toolbar button:hover { opacity: .9; }
  @media print {
    .print-toolbar { display: none; }
    body { padding: 0 8px; }
  }
</style>
</head>
<body>
  <div class="print-toolbar">
    <button type="button" class="btn-close" onclick="window.close()">
      <svg style="width:15px;height:15px;fill:currentColor;" viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
      Close Preview
    </button>
    <button type="button" class="btn-csv" onclick="downloadReportCsv()">
      <svg style="width:15px;height:15px;fill:currentColor;" viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
      Export as CSV
    </button>
    <button type="button" class="btn-print" onclick="window.print()">
      <svg style="width:15px;height:15px;fill:currentColor;" viewBox="0 0 24 24"><path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/></svg>
      Print / Save as PDF
    </button>
  </div>
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

  <script>
    const REPORT_DATA = ${reportJson};

    function stripHtml(val) {
      if (val === null || val === undefined) return "";
      if (typeof val === "object" && "html" in val) {
        return String(val.html).replace(/<[^>]*>/g, "").trim();
      }
      return String(val).replace(/<[^>]*>/g, "").trim();
    }

    function downloadReportCsv() {
      const lines = [];
      const title = REPORT_DATA.title || "StayEd_Report";
      const subtitle = REPORT_DATA.subtitle || "";
      const meta = REPORT_DATA.meta || [];
      const sections = REPORT_DATA.sections || [];

      if (title) lines.push('"' + String(title).replace(/"/g, '""') + '"');
      if (subtitle) lines.push('"' + String(subtitle).replace(/"/g, '""') + '"');
      lines.push('"Generated: ' + new Date().toLocaleString("en-PH") + '"');
      lines.push("");

      if (meta.length) {
        lines.push('"Report Summary / Filters:"');
        meta.forEach(m => {
          lines.push('"' + String(m.label).replace(/"/g, '""') + '","' + String(m.value).replace(/"/g, '""') + '"');
        });
        lines.push("");
      }

      sections.forEach(sec => {
        if (sec.title) lines.push('"' + String(sec.title).replace(/"/g, '""') + '"');
        if (sec.columns && sec.columns.length) {
          lines.push(sec.columns.map(c => '"' + String(stripHtml(c)).replace(/"/g, '""') + '"').join(","));
        }
        const rows = sec.rows || [];
        if (rows.length) {
          rows.forEach(r => {
            lines.push(r.map(c => '"' + String(stripHtml(c)).replace(/"/g, '""') + '"').join(","));
          });
        } else {
          lines.push('"' + String(sec.emptyText || "No records found.").replace(/"/g, '""') + '"');
        }
        lines.push("");
      });

      const csv = lines.join("\\r\\n");
      const blob = new Blob(["\\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const safeTitle = title.replace(/[^a-zA-Z0-9_-]/g, "_").replace(/__+/g, "_");
      link.href = url;
      link.download = safeTitle + ".csv";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  </script>
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
