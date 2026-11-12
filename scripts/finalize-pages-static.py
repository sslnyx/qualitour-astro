"""Verify and inventory a root-hosted Cloudflare Pages staging build."""
import argparse
import hashlib
import json
import os
import re
import sys
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path, PurePosixPath
from urllib.parse import quote, unquote, urlsplit

sys.path.insert(0, str(Path(__file__).resolve().parent))
from seo_check import SeoDocument, validate_alternates
from staging_release import island_props


ORIGIN = "https://staging.qualitour-astro.pages.dev"
CMS_ORIGIN = "https://qualitour-cms-free-test.qualitour.workers.dev"
TARGET = "cloudflare-staging"
MANIFEST = "qualitour-release.json"
SNAPSHOT = Path(".astro/cms-content/public-catalogue.json")
COMPATIBILITY = Path("src/data/cms-legacy-compat.json")
SECRET_MARKERS = (
    "WORDPRESS_AUTH_PASS",
    "ZAUI_API_TOKEN",
    "GH_DEPLOY_WORKFLOW_TOKEN",
    "EMDASH_TOKEN",
    "refreshToken",
    "ec_pat_",
    "ec_oat_",
)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def canonical_for_file(relative):
    path = "/" if relative == "index.html" else "/" + relative.removesuffix(".html")
    return ORIGIN + quote(unquote(path), safe="/")


def safe_slug(value):
    if not isinstance(value, str) or not value:
        raise ValueError("Invalid tour slug in public catalogue")
    decoded = unquote(value)
    if decoded in {".", ".."} or "/" in decoded or "\\" in decoded or any(ord(char) < 32 for char in decoded):
        raise ValueError("Unsafe tour slug in public catalogue")
    return decoded


def compatibility_digest(value):
    def canonical(item):
        if isinstance(item, list):
            return [canonical(child) for child in item]
        if isinstance(item, dict):
            return {
                key: canonical(item[key])
                for key in sorted(item)
                if key != "_key"
            }
        return item

    encoded = json.dumps(canonical(value), ensure_ascii=False, separators=(",", ":"))
    return digest(encoded.encode())


def read_catalogue(path, compatibility_path=COMPATIBILITY):
    raw = path.read_bytes()
    value = json.loads(raw)
    if value.get("schema") != 2:
        raise ValueError("CMS public catalogue must use schema 2")
    if value.get("origin") != CMS_ORIGIN:
        raise ValueError("CMS public catalogue origin is not the approved CMS origin")
    generated_at = value.get("generatedAt")
    try:
        generated = datetime.fromisoformat(generated_at.replace("Z", "+00:00"))
    except (AttributeError, TypeError, ValueError):
        raise ValueError("CMS public catalogue generatedAt is not valid UTC") from None
    if generated.tzinfo is None or generated.utcoffset() != timezone.utc.utcoffset(generated):
        raise ValueError("CMS public catalogue generatedAt is not UTC")
    age = (datetime.now(timezone.utc) - generated).total_seconds()
    if age < -60:
        raise ValueError("CMS public catalogue generatedAt is too far in the future")
    if age > 3600:
        raise ValueError("CMS public catalogue generatedAt is older than one hour")
    compatibility = json.loads(Path(compatibility_path).read_text())
    if value.get("compatibilityHash") != compatibility_digest(compatibility):
        raise ValueError("CMS public catalogue compatibility hash does not match the public compatibility source")
    locales = value.get("locales")
    if not isinstance(locales, dict):
        raise ValueError("CMS public catalogue locales are missing")
    tours = {}
    for language in ("en", "zh"):
        rows = locales.get(language, {}).get("tours")
        if not isinstance(rows, list) or not rows:
            raise ValueError(f"CMS public catalogue is empty or partial for {language}")
        ids = set()
        slugs = set()
        for tour in rows:
            tour_id = tour.get("id")
            slug = safe_slug(tour.get("slug"))
            if not isinstance(tour_id, int) or tour.get("status") != "publish":
                raise ValueError(f"Invalid public tour in {language} catalogue")
            if tour_id in ids:
                raise ValueError(f"Duplicate tour ID in {language} catalogue: {tour_id}")
            if slug in slugs:
                raise ValueError(f"Duplicate decoded tour slug in {language} catalogue: {slug}")
            try:
                datetime.fromisoformat(tour["date"].replace("Z", "+00:00"))
            except (KeyError, TypeError, ValueError):
                raise ValueError(f"Invalid CMS publication date for {language} tour {tour.get('id')}") from None
            ids.add(tour_id)
            slugs.add(slug)
        tours[language] = rows
    return value, raw, tours


