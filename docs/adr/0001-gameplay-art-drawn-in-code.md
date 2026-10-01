---
status: superseded by ADR-0002
---

# Gameplay art is drawn in code

> **Superseded** by [ADR 0002, "Pixel-art rules and pipeline"](0002-pixel-art-rules-and-pipeline.md): gameplay art is now generated pixel art made through the committed pipeline and drawn by the renderer as palette-indexed data. The determinism rule below survives in ADR 0002.

Every gameplay sprite and animation (Rexi, Enemies, Weapons, Crates, effects, the Arena background and the Dialogue Box) is drawn and animated in TypeScript on canvas 2D, by hand, with no image files. AI-generated images, themselves in pixel-art style, are only used as concept references for drawing that code, plus one exception: the title-screen illustration. We chose this so the pixel-art style stays consistent (generated art mixed with hand-coded sprites clashes) and so that all animation stays under programmatic control. Don't import sprite sheets or generated images into gameplay.
