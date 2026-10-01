"""One image generation through the creation-tool CLI, under the hard budget cap.

    art.py gen NAME [--root DIR] [--prompt-file prompts/X.txt | --prompt "..."] [--ref PATH ...]
                    [--style] [--model M] [--res 2K] [--aspect 16:9] [--note "..."] [--dry-run]

- The prompt and references default to the manifest's sheet entry of the same NAME
  (`prompt`, `refs`), so a sheet can be regenerated from what is committed.
- `--style` prepends <root>/prompts/_style.txt (the shared pixel-art rules) to the prompt.
- Before calling the model it checks spent + the model's cost estimate against the cap
  (ledger.check) and refuses past it. After the call it appends the real cost to
  art/ledger.tsv and adds a "pipeline" block (root, prompt file, references, ledger total) to
  the sidecar creation-tool writes next to the render.
- Writes <root>/raw/NAME.png and NAME.json. Run `art.py credit` to fold the ledger into
  CREDITS.md.
"""
import json
import os
import subprocess
import sys

import ledger
from palette import ROOT
from project import Project, write_json

TOOL = os.environ.get("CREATION_TOOL", os.path.expanduser("~/.local/bin/creation-tool"))
DEFAULT_MODEL = "google/gemini-3.1-flash-image"


def add_args(p):
    p.add_argument("name")
    p.add_argument("--prompt")
    p.add_argument("--prompt-file", help="prompt file, relative to the root (prompts/X.txt)")
    p.add_argument("--ref", action="append", default=None, help="reference image (repeatable), relative to the root")
    p.add_argument("--style", action="store_true", help="prepend prompts/_style.txt")
    p.add_argument("--model", default=None)
    p.add_argument("--res", default="2K")
    p.add_argument("--aspect", default="16:9")
    p.add_argument("--note", default="")
    p.add_argument("--dry-run", action="store_true", help="print the call and the budget check only")


def _resolve(project, path):
    return path if os.path.isabs(path) else project.path(path)


def run(a):
    project = Project(a.root)
    cfg = project.manifest["sheets"].get(a.name, {})
    model = a.model or cfg.get("model", DEFAULT_MODEL)
    prompt_file = a.prompt_file or cfg.get("prompt")
    if a.prompt:
        prompt = a.prompt
    elif prompt_file:
        prompt = open(_resolve(project, prompt_file)).read().strip()
    else:
        sys.exit(f"{a.name}: no --prompt, --prompt-file or manifest `prompt`")
    if a.style or cfg.get("style"):
        prompt = open(project.path("prompts", "_style.txt")).read().strip() + "\n\n" + prompt
    refs = [_resolve(project, r) for r in (a.ref if a.ref is not None else cfg.get("refs", []))]
    missing = [r for r in refs if not os.path.exists(r)]
    if missing:
        sys.exit(f"missing reference(s): {missing} (build templates first: art.py templates)")
    cost_estimate = ledger.estimate(model, a.res if model.startswith("google/") else None)
    try:
        s = ledger.check(cost_estimate)
    except ledger.BudgetError as e:
        sys.exit(str(e))
    out_png = project.raw(a.name)
    if os.path.exists(out_png) and not a.dry_run:
        sys.exit(f"{os.path.relpath(out_png, ROOT)} exists: pick a new name (v2, v3...) so every render stays on record")
    cmd = [TOOL, "image", "--prompt", prompt, "--model", model, "--aspect-ratio", a.aspect,
           "--output-dir", project.path("raw"), "--name", a.name, "--count", "1"]
    if model.startswith("google/"):
        cmd += ["--resolution", a.res]
    for r in refs:
        cmd += ["--reference", os.path.abspath(r)]
    print(f"budget: spent ${s['spent']:.4f} of ${s['cap']:.2f}; this call ~${cost_estimate:.2f}")
    if a.dry_run:
        print("dry run:", " ".join(c if len(c) < 80 else c[:77] + "..." for c in cmd))
        return 0
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print(res.stdout, res.stderr)
        return 1
    out = json.loads(res.stdout)
    item = out[0] if isinstance(out, list) else out
    first = (item.get("assets") or [item])[0]
    path = first.get("path", out_png)
    cost = item.get("cost_usd") or first.get("cost_usd") or 0
    ledger.record(project.rel, a.name, model, cost, os.path.basename(path), a.note)
    total = ledger.status()
    sidecar = os.path.splitext(path)[0] + ".json"
    if os.path.exists(sidecar):
        meta = json.load(open(sidecar))
        meta["pipeline"] = {"root": project.rel, "prompt_file": prompt_file, "style": bool(a.style or cfg.get("style")),
                            "references": [os.path.relpath(r, ROOT) for r in refs], "note": a.note,
                            "spent_after_usd": total["spent"]}
        write_json(sidecar, meta)
    print(json.dumps({"path": os.path.relpath(path, ROOT), "cost_usd": cost, "spent_usd": total["spent"],
                      "remaining_usd": total["remaining"]}))
    return 0
