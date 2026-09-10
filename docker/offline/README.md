# Offline CI/CD for OpenMetadata custom builds

This directory holds the pieces of an airgapped build pipeline that turns
a code change into either an `openmetadata-server` image (backend and/or
frontend changes) or an `openmetadata-ingestion` image (`ingestion/`
changes), using the pre-warmed `openmetadata-{be,fe,ingest}-base` images
from the base-image tooling repo as the only Maven/Yarn/pip dependency
source — no network access required at build time.

| File | Purpose |
|---|---|
| `../../.gitlab-ci.yml` | GitLab CI pipeline: path-triggered `build-server` / `build-ingest` jobs |
| `Dockerfile.server` | Multi-stage: backend (Maven, no UI) + frontend (Yarn) + assembly into one runtime image |
| `Dockerfile.ingest` | Installs the local `ingestion/` package on top of `ingest-base`, no deps re-resolved |
| `package-ui-assets.sh` | Packages the Yarn-built UI as a plain jar consumable by the Java server |

## Why the server build isn't just `mvn clean package`

`openmetadata-ui`'s Maven module runs `frontend-maven-plugin`, whose
`install-node-and-yarn` goal downloads its own Node/Yarn from the internet
on every build — there's no config in the pom to point it at a local
mirror or a pre-installed Node/Yarn. Rather than fight that (patching the
pom, or gambling on undocumented plugin-cache internals), `Dockerfile.server`
sidesteps it entirely:

1. **Backend** builds via `mvn ... -DonlyBackend ... -pl '!openmetadata-ui'`
   — a supported, already-documented dev command (see
   `OpenMetadata/CLAUDE.md`) that excludes the UI module from the Maven
   reactor entirely, so `frontend-maven-plugin` never runs. Fully offline
   against `be-base`'s cached `~/.m2`.
2. **Frontend** builds via a real `yarn install && yarn run build` in a
   separate stage on `fe-base`, entirely offline against its cached
   `$YARN_CACHE_FOLDER` — no Maven involved.
3. The UI's build output (`dist/`) is packaged as a plain jar with its
   contents rooted under `assets/` — **not** by running
   `frontend-maven-plugin`'s `copy-resources` step, just a manual `jar cf`.
   This works because `OpenMetadataAssetServlet` is registered with
   `resourcePath="/assets"` and resolves files via
   `getClass().getResource(...)` — a **classpath** lookup. Any jar on the
   runtime classpath with that layout satisfies it; the runtime doesn't
   care whether Maven or a shell script produced the jar.
4. That jar is dropped into the assembled dist tarball's `libs/` directory,
   which `openmetadata-server-start.sh` globs (`for file in
   $base_dir/libs/*.jar`) onto the classpath — confirmed by reading the
   script, not assumed.

## A real fix this required: `fe-base`'s cache was incomplete

`fe-base` originally only ran `yarn install --ignore-scripts` against
`openmetadata-ui`'s own manifest. But a **real** (script-enabled) install
at that path walks up and installs the repo-root workspace, then builds
the linked `openmetadata-ui-core-components` package — three separate
manifests (see `minimal-ctx/FRONTEND.md`), only one of which was actually
being warmed. `Dockerfile-fe-base` (in the base-image tooling repo) was
updated to install all three levels so `Dockerfile.server`'s real build
doesn't unexpectedly need the network. If you're reading this after that
fix has drifted, `fe-base` needs rebuilding before trusting this pipeline.

## What's verified vs. not

Verified in the base-image tooling repo, by actually running the builds:

- `mvn dependency:go-offline` against the full reactor (`be-base`) — works.
- Real, script-enabled `yarn install` at all three manifest levels against
  `fe-base`'s cache — rebuilt and re-running as of this writing.
- `openmetadata-ingest-base`'s full "all" extra installs cleanly, `pip
  check` clean, and `wheel`/`setuptools` are present for `Dockerfile.ingest`'s
  `--no-build-isolation` local install.
- The classpath mechanism `package-ui-assets.sh` relies on, by reading
  `OpenMetadataAssetServlet.java`, `OpenMetadataApplication.java`'s
  `registerAssetServlet`, `openmetadata-ui/pom.xml`'s `copy-resources`
  config, `openmetadata-dist`'s assembly descriptor
  (`dependencySet` → `libs/`, `unpack=false`), the `only-backend` Maven
  profile, and `bin/openmetadata-server-start.sh`'s classpath construction
  — not guessed.

**Not** verified end-to-end in this session: an actual full `mvn ...
-DonlyBackend clean package -pl '!openmetadata-ui'` run (compiling all
Java modules, not just resolving dependencies) and an actual `yarn run
build` (webpack) against real source, or the resulting `docker build -f
Dockerfile.server` all the way through. Each of the three base images took
20 minutes to several hours to verify in this environment (slow network,
background builds that were repeatedly interrupted) — a full server build
compiling the entire reactor plus a production webpack build is a
significantly larger job than any single piece verified so far.

## Before trusting this in production, run

```sh
# From the OpenMetadata/ repo root, with be-base/fe-base/ingest-base
# already loaded locally (docker load -i ...tar, or built fresh):
docker build -f docker/offline/Dockerfile.server \
  --build-arg BE_BASE_IMAGE=openmetadata-be-base:latest \
  --build-arg FE_BASE_IMAGE=openmetadata-fe-base:latest \
  -t openmetadata-server:smoketest .

docker run --rm -p 8585:8585 openmetadata-server:smoketest &
curl -sf http://localhost:8585/api/v1/system/version   # expect 1.13.5, not a 404/connection error

docker build -f docker/offline/Dockerfile.ingest \
  --build-arg INGEST_BASE_IMAGE=openmetadata-ingest-base:latest \
  -t openmetadata-ingestion:smoketest .
docker run --rm openmetadata-ingestion:smoketest --help   # `metadata` CLI should print usage
```

A 404 or blank page at `/` on the running server would point at the UI
jar not landing on the classpath correctly — check `libs/` inside the
container for `openmetadata-ui-assets.jar` and confirm it contains
`assets/index.html` (`unzip -l`).

## Registry & runner setup (one-time, outside this pipeline)

1. Push the three base images to your self-hosted GitLab's Container
   Registry once:
   ```sh
   docker tag openmetadata-be-base:latest     $CI_REGISTRY_IMAGE/openmetadata-be-base:latest
   docker tag openmetadata-fe-base:latest     $CI_REGISTRY_IMAGE/openmetadata-fe-base:latest
   docker tag openmetadata-ingest-base:latest $CI_REGISTRY_IMAGE/openmetadata-ingest-base:latest
   docker push $CI_REGISTRY_IMAGE/openmetadata-be-base:latest
   docker push $CI_REGISTRY_IMAGE/openmetadata-fe-base:latest
   docker push $CI_REGISTRY_IMAGE/openmetadata-ingest-base:latest
   ```
   Re-push whenever the base-image tooling repo's `OpenMetadata/` checkout
   moves to a new version and the sync scripts + base images are rebuilt.
2. Register a GitLab Runner tagged `docker` with access to a Docker daemon
   and network access to `$CI_REGISTRY` only (no public internet needed).
3. `.gitlab-ci.yml` uses GitLab's predefined `$CI_REGISTRY*` variables —
   no extra CI/CD variables to configure unless your registry needs
   different credentials than the runner's default.
