# Voyagr — AI Trip Generator

_Design spec. Date: 2026-08-15. Depends on
`2026-08-15-voyagr-place-connectors-design.md` — build that first._

**This spec is self-contained.** It assumes no prior conversation.

---

## 1. What Voyagr is

Voyagr is a **travel itinerary planner built as a fork of the n8n monorepo**.
The repo at `~/Documents/Code/Voyagr` **is** the n8n monorepo, vendored and
rebranded. An "itinerary" IS an n8n workflow; the nodes on the canvas are travel
steps (hotels, flights, restaurants).

**Voyagr is a consumer product, not a developer tool.** Users never see or enter
an API key. Every key is ours, in deployment environment variables. No
credentials UI, no technical concepts in the interface.

Read `docs/VOYAGR.md` for project background, and the place-connectors spec for
the provider layer this builds on. Build and run:

```bash
CI=1 pnpm build:n8n > build.log 2>&1
N8N_DIAGNOSTICS_ENABLED=false pnpm start   # http://localhost:5678
```

Login `owner@voyagr.local` / `Voyagr1234`. The gotchas section of the
place-connectors spec applies here in full — read it.

---

## 2. What this feature does

A traveller fills in a short form and gets **three complete itineraries** drawn
on one canvas, ready to compare, keep, and edit.

---

## 3. The form

Five inputs, no more. Styled to match the existing signup dialogue —
`packages/frontend/editor-ui/src/features/core/auth/views/SignupView.vue` and
`SetupView.vue` — so it feels like part of the product rather than a settings
screen. Reached from a **Plan with AI** action beside **Plan a trip** on My Trips.

| # | Input | Notes |
|---|---|---|
| 1 | Where to? | destination |
| 2 | From where? | origin, defaults to `Home` |
| 3 | When? | date range |
| 4 | Budget | amount + currency |
| 5 | Two sliders | chill ↔ active, and mountain ↔ beach |

The sliders capture taste. They are not decoration: they filter which
place categories enter the candidate pool, and they shape the prompt.

---

## 4. The pipeline

```
form submit
  → geocode destination                        (Nominatim, from Spec A)
  → fetch candidate pool                       (Foursquare, from Spec A)
      ~20 real places across hotels/food/sights,
      categories filtered by the slider values
  → ONE Claude call, structured output         (three itineraries)
  → materialise into n8n workflow JSON
  → create the workflow, open the canvas
```

### The decision that makes this trustworthy

**The model picks places by `providerId` from the pool we fetched. It never
writes a place name.** Hallucinating a hotel becomes structurally impossible
rather than something the prompt has to talk it out of. Every node drawn on the
canvas is a real place with a real rating and a real photo.

### How the three options differ

All three respect the taste the form captured — they are not "relaxed vs packed"
variants that contradict what the user asked for. What varies is the
**combination**: different hotels, different restaurants, different sights,
drawn from the same pool and all consistent with the stated preferences. Give
each option a short name and a one-line rationale so the difference is legible.

---

## 5. The model call

TypeScript, so `@anthropic-ai/sdk`.

- **Model:** `claude-opus-5`.
- **Structured outputs**, not prompt-and-parse: `output_config.format` with a
  JSON schema. Prefer `client.messages.parse()` so the response is validated
  against the schema automatically.
- **Stream it** — three itineraries is a long output, and streaming avoids HTTP
  timeouts at high `max_tokens`. Use `.finalMessage()` to collect.
- **Adaptive thinking** is on by default on `claude-opus-5`; leave it on. Start
  at `output_config: { effort: 'high' }` and tune down if latency hurts.
- **Handle `stop_reason: "refusal"` before reading `content`** — a refused
  request returns HTTP 200 with empty or partial content, so code that indexes
  `content[0]` unconditionally will break.
- **Key:** `VOYAGR_ANTHROPIC_KEY` in deployment env, same operator-owned pattern
  as the places key. Never surfaced in the UI.

### Output schema

```ts
{
  options: [
    {
      name: string;        // "Gion & the eastern temples"
      rationale: string;   // one line on why this combination
      stops: [
        { providerId: string; kind: PlaceKind; dayOffset: number }
      ];
    }
  ]
}
```

`providerId` must be one of the pool entries we supplied. Validate on the way
out and drop any stop that does not resolve rather than trusting it.

---

## 6. Materialisation

The crux of the feature: turning the model's answer into a canvas.

```
                  [Hotel A]—[Ramen]—[Fushimi]
                 /
[Start Trip]————— [Hotel B]—[Kaiseki]—[Arashiyama]
                 \
                  [Hotel C]—[Izakaya]—[Nishiki]
```

One trip, one `tripStart` node, three parallel branches. The traveller keeps the
branch they like and deletes the others — or splices the hotel from one branch
into another. Mixing is the point, and side-by-side is the only layout that
makes it easy.

`buildTripWorkflow(tripParams, options, placesById) → { nodes, connections }`:

- One `n8n-nodes-base.tripStart` at `x = 0`, carrying the form's
  `startLocation`, `destination`, `startDate`, `endDate`, `budget`, `currency`.
- Branch *i* laid out at `y = i * BRANCH_SPACING`; each stop `x += 250`.
- `tripStart`'s main output connects to the **first node of every branch** —
  n8n supports multiple connections from one output, which is exactly this
  fan-out.
- Each stop node is written with the four provider fields from Spec A
  (`placeId`, `rating`, `priceTier`, `photoUrl`) plus its own params
  (`hotelName`/`location`/etc.). **The card-facing node shape from Spec A is
  this generator's output format** — keep them identical.

Keep this function pure — params in, graph out, no I/O. It is the one piece here
worth testing properly.

---

## 7. Failure states

No key, quota exhausted, a refusal, or a model error all land on the same quiet
message: *AI planning isn't available right now.* Planning a trip by hand never
depends on this feature working. Never surface a raw API error or a stack trace.

If fewer than three options survive validation, show the ones that did rather
than failing the whole request.

---

## 8. Testing

Deliberately light, by explicit instruction:

- Unit-test `buildTripWorkflow`: correct node count, correct fan-out
  connections, correct positions, provider fields written through.
- Unit-test the slider → category filter.
- One fixture test for the model call with a stubbed response — no live API
  calls in tests.
- One end-to-end visual check at the very end of the build, not per task.

---

## 9. Not in scope

Real prices, availability, or booking. Flights and trains (no free data source).
Per-node dates beyond `dayOffset`. Learning from past trips. Regenerating a
single branch. Chat-based refinement.

---

## 10. Files this touches

| Path | Change |
|---|---|
| `packages/cli/src/voyagr/generator/` | New: candidate-pool builder, prompt, Claude client, `buildTripWorkflow` |
| `packages/cli/src/voyagr/generator/generator.controller.ts` | New: `POST /rest/voyagr/generate-trip` |
| `packages/@n8n/api-types` | Form payload + generated-option shared types |
| `packages/@n8n/config` | `VOYAGR_ANTHROPIC_KEY` |
| `packages/cli/package.json` | Add `@anthropic-ai/sdk` |
| `packages/frontend/editor-ui/src/features/voyagr/generator/` | New: the form dialogue, styled like SignupView |
| `packages/frontend/editor-ui/src/app/views/WorkflowsView.vue` | "Plan with AI" entry point |
| `packages/frontend/@n8n/i18n/src/locales/en.json` | Form labels, slider ends, failure copy |
