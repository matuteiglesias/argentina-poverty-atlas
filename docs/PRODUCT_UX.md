# Product and UX brief

## Product promise

The atlas should make a sophisticated poverty-estimation system feel simple:

1. **How much poverty is there?**
2. **How has it changed?**
3. **Where is it higher or lower?**
4. **What does this estimate mean?**
5. **Can I inspect, cite and download the evidence?**

It should feel like an illustrated statistical atlas or editorial research product, not an internal BI dashboard.

## Tone and visual direction

Aim for:

- strong typography;
- generous whitespace;
- restrained chrome;
- a warm/light editorial canvas;
- the map as the dominant color object;
- one clear accent language;
- small, intentional controls;
- scientific transparency without overwhelming the landing experience.

Reference qualities: modern statistical publications, serious news graphics, research atlases and high-quality public-data products.

Avoid:

- dense admin dashboards;
- grids of interchangeable KPI cards;
- unnecessary shadows/pills/borders;
- controls that expose implementation vocabulary before user meaning;
- Mapbox-Studio-looking UI as the product identity.

## Site structure

### `/` — editorial landing

The first viewport should answer the national question quickly.

Suggested hierarchy:

```text
Atlas de pobreza en Argentina
Estimaciones territoriales de pobreza e indigencia

[ DEMO · DATOS SINTÉTICOS ]

32,8 %
Pobreza estimada · Personas
Argentina · 2026-Q1

7,4 % indigencia      11,6 % brecha

<small national time-series chart>

[ Explorar el territorio ]
```

Fixture numbers above are illustrative only and must not be committed as claims.

Below the headline:

- one compact timeline;
- one simplified interactive province map;
- a short explanation of the system;
- links to methodology/data/citation.

### `/explorar` — atlas explorer

Desktop concept:

```text
┌─────────────────────────────────────────────────────┐
│ Atlas de pobreza                  Método · Datos     │
├───────────────┬─────────────────────────────────────┤
│ Periodo       │                                     │
│ Universo      │                                     │
│ Medida        │                MAP                  │
│ Estimando     │                                     │
│               │                                     │
│ Legend        │                                     │
├───────────────┴─────────────────────────────────────┤
│ release / quality / citation strip                 │
└─────────────────────────────────────────────────────┘
```

Mobile should become map-first with compact selectors and a bottom sheet rather than preserving a desktop sidebar.

## Default vocabulary

Scientific identity remains exact in metadata. UI labels may be friendlier:

| Scientific | UI |
| --- | --- |
| `concept=poverty` | Pobreza |
| `concept=indigence` | Indigencia |
| `universe=persons` | Personas |
| `universe=households` | Hogares |
| `estimand=fgt0` | Incidencia |
| `estimand=fgt1` | Brecha |
| `estimand=fgt2` | Severidad |

A help/methodology layer should explicitly connect the friendly labels back to FGT(0/1/2).

## Headline metric

Never display an unlabeled number such as only `31.6%`.

Minimum context:

```text
31,6 %
Pobreza estimada · Personas
Argentina · 2026-Q1
Modelo territorial de investigación
```

The product must visibly distinguish a research estimate from an official INDEC publication.

## National time series

The homepage needs a first-class temporal view from the beginning, even while using fixtures.

The schema/UI should support:

- period;
- estimate;
- uncertainty when supplied;
- method/model/frame lineage keys;
- explicit comparability breaks.

Do not draw a visually continuous line across a known methodological discontinuity without annotation.

## Map interaction

### Hover

Keep it minimal:

```text
Salta
Pobreza 41,3 %
```

### Click/select

Open a detail panel/sheet with:

```text
SALTA
41,3 %
Pobreza · Personas

Argentina 32,8 %

Brecha       15,2 %
Severidad     7,8 %

<province time series>

Calidad
Estimación puntual
Incertidumbre: no provista

Frame / método / release
```

When uncertainty exists, reserve the same UI area for interval/CV rather than redesigning the panel later.

## Choropleth behavior

The first map uses the 24 jurisdictions/provinces as a signal that the entire system works.

Requirements:

- stable sequential scale;
- `no data` visual state distinct from low poverty;
- selected outline distinct from hover;
- legend always visible in explorer;
- scale values shown in human units;
- comparable scale across periods by default;
- keyboard/focus access to province selection through a non-map fallback list/table.

The first palette should be treated as a product/scientific design decision, not copied blindly from the legacy map.

## Fixture UX states

The synthetic fixture should deliberately include:

- normal estimates across all 24 jurisdictions;
- at least one missing-estimate case in an alternate fixture/test;
- a quality-warning case;
- `uncertainty_status=not_supplied`;
- several periods to exercise time navigation;
- persons and households;
- poverty and indigence;
- FGT0/1/2.

Every page driven by fixtures must display a persistent but tasteful banner:

> **Datos de demostración** — valores sintéticos usados para desarrollar el atlas. No son estimaciones reales ni estadísticas oficiales.

## Methodology and lineage UX

Scientific depth should be one click away through a drawer/page containing:

```text
Population frame
Welfare estimate/model
Poverty method
Poverty-line release
Geography release
Atlas build
```

Each item should expose a release/version/hash or stable citation reference when available.

The user should be able to answer “where did this number come from?” without reading source code.

## Data and citation UX

A small footer/action strip should eventually offer:

- `Metodología`;
- `Datos`;
- `Descargar`;
- `Citar`;
- exact release identity.

Download/citation behavior should derive from the selected release rather than hardcoded copy.

## Accessibility

Acceptance includes:

- meaningful non-map representation of the same 24 values;
- WCAG-conscious contrast;
- keyboard-operable controls;
- visible focus states;
- screen-reader labels for measure/period changes;
- no critical information communicated only by color;
- reduced-motion-safe interactions.

## V0 definition of good

V0 is successful if a human can open the site and, without knowing the architecture:

- understand that the current values are synthetic;
- read one national headline and time series;
- explore a province choropleth;
- change period/universe/measure;
- select a province and understand its values;
- copy/share the URL state;
- inspect methodology/lineage;
- use the site acceptably on a phone.

Nothing else is required for the first convincing atlas experience.
