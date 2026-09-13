# Voyagr Docker image

Docker packaging for Voyagr (built from this n8n-based monorepo). Prefer
running from source for local development — see the
[root README](../../../README.md) and [docs/VOYAGR.md](../../../docs/VOYAGR.md).

## Build

From the repo root:

```bash
pnpm build:docker
```

That compiles the app and builds the image. Alternatively:

```bash
pnpm run build:deploy   # produces compiled/
# then build with a context that includes the compiled/ directory
```

## Run (local image)

```bash
docker volume create voyagr_data

docker run -it --rm \
  --name voyagr \
  -p 5678:5678 \
  -v voyagr_data:/home/node/.n8n \
  <your-voyagr-image>
```

Open [http://localhost:5678](http://localhost:5678). Persist `/home/node/.n8n`
across restarts (SQLite data and encryption key live there).

### Optional env

| Variable | Purpose |
|---|---|
| `VOYAGR_GOOGLE_PLACES_KEY` | Place search / photos |
| `VOYAGR_GROQ_KEY` | AI trip generator |
| `GENERIC_TIMEZONE` / `TZ` | Timezone for scheduling / system |
| `DB_TYPE=postgresdb` + `DB_POSTGRESDB_*` | Use Postgres instead of SQLite |

Sensitive values can use the `*_FILE` pattern (load from a file / secret) where
supported by the upstream server.

## License

Sustainable Use License — see the [root README](../../../README.md#license).
Voyagr is non-commercial.
