import importlib.util
import io
import json
import os
import sys
import tempfile
import unittest
import xml.etree.ElementTree as ET
from contextlib import contextmanager, redirect_stdout
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from seo_check import SeoDocument, validate_alternates, validate_document


FINALIZER_SPEC = importlib.util.spec_from_file_location(
    "finalize_static_build", SCRIPT_DIR / "finalize-static-build.py"
)
finalizer = importlib.util.module_from_spec(FINALIZER_SPEC)
FINALIZER_SPEC.loader.exec_module(finalizer)


def parse_document(html):
    document = SeoDocument()
    document.feed(html)
    document.close()
    return document


def html_document(
    *,
    canonical,
    title="A distinct page | Qualitour",
    description="A concise description written for this page.",
    robots="index, follow",
    h1="A distinct page",
    schemas=None,
    alternates=None,
):
    alternate_links = "".join(
        f'<link rel="alternate" hreflang="{language}" href="{href}">'
        for language, href in (alternates or {}).items()
    )
    schema_scripts = "".join(
        f'<script type="application/ld+json">{json.dumps(schema)}</script>'
        for schema in (schemas or [{"@context": "https://schema.org", "@type": "WebPage"}])
    )
    h1_markup = "" if h1 is None else f"<h1>{h1}</h1>"
    return f"""<!doctype html>
<html>
  <head>
    <title>{title}</title>
    <meta name="description" content="{description}">
    <meta name="robots" content="{robots}">
    <meta property="og:url" content="{canonical}">
    <meta name="twitter:url" content="{canonical}">
    <link rel="canonical" href="{canonical}">
    {alternate_links}
    {schema_scripts}
  </head>
  <body>{h1_markup}<section data-tour-panel="overview">Static overview text</section></body>
</html>"""


def tour_schemas(canonical):
    return [
        {
            "@context": "https://schema.org",
            "@type": "TouristTrip",
            "name": "Rocky Mountains Explorer",
            "url": canonical,
        },
        {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [],
        },
    ]


def write_page(root, relative, html):
    destination = root / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(html)


@contextmanager
def working_directory(path):
    previous = Path.cwd()
    os.chdir(path)
    try:
        yield
    finally:
        os.chdir(previous)


