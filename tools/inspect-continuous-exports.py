from pathlib import Path
from zipfile import ZipFile
from xml.etree import ElementTree as ET
from pypdf import PdfReader
import subprocess

root = Path(__file__).resolve().parents[1] / 'qa' / 'continuous'
for name in ('initial', 'defense', 'blank-start'):
    with ZipFile(root / (name + '.docx')) as archive:
        for part in archive.namelist():
            if part.endswith(('.xml', '.rels')):
                ET.fromstring(archive.read(part))
    reader = PdfReader(root / (name + '.pdf'))
    text = '\n'.join(page.extract_text() for page in reader.pages)
    assert 'Texto da peça' not in text and 'NOTA_INTERNA' not in text
    if name == 'initial':
        assert text.count('Dos fatos') == 1 and 'Doc. 01' in text
    if name == 'blank-start':
        assert 'Uma redação livre sem títulos obrigatórios.' in text
        assert 'Dos fatos' not in text
    subprocess.run(['pdftoppm', '-scale-to', '950', '-png', str(root / (name + '.pdf')), str(root / name)], check=True)
    print(f'PASS: {name}: Word XML, continuous PDF, internal-note exclusion; {len(reader.pages)} pages rendered.')