def expected_latest(tours):
    def key(tour):
        stamp = datetime.fromisoformat(tour["date"].replace("Z", "+00:00")).timestamp()
        return stamp, tour["id"]

    return [tour["id"] for tour in sorted(tours, key=key, reverse=True)[:6]]


class BrowserReferences(HTMLParser):
    """Collect browser-fetched local files while excluding ordinary navigation."""

    def __init__(self):
        super().__init__()
        self.assets = []
        self.root_references = []

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        for name in ("src", "poster", "component-url", "renderer-url"):
            if values.get(name):
                self.assets.append(values[name])
        if values.get("srcset"):
            self.assets.extend(candidate.strip().split()[0] for candidate in values["srcset"].split(",") if candidate.strip())
        if tag == "link" and values.get("href"):
            rel = set(values.get("rel", "").split())
            if rel.intersection({"stylesheet", "icon", "preload", "modulepreload"}):
                self.assets.append(values["href"])
        for name in ("src", "href", "poster", "component-url", "renderer-url"):
            value = values.get(name)
            if isinstance(value, str) and value.startswith("/"):
                self.root_references.append(value)


def validate_assets(root, relative, html_text):
    parser = BrowserReferences()
    parser.feed(html_text)
    for reference in parser.root_references:
        if reference.startswith("/staging/"):
            raise ValueError(f"Non-root browser URL in {relative}: {reference}")
    for reference in parser.assets:
        if reference.startswith("//"):
            raise ValueError(f"Protocol-relative browser asset in {relative}: {reference}")
        parsed = urlsplit(reference)
        if "/wp-content/" in unquote(parsed.path):
            raise ValueError(f"Unoptimized WordPress browser image in {relative}: {reference}")
        if parsed.scheme or parsed.netloc or not parsed.path.startswith("/"):
            continue
        asset_path = unquote(parsed.path).removeprefix("/")
        parts = PurePosixPath(asset_path).parts
        if not asset_path or ".." in parts or not (root / asset_path).is_file():
            raise ValueError(f"Missing browser asset in {relative}: {reference}")


def validate_schema(document, relative):
    if not document.schemas:
        raise ValueError(f"No structured data: {relative}")
    if any(not isinstance(schema, (dict, list)) for schema in document.schemas):
        raise ValueError(f"Invalid structured data: {relative}")


def validate_detail(document, relative):
    if not document.h1 or not document.h1[0].strip() or "overview" not in document.tour_panels:
        raise ValueError(f"Missing server-rendered tour detail: {relative}")
    if len(document.meta.get("description", "")) > 160:
        raise ValueError(f"Tour description too long: {relative}")
    schemas = [schema for schema in document.schemas if isinstance(schema, dict)]
    types = {schema.get("@type") for schema in schemas}
    if not {"TouristTrip", "BreadcrumbList"}.issubset(types):
        raise ValueError(f"Missing tour schema: {relative}")
    for schema in schemas:
        if schema.get("@type") == "TouristTrip" and (
            schema.get("url") != document.canonical or "aggregateRating" in schema
        ):
            raise ValueError(f"Invalid tour schema: {relative}")


def catalogue_identities(rows):
    return {(tour.get("id"), tour.get("slug")) for tour in rows}


