# W5 — Editorial UX design

Status: **design direction for human review before implementation**.

This document turns W5 from a checklist into one coherent public experience. It is deliberately product/editorial work: the scientific release and governed geography remain upstream, and the atlas only presents the selected release faithfully.

## Product proposition

The first visit should answer five questions in order:

1. **How much?** — one national headline, clearly scoped by period, universe, concept and estimand.
2. **How has it changed?** — a readable national time series, not a dashboard widget.
3. **Where is it different?** — an editorial map passage that reveals the territorial surface.
4. **What about one province?** — direct inspection with province-vs-national comparison.
5. **Where did this number come from?** — methodology, lineage, quality, data and citation one action away.

The product should feel closer to a statistical atlas / data-journalism feature than to an admin dashboard.

## Core interaction decision

### Do not let an embedded homepage map hijack page scroll

The W4 map correctly disables wheel zoom. W5 should preserve that property on the homepage.

Instead, ordinary document scroll drives the camera while the map is sticky. This produces the desired discovery — the reader sees that the territory is a real, navigable map — without the common failure mode where the mouse wheel suddenly traps the reader inside a map.

Mapbox supports camera changes from scroll position directly; the atlas should own a much smaller version of that pattern rather than adding a general storytelling framework.

### Separate two map modes

**Homepage: guided map**

- scroll owns the wheel;
- no free wheel zoom;
- no rotation or pitch;
- camera changes are driven by section progress;
- hover/tap may read a jurisdiction;
- click/tap can set a durable province selection;
- final action: **Explorar libremente** opens `/explorar` with the same measure/period/province URL state.

**Explorer: free map**

- explicit +/- zoom controls;
- drag/pan enabled;
- wheel zoom remains conservative by default so document scroll is never surprising;
- an explicit desktop action may enable wheel zoom for users who want map-first navigation;
- coarse pointers use cooperative gestures;
- selection, hover and URL state retain W4 semantics.

Both modes must use the same governed transport, same runtime fact join and same visual measure encoding.

## Homepage choreography

The homepage is a vertical essay with five acts.

### Act 1 — National answer

Above the fold should be quieter and more authoritative than the W1 hero.

Suggested desktop composition:

```text
Argentina · Atlas de pobreza                         [Explorar]
────────────────────────────────────────────────────────────────

Pobreza e indigencia
en Argentina

[ short context / scientific status ]        32.4%
                                              Pobreza · personas
                                              Demo 2025 S2

                                              ↓ desde período anterior

[ Ver evolución ]   [ Cómo se construye ]
```

The headline number is the dominant object. The synthetic disclaimer stays visible but should not visually overpower the product; it is metadata-driven and becomes a compact amber status strip plus an inline `Datos de demostración` badge.

Do not imply a trend direction unless it is computed from the selected fixture/release values. Do not add interpretive prose about why the number changed.

### Act 2 — National time series

Replace the current bar-placeholder treatment with a proper low-ink time-series chart.

Behavior:

- one line, one selected-point marker;
- period labels on the x axis;
- human-readable percent axis;
- hover/focus reads exact period/value;
- clicking a point changes the selected period and therefore the map below;
- keyboard focus can step through periods;
- the selected period is visually obvious;
- chart title reflects concept/universe/estimand;
- uncertainty is shown only when supplied by the release; otherwise no invented band.

A compact measure switch may live above the chart, but the homepage should not expose the entire four-control explorer form at this stage.

### Act 3 — Territorial reveal

This is the signature W5 moment.

#### Desktop structure

Use a full-bleed or near-full-bleed section approximately `200–240vh` tall with an `80–88vh` sticky viewport.

```text
┌────────────────────────────────────────────────────────────────────┐
│                                                                    │
│                       STICKY MAP                                   │
│                                                                    │
│                                                   ┌─────────────┐  │
│                                                   │ reading card│  │
│                                                   │ period      │  │
│                                                   │ measure     │  │
│                                                   │ instruction│  │
│                                                   └─────────────┘  │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
                 ↓ normal page scroll controls camera
```

