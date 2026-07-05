# Editorial-Artifacts design system — reference

Rigorous notes from reading `QuangDao215/editorial-artifact-skills` (the "editorial
artifacts" Claude skill). Source of truth for our ongoing design-adoption work on the
KCD2 map. The repo is a **design system (`theme/`)** + a **generate→render→critic loop
(`loop/`)** for producing self-contained editorial HTML artifacts. The loop is for
one-page artifacts, not an app like ours — but the **theme rules and the critic's checks
are the reusable part**.

Repo layout: `theme/{design-tokens.css, components.css, gallery.html, RULEBOOK.md}`,
`loop/{generate.py, render.py, critic.py, examples/}`.

---

## 1. Three themes, one token file

Themes: **light**, **dark**, **Ember** (warm, reading-focused — the theme the whole
system is calibrated against). Tokens live in `theme/design-tokens.css`; a page **inlines
a mirror** of them (CSP-safe, self-contained), never links the file.

**Naming debt to know:** the three chromatic slots are historically named `--purple`
(accent), `--teal` (secondary), `--blue` (tertiary). Semantic aliases `--accent /
--secondary / --tertiary` are the correct names.

**Ember palette** (warm, low-chroma):

| Role | Token | Value |
|---|---|---|
| Page ground | `--canvas-a` / `--canvas-b` | `#F8F2E6` / `#F1E7D4` |
| Card surface | `--white` / `--panel` | `#FFFDF8` |
| Soft surface | `--offwhite` | `#F4EEE1` |
| Body ink | `--ink` | `#2A231C` |
| Heading ink | `--ink-2` | `#1A1410` |
| Muted text | `--muted` | `#736757` |
| Hairline | `--gridline` | `#E9DFCB` |
| **Accent (coral)** | `--purple` slot | `#CB4E2A` |
| **Secondary (sage)** | `--teal` slot | `#3F8F6E` |
| Tertiary (warm slate) | `--blue` slot | `#33566E` |

Status remapped warm: ok=sage, warn=ochre `#B4791E`, fail=coral, na=warm gray, each over a
soft warm tint (`--*-soft`). Segmented-control tokens: `--seg-track/thumb/on/off`.

**Type scale** (one display serif + sans + mono):
- serif `"Charter", "Bitstream Charter", "Iowan Old Style", Georgia, serif` (system, no web font) — hero + card titles only.
- `--text-display` clamp(23,2.6vw,31) · `--text-title` 15.5 · `--text-body` 14 · `--text-body-sm` 12.5 · `--text-eyebrow` 10.5 · `--text-figure-lg` 22 · `--text-figure` 20 · `--text-micro` 10. Eyebrow tracking `0.06em`.

**Spacing scale:** `4 / 8 / 12 / 16 / 24 / 32 / 44`. **Radii:** `--radius-lg 16` (card),
`--radius 12` (panel/control group), `--radius-sm 9` (input/button), `--radius-pill 999`.
**Motion:** `--motion-fast 0.15s` (focus), `--motion 0.24s` (switch/stepper), `--motion-entrance 0.5s` (card rise); `--ease cubic-bezier(0.4,0,0.2,1)`. **Icon stroke:** `1.5` on a 20×20 viewBox, round caps, `currentColor`.

---

## 2. The rules (RULEBOOK.md)

**Accent discipline — "two hues, two jobs."** One reserved accent per view. The two warm
hues do two distinct jobs, and keeping them separate is what keeps the theme legible:
- **Sage green = a control you trigger** (a primary action button).
- **Coral = attention / a selected state** (a badge, a failing card's top edge, the
  selected segment of a toggle) — *not* a plain action button.
- Put simply: *a control a person triggers is green; a state a person selected or that
  demands attention is coral.*

**Contrast rule.** Text is chosen **per element, per theme**, and verified by looking —
never defaulted. Floor ≈ **4.5:1** for normal text. The canonical example is the sliding
switch, which puts two labels on two grounds at once: the unselected label on the light
track is near-black; the selected label on the saturated thumb is white. Rule: light
ground → dark label; dark/saturated ground → light label. A surface that can't hit 4.5:1
with either is itself wrong and should be darkened/lightened.

**Gradient rule.** Every colored gradient panel puts the **darker/more-saturated color at
the top, whiter at the bottom.** Two deliberate exceptions: the hero card reverses it
(white on top, because its main color is white), and the page background is a large
**radial** warm-ivory (center base, rim lighter), not a linear gradient.

**Four composition principles:**
1. **A loud utility element should recede into the page's own type system**, not stand as
   its own chrome. A numbered-circles pipeline → quiet dots on a hairline with eyebrow
   labels; still reads state through color, but stops competing.
2. **Flat beats box-in-box.** Content sits directly on a card under a section header, not
   inside a second bordered box. A frame earns its place only when spacing + a header
   can't group on their own.
3. **Whitespace is surface-dependent.** A **reading** surface breathes **horizontally**
   (narrower measure, bigger gutters); a **scan/data** surface breathes **vertically**
   (lift the rhythm between groups onto the spacing scale). Ask read-vs-scan *before*
   adding padding.
4. **Inversion makes the hero without a loud color.** On a light page, one **dark card**
   is the loudest thing (strong contrast carries the emphasis, palette stays calm). The
   accent then touches only its label + action. Fixed dark in every theme; headline in the
   display serif.

**Buttons.** Solid fill = a real action (Ember primary is the **sage**); everything minor
is a quiet outline. **No button darkens/brightens its fill on hover** and **no button
resizes on hover** — the primary thickens its label via **`text-shadow: 0.4px 0 0
currentColor, -0.4px 0 0 currentColor`** (not a heavier font-weight, so the row never
nudges). Quiet controls give a box-color change instead. Disabled = same color at half
opacity.

**Two-state toggle = sliding thumb.** Recessed pill track; raised accent thumb slides to
the active side; selected label light, unselected muted, both uppercase + letter-spaced;
~0.24s slide, disabled under reduced motion. The raised thumb also keeps the two options
from merging — general rule: **two adjacent controls must visibly differ so they never
read as one.**

**Card motion + coral border.** Cards fade-and-rise on mount (small stagger, backwards
fill so hover-lift still works), lift on hover, both off under reduced motion. Each card
may carry a **thin 3px top accent strip** colored by status (coral=fail, sage=ok) — the
signature that names the theme.

---

## 3. The 14 components (`components.css`, all `c-` prefixed)

`c-eyebrow` (+`__step` mono chip) · `c-card` (+`__rule--{ok,warn,fail,na}` 3px top bar) ·
`c-subhead` (section header; in Ember becomes the celery-green gradient bar with a
`#7DAE4C` left border) · `c-stat` (mono figure over uppercase label) · `c-bar` (5px pill
fill) · `c-pill` / `c-dot` (status word / haloed dot, box-shadow halo `0 0 0 4px *-soft`) ·
`c-btn` (`--secondary`, `--ghost`, `--icon`; text-shadow hover) · **`c-seg`** (segmented
control — thumb is a `::before`, driven by `:has(button:nth-of-type(2).active)`, no JS
beyond toggling `.active`) · `c-checklist`/`c-check` · `c-stepper` (quiet dots on a
hairline) · `c-label`/`c-input`/`c-select`/`c-textarea` (focus = accent border + `0 0 0 3px
*-soft` ring) · `c-chip` · `c-linkpreview` (quiet until hover; only accent moment is the go
arrow) · `c-payoff` (full-width status strip, big mono figure — ground is a **status**
color, never the reserved accent) · `c-bulletin` (the dark inverted hero; serif headline;
accent only on label + action).

---

## 4. The critic — 5 measurable gates (`critic.py`)

The objective QA the system commits to (exit 0/1). Useful as a checklist for *any* page,
including ours:
1. **emphasis** (live) — at most **2 loud elements** across payoff banners + bulletin
   cards + accent buttons. The emphasis budget is 2; keep one clear focal point.
2. **overflow** (live) — **no horizontal overflow** at **1200px and 390px**
   (`scrollWidth <= innerWidth`).
3. **contrast** (structural) — WCAG ratios of the text-on-surface token pairs per theme
   (body/heading/muted on panel/inset/ground ≥ 4.5; status figures ≥ 3.0).
4. **spacing** (structural) — inline spacing values must be on the scale
   `{0,4,8,12,16,24,32,44}` (+ an allowlisted drift set).
5. **alignment** (structural) — every top-level container shares one `max-width` (one
   measure).

Autonomous visual taste is **deliberately not** automated — the critic carries an artifact
to the door of human approval, not past it.

---

## 5. Mapping to the KCD2 map — adopted vs available

**Already adopted** (this design language, translated to our gold/parchment palette):
- Eyebrow labels (muted uppercase Cinzel + hairline) — `.section-eyebrow`, `.region-eyebrow`, `.mo-header`.
- Stat card with a **mono** figure — Game Completion `%` (gold, `--font-mono`).
- **Sliding-thumb segmented control** — region switcher: a `::before` thumb driven by
  `:has(.region-btn[data-region="kuttenberg"].active)` — the exact `c-seg` pattern.
- Recessed-track / raised-thumb toggles; toggle **chips** (on = accent).
- Inline **`currentColor`** line icons across the chrome.
- Hairlines + whitespace as the grouping device; collapse/disclosure motion (~0.24–0.28s).
- A **second hue with a distinct job**: **ember `#e07b39`** reserved for the *collapse
  carets only* — our loose take on "two hues, two jobs" (gold = value/active, ember = the
  "this collapses" affordance).
- **Contrast discipline verified** — every text pair audited to WCAG AA; the danger red was
  brightened to `#c95a54` to clear the 3:1 UI-object bar. The blue highlight halo is a
  hue-based glow (can't beat luminance-3:1 on tan) so it's kept by intent, not defaulted.
- **Spacing rhythm** — the sidebar's off-scale vertical paddings were snapped to the 8/12
  ladder (the 18px side gutter and tight 4/6/8 corner ladder kept as the game-UI look).

**Available, not yet adopted** (candidate next steps):
- **No-resize hover:** thicken button labels via `text-shadow`, not font-weight, so buttons
  never nudge the row on hover. *Assessed as a non-problem for us* — we don't bold on hover,
  so there's no reflow to fix; it's optional flavor, not a fix.
- **Status color family** (sage=done, ochre=warn, coral=attention) — *previously declined*
  the gold-vs-green split for the map; revisit only if wanted.
- **Inversion hero** — our sidebar is already the single dark surface, so the principle is
  effectively satisfied; no bright fills needed to emphasize.
