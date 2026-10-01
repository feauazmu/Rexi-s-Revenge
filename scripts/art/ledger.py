"""The cost ledger and the hard budget cap for generated media.

CREDITS.md is the source of truth for money already spent: its Budget table ends in
"| **Running total** | **T of CAP** ... |". Pipeline generations are appended to
art/ledger.tsv as they happen (one row each, `credited` = no) and folded into CREDITS.md by
`art.py credit`, which rewrites the "Art pipeline" table and the Budget rows and marks the
rows credited. So at any moment:

    spent = CREDITS.md running total + every ledger row not yet credited

and `check(estimate)` refuses a generation when spent + estimate would pass the cap.

    from ledger import status, check, record, credit
"""
import csv
import datetime
import os
import re
import subprocess

from palette import ROOT

CREDITS = os.path.join(ROOT, "CREDITS.md")
LEDGER = os.path.join(ROOT, "art", "ledger.tsv")
FIELDS = ["time", "root", "name", "model", "cost_usd", "file", "credited", "note"]

# Upper estimates per call (USD), used before a call to keep spent + estimate under the cap.
# Measured: gemini-3.1-flash-image at 2K 16:9 cost 0.1015-0.1027 per call (CREDITS.md).
ESTIMATES = {
    ("google/gemini-3.1-flash-image", "2K"): 0.11,
    ("google/gemini-3.1-flash-image", "1K"): 0.07,
    ("google/gemini-3.1-flash-image", "4K"): 0.16,
    ("google/gemini-3-pro-image", "2K"): 0.15,
    ("google/gemini-3-pro-image", "4K"): 0.25,
    ("openai/gpt-image-2", None): 0.10,
}
DEFAULT_ESTIMATE = 0.25
HARD_CAP = 10.00       # the owner's cap (#24); CREDITS.md may state a lower one, never a higher one

TOTAL_RE = re.compile(r"\|\s*\*\*Running total\*\*\s*\|\s*\*\*([0-9.]+) of ([0-9.]+)\*\*[^|]*\|")


class BudgetError(Exception):
    pass


def estimate(model, resolution=None):
    return ESTIMATES.get((model, resolution), ESTIMATES.get((model, None), DEFAULT_ESTIMATE))


def credits_total(path=CREDITS):
    """(running total, cap) from the Budget table of CREDITS.md."""
    m = TOTAL_RE.search(open(path).read())
    if not m:
        raise BudgetError(f"no '**Running total** | **T of CAP**' row in {path}")
    return float(m.group(1)), min(float(m.group(2)), HARD_CAP)


def rows(path=LEDGER):
    if not os.path.exists(path):
        return []
    with open(path) as f:
        return list(csv.DictReader(f, delimiter="\t"))


def status(credits=CREDITS, ledger=LEDGER):
    total, cap = credits_total(credits)
    pending = sum(float(r["cost_usd"] or 0) for r in rows(ledger) if r["credited"] != "yes")
    spent = total + pending
    return {"credited": total, "pending": round(pending, 6), "spent": round(spent, 6), "cap": cap,
            "remaining": round(cap - spent, 6)}


def check(cost_estimate, credits=CREDITS, ledger=LEDGER):
    """Raise BudgetError unless spent + cost_estimate stays within the cap. Returns status()."""
    s = status(credits, ledger)
    if s["spent"] + cost_estimate > s["cap"] + 1e-9:
        raise BudgetError(f"budget cap: spent ${s['spent']:.4f} + estimate ${cost_estimate:.4f} "
                          f"> cap ${s['cap']:.2f} (remaining ${s['remaining']:.4f})")
    return s


def record(root, name, model, cost, file, note="", ledger=LEDGER):
    new = not os.path.exists(ledger)
    os.makedirs(os.path.dirname(ledger), exist_ok=True)
    with open(ledger, "a", newline="") as f:
        w = csv.DictWriter(f, FIELDS, delimiter="\t", lineterminator="\n")
        if new:
            w.writeheader()
        w.writerow({"time": datetime.datetime.now().isoformat(timespec="seconds"), "root": root,
                    "name": name, "model": model, "cost_usd": cost, "file": file, "credited": "no",
                    "note": note.replace("\t", " ").replace("\n", " ")})


