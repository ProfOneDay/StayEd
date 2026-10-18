// "Charts as reports": every number a chart shows on hover is also printed
// on the chart itself, so a screenshot, printout, or projected slide still
// carries the information without anyone hovering. Shared by the teacher
// and admin dashboards (load after Chart.js, before the page script).
//
//   ST_SLICE_PERCENT   plugin  -- "NN%" written on each doughnut/pie slice
//   ST_BAR_VALUES      plugin  -- count written on top of each bar
//   ST_LEGEND_VALUES(base)     -- legend options whose entries read
//                                 "Label · count (NN%)" instead of "Label"

// Slices thinner than this get no on-slice label (it wouldn't fit and would
// collide with its neighbours); the legend still lists their value.
const ST_MIN_LABELLED_SHARE = 0.05;

function stShareOf(values, value) {
  const total = values.reduce((sum, v) => sum + (Number(v) || 0), 0);
  return total ? Math.round(((Number(value) || 0) / total) * 100) : 0;
}

// White text on dark slices, navy on light ones (e.g. the light-blue
// category color or the grey "Not yet assessed").
function stTextColorFor(color) {
  const hex = String(color || "").replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(hex)) return "#ffffff";
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.6 ? "#111a36" : "#ffffff";
}

const ST_SLICE_PERCENT = {
  id: "stSlicePercent",
  afterDatasetsDraw(chart) {
    if (!["doughnut", "pie"].includes(chart.config.type)) return;
    const dataset = chart.data.datasets[0];
    const meta = chart.getDatasetMeta(0);
    if (!dataset || !meta) return;

    // Shares are of the full total (same as the legend), so a slice and its
    // legend entry always agree even if a slice is toggled off.
    const values = dataset.data.map((v) => Number(v) || 0);
    const total = values.reduce((a, b) => a + b, 0);
    if (!total) return;

    const { ctx } = chart;
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "700 12px Inter, system-ui, sans-serif";

    meta.data.forEach((arc, i) => {
      const value = values[i];
      if (!value || !chart.getDataVisibility(i) || value / total < ST_MIN_LABELLED_SHARE) return;
      // Final geometry, so labels sit where the slice ends up instead of
      // sliding around during the entry animation.
      const { x, y, startAngle, endAngle, innerRadius, outerRadius } = arc.getProps(
        ["x", "y", "startAngle", "endAngle", "innerRadius", "outerRadius"],
        true,
      );
      const angle = (startAngle + endAngle) / 2;
      const r = innerRadius + (outerRadius - innerRadius) / 2;
      const color = Array.isArray(dataset.backgroundColor) ? dataset.backgroundColor[i] : dataset.backgroundColor;
      ctx.fillStyle = stTextColorFor(color);
      ctx.fillText(`${Math.round((value / total) * 100)}%`, x + Math.cos(angle) * r, y + Math.sin(angle) * r);
    });
    ctx.restore();
  },
};

const ST_BAR_VALUES = {
  id: "stBarValues",
  afterDatasetsDraw(chart) {
    if (chart.config.type !== "bar") return;
    const { ctx } = chart;
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.font = "700 11px Inter, system-ui, sans-serif";
    ctx.fillStyle = "#3a4256";
    chart.data.datasets.forEach((dataset, di) => {
      const meta = chart.getDatasetMeta(di);
      if (meta.hidden) return;
      meta.data.forEach((bar, i) => {
        const value = Number(dataset.data[i]) || 0;
        const { x, y } = bar.getProps(["x", "y"], true);
        ctx.fillText(String(value), x, y - 4);
      });
    });
    ctx.restore();
  },
};

// Wraps a page's base legend options (position, point style, colors...) so
// each entry also shows its count and share. Doughnut/pie only -- one
// legend entry per slice.
function ST_LEGEND_VALUES(base = {}) {
  return {
    ...base,
    labels: {
      ...(base.labels || {}),
      generateLabels(chart) {
        const items = Chart.overrides.doughnut.plugins.legend.labels.generateLabels(chart);
        const data = chart.data.datasets[0]?.data || [];
        return items.map((item) => {
          const value = Number(data[item.index]) || 0;
          return { ...item, text: `${item.text} · ${value} (${stShareOf(data, value)}%)` };
        });
      },
    },
  };
}

window.ST_SLICE_PERCENT = ST_SLICE_PERCENT;
window.ST_BAR_VALUES = ST_BAR_VALUES;
window.ST_LEGEND_VALUES = ST_LEGEND_VALUES;
