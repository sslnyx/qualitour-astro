import hashlib
import html
import importlib.util
import json
import os
import shutil
import subprocess
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import quote, unquote


SCRIPT_DIR = Path(__file__).resolve().parent
FINALIZER_PATH = SCRIPT_DIR / "finalize-pages-static.py"
BUILD_PATH = SCRIPT_DIR / "build-pages-static.mjs"
ORIGIN = "https://staging.qualitour-astro.pages.dev"


def load_finalizer():
    spec = importlib.util.spec_from_file_location("pages_static", FINALIZER_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def astro_encode(value):
    if isinstance(value, list):
        return [1, [astro_encode(item) for item in value]]
    if isinstance(value, dict):
        return [0, {key: astro_encode(item) for key, item in value.items()}]
    return [0, value]


def island(component, **props):
    encoded = {key: astro_encode(value) for key, value in props.items()}
    payload = html.escape(json.dumps(encoded, separators=(",", ":")), quote=True)
    return (
        f'<astro-island component-url="/_astro/{component}.js" '
        f'props="{payload}"></astro-island>'
    )


def page_html(relative, *, body="", noindex=True, canonical=None, alternates=None):
    path = "/" if relative == "index.html" else "/" + relative.removesuffix(".html")
    url = canonical or ORIGIN + quote(unquote(path), safe="/")
    alternate_links = "".join(
        f'<link rel="alternate" hreflang="{language}" href="{href}">'
        for language, href in (alternates or {}).items()
    )
    robots = '<meta name="robots" content="noindex, follow">' if noindex else ""
    schemas = '<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebPage"}</script>'
    if "/tours/" in path:
        schemas = (
            f'<script type="application/ld+json">{{"@context":"https://schema.org","@type":"TouristTrip","url":"{url}"}}</script>'
            '<script type="application/ld+json">{"@context":"https://schema.org","@type":"BreadcrumbList"}</script>'
        )
        body = '<h1>Specific tour</h1><section data-tour-panel="overview">Overview</section>' + body
    return (
        "<!doctype html><html><head>"
        f"<title>{relative} | Qualitour</title>"
        f'<meta name="description" content="A complete description for {relative}.">'
        f'<link rel="canonical" href="{url}">'
        f'<meta property="og:url" content="{url}"><meta name="twitter:url" content="{url}">'
        f"{robots}{alternate_links}{schemas}"
        '<link rel="stylesheet" href="/assets/site.css">'
        "</head><body>"
        '<img src="/assets/logo.png" alt="Qualitour">'
        f"{body}<a href>Unavailable link</a></body></html>"
    )


class BuildFixture:
    def __init__(self, root):
        self.root = Path(root)
        self.dist = self.root / "dist"
        self.snapshot_path = self.root / ".astro/cms-content/public-catalogue.json"
        self.compatibility_path = self.root / "src/data/cms-legacy-compat.json"
        self.tours = {
            "en": [
                {"id": 12, "slug": "older-en", "status": "publish", "date": "2026-01-01T00:00:00Z"},
                {"id": 11, "slug": "latest-en", "status": "publish", "date": "2026-02-01T00:00:00Z"},
            ],
            "zh": [
                {"id": 22, "slug": "%e6%97%a7", "status": "publish", "date": "2026-03-01T00:00:00Z"},
                {"id": 21, "slug": "%e6%96%b0", "status": "publish", "date": "2026-04-01T00:00:00Z"},
            ],
        }
        self.routes = [
            {"id": "one", "name": "One", "vehicles": [{"activityId": 1}]},
            {"id": "two", "name": "Two", "vehicles": [{"activityId": 2}]},
        ]

    def create(self):
        (self.dist / "_astro").mkdir(parents=True)
        (self.dist / "assets").mkdir()
        (self.dist / "data").mkdir()
        self.snapshot_path.parent.mkdir(parents=True)
        self.compatibility_path.parent.mkdir(parents=True)
        (self.dist / "assets/site.css").write_text("body{}")
        (self.dist / "assets/logo.png").write_bytes(b"png")
        for component in ["FeaturedToursHero", "ToursGrid", "TransferRoutesGrid"]:
            (self.dist / "_astro" / f"{component}.js").write_text("export default {}")
        snapshot = {
            "schema": 2,
            "origin": "https://qualitour-cms-free-test.qualitour.workers.dev",
            "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "compatibilityHash": "9709b4f6f9d75981d49e2c4ed01b2998a406a710170805516dc799bca2eee121",
            "locales": {lang: {"tours": tours, "terms": {}, "excluded": []} for lang, tours in self.tours.items()},
        }
        self.compatibility_path.write_text(json.dumps({"schema": 1, "locales": {}}))
        self.snapshot_path.write_text(json.dumps(snapshot))
        transfer_snapshot = {
            "schemaVersion": 1,
            "source": "zaui",
            "fetchedAt": "2026-11-12T00:00:00Z",
            "priceDate": "2026-11-12",
            "timezone": "America/Vancouver",
            "currency": "CAD",
            "activityCount": 2,
            "routes": self.routes,
        }
        (self.dist / "data/private-transfers.json").write_text(json.dumps(transfer_snapshot))
        (self.dist / "_headers").write_text("/_astro/*\n  Cache-Control: public, max-age=31536000, immutable\n")
        (self.dist / ".htaccess-staging").write_text("Apache only")
        self.write_dynamic_pages()
        for lang, tours in self.tours.items():
            prefix = "zh/" if lang == "zh" else ""
            for tour in tours:
                relative = prefix + "tours/" + tour["slug"] + ".html"
                decoded = __import__("urllib.parse", fromlist=["unquote"]).unquote(relative)
                path = self.dist / decoded
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(page_html(decoded))
        return self

    def write_dynamic_pages(self, *, catalogue=None, homepage=None):
        catalogue = catalogue or self.tours
        homepage = homepage or {
            lang: sorted(tours, key=lambda tour: (tour["date"], tour["id"]), reverse=True)[:6]
            for lang, tours in self.tours.items()
        }
        for lang in ["en", "zh"]:
            prefix = "zh/" if lang == "zh" else ""
            home = "zh.html" if lang == "zh" else "index.html"
            self._write(home, page_html(home, body=island("FeaturedToursHero", tours=homepage[lang]) + island("TransferRoutesGrid", routes=self.routes)))
            listing = prefix + "tours.html"
            self._write(listing, page_html(listing, body=island("ToursGrid", tours=catalogue[lang])))
            transfers = prefix + "private-transfers.html"
            self._write(transfers, page_html(transfers, body=island("TransferRoutesGrid", routes=self.routes)))

    def _write(self, relative, content):
        path = self.dist / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content)


