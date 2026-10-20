'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const R = require('./dist/rich-document.js');
const M = require('./dist/workspace-model.js');

const legacy = { text: 'Ação e revisão\n\nTexto <seguro> & completo.' };
assert.equal(R.text(legacy), legacy.text);
assert.equal(R.text({ text: 'última linha\n' }), 'última linha\n');
assert.ok(R.equal(legacy, { delta: R.delta(legacy) }));
const unsafe = { delta: { ops: [{ insert: '<img src=x onerror=alert(1)>', attributes: { color: 'red', link: 'javascript:alert(1)', size: '99px', bold: true } }, { insert: { image: 'https://example.com' } }, { insert: '\n', attributes: { align: 'right', indent: 100, list: 'bullet' } }] } };
assert.ok(!R.html(unsafe).includes('<img'));
assert.ok(!R.html(unsafe).includes('javascript:'));
assert.ok(R.html(unsafe).includes('<strong>'));
assert.equal(R.lines(unsafe)[0].indent, 8);

const sample = M.createSeed().cases[3];
sample.sections[0].delta = { ops: [{ insert: 'Relato em análise', attributes: { bold: true } }, { insert: '\n', attributes: { header: 1 } }, { insert: 'Bruno Exemplo', attributes: { bold: true, italic: true } }, { insert: '. Atendimento fictício com ' }, { insert: 'informações pendentes', attributes: { underline: true } }, { insert: ' e ' }, { insert: 'rascunho anterior', attributes: { strike: true } }, { insert: '. Ação, revisão, imóvel e R$ 480,00.' }, { insert: '\n', attributes: { align: 'justify' } }] };
sample.sections[1].delta = { ops: [{ insert: 'Conferir a vistoria de entrada.' }, { insert: '\n', attributes: { list: 'ordered' } }, { insert: 'Conferir a vistoria de saída.' }, { insert: '\n', attributes: { list: 'ordered' } }, { insert: 'Confirmar a data e as assinaturas.' }, { insert: '\n', attributes: { list: 'ordered', indent: 1 } }, { insert: 'Organizar as mensagens.' }, { insert: '\n', attributes: { list: 'bullet' } }, { insert: 'Sem confirmação documental.', attributes: { italic: true } }, { insert: '\n', attributes: { blockquote: true } }] };
sample.sections[2].delta = { ops: [{ insert: 'Documentos para conferência', attributes: { size: '14pt' } }, { insert: '\n', attributes: { align: 'center' } }, { insert: 'A vistoria de saída e a sequência completa das mensagens ainda precisam ser conferidas.' }, { insert: '\n', attributes: { indent: 1 } }] };
sample.sections.forEach(s => s.text = R.text(s));
assert.deepEqual(R.withMarkers(sample.sections[1]).slice(0, 4).map(l => l.marker), ['1.', '2.', 'a.', '•']);
const before = M.clone(sample.sections);
M.transition(sample, 'saveVersion', 'marina');
sample.sections[0].delta.ops[0].attributes.bold = false;
assert.equal(sample.versions.at(-1).sections[0].delta.ops[0].attributes.bold, true);
assert.ok(!R.equal(sample.sections[0], before[0]));
sample.sections = before;
assert.ok(M.validState({ schema: 2, cases: [sample] }));
assert.ok(R.pdfDefinition(sample, 'A4').content.some(n => n.columns));
assert.equal(R.pdfDefinition(sample, 'LETTER').pageSize, 'LETTER');
console.log('PASS: legacy text, safe format whitelist, accented text, lists/restarts, rich snapshots, format-only comparison and both paper sizes.');

if (process.argv.includes('--exports')) (async () => {

  const D = require('docx');
  const zip = require('jszip');
  const pdf = require('./dist/vendor/pdfmake.min.js');
  pdf.addVirtualFileSystem(require('./dist/vendor/vfs_fonts.js'));
  const out = path.join(__dirname, 'qa/editor'); fs.mkdirSync(out, { recursive: true });
  for (const [name, item] of [['formatacao', sample], ['multipagina', { ...sample, sections: [...sample.sections, { id: 'longo', title: 'Registros adicionais do atendimento fictício', delta: { ops: Array.from({ length: 42 }, (_, i) => [{ insert: `Registro ${i + 1}. A equipe confere a documentação fictícia, organiza a sequência dos acontecimentos e registra as informações ainda pendentes. Nenhuma conclusão jurídica foi validada. Ação e revisão dependem da conferência profissional.` }, { insert: '\n', attributes: i % 5 === 0 ? { list: 'ordered' } : {} }]).flat() } }] }]]) {
    const buffer = await D.Packer.toBuffer(R.docxDocument(item, D, 'A4'));
    fs.writeFileSync(path.join(out, name + '.docx'), buffer);
    const archive = await zip.loadAsync(buffer), xml = await archive.file('word/document.xml').async('string');
    for (const token of ['<w:b', '<w:i', '<w:u', '<w:strike', '<w:numPr', 'ação', '480,00', 'A4'.replace('A4', '11906')]) assert.ok(xml.includes(token), 'Missing DOCX token: ' + token);
    assert.ok(!xml.includes('altChunk')); assert.ok(!xml.includes('<w:color w:val="FF'));
    const pdfBuffer = await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('PDF generation timed out')), 30000); pdf.createPdf(R.pdfDefinition(item, 'A4')).getBuffer(data => { clearTimeout(timer); resolve(data); }); });
    fs.writeFileSync(path.join(out, name + '.pdf'), pdfBuffer);
    console.log('Generated DOCX and PDF:', name, buffer.length, pdfBuffer.length);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