The map begins close enough that the reader does not immediately see the complete long north-south extent of Argentina. The initial frame may privilege north / north-central Argentina as a **geographic orientation device only**, never as a substantive statement about poverty. A small caption should make that neutrality explicit while fixture data are active.

Suggested camera keyframes, to tune visually rather than treat as scientific constants:

```text
0%   center ≈ [-64.3, -27.5]  zoom ≈ 4.1   north / north-central detail
40%  center ≈ [-64.1, -33.0]  zoom ≈ 3.5   broader central frame
75%  center ≈ [-64.0, -37.5]  zoom ≈ 2.9   almost whole country
100% fit governed 24-feature bounds          whole country with padding
```

Use `easeTo` or direct camera interpolation with no pitch and no bearing. Camera motion must stop under `prefers-reduced-motion`; reduced-motion users get the final whole-country frame immediately while the editorial text remains readable.

The exact final frame should ultimately use bounds derived from the governed transport rather than hand-maintained province geometry.

#### Scroll semantics

- scroll down = zoom out / reveal the whole country;
- scroll up = retrace the camera inward;
- the wheel never becomes a Mapbox scroll-zoom gesture in this passage;
- once the end of the sticky section is reached, the document naturally continues;
- no invisible scroll lock, preventDefault trap or nested scroll container.

This matches the user's mental model while preserving page usability.

#### Discovery cue

At the beginning, a subtle label can say:

> Desplazate para abrir el territorio

Near the final frame it changes to:

> 24 jurisdicciones · tocá una para inspeccionarla

Then the section resolves into one strong action:

**Explorar libremente →**

This opens `/explorar` carrying the current period, universe, concept, estimand and selected province.

#### Selection in the guided map

Hover/focus should show a restrained readout (province + value), as W4 already proves. Click/tap fixes the province and changes the reading card to:

```text
Salta
34.1%
+2.7 pp vs Argentina
[Ver provincia en el explorador →]
```

Do not open a large modal over the scrollytelling passage.

### Act 4 — One province in context

After the territorial reveal, give the selected province — or a neutral invitation if none is selected — a simple comparison block.

Desktop:

```text
Salta                         Argentina
34.1%                         31.4%

+2.7 pp respecto del total nacional

Incidencia     Brecha     Severidad
34.1%          11.2%      5.4%

[ Abrir detalle ]
```

For a synthetic fixture, copy must remain non-interpretive. A real release can later add approved contextual annotations without changing the component architecture.

### Act 5 — Trust / provenance / actions

End the homepage with a compact `Sobre esta estimación` surface, not raw developer metadata.

Show human-readable rows:

- período;
- universo;
- concepto;
- medida;
- scientific status;
- uncertainty availability;
- geography release;
- poverty release identity;
- last release/publication identity when available.

Actions:

- **Metodología y linaje**
- **Descargar datos**
- **Citar esta vista**
- **Copiar enlace**

The raw release IDs/hashes belong inside the lineage drawer, not scattered as footer diagnostics.

## Explorer information architecture

`/explorar` should feel like an atlas instrument, but still editorial.

### Desktop layout

Prefer three functional regions rather than a stack of cards:

```text
┌──────────────┬──────────────────────────────────────┬───────────────┐
│ controls     │                                      │ province      │
│ sticky       │              MAP                     │ detail        │
│              │                                      │ sticky        │
│ period       │                                      │               │
│ universe     │                                      │ value         │
│ concept      │                                      │ vs national   │
│ estimand     │                                      │ FGT profile   │
│              │                                      │ quality       │
├──────────────┴──────────────────────────────────────┴───────────────┤
│ legend / status / data actions                                     │
└────────────────────────────────────────────────────────────────────┘
```

