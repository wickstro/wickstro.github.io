# wickstro.github.io

## Development

No local Ruby/Jekyll install needed — everything runs via Docker.

```bash
# start the dev server (http://localhost:4000), rebuilds on file changes
docker-compose up

# start in the background
docker-compose up -d

# view logs (when running in the background)
docker-compose logs -f

# stop and remove the container
docker-compose down
```
Claude can upload to drhardman.fi
-Requires rsync
I also saved the upload steps to my memory, so next time you can just say “update drhardman.fi” and I’ll pull, build, show you a test run and upload once you say go.
