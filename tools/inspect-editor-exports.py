from pathlib import Path
from zipfile import ZipFile
import xml.etree.ElementTree as ET
from pypdf import PdfReader

root = Path(__file__).resolve().parents[1]
ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
paths = [root/'qa/editor/formatacao.docx', root/'qa/editor/multipagina.docx']
for path in paths:
    with ZipFile(path) as archive:
        for name in archive.namelist():
            if name.endswith('.xml') or name.endswith('.rels'):
                ET.fromstring(archive.read(name))
        body = ET.fromstring(archive.read('word/document.xml'))
        text = ''.join(t.text or '' for t in body.findall('.//w:t', ns))
        assert 'Bruno Exemplo' in text and 'confer' in text
        assert body.findall('.//w:b', ns) and body.findall('.//w:numPr', ns)
        assert body.find('.//w:pgSz', ns).get('{'+ns['w']+'}w') == '11906'
    print('DOCX XML and native formatting valid:', path.name)
for path in [root/'qa/editor/formatacao.pdf', root/'qa/editor/multipagina.pdf']:
    reader = PdfReader(path)
    text = '\n'.join(page.extract_text() for page in reader.pages)
    assert 'Bruno Exemplo' in text and 'vistoria' in text and 'revisão' in text
    if path.stem == 'multipagina':
        assert 'Registro 42.' in text and len(reader.pages) > 1
    print('PDF searchable text and pages valid:', path.name, len(reader.pages))
