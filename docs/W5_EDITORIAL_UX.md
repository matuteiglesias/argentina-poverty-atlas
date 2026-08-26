# W5 — Atlas editorial UX

Status: **implemented for product review on synthetic fixture data**.

W5 turns the W2/W3/W4 technical seams into the intended public-facing Argentina Poverty Atlas. The site is in Spanish and is designed as an editorial statistical publication, not as an internal dashboard.

## Reading model

The public experience follows a deliberate sequence:

1. answer the national question quickly;
2. show change through time;
3. move from the national view into territorial variation;
4. let a province be inspected in context;
5. expose methodology, lineage, quality and citation without forcing technical metadata into the first screen.

The homepage and `/explorar` share data, geography identity, URL state and Mapbox runtime semantics, but they have different interaction roles.

## Homepage: guided reading

The homepage is a vertical publication.

### National answer

The first viewport prioritizes:

- current national estimate;
- period;
- poverty/indigence;
- persons/households;
- FGT estimand;
- an explicit statement that the national fact comes from the release rather than browser aggregation.

The synthetic-fixture status is metadata-driven and always visible, but it does not compete typographically with the primary reading.

### National series

The national time series is a low-ink line chart using the same selected measure as the rest of the page. Period buttons update the same URL-backed atlas state used by the map and explorer.

### Territorial reveal

Desktop uses a sticky map passage. Normal document scroll controls a deterministic Mapbox camera sequence:

```text
closer north / north-central frame
              ↓
progressively wider territorial context
              ↓
whole-country Argentina frame
```

Key rule: **Mapbox does not capture wheel scrolling on the homepage.** The reader always remains in control of the document. The camera responds to page progress; page scroll is never reinterpreted as direct map zoom.

The editorial camera has a pure tested contract in `src/map/editorialCamera.ts`.

The story map continues to use the W4 runtime seam:

```text
one governed vector source
+ promoted geography_id
+ poverty facts through feature state
+ stable choropleth layers
```

Camera motion never republishes geography, recalculates poverty or writes facts into geometry.

### Mobile and reduced motion

Sticky scrollytelling is not forced onto small screens. Mobile receives the whole-country frame, native page scrolling and an explicit route to the explorer.

`prefers-reduced-motion` also receives the final whole-country camera rather than a scroll-driven moving camera.

## Explorer: atlas instrument

`/explorar` is the free investigation surface rather than a duplicate homepage.

Large desktop layout:

```text
measure + province controls | map and values | sticky province profile
```

At narrower widths the province profile moves below the map.

The explorer provides:

- period / universe / concept / estimand controls;
- map pan and explicit zoom controls without wheel-scroll capture;
- native-select province navigation for keyboard/non-map use;
- stable URL-backed province selection;
- province table using the exact same facts as the map;
- province vs Argentina comparison;
- province vs national time series;
- FGT incidence / gap / severity profile;
- quality and warning presentation;
- explicit uncertainty status.

## Missing values and warnings

A missing fact is never converted to zero. The UI says `Sin dato` and explains that the atlas does not impute in the browser.

Quality warnings do not alter the poverty value or silently change the color scale. They are displayed as a separate information channel in the table and province profile.

## Trust surface

Methodology and lineage are first-class product actions.

W5 exposes:

- scientific status;
- uncertainty status;
- release identity;
- declared parents;
- comparability metadata;
- geometry transport status;
- downloadable release facts;
- downloadable/viewable metadata;
- copyable citation;
- copyable share URL.

The technical lineage remains expandable so a nontechnical reader can understand the page without reading hashes, while a reviewer can still reach the exact identities.

## Scientific and architecture invariants

W5 does not change scientific authority.

- The atlas does not estimate poverty.
- The atlas does not construct poverty lines.
- The atlas does not correct geography.
- The atlas does not fabricate uncertainty.
- Geometry and poverty facts have independent lifecycles.
- Mapbox remains a rendering/transport provider.
- Browser components remain downstream of the atlas release contract.
- URL state remains a stable public/shareable interface.

The current W3 transport manifest is respected fail-closed. If it says the Mapbox transport is not published, W5 shows the unavailable/blocked map state rather than inventing provider metadata.

## Human review targets

W5 intentionally leaves the following as visual tuning surfaces rather than scientific semantics:

- headline typography;
- vertical rhythm between the national series and territory passage;
- sticky-map duration;
- exact close-view camera framing;
- map height on phones/tablets;
- explorer column widths;
- province-profile density;
- palette contrast under real display conditions.

Those can be tuned without changing the data or geography contracts.
