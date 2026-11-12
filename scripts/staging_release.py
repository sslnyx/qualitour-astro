"""Verify and publish the public cPanel staging build using existing FTP secrets."""
import argparse
import concurrent.futures
import ftplib
import hashlib
import io
import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from seo_check import SeoDocument, validate_document, validate_alternates
from pathlib import Path, PurePosixPath
from datetime import date, datetime
from datetime import timezone

SITE = 'https://qualitour.ca/staging'
MANIFEST = 'qualitour-release.json'


def digest(data):
    return hashlib.sha256(data).hexdigest()


def safe_path(path):
    parts = PurePosixPath(path).parts
    if not path or path.startswith('/') or '..' in parts or '\\' in path or any(ord(c) < 32 for c in path):
        raise ValueError('Unsafe release path')
    return path


def validate_manifest(value):
    if value.get('schema') != 1 or not isinstance(value.get('files'), dict):
        raise ValueError('Invalid release manifest')
    for path, sha in value['files'].items():
        safe_path(path)
        if not re.fullmatch('[0-9a-f]{64}', sha):
            raise ValueError('Invalid release hash')
    return value['files']


def changed_files(current, previous):
    return sorted((p for p, sha in current.items() if previous.get(p) != sha),
                  key=lambda p: (not p.startswith('_astro/'), p == '.htaccess', p))


def decode(value):
    if isinstance(value, list) and len(value) == 2 and isinstance(value[0], int):
        return [decode(x) for x in value[1]] if value[0] == 1 else decode(value[1])
    if isinstance(value, dict):
        return {k: decode(v) for k, v in value.items()}
    return value


class Islands(HTMLParser):
    def __init__(self):
        super().__init__()
        self.props = {}

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'astro-island' and attrs.get('props'):
            self.props[attrs.get('component-url', '')] = decode(json.loads(attrs['props']))


def island_props(html, component):
    parser = Islands()
    parser.feed(html)
    matches = [v for k, v in parser.props.items() if component + '.' in k]
    if len(matches) != 1:
        raise ValueError(f'Expected one {component} island, found {len(matches)}')
    return matches[0]


def read_url(url):
    request = urllib.request.Request(url, headers={'User-Agent': 'Qualitour-Staging-Verification/1.0', 'Cache-Control': 'no-cache'})
    with urllib.request.urlopen(request, timeout=45) as response:
        return response.read(), response.headers


def live_tours(lang):
    base = 'https://qualitour.ca/' + ('zh/' if lang == 'zh' else '') + 'wp-json/qualitour/v1/tours'
    records = []
    page = 1
    total = None
    while total is None or len(records) < total:
        raw, headers = read_url(f'{base}?per_page=100&page={page}&_fields=id,slug')
        batch = json.loads(raw)
        reported = int(headers['X-WP-Total'])
        if total is not None and reported != total:
            raise ValueError('API changed while reading; rerun build')
        total = reported
        if not isinstance(batch, list) or not batch:
            raise ValueError('Tour API is empty or incomplete')
        records.extend(batch)
        page += 1
    return records


def validate_catalogue(built, live):
    if not built or not live:
        raise ValueError('Tour catalogue is empty')
    if len(built) != len(live) or {(x['id'], x['slug']) for x in built} != {(x['id'], x['slug']) for x in live}:
        raise ValueError(f'Tour catalogue count/IDs/slugs mismatch: built={len(built)}, live={len(live)}')


def source_tours(lang, snapshot_path=Path('.astro/cms-content/public-catalogue.json')):
    source = os.environ.get('TOUR_CONTENT_SOURCE', 'emdash')
    if source == 'wordpress':
        return live_tours(lang)
    if source != 'emdash':
        raise ValueError('Unknown tour content source')
    snapshot = json.loads(snapshot_path.read_text())
    if snapshot.get('schema') != 2 or snapshot.get('origin') != 'https://qualitour-cms-free-test.qualitour.workers.dev':
        raise ValueError('Invalid CMS build snapshot')
    generated = datetime.fromisoformat(snapshot['generatedAt'].replace('Z', '+00:00'))
    age = (datetime.now(timezone.utc) - generated).total_seconds()
    if age < -60 or age > 3600:
        raise ValueError('Stale CMS build snapshot; rebuild before verification')
    tours = snapshot['locales'][lang]['tours']
    if not tours or any(tour.get('status') != 'publish' for tour in tours):
        raise ValueError('CMS snapshot contains empty or non-public catalogue')
    return [{'id': tour['id'], 'slug': tour['slug']} for tour in tours]


