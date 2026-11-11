import importlib.util
import json
import tempfile
import unittest
from unittest.mock import patch
from pathlib import Path

spec = importlib.util.spec_from_file_location('release', Path(__file__).with_name('staging_release.py'))
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)


class ReleaseTests(unittest.TestCase):
    def test_equal_size_change_is_uploaded(self):
        self.assertEqual(release.changed_files({'a.html': 'abc'}, {'a.html': 'xyz'}), ['a.html'])

    def test_unchanged_files_are_skipped_assets_first(self):
        current = {'index.html': 'a', '_astro/new.js': 'b', '_astro/old.js': 'c'}
        self.assertEqual(release.changed_files(current, {'_astro/old.js': 'c'}), ['_astro/new.js', 'index.html'])

    def test_manifest_rejects_unsafe_paths(self):
        for path in ['../secret', '/index.html', 'dir/../../secret', 'bad\r\nDELE a']:
            with self.subTest(path=path), self.assertRaises(ValueError):
                release.validate_manifest({'schema': 1, 'files': {path: 'a' * 64}})

    def test_missing_new_tour_stops_release(self):
        with tempfile.TemporaryDirectory() as temp:
            tours = [{'id': 1, 'slug': 'new-tour'}]
            with self.assertRaisesRegex(ValueError, 'Missing detail'):
                release.validate_tour_paths(Path(temp), 'en', tours)

    def test_chinese_encoded_slug_resolves(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / 'zh/tours').mkdir(parents=True)
            (root / 'zh/tours/中文.html').write_text('tour')
            release.validate_tour_paths(root, 'zh', [{'id': 1, 'slug': '%e4%b8%ad%e6%96%87'}])

    def test_api_count_mismatch_stops_release(self):
        with self.assertRaisesRegex(ValueError, 'count'):
            release.validate_catalogue([{'id': 1}], [{'id': 1}, {'id': 2}])

    def test_empty_api_stops_release(self):
        with self.assertRaisesRegex(ValueError, 'empty'):
            release.validate_catalogue([], [])

    def test_truncated_api_is_not_accepted(self):
        responses = [(b'[{"id":1,"slug":"one"}]', {'X-WP-Total': '2'}),
                     (b'[]', {'X-WP-Total': '2'})]
        with patch.object(release, 'read_url', side_effect=responses):
            with self.assertRaisesRegex(ValueError, 'incomplete'):
                release.live_tours('en')

    def test_backup_failure_prevents_all_uploads(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / 'dist').mkdir()
            (root / 'dist/index.html').write_text('new')
            manifest = {'schema': 1, 'target': 'staging', 'commit': 'test', 'files': {'index.html': release.digest(b'new')}}
            (root / 'dist' / release.MANIFEST).write_text(json.dumps(manifest))
            old = json.dumps({'schema': 1, 'files': {'index.html': release.digest(b'old')}}).encode()
            with patch.object(release, 'connect') as connection, patch.object(release, 'retrieve', return_value=old), \
                 patch.object(release, 'batches', side_effect=OSError('backup failed')), patch.object(release, 'upload') as upload:
                with self.assertRaises(OSError):
                    release.deploy(root / 'dist', root / 'backup')
                upload.assert_not_called()

    def test_upload_integrity_failure_prevents_rename(self):
        from unittest.mock import Mock
        ftp = Mock()
        with patch.object(release, 'retrieve', return_value=b'corrupted'):
            with self.assertRaisesRegex(ValueError, 'hash'):
                release.upload(ftp, 'index.html', b'new')
        ftp.rename.assert_not_called()

    def test_removed_tour_is_backed_up_deleted_and_untracked_file_kept(self):
        self.simulate_release(fail=False)

    def test_mid_publication_failure_restores_previous_release(self):
        self.simulate_release(fail=True)

    def test_delete_permission_error_fails_and_restores_release(self):
        self.simulate_release(fail=False, deny_delete=True)

    def simulate_release(self, fail, deny_delete=False):
        from unittest.mock import Mock
        import ftplib
        old_manifest = json.dumps({'schema': 1, 'files': {
            'index.html': release.digest(b'old'), 'tours/withdrawn.html': release.digest(b'withdrawn')
        }}).encode()
        initial = {release.MANIFEST: old_manifest, 'index.html': b'old',
                   'tours/withdrawn.html': b'withdrawn', 'untracked.txt': b'keep'}
        remote = initial.copy()
        ftp = Mock()
        ftp.__enter__ = Mock(return_value=ftp)
        ftp.__exit__ = Mock(return_value=False)
        def retrieve(_, path, required=False):
            if required and path not in remote:
                raise ftplib.error_perm('550 Missing')
            return remote.get(path)
        def upload(_, path, data):
            remote[path] = data
            if fail and path == 'index.html' and data == b'new':
                raise ValueError('Simulated failure after rename')
        def delete(path):
            if deny_delete and path == 'tours/withdrawn.html':
                raise ftplib.error_perm('550 Permission denied')
            return remote.pop(path)
        ftp.delete.side_effect = delete
        def batches(paths, fn):
            for path in paths:
                fn(ftp, path)
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            dist = root / 'dist'
            (dist / '_astro').mkdir(parents=True)
            (dist / 'index.html').write_bytes(b'new')
            (dist / '_astro/new.js').write_bytes(b'js')
            manifest = {'schema': 1, 'target': 'staging', 'commit': 'test', 'files': {
                'index.html': release.digest(b'new'), '_astro/new.js': release.digest(b'js')}}
            (dist / release.MANIFEST).write_text(json.dumps(manifest))
            with patch.object(release, 'connect', return_value=ftp), patch.object(release, 'retrieve', side_effect=retrieve), \
                 patch.object(release, 'upload', side_effect=upload), patch.object(release, 'batches', side_effect=batches):
                if deny_delete:
                    with self.assertRaises(ftplib.error_perm):
                        release.deploy(dist, root / 'backup')
                    self.assertEqual(remote, initial)
                elif fail:
                    with self.assertRaisesRegex(ValueError, 'Simulated'):
                        release.deploy(dist, root / 'backup')
                    self.assertEqual(remote, initial)
                else:
                    release.deploy(dist, root / 'backup')
                    self.assertNotIn('tours/withdrawn.html', remote)
                    self.assertEqual(remote['untracked.txt'], b'keep')
                    self.assertEqual((root / 'backup/tours/withdrawn.html').read_bytes(), b'withdrawn')

    def test_url_style_ftp_host_parsed(self):
        with patch.dict(release.os.environ, {'FTP_HOST': 'ftp://example.com:2121', 'FTP_USERNAME': 'test', 'FTP_PASSWORD': 'test'}), \
             patch.object(release.ftplib, 'FTP') as ftp:
            release.connect()
            ftp.return_value.connect.assert_called_once_with('example.com', 2121)


if __name__ == '__main__':
    unittest.main()
