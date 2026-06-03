# Screen Patterns — production-grade composition cookbook

Patterns extracted from a gold-standard production onboarding (21 ComposableScreen steps, health-app vertical). Archetypes in `composable-archetypes.md` give the skeleton; this file is the polish layer — motion choreography, interaction idioms, and composition recipes that make a flow feel hand-built.

> **Schema reminder.** `payload = { elements: UIElement[] }`. No `payload.root`, no `payload.variables`. Every container needs `children` (even `[]`).

> **Element ids.** Readable ids below are illustrative. Real output: fresh UUID v4 per element, never reused.

> **⚠ Colors/fonts below are EXAMPLE VALUES from the reference app** (`#66A3FF` brand blue, `#FAFAFA` background, SF Pro Display, etc.). They are concrete so you can see real recipes — but **always replace every color, font, radius, and spacing value with the target app's Design Profile** (`inspect-target-app.md`). Shipping the reference palette into another app is a regression.

---

## 1. Universal screen skeleton

Nearly every screen shares one bone structure: SafeAreaView → space-between YStack → top content block + bottom-pinned CTA. `justifyContent: "space-between"` replaces spacer elements when there are exactly two groups.

```json
{
  "id": "safe", "type": "SafeAreaView",
  "props": { "flex": 1, "edges": ["top", "bottom"], "backgroundColor": "#FAFAFA" },
  "children": [
    {
      "id": "root", "type": "YStack",
      "props": { "flex": 1, "justifyContent": "space-between", "paddingHorizontal": 24, "paddingTop": 12, "paddingBottom": 24, "gap": 16 },
      "children": [
        { "id": "content", "type": "YStack", "props": { "gap": 16 }, "children": [ /* heading, subtitle, body */ ] },
        { "id": "cta", "type": "Button", "props": {
          "label": "Continue", "variant": "filled",
          "backgroundColor": "#66A3FF", "color": "#FFFFFF",
          "fontSize": 17, "fontWeight": "600", "borderRadius": 16, "paddingVertical": 16,
          "haptic": "light",
          "pressedStyle": { "opacity": 0.85 },
          "disabledStyle": { "color": "#8E8E93", "backgroundColor": "#E5E5E5" },
          "actions": ["continue"]
        } }
      ]
    }
  ]
}
```

The canonical CTA recipe — reuse on every screen, identical across the flow: brand fill + on-brand text, radius 16 (≈ `<DP.buttonBorderRadius>`), `paddingVertical 16`, `fontSize 17`, semibold, `haptic: "light"`, `pressedStyle: { opacity: 0.85 }`, `disabledStyle` (never the deprecated `disabledBackgroundColor`/`disabledColor`). Give big top breathing room above headings on sparse screens (`paddingTop`/`paddingVertical` up to 60).

## 2. Select-and-advance single-select (preferred over RadioGroup)

For single-select questions that should advance on tap, render answers as full-width **Button rows** — not a RadioGroup + Continue. The reference flow's 7 question screens used **zero RadioGroups**. Each button sets the variable then continues; `pressedStyle` previews the selected state so the tap *feels* like a selection.

```json
{
  "id": "answers", "type": "YStack", "props": { "gap": 12 },
  "children": [
    { "id": "opt-instagram", "type": "Button", "props": {
      "label": "Instagram", "haptic": "light",
      "color": "#1A1A1A", "backgroundColor": "#FFFFFF",
      "fontSize": 17, "fontWeight": "400", "textAlign": "left",
      "borderRadius": 16, "paddingVertical": 18, "paddingHorizontal": 20,
      "pressedStyle": { "color": "#FFFFFF", "backgroundColor": "#66A3FF" },
      "actions": [ { "type": "setVariable", "name": "attribution", "value": "instagram" }, "continue" ]
    } }
  ]
}
```