def validate_tour_paths(root, lang, tours):
    prefix = Path('zh') if lang == 'zh' else Path()
    for tour in tours:
        slug = safe_path(urllib.parse.unquote(tour['slug']))
        if '/' in slug:
            raise ValueError('Unexpected slash in tour slug')
        if not (root / prefix / 'tours' / (slug + '.html')).is_file():
            raise ValueError(f'Missing detail page: {lang}, tour {tour["id"]}')


def validate_shared_transfers(snapshot, detail_routes, home_routes):
    definitions = json.loads(Path(__file__).with_name('zaui-route-map.json').read_text())
    routes = snapshot.get('routes', [])
    expected_ids = {v['activityId'] for r in definitions for key in ['vehicles', 'reverseActivityIds'] for v in r[key]}
    if snapshot.get('schemaVersion') != 1 or snapshot.get('source') != 'zaui' or len(routes) != len(definitions):
        raise ValueError('Invalid transfer snapshot schema/routes')
    if snapshot.get('activityCount') != len(expected_ids) or not re.fullmatch('[A-Z]{3}', snapshot.get('currency', '')):
        raise ValueError('Invalid transfer snapshot count/currency')
    try:
        date.fromisoformat(snapshot['priceDate'])
        datetime.fromisoformat(snapshot['fetchedAt'].replace('Z', '+00:00'))
    except (ValueError, KeyError, TypeError):
        raise ValueError('Invalid transfer snapshot dates')
    for route, definition in zip(routes, definitions):
        if any(route.get(key) != definition[key] for key in ['id', 'name', 'fromLocation', 'toLocation']):
            raise ValueError('Transfer snapshot route mapping changed')
        for key in ['vehicles', 'reverseActivityIds']:
            vehicles = route.get(key, [])
            if [{k: v.get(k) for k in ['seater', 'activityId']} for v in vehicles] != definition[key]:
                raise ValueError('Transfer snapshot activity mapping changed')
            if any(v.get('currency') != snapshot['currency'] or v.get('priceDate') != snapshot['priceDate'] for v in vehicles):
                raise ValueError('Transfer snapshot price metadata inconsistent')
    if detail_routes != routes or home_routes != routes[:3]:
        raise ValueError('Shared transfer pages differ from published JSON snapshot')


def verify(root):
    inventory = json.loads((root / 'seo-inventory.json').read_text())
    if inventory['target'] != 'staging':
        raise ValueError('Only staging output may be published by this workflow')
    summary = {}
    transfer_snapshot = json.loads((root / 'data/private-transfers.json').read_text())
    for lang in ['en', 'zh']:
        relative = ('zh/' if lang == 'zh' else '') + 'tours.html'
        tours = island_props((root / relative).read_text(), 'ToursGrid')['tours']
        validate_catalogue(tours, source_tours(lang))
        validate_tour_paths(root, lang, tours)
        for tour in tours:
            relative_tour = ('zh/' if lang == 'zh' else '') + 'tours/' + urllib.parse.unquote(tour['slug']) + '.html'
            content = (root / relative_tour).read_text()
            if len(content.encode()) > 2 * 1024 * 1024:
                raise ValueError('Tour HTML exceeds 2MiB budget: ' + relative_tour)
            document = SeoDocument()
            document.feed(content)
            validate_document(document, relative_tour, tour=True)
        summary[lang] = {'count': len(tours), 'sample_slugs': [t['slug'] for t in tours[:2]]}
        transfer = ('zh/' if lang == 'zh' else '') + 'private-transfers.html'
        routes = island_props((root / transfer).read_text(), 'TransferRoutesGrid')['routes']
        home = 'zh.html' if lang == 'zh' else 'index.html'
        home_routes = island_props((root / home).read_text(), 'TransferRoutesGrid')['routes']
        validate_shared_transfers(transfer_snapshot, routes, home_routes)
    files = {p.relative_to(root).as_posix(): digest(p.read_bytes()) for p in root.rglob('*')
             if p.is_file() and p.name != MANIFEST and p.name != '.DS_Store'}
    for html in root.rglob('*.html'):
        for path in re.findall(r'(?:src|href|component-url|renderer-url)="(/staging/_astro/[^"?#]+)', html.read_text()):
            if urllib.parse.unquote(path.removeprefix('/staging/')) not in files:
                raise ValueError(f'Missing asset in {html.name}: {path}')
    for bundle in (root / '_astro').glob('*.js'):
        if any(private_key in bundle.read_text() for private_key in ['WORDPRESS_AUTH_PASS', 'ZAUI_API_TOKEN', 'GH_DEPLOY_WORKFLOW_TOKEN', 'EMDASH_TOKEN', 'refreshToken', 'ec_pat_', 'ec_oat_']):
            raise ValueError('Server-only environment key found in browser bundle: ' + bundle.name)
    manifest = {'schema': 1, 'commit': os.environ.get('GITHUB_SHA', 'local'), 'files': files, 'tours': summary, 'target': 'staging', 'content_source': os.environ.get('TOUR_CONTENT_SOURCE', 'emdash'),
                'transfers': {key: transfer_snapshot[key] for key in ['fetchedAt', 'priceDate', 'currency', 'activityCount']}}
    (root / MANIFEST).write_text(json.dumps(manifest, ensure_ascii=False, sort_keys=True))
    print(json.dumps({'verified': True, 'tours': summary, 'files': len(files), 'bytes': sum(p.stat().st_size for p in root.rglob('*') if p.is_file())}))


