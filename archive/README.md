# Archive

Files nothing in the build, tests, workflows or `package.json` refers to any more. They were moved here (history kept with `git mv`) on 2026-11-19 so the project root only shows what the two Workers need. Nothing here is part of a release. Do not import from it.

`2026-11/`
- Root leftovers: old analysis output, a failed-build log, Lighthouse reports from the WordPress/cPanel era, a plugin list, and one-off debug files.
- `upload-secrets.sh`: pushed a `.env` file to the old Cloudflare Pages project `qualitour-astro`. Not used by the Workers.
- `scripts/`: one-off tour-matching analysis, image-rewrite debugging and an early Zaui prefetch.

Move a file back with `git mv` if you need it again.