# ---------------------------------------------------------------- folding into CREDITS.md
START, END = "<!-- art-ledger:start -->", "<!-- art-ledger:end -->"
BUDGET_ROW = "Art pipeline"


def _money(x):
    return f"{x:.4f}"


def credit(credits=CREDITS, ledger=LEDGER, fmt=True):
    """Fold the ledger into CREDITS.md: the per-generation table between the art-ledger markers,
    the Budget table's "Art pipeline (N generations)" row and the running total (moved by the
    change in that row). Marks every ledger row credited. Returns the new total."""
    all_rows = rows(ledger)
    text = open(credits).read()
    table = ["| # | Time | Root | Name | Model | Cost (USD) | Note |",
             "| - | ---- | ---- | ---- | ----- | ---------- | ---- |"]
    for i, r in enumerate(all_rows, 1):
        table.append(f"| {i} | {r['time']} | `{r['root']}` | `{r['name']}` | {r['model']} | "
                     f"{_money(float(r['cost_usd'] or 0))} | {r['note'] or ''} |")
    if not all_rows:
        table.append("| | | | (none yet) | | 0.0000 | |")
    block = f"{START}\n\n" + "\n".join(table) + f"\n\n{END}"
    if START in text:
        text = re.sub(re.escape(START) + r".*?" + re.escape(END), lambda _: block, text, flags=re.S)
    else:
        section = ("## Art pipeline\n\nGenerations made with `scripts/art` (see its README), folded in from "
                   "`art/ledger.tsv` by `npm run art -- credit`. Raw renders and their JSON sidecars are in "
                   f"each art root's `raw/`.\n\n{block}\n\n")
        text = text.replace("## Budget", section + "## Budget", 1)
    pipeline = sum(float(r["cost_usd"] or 0) for r in all_rows)
    # Budget table: replace or insert the pipeline row, then recompute the running total.
    lines = text.rstrip("\n").split("\n")
    total_i = next((i for i, l in enumerate(lines) if TOTAL_RE.search(l)), None)
    heads = [i for i in range(total_i or 0) if lines[i].startswith("| Item")]
    if total_i is None or not heads:
        raise BudgetError(f"{credits}: the Budget table needs an '| Item' header and a Running total row")
    head_i = heads[-1]
    row = f"| {BUDGET_ROW} ({len(all_rows)} generations) | {_money(pipeline)} |"
    existing = [i for i in range(head_i, total_i) if lines[i].startswith(f"| {BUDGET_ROW} (")]
    old_pipeline = float(lines[existing[0]].strip().strip("|").split("|")[1]) if existing else 0.0
    if existing:
        lines[existing[0]] = row
    elif all_rows:
        lines.insert(total_i, row)
        total_i += 1
    # Adjust the stated total by the pipeline row's change instead of re-adding the rounded rows:
    # the image subtotal comes from unrounded sidecar costs (see CREDITS.md), so a re-sum could drift.
    old_total, cap = credits_total(credits)
    items = round(old_total - old_pipeline + pipeline, 6)
    lines[total_i] = (f"| **Running total** | **{_money(items)} of {cap:.2f}** "
                      f"({_money(cap - items)} remaining) |")
    open(credits, "w").write("\n".join(lines) + "\n")
    if all_rows:
        with open(ledger, "w", newline="") as f:
            w = csv.DictWriter(f, FIELDS, delimiter="\t", lineterminator="\n")
            w.writeheader()
            for r in all_rows:
                w.writerow({**r, "credited": "yes"})
    if fmt:
        res = subprocess.run(["npx", "prettier", "--write", credits], cwd=ROOT, capture_output=True, text=True)
        if res.returncode != 0:
            print(f"warning: prettier failed on {credits}; run `npm run format`:\n{res.stderr}")
    return items