def connect():
    target = os.environ['FTP_HOST']
    parsed = urllib.parse.urlsplit(target if '://' in target else 'ftp://' + target)
    if parsed.scheme != 'ftp' or not parsed.hostname or parsed.username or parsed.password or parsed.path not in ['', '/']:
        raise ValueError('FTP_HOST must be an FTP hostname or ftp://host[:port] URL')
    ftp = ftplib.FTP(timeout=40)
    ftp.connect(parsed.hostname, parsed.port or 21)
    ftp.login(os.environ['FTP_USERNAME'], os.environ['FTP_PASSWORD'])
    ftp.cwd('public_html/staging')
    return ftp


def retrieve(ftp, path, required=False):
    data = io.BytesIO()
    try:
        ftp.retrbinary('RETR ' + path, data.write)
    except ftplib.error_perm as error:
        if str(error).startswith('550') and not required:
            return None
        raise
    return data.getvalue()


def upload(ftp, path, data):
    parent = PurePosixPath(path).parent
    if str(parent) != '.':
        current = ''
        for part in parent.parts:
            current += part + '/'
            try:
                ftp.mkd(current)
            except ftplib.error_perm as error:
                if not str(error).startswith('550'):
                    raise
    temporary = path + '.qualitour-upload'
    ftp.storbinary('STOR ' + temporary, io.BytesIO(data))
    if digest(retrieve(ftp, temporary, required=True)) != digest(data):
        raise ValueError('Upload hash verification failed: ' + path)
    ftp.rename(temporary, path)


def batches(items, fn):
    groups = [items[i::4] for i in range(4)]
    def worker(group):
        if not group:
            return
        ftp = None
        try:
            for path in group:
                for attempt in range(3):
                    try:
                        if ftp is None:
                            ftp = connect()
                        fn(ftp, path)
                        break
                    except (OSError, EOFError, ftplib.error_temp):
                        if ftp is not None:
                            ftp.close()
                        ftp = None
                        if attempt == 2:
                            raise
                        time.sleep(attempt + 1)
        finally:
            if ftp is not None:
                ftp.close()
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(worker, groups))


