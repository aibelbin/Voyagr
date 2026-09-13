# Voyagr editor UI

The Vue 3 frontend for Voyagr — the canvas where you build trips, pick places,
and compare itinerary options.

This package is the n8n editor-ui, rebranded and wired for travel planning
(My Trips, Plan trip, travel-only node creator, budget UI).

## Setup

From the **repo root** (not this package alone):

```bash
CI=1 pnpm build:n8n
N8N_DIAGNOSTICS_ENABLED=false pnpm start
# open http://localhost:5678
```

### Package scripts (after a full monorepo build)

```bash
pnpm serve      # hot-reload for this package
pnpm build      # production build of editor-ui
pnpm test       # unit tests
pnpm lint       # lint
```

End-to-end tests live in `packages/testing/playwright` — see that package's README
and [docs/VOYAGR.md](../../../docs/VOYAGR.md).

## Related

- Travel nodes: `packages/nodes-base/nodes/Voyagr/`
- Project handoff: [docs/VOYAGR.md](../../../docs/VOYAGR.md)

## License

Sustainable Use License — see the [root README](../../../README.md#license).
Voyagr is non-commercial.
