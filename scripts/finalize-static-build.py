"""Finish static hosting output without modifying generated HTML bytes."""
import argparse
import json
import xml.etree.ElementTree as ET
from pathlib import Path
from seo_check import SeoDocument, validate_document, validate_alternates


def finalize(root, target):
    records = []
    documents = []
    for page in sorted(root.rglob('*.html')):
        document = SeoDocument()
        document.feed(page.read_text())
        relative = page.relative_to(root).as_posix()
        validate_document(document, relative, target)
        documents.append(document)
        records.append({'file': page.relative_to(root).as_posix(), 'url': document.canonical,
                        'title': document.title, 'description': document.meta.get('description'), 'alternates': document.alternates, 'schema': document.schemas, 'indexable': 'noindex' not in document.robots})
    validate_alternates(documents)
    canonicals = [r['url'] for r in records]
    if len(canonicals) != len(set(canonicals)):
        raise ValueError('Duplicate canonical URLs in generated pages')
    tour_pages = [record for record in records if '/tours/' in record['file'] or record['file'].startswith('tours/')]
    # Taxonomy/featured pages have their own semantics; uniqueness applies to tour records.
    detail_paths = {record['file'] for record in tour_pages if record['file'].count('/') == (2 if record['file'].startswith('zh/') else 1) and not record['file'].endswith('/featured.html')}
    detail_documents = [doc for doc, record in zip(documents, records) if record['file'] in detail_paths]
    for field, values in [('titles', [doc.title for doc in detail_documents]), ('descriptions', [doc.meta['description'] for doc in detail_documents])]:
        if len(values) != len(set(values)):
            raise ValueError('Duplicate tour ' + field)
    (root / 'seo-inventory.json').write_text(json.dumps({'target': target, 'pages': records}, ensure_ascii=False, indent=2))
    apache = Path('public/.htaccess-staging' if target == 'staging' else 'config/htaccess-production')
    (root / '.htaccess').write_bytes(apache.read_bytes())
    (root / '_astro').mkdir(exist_ok=True)
    (root / '_astro/.htaccess').write_text('<IfModule mod_headers.c>\n  Header set Cache-Control "public, max-age=31536000, immutable"\n</IfModule>\n')
    robots = 'User-agent: *\nAllow: /\nDisallow: /api/\n'
    sitemap = root / 'sitemap.xml'
    if target == 'production':
        ET.register_namespace('', 'http://www.sitemaps.org/schemas/sitemap/0.9')
        namespace = '{http://www.sitemaps.org/schemas/sitemap/0.9}'
        urlset = ET.Element(namespace + 'urlset')
        for record in records:
            if record['indexable']:
                ET.SubElement(ET.SubElement(urlset, namespace + 'url'), namespace + 'loc').text = record['url']
        ET.ElementTree(urlset).write(sitemap, encoding='utf-8', xml_declaration=True)
        robots += 'Disallow: /wp-admin/\nSitemap: https://qualitour.ca/sitemap.xml\n'
    elif sitemap.exists():
        sitemap.unlink()
    (root / 'robots.txt').write_text(robots)
    print(f'[Static output] {target}: {len(records)} canonical pages; sitemap={target == "production"}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--target', choices=['staging', 'production'], required=True)
    parser.add_argument('--dist', type=Path, default=Path('dist'))
    args = parser.parse_args()
    finalize(args.dist, args.target)