- One Button per option; white card, left-aligned regular-weight label, radius 16, no Continue button at all. One less tap per screen.
- **When to keep RadioGroup instead:** the user should review/change their pick before advancing, or selection alone shouldn't commit (e.g. legal/confirm steps).
- Multi-select stays `CheckboxGroup`: `showTick: false`, selected = full brand fill + on-brand text (`itemSelectedBackgroundColor` + `itemSelectedColor`), unselected = white card, `itemBorderWidth: 0`, radius 16, `haptic: "light"`; CTA gated `disabledWhen: { "variable": "<groupVar>", "operator": "is_empty" }`.

## 3. Carousel as state machine

One variable drives both the carousel position and which CTA renders — one screen behaves like N. `setVariable` with `valueMode: "expression"` increments the page; `renderWhen` swaps the CTA per page range.

```json
{ "id": "pager", "type": "Carousel", "props": {
    "carouselType": "normal", "loop": false, "variableName": "welcomePage",
    "showDots": true, "dotColor": "#E5E5E5", "activeDotColor": "#000000", "dotWidth": 8, "dotHeight": 8
  }, "children": [ /* 5 slides */ ] },

{ "id": "cta-start", "type": "Button",
  "props": { "label": "Discover", "actions": [ { "type": "setVariable", "name": "welcomePage", "value": "1", "kind": "int" } ] },
  "renderWhen": { "variable": "welcomePage", "operator": "eq", "value": "0" } },

{ "id": "cta-next", "type": "Button",
  "props": { "label": "Next →", "actions": [ { "type": "setVariable", "name": "welcomePage", "value": "{{welcomePage}} +1", "valueMode": "expression" } ] },
  "renderWhen": { "logic": "and", "conditions": [
    { "variable": "welcomePage", "operator": "gt", "value": "0" },
    { "variable": "welcomePage", "operator": "lt", "value": "4" } ] } },

{ "id": "cta-done", "type": "Button", "props": { "label": "Continue", "actions": ["continue"] },
  "renderWhen": { "variable": "welcomePage", "operator": "eq", "value": "4" } }
```

(CTA styling props elided — use the §1 recipe on all three.) For an N-slide carousel the bounds are `eq 0` / `gt 0 AND lt N-1` / `eq N-1`.

## 4. Staggered FadeIn choreography ("reveal beat")

A hero animation (Rive/Lottie) plays, then text lines and the CTA enter one-by-one with `FadeIn` + incremental delays **tuned to the media's runtime**. Turns a static reflection screen into a narrative moment.

```json
{ "id": "anim", "type": "Rive", "props": { "url": "https://cdn.example.com/reveal.riv", "autoPlay": true, "fit": "FitWidth", "alignment": "TopCenter" } },
{ "id": "line-1", "type": "Text", "props": { "content": "Good news...", "fontSize": 28, "fontWeight": "500",
    "animation": { "entering": { "preset": "FadeIn", "duration": 500, "delay": 3500 } } } },
{ "id": "line-2", "type": "Text", "props": { "content": "All of your symptoms can be reversed! 🌈", "fontSize": 28, "fontWeight": "500",
    "animation": { "entering": { "preset": "FadeIn", "duration": 500, "delay": 4500 } } } },
{ "id": "cta", "type": "Button", "props": { "label": "See how", "actions": ["continue"],
    "animation": { "entering": { "preset": "FadeIn", "duration": 500, "delay": 5500 } },
    "backgroundColor": "#ffffff", "color": "#1A1A1A", "borderRadius": 16,
    "paddingVertical": 20, "paddingHorizontal": 64,
    "elevation": 2, "shadowColor": "#1A1A1A12", "shadowOffset": { "width": 0, "height": 2 }, "shadowRadius": 10, "shadowOpacity": 1 } }
```

Heuristics: 500ms fades, ~1000ms between beats, first delay = animation runtime so text lands as the motion settles. Works for any "diagnosis → good news → CTA" sequence. (Note 8-digit hex `#1A1A1A12` — alpha baked into `shadowColor`.)

## 5. Sequential self-completing loader

No host timer, no `delayedContinue`. Chain `ProgressIndicator`s via `delay` so bars fill one after another; pair each with a label that flips from in-progress text to a done-row when its variable hits 100; gate the final CTA on the last bar.

