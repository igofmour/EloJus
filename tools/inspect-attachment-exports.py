from pathlib import Path
from zipfile import ZipFile
from xml.etree import ElementTree as ET
from pypdf import PdfReader
import subprocess

root = Path(__file__).resolve().parents[1] / 'qa' / 'attachments'
for name in ('initial', 'defense'):
    stem = name + '-vinculada'
    with ZipFile(root / (stem + '.docx')) as archive:
        for part in archive.namelist():
            if part.endswith(('.xml', '.rels')):
                ET.fromstring(archive.read(part))
    reader = PdfReader(root / (stem + '.pdf'))
    text = '\n'.join(page.extract_text() for page in reader.pages)
    assert 'Doc. 01' in text and 'Documentos relacionados:' in text
    assert 'NOTA_PRIVADA_DA_PROVA' not in text and 'Extra.txt' not in text
    assert 'Caução <modelo>.txt' in text
    subprocess.run(['pdftoppm', '-scale-to', '950', '-png', str(root / (stem + '.pdf')), str(root / stem)], check=True)
    print(f'PASS: {name}: Word XML, PDF references, internal-note exclusion; {len(reader.pages)} pages rendered.')