class GeneratedHtmlSeoTests(unittest.TestCase):
    def test_tour_validation_rejects_generic_or_client_only_details(self):
        canonical = "https://qualitour.ca/tours/rockies"
        counterexamples = {
            "generic metadata": html_document(
                canonical=canonical,
                title="Tour | Qualitour",
                h1="Rocky Mountains Explorer",
                schemas=tour_schemas(canonical),
            ),
            "client-only heading": html_document(
                canonical=canonical,
                title="Rocky Mountains Explorer | Qualitour",
                h1=None,
                schemas=tour_schemas(canonical),
            ),
        }

        for label, html in counterexamples.items():
            with self.subTest(label=label), self.assertRaisesRegex(
                ValueError, "Client-only or generic tour page"
            ):
                validate_document(
                    parse_document(html),
                    "tours/rockies.html",
                    target="production",
                    tour=True,
                )

    def test_tour_validation_accepts_static_unique_metadata_and_schema(self):
        canonical = "https://qualitour.ca/tours/rockies"
        document = parse_document(
            html_document(
                canonical=canonical,
                title="Rocky Mountains Explorer | Qualitour",
                description="Explore the Canadian Rockies on a guided small-group journey.",
                h1="Rocky Mountains Explorer",
                schemas=tour_schemas(canonical),
            )
        )

        validate_document(
            document,
            "tours/rockies.html",
            target="production",
            tour=True,
        )

    def test_canonical_rejects_html_suffix_or_wrong_host(self):
        counterexamples = {
            "html suffix": "https://qualitour.ca/tours/rockies.html",
            "wrong host": "https://qualitour.isquarestudio.com/tours/rockies",
        }

        for label, canonical in counterexamples.items():
            with self.subTest(label=label), self.assertRaisesRegex(
                ValueError, "Incorrect canonical"
            ):
                validate_document(
                    parse_document(html_document(canonical=canonical)),
                    "tours/rockies.html",
                    target="production",
                )

    def test_staging_rejects_indexable_page(self):
        canonical = "https://qualitour.ca/staging/tours/rockies"
        document = parse_document(
            html_document(canonical=canonical, robots="index, follow")
        )

        with self.assertRaisesRegex(ValueError, "Indexable staging page"):
            validate_document(document, "tours/rockies.html", target="staging")

    def test_hreflang_rejects_missing_counterpart(self):
        alternates = {
            "en": "https://qualitour.ca/tours/rockies",
            "zh": "https://qualitour.ca/zh/tours/rockies",
            "x-default": "https://qualitour.ca/tours/rockies",
        }
        english = parse_document(
            html_document(
                canonical="https://qualitour.ca/tours/rockies",
                alternates=alternates,
            )
        )

        with self.assertRaisesRegex(ValueError, "Missing or non-reciprocal alternate"):
            validate_alternates([english])

    def test_hreflang_rejects_nonreciprocal_group(self):
        english_alternates = {
            "en": "https://qualitour.ca/tours/rockies",
            "zh": "https://qualitour.ca/zh/tours/rockies",
        }
        chinese_alternates = {
            "en": "https://qualitour.ca/tours/rockies",
            "zh": "https://qualitour.ca/zh/tours/different-tour",
        }
        english = parse_document(
            html_document(
                canonical="https://qualitour.ca/tours/rockies",
                alternates=english_alternates,
            )
        )
        chinese = parse_document(
            html_document(
                canonical="https://qualitour.ca/zh/tours/rockies",
                alternates=chinese_alternates,
            )
        )

        with self.assertRaisesRegex(ValueError, "Missing or non-reciprocal alternate"):
            validate_alternates([english, chinese])


class StaticBuildFinalizerTests(unittest.TestCase):
    def test_production_sitemap_contains_only_indexable_canonical_pages(self):
        with tempfile.TemporaryDirectory() as temporary:
            workspace = Path(temporary)
            site = workspace / "dist"
            site.mkdir()
            (workspace / "config").mkdir()
            (workspace / "config/htaccess-production").write_text("production rules\n")
            write_page(
                site,
                "index.html",
                html_document(canonical="https://qualitour.ca/"),
            )
            write_page(
                site,
                "private.html",
                html_document(
                    canonical="https://qualitour.ca/private",
                    robots="noindex, follow",
                ),
            )

            with working_directory(workspace), redirect_stdout(io.StringIO()):
                finalizer.finalize(site, "production")

            sitemap = ET.parse(site / "sitemap.xml")
            locations = [
                element.text
                for element in sitemap.findall(
                    ".//{http://www.sitemaps.org/schemas/sitemap/0.9}loc"
                )
            ]
            self.assertEqual(locations, ["https://qualitour.ca/"])
            self.assertNotIn("https://qualitour.ca/private", locations)

    def test_staging_removes_sitemap_and_obsolete_robots_host(self):
        with tempfile.TemporaryDirectory() as temporary:
            workspace = Path(temporary)
            site = workspace / "dist"
            site.mkdir()
            (workspace / "public").mkdir()
            (workspace / "public/.htaccess-staging").write_text("staging rules\n")
            write_page(
                site,
                "index.html",
                html_document(
                    canonical="https://qualitour.ca/staging/",
                    robots="noindex, follow",
                ),
            )
            (site / "sitemap.xml").write_text("stale sitemap")
            (site / "robots.txt").write_text(
                "Sitemap: https://qualitour.isquarestudio.com/sitemap.xml\n"
            )

            with working_directory(workspace), redirect_stdout(io.StringIO()):
                finalizer.finalize(site, "staging")

            robots = (site / "robots.txt").read_text()
            self.assertFalse((site / "sitemap.xml").exists())
            self.assertNotIn("qualitour.isquarestudio.com", robots)
            self.assertNotIn("Sitemap:", robots)


if __name__ == "__main__":
    unittest.main()