def validate_catalogue_pages(root, source_tours):
    counts = {}
    homepage_ids = {}
    detail_paths = set()
    for language in ("en", "zh"):
        prefix = "zh/" if language == "zh" else ""
        listing = root / (prefix + "tours.html")
        built = island_props(listing.read_text(), "ToursGrid").get("tours")
        if not isinstance(built, list) or len(built) != len(source_tours[language]) or catalogue_identities(built) != catalogue_identities(source_tours[language]):
            raise ValueError(
                f"Built {language} catalogue IDs/slugs/count differ from current schema 2 public catalogue"
            )
        counts[language] = len(built)
        for tour in source_tours[language]:
            relative = prefix + "tours/" + safe_slug(tour["slug"]) + ".html"
            if not (root / relative).is_file():
                raise ValueError(f"Missing detail page: {language}, tour {tour['id']}")
            detail_paths.add(relative)

        home = root / ("zh.html" if language == "zh" else "index.html")
        featured = island_props(home.read_text(), "FeaturedToursHero").get("tours")
        ids = [tour.get("id") for tour in featured] if isinstance(featured, list) else []
        expected = expected_latest(source_tours[language])
        if ids != expected:
            raise ValueError(f"Incorrect {language} homepage latest tour selection: built={ids}, expected={expected}")
        homepage_ids[language] = ids
    return counts, homepage_ids, detail_paths


def validate_transfers(root):
    snapshot = json.loads((root / "data/private-transfers.json").read_text())
    routes = snapshot.get("routes")
    if (
        snapshot.get("schemaVersion") != 1
        or snapshot.get("source") != "zaui"
        or not isinstance(routes, list)
        or not routes
        or not isinstance(snapshot.get("activityCount"), int)
        or snapshot["activityCount"] < 1
    ):
        raise ValueError("Invalid public transfer snapshot")
    for field in ("fetchedAt", "priceDate", "currency"):
        if not isinstance(snapshot.get(field), str) or not snapshot[field]:
            raise ValueError("Invalid public transfer snapshot metadata")
    for language in ("en", "zh"):
        prefix = "zh/" if language == "zh" else ""
        detail = island_props((root / (prefix + "private-transfers.html")).read_text(), "TransferRoutesGrid").get("routes")
        home = island_props((root / ("zh.html" if language == "zh" else "index.html")).read_text(), "TransferRoutesGrid").get("routes")
        if detail != routes or home != routes[:3]:
            raise ValueError(f"Shared {language} transfer routes differ from published JSON")


def changjiang_compatibility(root, source_tours):
    tour = next((tour for tour in source_tours["zh"] if tour.get("id") == 19039), None)
    if tour is None:
        return None
    relative = "zh/tours/" + safe_slug(tour["slug"]) + ".html"
    props = island_props((root / relative).read_text(), "TourDetail").get("tour", {})
    sections = props.get("goodlayers_data", {}).get("sections", [])
    itinerary = next((section for section in sections if section.get("value", {}).get("id") == "itinerary"), None)
    toggle = next((item for item in (itinerary or {}).get("items", []) if item.get("type") == "toggle-box"), None)
    days = (toggle or {}).get("value", {}).get("tabs", [])
    if len(days) != 16:
        raise ValueError("Published Changjiang compatibility tour must retain its 16-day itinerary")
    return {"path": "/" + relative.removesuffix(".html"), "itineraryDays": 16}


def append_noindex_header(root):
    path = root / "_headers"
    current = path.read_text() if path.exists() else ""
    block = "/*\n  X-Robots-Tag: noindex, follow\n"
    wildcard_noindex = re.search(
        r"(?ms)^/\*\s*$.*?^\s+X-Robots-Tag:\s*[^\n]*\bnoindex\b",
        current,
    )
    if not wildcard_noindex:
        path.write_text(current.rstrip() + "\n\n# Cloudflare Pages staging must never be indexed.\n" + block)


