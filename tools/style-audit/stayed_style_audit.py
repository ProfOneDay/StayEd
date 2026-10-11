#!/usr/bin/env python3
"""StayEd style-consistency audit.

Run from the StayEd_Frontend folder (or pass its path):

    pip install tinycss2
    python stayed_style_audit.py            # report
    python stayed_style_audit.py --strict   # also exit 1 if any target is missed

Prints one line per check with the current count and the target, so each
refactor phase can be verified by re-running it. Read-only: it never edits files.
"""
import collections
import os
import re
import sys

try:
    import tinycss2
except ImportError:
    sys.exit("Install the parser first:  pip install tinycss2")

ROOT = next((a for a in sys.argv[1:] if not a.startswith("--")), ".")
STRICT = "--strict" in sys.argv
CSS_DIR = os.path.join(ROOT, "assets", "css")
if not os.path.isdir(CSS_DIR):
    sys.exit(f"No assets/css folder under {os.path.abspath(ROOT)}")

SHARED_FILES = {"variables.css", "components.css", "layout.css"}  # + components/*.css


def is_shared(rel):
    return os.path.basename(rel) in SHARED_FILES or rel.startswith("components" + os.sep) or rel.startswith("components/")


# ---------- parse ----------
records = []  # (file, line, ctx, selector, decls)
keyframes = collections.defaultdict(list)
comment_breaks = []

def decls_of(content):
    out = {}
    for d in tinycss2.parse_blocks_contents(content, skip_whitespace=True, skip_comments=True):
        if d.type == "declaration":
            out[d.lower_name] = " ".join(tinycss2.serialize(d.value).split()) + (" !important" if d.important else "")
    return out

def split_selectors(sel):
    depth, cur, parts = 0, "", []
    for ch in sel:
        depth += ch in "(["
        depth -= ch in ")]"
        if ch == "," and depth == 0:
            parts.append(cur); cur = ""
        else:
            cur += ch
    parts.append(cur)
    return [" ".join(p.split()) for p in parts if p.strip()]

def walk(rules, rel, ctx):
    for r in rules:
        if r.type == "qualified-rule":
            sel = tinycss2.serialize(r.prelude).strip()
            d = decls_of(r.content)
            for s in split_selectors(sel):
                records.append((rel, r.source_line, ctx, s, d))
        elif r.type == "at-rule" and r.content is not None:
            kw = r.lower_at_keyword
            pre = " ".join(tinycss2.serialize(r.prelude).split())
            if kw in ("media", "supports", "container", "layer"):
                walk(tinycss2.parse_rule_list(r.content, skip_whitespace=True, skip_comments=True), rel, f"{ctx}@{kw} {pre};")
            elif kw.endswith("keyframes"):
                keyframes[pre].append(rel)

for dp, _, fs in os.walk(CSS_DIR):
    for f in sorted(fs):
        if not f.endswith(".css"):
            continue
        p = os.path.join(dp, f)
        rel = os.path.relpath(p, CSS_DIR).replace(os.sep, "/")
        src = open(p, encoding="utf-8", errors="replace").read()
        # A "*/" written inside a comment's text ends the comment early, and the
        # leftover words get glued onto the next selector, which the browser drops.
        for m in re.finditer(r"/\*(.*?)\*/", src, flags=re.S):
            # stray "*/" before the next "{" or "}" with no new "/*" opened in between
            tail = re.split(r"[{}]", src[m.end():m.end() + 2000])[0]
            if "*/" in tail and "/*" not in tail.split("*/")[0]:
                comment_breaks.append(f"{rel}:{src[:m.start()].count(chr(10)) + 1}")
        walk(tinycss2.parse_stylesheet(src, skip_whitespace=True, skip_comments=True), rel, "")

# ---------- helpers ----------
PAGE_SCOPE = re.compile(r'\[data-page="[^"]*"\]')

