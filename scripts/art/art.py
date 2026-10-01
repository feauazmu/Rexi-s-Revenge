"""The art pipeline's command line (ADR 0002; workflow in scripts/art/README.md).

    npm run art -- <command> [--root DIR] [...]       (uv run ... python scripts/art/art.py)

Commands:
  budget              spent / cap / remaining (CREDITS.md + uncredited ledger rows)
  gen NAME            one generation under the hard cap (gen.py has the options)
  credit              fold art/ledger.tsv into CREDITS.md (tables + running total)
  templates [NAME..]  build the manifest's "templates" (reference images on the model's grid)
  clean [SHEET..]     raw renders -> grid -> palette snap -> sliced, named sprites
  bake [PART..]       RotSprite pre-rotated parts with pivots
  export [MODULE..]   palette-indexed TypeScript sprite modules (--out DIR to redirect)
  preview             contact sheets + index.html in <root>/build/preview
  audit [--strict]    palette and pixel-rule lint (exit 1 on errors)
  holes [-v] [FILE..] enclosed-hole report
  build               clean, bake, export, preview, audit
  pixtext FILE        print a sprite as pixel text
--root defaults to art/ (the production root); reference/manu-pipeline is the version C prototype.
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import audit  # noqa: E402
import bake  # noqa: E402
import clean  # noqa: E402
import export_ts  # noqa: E402
import gen  # noqa: E402
import holes  # noqa: E402
import ledger  # noqa: E402
import preview  # noqa: E402
import template_specs  # noqa: E402
from project import Project  # noqa: E402


def main(argv=None):
    p = argparse.ArgumentParser(prog="art", description=__doc__.split("\n")[0])
    p.add_argument("--root", default=None, help="art root (default: art/)")
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--root", default=argparse.SUPPRESS, help="art root (default: art/)")
    sub = p.add_subparsers(dest="cmd", required=True)
    add = lambda name: sub.add_parser(name, parents=[common])  # noqa: E731
    add("budget")
    add("credit")
    gen.add_args(add("gen"))
    for name in ("templates", "clean", "bake"):
        add(name).add_argument("only", nargs="*")
    e = add("export"); e.add_argument("only", nargs="*"); e.add_argument("--out")
    pv = add("preview"); pv.add_argument("--scale", type=int, default=4)
    add("audit").add_argument("--strict", action="store_true")
    h = add("holes"); h.add_argument("files", nargs="*"); h.add_argument("-v", action="store_true")
    add("build").add_argument("--strict", action="store_true")
    add("pixtext").add_argument("file")
    a = p.parse_args(argv)

    if a.cmd == "budget":
        s = ledger.status()
        print(f"credited ${s['credited']:.4f} + pending ${s['pending']:.4f} = spent ${s['spent']:.4f} "
              f"of ${s['cap']:.2f}; remaining ${s['remaining']:.4f}")
        return 0
    if a.cmd == "credit":
        total = ledger.credit()
        print(f"CREDITS.md running total: ${total:.4f}")
        return 0
    if a.cmd == "pixtext":
        import pixtext
        sp = pixtext.load(a.file)
        print("    " + "".join(str(x % 10) for x in range(sp.shape[1])))
        for y, r in enumerate(pixtext.to_text(sp)):
            print(f"{y:3d} {r}")
        return 0
    if a.cmd == "gen":
        return gen.run(a)
    project = Project(a.root)
    if a.cmd == "templates":
        return template_specs.run(project, a.only)
    if a.cmd == "clean":
        return 1 if clean.run(project, a.only) else 0
    if a.cmd == "bake":
        return bake.run(project, a.only)
    if a.cmd == "export":
        export_ts.run(project, a.only, a.out)
        return 0
    if a.cmd == "preview":
        preview.run(project, a.scale)
        return 0
    if a.cmd == "audit":
        return 1 if audit.run(project, a.strict) else 0
    if a.cmd == "holes":
        holes.run(project.root, a.files, a.v)
        return 0
    if a.cmd == "build":
        problems = clean.run(project)
        bake.run(project)
        export_ts.run(project)
        preview.run(project)
        errors = audit.run(project, a.strict)
        return 1 if errors or problems else 0
    return 2


if __name__ == "__main__":
    sys.exit(main())