def finalize(root, snapshot_path=SNAPSHOT, compatibility_path=COMPATIBILITY):
    root = Path(root)
    snapshot_path = Path(snapshot_path)
    if not root.is_dir():
        raise ValueError(f"Static output directory does not exist: {root}")
    snapshot, snapshot_bytes, source_tours = read_catalogue(snapshot_path, compatibility_path)
    counts, homepage_ids, detail_paths = validate_catalogue_pages(root, source_tours)
    validate_transfers(root)

    documents = []
    records = []
    detail_titles = []
    detail_descriptions = []
    for page in sorted(root.rglob("*.html")):
        relative = page.relative_to(root).as_posix()
        html_text = page.read_text()
        document = SeoDocument()
        document.feed(html_text)
        expected = canonical_for_file(relative)
        if document.canonical != expected:
            raise ValueError(f"Incorrect root canonical for {relative}: {document.canonical}")
        if document.meta.get("og:url") != expected or document.meta.get("twitter:url") != expected:
            raise ValueError(f"Sharing URL differs from canonical: {relative}")
        if not document.title or not document.meta.get("description"):
            raise ValueError(f"Missing title/description: {relative}")
        if "noindex" not in document.robots.lower():
            raise ValueError(f"Staging page lacks noindex: {relative}")
        validate_schema(document, relative)
        validate_assets(root, relative, html_text)
        if relative in detail_paths:
            validate_detail(document, relative)
            detail_titles.append(document.title)
            detail_descriptions.append(document.meta["description"])
        documents.append(document)
        records.append(
            {
                "file": relative,
                "url": expected,
                "title": document.title,
                "description": document.meta["description"],
                "alternates": document.alternates,
                "schema": document.schemas,
                "indexable": False,
            }
        )
    if not records:
        raise ValueError("Static output contains no HTML pages")
    validate_alternates(documents)
    if len({document.canonical for document in documents}) != len(documents):
        raise ValueError("Duplicate canonical URLs in generated pages")
    if len(detail_titles) != len(set(detail_titles)) or len(detail_descriptions) != len(set(detail_descriptions)):
        raise ValueError("Duplicate tour titles or descriptions")

    for bundle in root.rglob("*.js"):
        content = bundle.read_text(errors="ignore")
        if any(marker in content for marker in SECRET_MARKERS):
            raise ValueError("Server-only secret marker found in browser bundle: " + bundle.relative_to(root).as_posix())

    (root / ".htaccess-staging").unlink(missing_ok=True)
    append_noindex_header(root)
    inventory = {"schema": 1, "target": TARGET, "origin": ORIGIN, "pages": records}
    (root / "seo-inventory.json").write_text(json.dumps(inventory, ensure_ascii=False, indent=2) + "\n")

    compatibility = changjiang_compatibility(root, source_tours)
    files = {
        path.relative_to(root).as_posix(): digest(path.read_bytes())
        for path in sorted(root.rglob("*"))
        if path.is_file() and path.name not in {MANIFEST, ".DS_Store"}
    }
    manifest = {
        "schema": 1,
        "commit": os.environ.get("CF_PAGES_COMMIT_SHA") or os.environ.get("GITHUB_SHA") or "local",
        "content_source": "emdash",
        "target": TARGET,
        "origin": ORIGIN,
        "counts": {"pages": len(records), "tours": counts, "files": len(files)},
        "homepage_ids": homepage_ids,
        "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "public_snapshot": {
            "schema": 2,
            "origin": snapshot.get("origin"),
            "generatedAt": snapshot.get("generatedAt"),
            "sha256": digest(snapshot_bytes),
        },
        "files": files,
    }
    if compatibility:
        manifest["changjiang"] = compatibility
    (root / MANIFEST).write_text(json.dumps(manifest, ensure_ascii=False, sort_keys=True) + "\n")
    result = {"verified": True, "counts": manifest["counts"], "homepage_ids": homepage_ids}
    print(json.dumps(result, ensure_ascii=False))
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dist", type=Path, required=True)
    arguments = parser.parse_args()
    finalize(arguments.dist)
