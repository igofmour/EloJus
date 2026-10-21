'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const G = require('./dist/guided-model.js'), M = require('./dist/workspace-model.js'), R = require('./dist/rich-document.js');
const now = Date.UTC(2026, 9, 18, 15);
const state = M.createSeed(now), old = M.clone(state);
state.cases[3].sections[2].delta = { ops: [{ insert: 'NOTA_INTERNA_SECRETA', attributes: { bold: true } }, { insert: '\n' }] };
G.upgrade(state, now);
assert.equal(state.cases.length, 8);
assert.equal(M.validState(state), true);
const upgraded = JSON.stringify(state); G.upgrade(state, now); assert.equal(JSON.stringify(state), upgraded, 'migration is idempotent');
assert.deepEqual(M.clone(state.cases[3].versions), old.cases[3].versions, 'historical versions preserved');
assert.equal(state.cases[3].sections[2].text, old.cases[3].sections[2].text, 'internal notes preserved');
assert.equal(state.cases[3].sections[2].delta.ops[0].insert, 'NOTA_INTERNA_SECRETA', 'rich internal notes retained');
assert.ok(!JSON.stringify(R.pdfDefinition(state.cases[3])).includes('NOTA_INTERNA_SECRETA'));
assert.deepEqual(G.document(state.cases[3]).sections.map(s => s.id), ['contexto', 'fatos']);
const guidedUiContext = { window: { EloGuided: G, EloModel: M } };
vm.runInNewContext(fs.readFileSync('dist/guided-ui.js', 'utf8'), guidedUiContext);
const GU = guidedUiContext.window.EloGuidedUI;
const source = state.cases[3], beforeCreation = JSON.stringify(source);
for (const actor of ['lucas', 'clara', 'unknown', undefined]) {
  assert.equal(GU.bar(source, 'document', actor), '', 'restricted profiles have no creation invitation');
  assert.equal(GU.choose(actor), '', 'restricted profiles cannot open the type selector');
  for (const type of Object.keys(G.types)) {
    assert.equal(M.createGuided(source, 'ELO-098', type, actor, now), null, 'direct creation is denied without the lawyer profile');
  }
}
assert.equal(JSON.stringify(source), beforeCreation, 'denied creation preserves the source');
assert.match(GU.bar(source, 'document', 'marina'), /data-action="newGuided"/);
assert.match(GU.choose('marina'), /data-type="initial"/);
assert.match(GU.choose('marina'), /data-type="defense"/);
for (const type of Object.keys(G.types)) {
  const assigned = M.createGuided(source, 'ELO-098', type, 'marina', now);
  assert.equal(assigned.guided.type, type);
  assert.equal(assigned.ownerId, 'lucas', 'lawyer creation retains the assigned intern');
  assert.equal(M.canEdit(assigned, 'lucas'), true, 'assigned intern can still elaborate an existing guided piece');
  assert.match(GU.bar(assigned, 'document', 'lucas'), /data-action="guidedStep"/);
}
assert.equal(JSON.stringify(source), beforeCreation, 'lawyer creation preserves the source');
for (const item of state.cases.slice(6)) {
  assert.ok(G.blockers(item).length > 0, 'examples are not falsely certified');
  const original = JSON.stringify(state.cases[3]);
  const created = G.create(state.cases[3], 'ELO-099', item.guided.type, now);
  assert.equal(JSON.stringify(state.cases[3]), original, 'creation preserves source');
  assert.ok(created.guided.notes.includes(state.cases[3].sections[2].text));
  assert.ok(G.templates(item.guided.type).some(s => s.id === 'pedidos'));
  item.guided.notes = 'NOTA_INTERNA_SECRETA'; item.instructions = 'ORIENTACAO_INTERNA_SECRETA';
  const document = G.document(item);
  assert.deepEqual(G.document(document).sections, document.sections, 'projection idempotent');
  assert.ok(document.sections.some(s => s.id === 'juizo'));
  assert.ok(!JSON.stringify(document.sections).includes('NOTA_INTERNA_SECRETA'));
  assert.ok(!JSON.stringify(R.pdfDefinition(item)).includes('ORIENTACAO_INTERNA_SECRETA'));
  assert.equal(M.transition(item, 'submit', item.ownerId, {}, now).ok, true);
  assert.equal(M.transition(item, 'approve', 'marina', {}, now).ok, false, 'incomplete checklist blocks approval');
  assert.equal(G.review(item, 'juizo', 'na', 'Not allowed', 'marina'), false);
  for (const key of Object.keys(item.guided.fields)) item.guided.fields[key] ||= 'Dado fictício conferido';
  item.sections.forEach(s => { if (!s.optional) s.text ||= 'Redação fictícia para teste do fluxo de revisão.'; });
  for (const r of G.requirements(item)) {
    const status = r.optional ? 'na' : r.id === 'partes' ? 'exception' : 'checked';
    G.review(item, r.id, status, '', 'marina', now);
    if (r.optional || r.id === 'partes') {
      assert.equal(G.requirements(item).find(c => c.id === r.id).done, false, 'justification is required');
      G.review(item, r.id, status, 'JUSTIFICATIVA_INTERNA_SECRETA', 'marina', now);
    }
  }
  assert.ok(G.requirements(item).every(r => r.done));
  assert.deepEqual(G.blockers(item), ['Conferência final da advogada']);
  item.guided.attestation = { userId: 'lucas', key: G.reviewKey(item) };
  assert.equal(M.transition(item, 'approve', 'marina').ok, false, 'author cannot attest as reviewer');
  item.guided.attestation = { userId: 'marina', key: G.reviewKey(item) };
  const verified = M.clone(item);
  item.guided.notes += ' Nova nota.';
  assert.deepEqual(G.blockers(item), [], 'internal notes do not invalidate final document');
  item.guided.fields.juizo += ' alterado';
  assert.ok(G.requirements(item).every(r => !r.done), 'changing case data invalidates review');
  assert.equal(M.transition(item, 'approve', 'marina').ok, false);
  Object.assign(item, M.clone(verified)); item.sections[0].text += ' Alteração.';
  assert.ok(G.requirements(item).every(r => !r.done), 'changing body invalidates review');
  Object.assign(item, M.clone(verified)); item.guided.annexes += '\nNovo anexo.';
  assert.ok(G.requirements(item).every(r => !r.done), 'changing annexes invalidates review');
  Object.assign(item, M.clone(verified));
  assert.equal(M.transition(item, 'approve', 'lucas').ok, false);
  assert.equal(M.transition(item, 'approve', 'marina', {}, now).ok, true);
  assert.ok(item.versions.at(-1).sections.some(s => s.id === 'juizo'));
  assert.equal(item.versions.at(-1).guided.fields.juizo, item.guided.fields.juizo);
  assert.ok(!JSON.stringify(item.versions.at(-1).sections).includes('JUSTIFICATIVA_INTERNA_SECRETA'));
}
assert.ok(G.templates('defense').some(s => s.id === 'impugnacao'));
assert.ok(!G.templates('initial').some(s => s.id === 'impugnacao'));
console.log('PASS: guided models, migration, data preservation, document boundaries, snapshots, exceptions, review invalidation and approval gates.');
(async () => {
  const context = { window: { EloGuided: G }, EloRich: R, Blob };
  vm.runInNewContext(fs.readFileSync('dist/document-export.js', 'utf8'), context);

  const D = require('docx'), zip = require('jszip');
  const pdf = require('./dist/vendor/pdfmake.min.js'); pdf.addVirtualFileSystem(require('./dist/vendor/vfs_fonts.js'));
  const out = path.join(__dirname, 'qa/guided'); fs.mkdirSync(out, { recursive: true });
  for (const item of state.cases.slice(6)) {
    const text = await (await context.window.EloExport.create(item, 'txt', 'A4')).text();
    for (const secret of ['NOTA_INTERNA_SECRETA', 'JUSTIFICATIVA_INTERNA_SECRETA', 'ORIENTACAO_INTERNA_SECRETA']) assert.ok(!text.includes(secret));
    const buffer = await D.Packer.toBuffer(R.docxDocument(item, D, 'A4'));
    const archive = await zip.loadAsync(buffer), xml = await archive.file('word/document.xml').async('string');
    assert.ok(xml.includes(item.guided.fields.juizo));
    for (const secret of ['NOTA_INTERNA_SECRETA', 'JUSTIFICATIVA_INTERNA_SECRETA', 'ORIENTACAO_INTERNA_SECRETA']) assert.ok(!xml.includes(secret));
    assert.equal((xml.match(/Endereçamento/g) || []).length, 1);
    const pdfBuffer = await new Promise(resolve => pdf.createPdf(R.pdfDefinition(item, 'A4')).getBuffer(resolve));
    assert.equal(pdfBuffer.slice(0, 4).toString(), '%PDF');
    fs.writeFileSync(path.join(out, item.guided.type + '.docx'), buffer);
    fs.writeFileSync(path.join(out, item.guided.type + '.pdf'), pdfBuffer);
    console.log('PASS: TXT/DOCX/PDF generated without internal content:', item.guided.type);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