def subject_class(sel):
    s = re.sub(r"::?[a-zA-Z-]+(\([^)]*\))?", "", sel)
    last = re.split(r"\s*[ >+~]\s*", s.strip())[-1]
    m = re.findall(r"\.([A-Za-z0-9_-]+)", last)
    return m[0] if m else None

results = []
def check(name, value, target, detail=""):
    ok = value <= target
    results.append(ok)
    mark = "OK  " if ok else "TODO"
    print(f"[{mark}] {name:58s} {value:>6}   target <= {target}")
    if detail and not ok:
        print("        " + detail)

print(f"\nStayEd style audit: {os.path.abspath(ROOT)}\n")

# 1 broken comments
check("Comments that end early and break the next rule", len(comment_breaks), 0, ", ".join(comment_breaks[:6]))

# 2 core components defined outside the shared files
CORE = ["st-btn", "st-btn-primary", "st-btn-outline", "st-btn-secondary", "st-btn-danger", "st-btn-danger-outline",
        "st-btn-ghost", "st-btn-sm", "st-btn-xs", "st-text-btn", "st-icon-btn-sm", "st-search", "st-select", "st-input",
        "st-field", "st-toggle", "st-toggle-track", "st-toggle-thumb", "st-toggle-row", "st-badge", "st-pill", "st-chip",
        "st-risk-badge", "st-avatar-initials", "st-icon-tile", "st-card", "st-panel", "st-panel-head", "st-panel-title",
        "st-table-card", "st-table-card-head", "st-table-card-title", "st-toolbar", "st-data-table", "st-pagination",
        "st-page-btn", "st-row-actions", "st-row-menu-trigger", "st-learner-cell", "st-two-line", "st-risk-cell",
        "st-risk-meter", "st-empty", "st-segment", "chart-type-toggle", "chart-type-btn", "st-modal", "st-modal-card",
        "st-filter-bar", "st-class-context-banner", "st-sort-btn", "st-sr-only"]
outside = collections.defaultdict(set)
for f, line, ctx, sel, d in records:
    k = subject_class(sel)
    if k in CORE and not is_shared(f):
        outside[k].add(f)
check("Core components styled outside shared files", len(outside), 0,
      "; ".join(f".{k} in {', '.join(sorted(v))}" for k, v in sorted(outside.items())[:8]))

# 3 same core component, base rule, conflicting values
conf = 0
detail = []
for k in CORE:
    vals = collections.defaultdict(set)
    for f, line, ctx, sel, d in records:
        base = PAGE_SCOPE.sub("", re.sub(r"^body(:is\([^)]*\))?|\.st-admin", "", sel)).strip()
        if base == "." + k and "max-width" not in ctx:
            for p in ("height", "padding", "border-radius", "font-size", "background", "border"):
                if p in d:
                    vals[p].add(d[p])
    bad = [p for p, v in vals.items() if len(v) > 1]
    if bad:
        conf += 1
        detail.append(f".{k}({','.join(bad)})")
check("Core components with conflicting base values", conf, 0, " ".join(detail[:10]))

# 4 page-list scopes used to share styles
lists = sum(1 for *_, sel, _ in records if len(PAGE_SCOPE.findall(sel)) >= 2)
check('Selectors sharing styles via body:is([data-page=..],..) lists', lists, 0)

# 5 tokens
var_src = open(os.path.join(CSS_DIR, "variables.css"), encoding="utf-8").read()
tok = dict(re.findall(r"(--st-[a-z0-9-]+)\s*:\s*([^;]+);", var_src))
all_css = ""
for dp, _, fs in os.walk(CSS_DIR):
    for f in fs:
        if f.endswith(".css"):
            all_css += open(os.path.join(dp, f), encoding="utf-8", errors="replace").read()
legacy = ["--st-card-radius", "--st-button-radius", "--st-input-radius", "--st-card-border", "--st-danger",
          "--st-danger-light", "--st-warning", "--st-warning-light", "--st-success", "--st-success-light",
          "--st-risk-high-soft-2", "--st-risk-moderate-soft-2", "--st-risk-low-soft-2"]
