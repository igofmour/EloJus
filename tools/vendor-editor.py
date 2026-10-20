"""Pin browser dependencies locally, checking npm tarball integrity before copying."""
import base64, hashlib, io, json, pathlib, tarfile, urllib.request

root = pathlib.Path(__file__).resolve().parents[1]
dest = root / 'dist' / 'vendor'
dest.mkdir(exist_ok=True)
manifest_path = dest / 'manifest.json'
manifest = [entry for entry in json.loads(manifest_path.read_text(encoding='utf-8')) if entry['package'] not in ('quill', 'pdfmake', 'docx')] if manifest_path.exists() else []
for package, version, files in [
    ('quill', '2.0.3', {'dist/quill.js': 'quill.js', 'dist/quill.core.css': 'quill.core.css', 'LICENSE': 'quill-LICENSE.txt'}),
    ('pdfmake', '0.2.20', {'build/pdfmake.min.js': 'pdfmake.min.js', 'build/vfs_fonts.js': 'vfs_fonts.js', 'LICENSE': 'pdfmake-LICENSE.txt'}),
]:
    metadata = json.load(urllib.request.urlopen(f'https://registry.npmjs.org/{package}/{version}'))
    raw = urllib.request.urlopen(metadata['dist']['tarball']).read()
    integrity = 'sha512-' + base64.b64encode(hashlib.sha512(raw).digest()).decode()
    if integrity != metadata['dist']['integrity']:
        raise ValueError('Integrity check failed: ' + package)
    with tarfile.open(fileobj=io.BytesIO(raw), mode='r:gz') as archive:
        for source, target in files.items():
            (dest / target).write_bytes(archive.extractfile('package/' + source).read())
    manifest.append({'package': package, 'version': version, 'integrity': integrity, 'source': metadata['dist']['tarball']})
runtime = root / 'node_modules' / 'docx'
if json.loads((runtime / 'package.json').read_text())['version'] != '9.6.1':
    raise ValueError('Install the locked docx 9.6.1 package before regenerating vendor files')
(dest / 'docx.umd.js').write_bytes((runtime / 'dist/index.umd.cjs').read_bytes())
(dest / 'docx-LICENSE.txt').write_bytes((runtime / 'LICENSE').read_bytes())
manifest.append({'package': 'docx', 'version': '9.6.1', 'source': 'https://registry.npmjs.org/docx/-/docx-9.6.1.tgz', 'sha256': hashlib.sha256((dest / 'docx.umd.js').read_bytes()).hexdigest()})
(dest / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
(dest / 'Roboto-LICENSE.txt').write_bytes(urllib.request.urlopen('https://raw.githubusercontent.com/googlefonts/roboto-2/main/LICENSE').read())
print('Vendored:', ', '.join(x['package'] + '@' + x['version'] for x in manifest))
