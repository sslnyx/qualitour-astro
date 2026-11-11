"""Inspect the actual generated HTML, independent of client-side JavaScript."""
import json
import re
from html.parser import HTMLParser
from urllib.parse import quote, unquote, urlsplit


class SeoDocument(HTMLParser):
    def __init__(self):
        super().__init__()
        self.canonical = None
        self.robots = ''
        self.title = ''
        self.meta = {}
        self.h1 = []
        self.alternates = {}
        self.schemas = []
        self.tour_panels = set()
        self._title = False
        self._h1 = False
        self._jsonld = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'link' and attrs.get('rel') == 'canonical':
            if self.canonical is not None:
                raise ValueError('Duplicate canonical')
            self.canonical = attrs.get('href')
        if tag == 'link' and attrs.get('rel') == 'alternate' and attrs.get('hreflang'):
            self.alternates[attrs['hreflang']] = attrs.get('href')
        if tag == 'meta':
            self.meta[attrs.get('name') or attrs.get('property')] = attrs.get('content', '')
            self.robots = self.meta.get('robots', '')
        if attrs.get('data-tour-panel'):
            self.tour_panels.add(attrs['data-tour-panel'])
        if tag == 'title':
            self._title = True
        if tag == 'h1':
            self._h1 = True
            self.h1.append('')
        if tag == 'script' and attrs.get('type') == 'application/ld+json':
            self._jsonld = ''

    def handle_endtag(self, tag):
        if tag == 'title':
            self._title = False
        if tag == 'h1':
            self._h1 = False
        if tag == 'script' and self._jsonld is not None:
            self.schemas.append(json.loads(self._jsonld))
            self._jsonld = None

    def handle_data(self, data):
        if self._title:
            self.title += data
        if self._h1:
            self.h1[-1] += data
        if self._jsonld is not None:
            self._jsonld += data


def canonical_for_file(relative, target='staging'):
    prefix = '/staging' if target == 'staging' else ''
    if relative == 'index.html':
        path = prefix + '/'
    else:
        path = prefix + '/' + relative.removesuffix('.html').removesuffix('/index')
    return 'https://qualitour.ca' + quote(unquote(path), safe='/')


def validate_document(document, relative, target='staging', tour=False):
    canonical = canonical_for_file(relative, target)
    if document.canonical != canonical:
        raise ValueError(f'Incorrect canonical for {relative}: {document.canonical}')
    if not document.title or not document.meta.get('description'):
        raise ValueError(f'Missing title/description: {relative}')
    if document.meta.get('og:url') != canonical or document.meta.get('twitter:url') != canonical:
        raise ValueError(f'Sharing URL differs from canonical: {relative}')
    if target == 'staging' and 'noindex' not in document.robots:
        raise ValueError(f'Indexable staging page: {relative}')
    if not document.schemas:
        raise ValueError(f'No structured data: {relative}')
    if tour:
        if not document.h1 or not document.h1[0].strip() or document.title == 'Tour | Qualitour':
            raise ValueError(f'Client-only or generic tour page: {relative}')
        if len(document.meta['description']) > 160:
            raise ValueError(f'Tour description too long: {relative}')
        if 'overview' not in document.tour_panels:
            raise ValueError(f'Missing server-rendered tour overview: {relative}')
        types = {value.get('@type') for value in document.schemas}
        if not {'TouristTrip', 'BreadcrumbList'}.issubset(types):
            raise ValueError(f'Missing tour schema: {relative}')
        for schema in document.schemas:
            if schema.get('@type') == 'TouristTrip' and (schema.get('url') != canonical or 'aggregateRating' in schema):
                raise ValueError(f'Invalid tour schema: {relative}')


def validate_alternates(documents):
    by_url = {document.canonical: document for document in documents}
    for document in documents:
        if not document.alternates:
            continue
        if document.canonical not in document.alternates.values():
            raise ValueError('Alternate group is not self-referencing: ' + document.canonical)
        for href in document.alternates.values():
            counterpart = by_url.get(href)
            if not counterpart or counterpart.alternates != document.alternates:
                raise ValueError('Missing or non-reciprocal alternate: ' + str(href))