legacy_uses = sum(len(re.findall(re.escape(f"var({t}") + r"[,)]", all_css)) for t in legacy)
check("Uses of legacy/duplicate tokens (5px card radius etc.)", legacy_uses, 0)
chains = len(re.findall(r"var\(--st-[a-z0-9-]+,\s*var\(--st-", all_css))
check("Two-token fallback chains var(--a, var(--b))", chains, 0)

hexes = 0
for dp, _, fs in os.walk(CSS_DIR):
    for f in fs:
        if f.endswith(".css") and f != "variables.css":
            s = re.sub(r"/\*.*?\*/", "", open(os.path.join(dp, f), encoding="utf-8", errors="replace").read(), flags=re.S)
            s = re.sub(r"var\(--[^,)]+,\s*#[0-9a-fA-F]+\)", "", s)
            hexes += len([h for h in re.findall(r"#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b", s) if h.lower() not in ("#fff", "#ffffff", "#000")])
check("Hard-coded hex colors outside variables.css (not #fff)", hexes, 25)

# 6 scale consistency
radii = {d["border-radius"] for *_, d in records if "border-radius" in d}
check("Distinct border-radius values", len(radii), 12)
bps = collections.Counter(m for *_, ctx, _, _ in [(r[0], r[1], r[2], r[3], r[4]) for r in records]
                          for m in re.findall(r"\((?:max|min)-width:\s*([0-9.]+)px\)", ctx))
check("Distinct media-query breakpoints", len(bps), 4, "in use: " + ", ".join(sorted(bps, key=float)))
fsz = {d["font-size"] for *_, d in records if "font-size" in d}
check("Distinct font-size values", len(fsz), 20)
imp = sum(1 for *_, d in records for v in d.values() if v.endswith("!important"))
check("!important declarations", imp, 40)

# 7 keyframes
dup_kf = [k for k, v in keyframes.items() if len(v) > 1]
check("@keyframes names defined more than once", len(dup_kf), 0, ", ".join(dup_kf))
check("@keyframes total (many are identical copies)", sum(len(v) for v in keyframes.values()), 20)

# 8 duplicate declaration blocks
blocks = collections.defaultdict(set)
for f, line, ctx, sel, d in records:
    if len(d) >= 5:
        blocks[tuple(sorted(d.items()))].add(f)
check("Identical 5+ property blocks copied across files", sum(1 for v in blocks.values() if len(v) > 1), 3)

# 9 inline styles and JS helpers
inline = 0
helper_defs = collections.Counter()
HELPERS = {"initials": r"(?:static|function)\s+initials\s*\(|const\s+initials\s*=",
           "esc/escapeHtml": r"(?:static|function)\s+(?:esc|escapeHtml|escHtml|escAttr)\s*\(",
           "countTo/countUp": r"(?:static|function)\s+(?:countTo|countUp|animateCount)\s*\(",
           "riskPill/riskBadge": r"(?:static|function)\s+(?:riskPill|riskBadge|riskClass)\s*\("}
for dp, _, fs in os.walk(ROOT):
    if "node_modules" in dp:
        continue
    for f in fs:
        if f.endswith((".html", ".js")):
            s = open(os.path.join(dp, f), encoding="utf-8", errors="replace").read()
            for m in re.findall(r'style\s*=\s*\\?["\']([^"\'$]*)', s):
                props = [p.split(":")[0].strip() for p in m.split(";") if ":" in p]
                if any(p and not p.startswith("--") for p in props):
                    inline += 1
            for name, pat in HELPERS.items():
                if re.search(pat, s) and not f == "utils.js":
                    helper_defs[name] += 1
check('Inline style="" with real properties (not --i / --w)', inline, 15)
for name in HELPERS:
    check(f"JS helper '{name}' re-implemented outside core/utils.js", helper_defs[name], 0)

print(f"\n{sum(results)}/{len(results)} checks on target.\n")
if STRICT and not all(results):
    sys.exit(1)