```json
{ "id": "load-1", "type": "ProgressIndicator", "props": {
    "variant": "linear", "autoplay": true, "duration": 5000, "delay": 0,
    "initialValue": 0, "value": 60, "thickness": 12,
    "color": "#3b82f6", "trackColor": "#e5e7eb", "variableName": "curatingLoader1" } },
{ "id": "label-1-busy", "type": "Text", "props": { "content": "Analyzing your answers…" },
  "renderWhen": { "variable": "curatingLoader1", "operator": "lt", "value": "100" } },
{ "id": "label-1-done", "type": "XStack", "props": { "gap": 10, "alignItems": "center" },
  "renderWhen": { "variable": "curatingLoader1", "operator": "eq", "value": "100" },
  "children": [
    { "id": "check-1", "type": "Icon", "props": { "name": "CircleCheck", "size": 20, "color": "#3385FF" } },
    { "id": "done-1", "type": "Text", "props": { "content": "Answers analyzed" } } ] },

{ "id": "cta", "type": "Button", "props": { "label": "Access my profile", "actions": ["continue"] },
  "renderWhen": { "variable": "curatingLoader3", "operator": "eq", "value": "100" } }
```

- N bars: each `duration: 5000`, `delay: (i-1) × 5000` — bar *i* starts when *i−1* finishes.
- During the wait, add a horizontal `ScrollView` (`horizontal: true`, indicators off) of "Did you know?" cards — 300px-wide white cards, radius 20, icon + body + image — to make the wait feel like value.
- Use the host-wired `custom: delayedContinue` action only when the wait must track *real* backend work, not a fixed duration.

## 6. Social-proof composition

Layered, not a list of plain quote cards:

1. **Laurel header** — `XStack`: laurel SVG `Image` + center block (gold `★★★★★` `#FFC107`, claim line, "+100K users") + mirrored laurel SVG.
2. **Floating testimonial card** — one quote, big soft shadow so it floats: `YStack` `backgroundColor #FFFFFF`, `borderRadius 24`, `padding 20`, `elevation 12`, `shadowColor #000000`, `shadowOffset {0,10}`, `shadowRadius 20`, `shadowOpacity 0.25`. Inside: handle, star row, quote, date (13px light gray).
3. **Payoff RichText** — short line with one bold/accent span ("You + us = 5-star energy").
4. **Rate CTA** (§1 recipe, e.g. "Rate the app").

Stat-anchored variant (value-prop screens): hero Lottie (`flex: 2`) above a centered RichText where the number is its own accent span:

```json
{ "id": "stat", "type": "RichText",
  "props": { "fontSize": 16, "textAlign": "center", "color": "#8E8E93", "padding": 48 },
  "children": [
    { "id": "n", "type": "Text", "props": { "content": "82%", "fontSize": 24, "fontWeight": "700", "color": "#F57C00" } },
    { "id": "rest", "type": "Text", "props": { "content": " of users report better sleep within 90 days" } }
  ] }
```

Same accent-span trick upgrades any headline: one keyword colored brand/accent inside an otherwise-plain RichText title.

## 7. Permission / integration screens

Permission asks deserve their own designed screen — never a bare OS dialog:

- **App/integration logo** `Image` with a soft shadow (`elevation 5`, `shadowOffset {0,4}`, `shadowRadius 8`, `shadowOpacity 0.2`).
- **Benefit rows** — per benefit, `XStack(gap 10)`: icon in a brand-tinted circle (`width/height 48`, `borderRadius 24`, brand bg) + `YStack` title (semibold, 18) / body (secondary).
- **Privacy reassurance** — `XStack`: green `ShieldCheck` icon (`#3DA755`) + "Your data is encrypted and private" (14px secondary).
- **Primary CTA** fires the host action: `actions: [{ "type": "custom", "function": "connectAppleHealth", "variables": [] }]` (likewise `requestNotifications`).
- **Soft opt-out** below (§8): "Later" / "Add data manually" — never trap the user.

