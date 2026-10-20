from pathlib import Path
from zipfile import ZipFile
from xml.etree import ElementTree as ET
from pypdf import PdfReader
import subprocess

root = Path(__file__).resolve().parents[1] / 'qa' / 'full-document'
for name in ('initial', 'defense', 'edited'):
    with ZipFile(root / (name + '.docx')) as archive:
        for part in archive.namelist():
            if part.endswith(('.xml', '.rels')):
                ET.fromstring(archive.read(part))
        doc = ET.fromstring(archive.read('word/document.xml'))
        word = '\n'.join(node.text or '' for node in doc.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t'))
    reader = PdfReader(root / (name + '.pdf'))
    pdf = '\n'.join(page.extract_text() for page in reader.pages)
    for text in (word, pdf):
        assert 'Texto da peça' not in text and 'NOTA_INTERNA' not in text
        if name == 'edited':
            assert text.count('Ao Juízo da Comarca Nova') == 1
            assert text.count('Autora: Pessoa Nova') == 1
            assert text.count('Advogada Nova') == 1
            assert 'Bruno Exemplo' not in text and 'Marina Exemplo' not in text
            assert 'CAMPO_ARQUIVADO' not in text and 'ANEXO_ARQUIVADO' not in text
        else:
            assert text.count('Ao Juízo da Vara Cível') == 1
            assert text.count('Comarca Exemplo, 18 de outubro de 2026.') == 1
        if name == 'initial':
            assert text.count('Ação de restituição de caução') == 1
        if name == 'defense':
            assert 'Processo demonstrativo' in text
    subprocess.run(['pdftoppm', '-scale-to', '950', '-png', str(root / (name + '.pdf')), str(root / name)], check=True)
    print(f'PASS: {name}: complete DOCX and PDF, no stale or duplicate fields, {len(reader.pages)} pages rendered.')
