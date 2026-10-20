from pathlib import Path
from zipfile import ZipFile
from xml.etree import ElementTree as ET
from pypdf import PdfReader
import subprocess

root = Path(__file__).resolve().parents[1] / 'qa' / 'guided'
for name in ('initial', 'defense'):
    with ZipFile(root / (name + '.docx')) as archive:
        for part in archive.namelist():
            if part.endswith(('.xml', '.rels')):
                ET.fromstring(archive.read(part))
    reader = PdfReader(root / (name + '.pdf'))
    text = '\n'.join(page.extract_text() for page in reader.pages)
    for secret in ('NOTA_INTERNA_SECRETA', 'JUSTIFICATIVA_INTERNA_SECRETA', 'ORIENTACAO_INTERNA_SECRETA'):
        assert secret not in text
    assert 'Endereçamento' in text and 'Encerramento' in text
    assert ('Do valor da causa' in text) == (name == 'initial')
    assert ('Da impugnação aos fatos' in text) == (name == 'defense')
    subprocess.run(['pdftoppm', '-scale-to', '950', '-png', str(root / (name + '.pdf')), str(root / name)], check=True)
    print(f'PASS: {name}: Word XML, PDF text boundaries, {len(reader.pages)} A4 pages rendered.')