**Integration-aware branch.** If granting the permission populates data that later screens would collect manually, branch past them:

```json
"nextStep": {
  "defaultTargetStepId": "cycle-length-manual",
  "branches": [ {
    "targetStepId": "notifications",
    "condition": { "logic": "and", "conditions": [
      { "variable": "cycleLengthWheelPicker", "operator": "is_not_null" },
      { "variable": "periodLengthWheelPicker", "operator": "is_not_null" },
      { "variable": "cycleStart", "operator": "is_not_null" } ] }
  } ]
}
```

Default path = manual entry; the branch skips it when the integration already supplied the data. A granted permission should *shorten* the funnel.

## 8. Soft opt-outs (ghost buttons)

Secondary escape hatches under the primary CTA — transparent, quiet, present:

```json
{ "id": "later", "type": "Button", "props": {
    "label": "Later", "variant": "ghost",
    "color": "#8E8E93", "backgroundColor": "#00000000",
    "fontSize": 16, "fontWeight": "400", "paddingVertical": 12,
    "actions": ["continue"] } }
```

Use for permission deferrals ("Later"), manual alternatives ("Add data manually"), and auth side-doors ("Log in"). Never style an opt-out to compete with the primary CTA.

## 9. Decorative rotated pills

Inline emphasis chips inside a centered RichText sentence — a `Text` child with box styling + a slight rotation reads as a hand-placed sticker:

```json
{ "id": "title", "type": "RichText",
  "props": { "fontSize": 32, "fontWeight": "500", "textAlign": "center", "fontFamily": "inherit" },
  "children": [
    { "id": "pill", "type": "Text", "props": {
        "content": "Sync", "color": "#ffffff", "backgroundColor": "#B28BE0",
        "paddingVertical": 12, "paddingHorizontal": 18, "borderRadius": 200,
        "lineHeight": 32, "transform": { "rotate": 1.5 } } },
    { "id": "rest", "type": "Text", "props": { "content": " with your cycle: work with your body", "lineHeight": 32 } }
  ] }
```

Rotate ±1.5° (alternate sign across slides), full-pill radius 200, pastel chip backgrounds (purple/yellow/green/blue family), white chip text. Set `lineHeight` on both chip and plain children so rows align.

## 10. Copy voice

- Headings: short, second person, often a question — "What should we call you?", "How old are you?". One idea per screen.
- Subtitles justify the ask: "This helps us tailor our recommendations."
- Accent one keyword per headline (brand or warm accent color span).
- CTA verbs: `Continue` (default), `Next →` (mid-carousel/education), `Discover`, `See how`, `Yes, notify me`, `Turn on <Integration>`, `Rate the app`, `Access my profile`. Opt-outs: `Later`, `Add data manually`.
- Emoji sparing — at most one, on emotional beats (🌈), and only if `voice.usesEmoji`.

## 11. Design literals ladder (reference app's — emit the target app's)

| Token | Reference value | Used for |
|-------|----------------|----------|
| radius | **16** | CTAs, answer cards, inputs, checkbox items — the one radius everywhere |
| radius | 20 | content cards ("Did you know?") |
| radius | 24 | icon circles (48×48), featured/testimonial cards |
| radius | 200 | decorative pills |
| gap | 8 / 12 / 16 / 24 / 32 | default / answer lists / section / header groups / reveal spacing |
| gutter | `paddingHorizontal: 24` | screen edge |
| font sizes | 13 / 14 / 16 / 17 / 18 / 20 / 24 / 28 / 32 | date / caption / body+answers / CTA / row title / card body / section head / hero head / display |
| weights | 400 body+answers · 500 headings · 600 CTAs+eyebrows | |
| answer rows | `paddingVertical 18, paddingHorizontal 20` | |
| CTA | `paddingVertical 16` | |

Input screens: wrap the CTA in `KeyboardAvoidingView` (`enabled: true`) so it rides above the keyboard. These literals describe ONE app — map each row to the target's Design Profile (`buttonBorderRadius`, `spacing.*`, `typeScale.*`) before emitting.