The map should get most of the horizontal area. Controls should be visually compact: segmented controls or select buttons where the option count is small, conventional select for long period lists.

At widths where three columns become cramped, move detail below the map before shrinking the map excessively.

### Measure sentence

Above controls, always render the current state as a natural-language sentence:

> Pobreza · personas · incidencia · Demo 2025 S2

This makes the complex selector state inspectable at a glance and reduces the dashboard feeling.

### Province detail

Keep W4's exact selected fact and national comparison, but make the panel feel like a profile rather than a technical sheet.

Order:

1. province name and selected measure;
2. comparison with national;
3. small province-vs-national time series for the same measure;
4. FGT incidence/gap/severity trio;
5. quality/warning state;
6. `Cómo se obtuvo este dato` link;
7. data/citation actions.

The technical `geography_id` can be shown in lineage/metadata, not as the primary label.

## Methodology and lineage drawer

Use one reusable drawer/sheet accessible from header, headline, province detail and data actions.

Tabs or sections:

### Qué mide

Plain-language explanation sourced from atlas metadata / stable editorial copy; preserve exact scientific concept and estimand labels.

### Cómo se produjo

Release parent chain, scientific status, producer identity and approved method summary. No producer runtime code is imported.

### Geografía

Exact Geography Release, provider/native identity, geometry transport and atlas join property.

### Calidad

Warnings, no-data semantics, uncertainty availability and known limitations.

### Reproducibilidad

Exact release IDs, checksums where appropriate, transport ID and citation payload.

On mobile this is a bottom sheet; on desktop a right-side drawer with a comfortable reading width.

## Data and citation actions

Create one `Compartir y datos` action group.

Minimum W5 actions:

- copy shareable URL including atlas state;
- download the currently projected public release JSON/CSV where available;
- download current territorial slice as CSV;
- copy a generated citation containing atlas title, release identity, period/measure state, access date and URL;
- expose source/release documentation links.

Do not fabricate a DOI or formal bibliographic identifier that upstream has not supplied.

## No-data and warning semantics

No-data and warning states must be visible in three places simultaneously:

1. map encoding;
2. province detail / table row;
3. methodology/quality surface.

### No data

- neutral light gray map fill, already distinct from the sequential palette;
- text label `Sin dato para esta vista`;
- do not display `0%`;
- detail panel explains whether absence is release coverage vs unavailable estimate when metadata distinguishes them.

### Quality warning

- keep the poverty fill value visible;
- add a small warning marker / badge rather than recoloring the whole province into an unrelated warning hue;
- detail panel states the exact warning text/code supplied by the release;
- keyboard/table presentation exposes the same warning.

Warnings should never be inferred from value magnitude in the browser.

## Responsive/mobile behavior

### Homepage map

Do not reproduce desktop sticky scrollytelling mechanically on a phone.

For coarse/narrow viewports:

- show the whole-country map earlier;
- use 55–65svh map height;
- keep page scroll fully native;
- use 2–3 discrete editorial cards before/after the map instead of a long sticky passage;
- tap selects province;
- explicit `Abrir mapa` enters `/explorar`;
- cooperative gestures remain enabled in Explorer.

### Explorer

Mobile order:

1. compact measure sentence + `Cambiar` control;
2. map;
3. selected province bottom sheet / inline detail;
4. legend;
5. province list/table disclosure;
6. provenance/data actions.

Selectors should open as a sheet rather than consume half the viewport above the map.

## Keyboard and non-map province inspection

The table/list is a first-class equivalent navigation path, not a fallback hidden at the bottom.

Add an accessible province combobox/list action near the map:

> Buscar jurisdicción

Requirements:

- 24 governed provinces only;
- arrow/keyboard selection;
- selected item updates the same URL state as map click;
- focus can move directly to province detail;
- the table exposes value, no-data and warning state;
- map hover is never the only way to discover a value.

Map canvas itself does not need to become the keyboard navigation primitive if an equivalent, synchronized control is clearer and more robust.