def deploy(root, backup):
    started = time.monotonic()
    manifest = json.loads((root / MANIFEST).read_text())
    current = validate_manifest(manifest)
    if manifest.get('target') != 'staging':
        raise ValueError('Refusing to publish a non-staging build')
    # Ensure verification manifest still describes the exact files being uploaded.
    for path, sha in current.items():
        if digest((root / path).read_bytes()) != sha:
            raise ValueError('Build changed after verification: ' + path)
    with connect() as ftp:
        old_bytes = retrieve(ftp, MANIFEST)
    previous = validate_manifest(json.loads(old_bytes)) if old_bytes else {}
    changed = changed_files(current, previous)
    # Retain immutable assets for open/cached older pages. Withdraw removed HTML.
    removed = sorted(p for p in previous.keys() - current.keys() if p.endswith('.html'))
    backup.mkdir(parents=True, exist_ok=False)
    if old_bytes:
        (backup / MANIFEST).write_bytes(old_bytes)
    report = {'commit': manifest['commit'], 'changed': changed, 'removed': removed, 'existing': {}, 'new': []}
    def save(ftp, path):
        original = retrieve(ftp, path, required=path in previous)
        if original is None:
            report['new'].append(path)
        else:
            destination = backup / path
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(original)
            report['existing'][path] = digest(original)
    # Finish all backups before changing any visitor-facing file.
    batches(changed + removed, save)
    (backup / 'restore-map.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
    attempted = set()
    def publish(ftp, path):
        attempted.add(path)
        upload(ftp, path, (root / path).read_bytes())
    def remove(ftp, path):
        attempted.add(path)
        # 550 also means permission denied. Never mark withdrawal successful
        # unless the server actually accepted deletion.
        ftp.delete(path)
    try:
        for paths in [[p for p in changed if p.startswith('_astro/')], [p for p in changed if not p.startswith('_astro/') and p != '.htaccess'], [p for p in changed if p == '.htaccess']]:
            batches(paths, publish)
        batches(removed, remove)
        with connect() as ftp:
            attempted.add(MANIFEST)
            upload(ftp, MANIFEST, (root / MANIFEST).read_bytes())
    except Exception:
        # All workers finish before batches raises. Restore affected old files,
        # then remove new files, and restore the previous completion marker.
        def restore(ftp, path):
            data = (backup / path).read_bytes()
            upload(ftp, path, data)
        try:
            batches(sorted(attempted & report['existing'].keys()), restore)
            batches(sorted(attempted & set(report['new'])), remove)
            if MANIFEST in attempted:
                with connect() as ftp:
                    if old_bytes:
                        upload(ftp, MANIFEST, old_bytes)
                    else:
                        remove(ftp, MANIFEST)
            print('Publication failed; affected visitor files restored from this run backup')
        except Exception as rollback_error:
            print('Automatic recovery incomplete; use staging-backup/restore-map.json:', type(rollback_error).__name__)
        raise
    print(json.dumps({'uploaded': len(changed), 'removed_html': len(removed), 'skipped': len(current) - len(changed), 'backed_up': len(report['existing']), 'seconds': round(time.monotonic() - started, 2)}))


def smoke(root):
    manifest = json.loads((root / MANIFEST).read_text())
    remote, _ = read_url(SITE + '/' + MANIFEST)
    if json.loads(remote) != manifest:
        raise ValueError('Public release manifest does not match this run')
    paths = ['index.html', 'zh.html', 'tours.html', 'zh/tours.html', 'private-transfers.html', 'zh/private-transfers.html', 'data/private-transfers.json']
    for lang, details in manifest['tours'].items():
        prefix = 'zh/' if lang == 'zh' else ''
        paths += [prefix + 'tours/' + urllib.parse.unquote(s) + '.html' for s in details['sample_slugs']]
    for path in paths:
        url_path = '' if path == 'index.html' else path.removesuffix('.html')
        raw, headers = read_url(SITE + '/' + urllib.parse.quote(url_path))
        if digest(raw) != manifest['files'][path]:
            raise ValueError('Public content hash mismatch: ' + path)
        if 'noindex' not in headers.get('X-Robots-Tag', ''):
            raise ValueError('Staging indexing header is missing: ' + path)
        if 'no-cache' not in headers.get('Cache-Control', ''):
            raise ValueError('Page must revalidate on navigation: ' + path)
        if path.endswith('.json') and 'application/json' not in headers.get('Content-Type', ''):
            raise ValueError('Transfer snapshot has an incorrect content type')
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, request, fp, code, message, headers, newurl):
            return None
    opener = urllib.request.build_opener(NoRedirect)
    for source, destination in [('index.html', ''), ('tours.html', 'tours'), ('zh.html', 'zh')]:
        request_url = SITE + '/' + source + '?release-check=1'
        try:
            opener.open(request_url, timeout=30)
            raise ValueError('Explicit .html URL did not redirect: ' + source)
        except urllib.error.HTTPError as error:
            target = urllib.parse.urljoin(request_url, error.headers.get('Location', ''))
            if error.code != 301 or target != SITE + '/' + destination + '?release-check=1':
                raise ValueError('Incorrect canonical redirect: ' + source) from error
    asset = next(path for path in manifest['files'] if path.startswith('_astro/') and path.endswith('.js'))
    _, headers = read_url(SITE + '/' + asset)
    if 'immutable' not in headers.get('Cache-Control', ''):
        raise ValueError('Hashed assets must be cached immutably')
    print(f'Public smoke verification passed: {len(paths)} exact page hashes, noindex/cache headers, 3 canonical redirects, immutable assets')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('command', choices=['verify', 'deploy', 'smoke'])
    parser.add_argument('--dist', type=Path, default=Path('dist'))
    parser.add_argument('--backup', type=Path, default=Path('staging-backup'))
    args = parser.parse_args()
    if args.command == 'verify':
        verify(args.dist)
    elif args.command == 'deploy':
        deploy(args.dist, args.backup)
    else:
        smoke(args.dist)
