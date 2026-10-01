"""An art root: a directory with a `sheets.json` manifest and the pipeline's folders.

    <root>/sheets.json      the manifest: "sheets" (raw render -> sprites), "parts" (RotSprite
                            bakes) and "exports" (TypeScript modules); see scripts/art/README.md
    <root>/prompts/*.txt    prompt files (one per generation; _style.txt is the shared preamble)
    <root>/templates/       reference images passed to the model (built by code)
    <root>/raw/             full-size renders (git-ignored in art/) and their JSON sidecars
    <root>/grid/            each render resampled to its art grid (1 cell = 1 px, not snapped)
                            plus pitches.json: all clean needs, so a fresh clone rebuilds
    <root>/sprites/         cleaned, palette-snapped sprites (an entry's `out` may differ)
    <root>/parts/           pre-rotated parts (RotSprite) with their pivots
    <root>/build/           previews, contact sheets and reports (git-ignored)

The production root is art/. reference/manu-pipeline/ is the version C prototype, kept as a
second root so its outputs stay reproducible.
"""
import json
import os

from palette import ROOT

DEFAULT_ROOT = os.path.join(ROOT, "art")
KIND_PALETTE = {"char": "character", "sprite": "prop", "icon": "icon", "scene": "scene"}


class ManifestError(Exception):
    pass


class Project:
    def __init__(self, root=None):
        self.root = os.path.abspath(root or DEFAULT_ROOT)
        self.manifest_path = os.path.join(self.root, "sheets.json")
        if not os.path.exists(self.manifest_path):
            raise ManifestError(f"no sheets.json in {self.root}")
        self.manifest = json.load(open(self.manifest_path))
        for section in ("sheets", "parts", "exports"):
            self.manifest.setdefault(section, {})
        self._validate()

    # ------------------------------------------------------------------ paths
    def path(self, *parts):
        return os.path.join(self.root, *parts)

    @property
    def rel(self):
        return os.path.relpath(self.root, ROOT)

    def raw(self, name):
        return self.path("raw", name + ".png")

    def grid(self, name):
        return self.path("grid", name + ".png")

    def out_dir(self, cfg):
        return self.path(cfg.get("out", "sprites"))

    # ------------------------------------------------------------------ entries
    def section(self, name):
        """A manifest section without its `_`-prefixed (comment or disabled) entries."""
        return {k: v for k, v in self.manifest.get(name, {}).items() if not k.startswith("_")}

    @property
    def sheets(self):
        return self.section("sheets")

    @property
    def parts(self):
        return self.section("parts")

    @property
    def exports(self):
        return self.section("exports")

    def palette_spec(self, cfg):
        return cfg.get("palette", KIND_PALETTE[cfg["kind"]])

    def outputs(self):
        """Every sprite file the sheets write: [(sheet, kind, palette spec, path)]."""
        out = []
        for name, cfg in self.sheets.items():
            if cfg["kind"] == "scene":
                names = [cfg.get("name", name)] + [f"{cfg.get('name', name)}_{l}" for l in cfg.get("layers", {})]
            else:
                names = [n for n in cfg.get("names", []) if n]
            for n in names:
                out.append((name, cfg["kind"], self.palette_spec(cfg), os.path.join(self.out_dir(cfg), n + ".png")))
        return out

    def _validate(self):
        for name, cfg in self.sheets.items():
            kind = cfg.get("kind")
            if kind not in KIND_PALETTE:
                raise ManifestError(f"{name}: kind must be one of {sorted(KIND_PALETTE)}, not {kind!r}")
            if kind != "scene" and not isinstance(cfg.get("names"), list):
                raise ManifestError(f"{name}: a {kind} sheet needs a `names` list (null skips a sprite)")
            if kind == "icon" and "canvas" not in cfg:
                raise ManifestError(f"{name}: an icon sheet needs a `canvas` [w, h]")
        for name, cfg in self.parts.items():
            for key in ("src", "pivot", "angles"):
                if key not in cfg:
                    raise ManifestError(f"parts.{name}: missing `{key}`")
        for name, cfg in self.exports.items():
            if not cfg.get("sprites"):
                raise ManifestError(f"exports.{name}: needs a `sprites` list of globs")
            if cfg.get("format", "rows") not in ("rows", "rle"):
                raise ManifestError(f"exports.{name}: format is rows or rle")


def _json(value, indent, prefix_len, width=100):
    pad = " " * indent
    if isinstance(value, dict):
        if not value:
            return "{}"
        items = [f'{pad}  {json.dumps(str(k))}: {_json(v, indent + 2, indent + 4 + len(json.dumps(str(k))))}'
                 for k, v in value.items()]
        return "{\n" + ",\n".join(items) + "\n" + pad + "}"
    if isinstance(value, list):
        if not value:
            return "[]"
        if not any(isinstance(v, dict) for v in value):
            inline = "[" + ", ".join(_json(v, 0, 0) for v in value) + "]"
            if "\n" not in inline and prefix_len + len(inline) + 1 <= width:
                return inline
        items = [f"{pad}  {_json(v, indent + 2, indent + 2)}" for v in value]
        return "[\n" + ",\n".join(items) + "\n" + pad + "]"
    return json.dumps(value, ensure_ascii=False)


def write_json(path, value, sort_keys=False):
    """Write JSON the way Prettier formats it (objects expanded, short arrays inline, 2-space
    indent, trailing newline), so generated files pass `prettier --check`."""
    if sort_keys:
        value = json.loads(json.dumps(value, sort_keys=True))
    with open(path, "w") as f:
        f.write(_json(value, 0, 0) + "\n")


def angles(spec):
    """A parts entry's `angles`: a list of degrees, or {"from", "to", "step"} (inclusive)."""
    if isinstance(spec, list):
        return [float(a) for a in spec]
    a, out = float(spec["from"]), []
    while a <= float(spec["to"]) + 1e-9:
        out.append(round(a, 4))
        a += float(spec["step"])
    return out