## Synthetic fixture treatment

The disclaimer must be metadata-driven and present on every meaningful entry path.

Recommended hierarchy:

- thin global amber status strip: `Datos de demostración`;
- one sentence on homepage explaining synthetic/non-interpretive status;
- compact badge in explorer header;
- full scientific status in lineage drawer;
- citation/download payloads preserve `scientific_status=synthetic_fixture` and `not_for_interpretation=true`.

Do not repeat large warning paragraphs inside every card.

## Typography and visual language

Keep the existing warm paper background and serif/sans pairing, but reduce the current card-grid feeling.

Direction:

- editorial sections separated by whitespace and rules, not a card around everything;
- serif for titles and major narrative statements;
- sans for controls, metadata and numerics;
- tabular numerals for estimates;
- national headline around 72–96px desktop, 52–64px mobile when space allows;
- narrow reading measure for prose;
- map may break the normal `max-w-7xl` shell to feel territorial and immersive;
- sequential map palette remains the dominant data color; UI chrome stays mostly neutral.

Avoid decorative gradients or map animation that competes with the estimates.

## Camera and motion contract

W5 camera behavior should be deterministic and testable.

Introduce a pure camera-story model independent of Mapbox:

```ts
type CameraKeyframe = {
  progress: number
  center?: [number, number]
  zoom?: number
  fitCountry?: boolean
}
```

A pure interpolation function maps section progress to camera state. React observes section progress; the Mapbox adapter applies it. This keeps camera semantics testable without a browser map.

Rules:

- bearing = 0;
- pitch = 0;
- no autoplay;
- no continuous animation after the user stops scrolling;
- reduced motion uses final country frame;
- user selection does not unexpectedly reset the editorial camera;
- Explorer camera is independent of homepage story progress.

## W5 acceptance walkthrough

A reviewer should be able to perform this sequence:

1. open `/` and immediately identify national value, period and synthetic status;
2. inspect the national series and choose another period;
3. scroll normally into the territorial section without the page becoming trapped;
4. watch the camera reveal the whole country;
5. inspect/select a province by pointer or keyboard/list;
6. see the exact province value and comparison with Argentina;
7. enter `/explorar` carrying that state;
8. change period/universe/concept/estimand without rebuilding the map;
9. encounter a fixture no-data case and a fixture warning case with truthful presentation;
10. open methodology/lineage and understand what release/geography produced the view;
11. copy a stateful link/citation or download the relevant public data;
12. repeat the essential flow on mobile without scroll capture.

If this walkthrough feels coherent, W5 has succeeded even while the numbers remain synthetic.

## Implementation sequence

Do not land W5 as one giant visual rewrite. Recommended bounded slices:

### W5a — editorial skeleton

- homepage information hierarchy;
- real national time-series component;
- compact metadata-driven fixture status;
- reduce card-grid visual density.

### W5b — territorial reveal

- guided homepage map wrapper around the W4 runtime map;
- pure scroll-progress → camera model;
- desktop sticky passage;
- reduced-motion and mobile static/discrete alternative;
- state handoff to `/explorar`.

### W5c — explorer productization

- compact controls;
- province profile rail/sheet;
- province-vs-national timeline;
- search/non-map navigation;
- responsive choreography.

### W5d — trust surfaces

- methodology/lineage drawer;
- no-data and warning presentation;
- download/share/citation actions;
- remove developer-facing footer diagnostics from the default visual surface.

Human visual review should occur after W5a and W5b before fine polish.

## Current integration note

At the time this design was written, the repository has a branch-integration wrinkle: the refined W4 interaction work was merged into the W2 feature branch, while the rebased W4-v2 PR is still open against the newer W3 `main`. W5 implementation should reconcile the clean W4 runtime/UX changes with current W3 main before modifying map behavior. This design document is therefore branched from current `main` and intentionally changes no runtime code.