class PagesStaticFinalizerTests(unittest.TestCase):
    def run_finalize(self, fixture):
        return load_finalizer().finalize(fixture.dist, fixture.snapshot_path, fixture.compatibility_path)

    def test_catalogue_rejects_unapproved_origin_and_bad_snapshot_age(self):
        cases = {
            "origin": lambda snapshot: snapshot.update(origin="https://example.invalid"),
            "older": lambda snapshot: snapshot.update(
                generatedAt=(datetime.now(timezone.utc) - timedelta(hours=2)).isoformat().replace("+00:00", "Z")
            ),
            "future": lambda snapshot: snapshot.update(
                generatedAt=(datetime.now(timezone.utc) + timedelta(minutes=2)).isoformat().replace("+00:00", "Z")
            ),
            "UTC": lambda snapshot: snapshot.update(generatedAt="2026-11-12T08:00:00+01:00"),
        }
        for expected, mutate in cases.items():
            with self.subTest(expected=expected), tempfile.TemporaryDirectory() as temp:
                fixture = BuildFixture(temp).create()
                snapshot = json.loads(fixture.snapshot_path.read_text())
                mutate(snapshot)
                fixture.snapshot_path.write_text(json.dumps(snapshot))
                with self.assertRaisesRegex(ValueError, expected):
                    load_finalizer().read_catalogue(fixture.snapshot_path, fixture.compatibility_path)

    def test_catalogue_rejects_compatibility_hash_mismatch(self):
        with tempfile.TemporaryDirectory() as temp:
            fixture = BuildFixture(temp).create()
            snapshot = json.loads(fixture.snapshot_path.read_text())
            snapshot["compatibilityHash"] = "0" * 64
            fixture.snapshot_path.write_text(json.dumps(snapshot))
            with self.assertRaisesRegex(ValueError, "compatibility"):
                load_finalizer().read_catalogue(fixture.snapshot_path, fixture.compatibility_path)

    def test_catalogue_rejects_duplicate_ids_and_decoded_slugs(self):
        mutations = {
            "ID": lambda tours: tours.append({**tours[0], "slug": "different-slug"}),
            "slug": lambda tours: tours.append({**tours[0], "id": 999, "slug": "%6flder-en"}),
        }
        for expected, mutate in mutations.items():
            with self.subTest(expected=expected), tempfile.TemporaryDirectory() as temp:
                fixture = BuildFixture(temp).create()
                snapshot = json.loads(fixture.snapshot_path.read_text())
                mutate(snapshot["locales"]["en"]["tours"])
                fixture.snapshot_path.write_text(json.dumps(snapshot))
                with self.assertRaisesRegex(ValueError, expected):
                    load_finalizer().read_catalogue(fixture.snapshot_path, fixture.compatibility_path)

    def test_valid_small_build_is_verified_and_manifested_idempotently(self):
        with tempfile.TemporaryDirectory() as temp:
            fixture = BuildFixture(temp).create()
            source_before = fixture.snapshot_path.read_bytes()
            result = self.run_finalize(fixture)
            self.run_finalize(fixture)

            self.assertEqual(result["counts"]["pages"], 10)
            self.assertEqual(result["counts"]["tours"], {"en": 2, "zh": 2})
            self.assertEqual(result["homepage_ids"], {"en": [11, 12], "zh": [21, 22]})
            self.assertFalse((fixture.dist / ".htaccess-staging").exists())
            headers = (fixture.dist / "_headers").read_text()
            self.assertEqual(headers.count("X-Robots-Tag: noindex, follow"), 1)
            self.assertEqual(fixture.snapshot_path.read_bytes(), source_before)

            inventory = json.loads((fixture.dist / "seo-inventory.json").read_text())
            self.assertEqual(inventory["target"], "cloudflare-staging")
            self.assertEqual(len(inventory["pages"]), 10)
            manifest = json.loads((fixture.dist / "qualitour-release.json").read_text())
            self.assertEqual(manifest["schema"], 1)
            self.assertEqual(manifest["target"], "cloudflare-staging")
            self.assertEqual(manifest["origin"], ORIGIN)
            self.assertEqual(manifest["public_snapshot"]["schema"], 2)
            self.assertEqual(manifest["public_snapshot"]["sha256"], hashlib.sha256(source_before).hexdigest())
            self.assertNotIn("raw", json.dumps(manifest["public_snapshot"]).lower())
            for relative, digest in manifest["files"].items():
                self.assertEqual(hashlib.sha256((fixture.dist / relative).read_bytes()).hexdigest(), digest)

    def test_wrong_root_canonical_is_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            fixture = BuildFixture(temp).create()
            page = fixture.dist / "index.html"
            page.write_text(page.read_text().replace(ORIGIN + "/", ORIGIN + "/staging/"))
            with self.assertRaisesRegex(ValueError, "canonical"):
                self.run_finalize(fixture)

    def test_partial_catalogue_and_missing_detail_are_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            fixture = BuildFixture(temp).create()
            partial = {**fixture.tours, "en": fixture.tours["en"][:1]}
            fixture.write_dynamic_pages(catalogue=partial)
            with self.assertRaisesRegex(ValueError, "catalogue"):
                self.run_finalize(fixture)

        with tempfile.TemporaryDirectory() as temp:
            fixture = BuildFixture(temp).create()
            missing = fixture.dist / "tours/latest-en.html"
            missing.unlink()
            with self.assertRaisesRegex(ValueError, "Missing detail"):
                self.run_finalize(fixture)

    def test_missing_local_browser_asset_is_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            fixture = BuildFixture(temp).create()
            (fixture.dist / "assets/logo.png").unlink()
            with self.assertRaisesRegex(ValueError, "Missing browser asset"):
                self.run_finalize(fixture)

    def test_homepage_must_use_latest_six_by_cms_date(self):
        with tempfile.TemporaryDirectory() as temp:
            fixture = BuildFixture(temp).create()
            wrong = {lang: list(tours) for lang, tours in fixture.tours.items()}
            fixture.write_dynamic_pages(homepage=wrong)
            with self.assertRaisesRegex(ValueError, "homepage latest"):
                self.run_finalize(fixture)

    def test_missing_noindex_is_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            fixture = BuildFixture(temp).create()
            page = fixture.dist / "index.html"
            page.write_text(page.read_text().replace('<meta name="robots" content="noindex, follow">', ""))
            with self.assertRaisesRegex(ValueError, "noindex"):
                self.run_finalize(fixture)


