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

## Deploy to drhardman.fi

```bash
# get the latest changes
git pull origin master

# build the site into _site/ (production settings)
docker-compose run --rm -e JEKYLL_ENV=production jekyll bash -c "bundle install --quiet && bundle exec jekyll build"

# upload _site/ to the server (add --dry-run first to see what would change)
rsync -rlptzc --delete _site/ lotta@pilvi.jco.fi:/var/www/production/drhardman.fi/
```
