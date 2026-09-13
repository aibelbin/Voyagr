# Voyagr travel nodes

Default nodes shipped with Voyagr. The automation integrations from upstream
n8n are not loaded; only travel nodes (plus Start Trip and Sticky Note) appear
in the palette.

## Travel nodes

| Category | Nodes |
|---|---|
| Hotels | Hotel |
| Tourist Destinations | Tourist Destination |
| Food & Dining | Restaurant, Cafe |
| Travel Modes | Flight, Train, Car Rental, Bus, Ferry |
| Experiences | Activity |
| Shopping | Shopping |
| Rest & Free Time | Free Time |

Source: `nodes/Voyagr/<Name>/`. Registration and whitelist details are in
[docs/VOYAGR.md](../../docs/VOYAGR.md) (§3–4).

## Adding a node

1. Add `nodes/Voyagr/<Name>/` (`*.node.ts`, `*.node.json`, icon SVG)
2. Register in this package's `package.json` `n8n.nodes` array
3. Add the type to the include list in `@n8n/config` `nodes.config.ts`
4. If it's a new category, add a palette tile + i18n keys (see VOYAGR.md)

Then from the repo root: `CI=1 pnpm build:n8n && pnpm start`.

## License

Sustainable Use License — see the [root README](../../README.md#license).
Voyagr is non-commercial.