class PagesStaticBuildRunnerTests(unittest.TestCase):
    def make_project(self, root):
        root = Path(root)
        (root / "scripts").mkdir()
        (root / "node_modules/astro").mkdir(parents=True)
        shutil.copy2(BUILD_PATH, root / "scripts/build-pages-static.mjs")
        (root / "node_modules/astro/package.json").write_text(json.dumps({"bin": {"astro": "cli.mjs"}}))
        (root / "node_modules/astro/cli.mjs").write_text(
            "import {writeFileSync} from 'node:fs';"
            "writeFileSync(process.env.BUILD_PROBE,JSON.stringify({argv:process.argv.slice(2),target:process.env.DEPLOY_TARGET,out:process.env.PAGES_STATIC_OUT_DIR}));"
            "if(process.env.ASTRO_FAKE_FAIL==='true')process.exit(7);"
        )
        fake_bin = root / "fake-bin"
        fake_bin.mkdir()
        python = fake_bin / "python3"
        python.write_text('#!/bin/sh\nprintf "%s\\n" "$@" > "$FINALIZE_PROBE"\n')
        python.chmod(0o755)
        (root / ".astro/wordpress-cache").mkdir(parents=True)
        (root / ".astro/wordpress-cache/keep").write_text("do not clear")
        return root

    def run_build(self, root, **extra_env):
        env = {
            **os.environ,
            "PATH": str(root / "fake-bin") + os.pathsep + os.environ["PATH"],
            "BUILD_PROBE": str(root / "build-probe.json"),
            "FINALIZE_PROBE": str(root / "finalize-probe.txt"),
            **extra_env,
        }
        return subprocess.run(
            [os.environ.get("NODE", "node"), "scripts/build-pages-static.mjs"],
            cwd=root,
            env=env,
            text=True,
            capture_output=True,
        )

    def test_build_uses_local_astro_staging_config_and_then_finalizes(self):
        with tempfile.TemporaryDirectory() as temp:
            root = self.make_project(temp)
            result = self.run_build(root, PAGES_STATIC_OUT_DIR="custom/dist")
            self.assertEqual(result.returncode, 0, result.stderr)
            build = json.loads((root / "build-probe.json").read_text())
            self.assertEqual(build["argv"], ["build", "--config", "astro.config.pages-static.mjs"])
            self.assertEqual(build["target"], "staging")
            self.assertEqual(build["out"], "custom/dist")
            self.assertEqual((root / "finalize-probe.txt").read_text().splitlines(), ["scripts/finalize-pages-static.py", "--dist", "custom/dist"])
            self.assertTrue((root / ".astro/wordpress-cache/keep").exists())

    def test_build_defaults_output_and_does_not_finalize_after_astro_failure(self):
        with tempfile.TemporaryDirectory() as temp:
            root = self.make_project(temp)
            result = self.run_build(root, ASTRO_FAKE_FAIL="true")
            self.assertNotEqual(result.returncode, 0)
            build = json.loads((root / "build-probe.json").read_text())
            self.assertEqual(build["out"], ".astro/cloudflare-release/dist")
            self.assertFalse((root / "finalize-probe.txt").exists())


if __name__ == "__main__":
    unittest.main()
