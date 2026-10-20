(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.EloAttachments = factory();
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const MAX_FILE = 20 * 1024 * 1024, MAX_CASE = 100 * 1024 * 1024;
  const formats = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', txt: 'text/plain', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
  const eligible = section => ['corpo', 'fatos', 'sintese', 'impugnacao', 'provas'].includes(section.id) && section.scope !== 'internal';
  const files = item => item.attachments || [];
  const active = item => files(item).filter(f => !f.archived);
  const links = item => item.documentLinks || [];
  const label = file => `Doc. ${String(file.number).padStart(2, '0')}`;
  const clone = value => JSON.parse(JSON.stringify(value));
  function validate(file, bytes) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!formats[ext]) throw new Error('Formato não aceito. Use PDF, PNG, JPG, WebP, TXT ou DOCX.');
    if (!file.size) throw new Error('O arquivo está vazio.');
    if (file.size > MAX_FILE) throw new Error('Cada arquivo pode ter até 20 MB.');
    const a = new Uint8Array(bytes), head = String.fromCharCode(...a.slice(0, 1024));
    const matches = ext === 'pdf' ? head.startsWith('%PDF-') : ext === 'png' ? a[0] === 137 && head.slice(1, 4) === 'PNG' : ['jpg', 'jpeg'].includes(ext) ? a[0] === 255 && a[1] === 216 && a[2] === 255 : ext === 'webp' ? head.startsWith('RIFF') && head.slice(8, 12) === 'WEBP' : ext === 'docx' ? head.startsWith('PK\x03\x04') : true;
    if (!matches) throw new Error('O conteúdo não corresponde à extensão do arquivo.');
    if (ext === 'txt') { try { new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { throw new Error('Salve o arquivo TXT em UTF-8 antes de importar.'); } }
    return { ext, mime: formats[ext] };
  }
  function addFile(item, file) {
    if (active(item).some(f => f.sha256 === file.sha256)) throw new Error('Este conteúdo já está anexado ao caso.');
    if (files(item).reduce((n, f) => n + f.size, 0) + file.size > MAX_CASE) throw new Error('Limite de 100 MB por caso, incluindo documentos retirados.');
    item.attachments ||= [];
    const number = Math.max(0, ...files(item).map(f => f.number)) + 1;
    const record = { ...file, number, archived: false, availability: 'ready' }; item.attachments.push(record); return record;
  }
  function linkState(item, link) {
    const file = files(item).find(f => f.id === link.attachmentId), section = item.sections.find(s => s.id === link.sectionId);
    if (!file || file.archived) return 'Documento retirado do caso';
    if (file.availability !== 'ready') return file.availability === 'missing' ? 'Arquivo indisponível neste navegador' : 'Conferindo arquivo local';
    if (!section || !eligible(section)) return 'Seção indisponível';
    if (link.quote) {
      const count = section.text.split(link.quote).length - 1;
      if (!count) return 'Trecho alterado — refaça o vínculo';
      if (count > 1 || link.quoteContext?.before || link.quoteContext?.after) {
        const context = link.quoteContext; let matches = 0, from = 0, at;
        while ((at = section.text.indexOf(link.quote, from)) !== -1) {
          if (context && (context.before || context.after) && section.text.slice(Math.max(0, at - context.before.length), at) === context.before && section.text.slice(at + link.quote.length, at + link.quote.length + context.after.length) === context.after) matches++;
          from = at + link.quote.length;
        }
        if (matches !== 1) return context ? 'Trecho alterado — confira novamente o vínculo e seu contexto' : 'Trecho repetido — selecione o trecho no editor ou use uma citação mais específica';
      }
    }
    return '';
  }
  function addLink(item, data) {
    const link = { id: data.id, attachmentId: data.attachmentId, sectionId: data.sectionId, quote: String(data.quote || '').trim(), location: String(data.location || '').trim().slice(0, 150), note: String(data.note || '').trim().slice(0, 2000), userId: data.userId, at: data.at };
    const previous = links(item).find(l => l.id === link.id), context = data.quoteContext || (previous?.quote === link.quote && previous.sectionId === link.sectionId ? previous.quoteContext : null);
    if (context) link.quoteContext = { before: String(context.before || '').slice(-80), after: String(context.after || '').slice(0, 80) };
    if (!item.sections.some(s => s.id === link.sectionId && eligible(s))) throw new Error('Selecione o texto da peça ou uma seção disponível.');
    const problem = linkState(item, link); if (problem) throw new Error(problem);
    if (links(item).some(l => l.id !== link.id && l.attachmentId === link.attachmentId && l.sectionId === link.sectionId && l.quote === link.quote && l.location === link.location)) throw new Error('Este vínculo já existe.');
    item.documentLinks ||= []; const index = item.documentLinks.findIndex(l => l.id === link.id);
    if (index >= 0) item.documentLinks[index] = link; else item.documentLinks.push(link);
    return link;
  }
  function issues(item) { return links(item).map(l => ({ link: l, problem: linkState(item, l) })).filter(r => r.problem); }
  function citation(item, link) { const f = files(item).find(f => f.id === link.attachmentId); return f && !f.archived ? `${label(f)} — ${f.name}${link.location ? ` (${link.location})` : ''}` : ''; }
  function project(item, sections) {
    return sections.map(s => {
      const refs = [...new Set(links(item).filter(l => l.sectionId === s.id && !linkState(item, l)).map(l => citation(item, l)))];
      if (!refs.length) return s;
      const output = clone(s), tail = 'Documentos relacionados: ' + refs.join('; ') + '.';
      output.text = s.text + '\n\n' + tail;
      if (output.delta) { const ops = output.delta.ops; if (!String(ops.at(-1)?.insert || '').endsWith('\n')) ops.push({ insert: '\n' }); ops.push({ insert: '\n' }, { insert: tail, attributes: { italic: true, size: '10pt' } }, { insert: '\n' }); }
      return output;
    });
  }
  function index(item) {
    const ids = new Set(links(item).filter(l => !linkState(item, l)).map(l => l.attachmentId));
    return active(item).filter(f => ids.has(f.id)).map(f => `${label(f)} — ${f.name}`).join('\n');
  }
  function pendingReferences(item) {
    const text = item.sections.filter(s => s.scope !== 'internal').map(s => s.text).join('\n');
    const missing = [...new Set(links(item).filter(l => !linkState(item, l)).map(l => citation(item, l)))].filter(ref => !text.includes(ref));
    return missing.length ? 'Documentos relacionados\n' + missing.join('\n') : '';
  }
  function fingerprint(item) { return { files: files(item).map(({ id, number, name, size, sha256, archived, availability }) => ({ id, number, name, size, sha256, archived, availability })), links: links(item).map(({ id, attachmentId, sectionId, quote, quoteContext, location }) => ({ id, attachmentId, sectionId, quote, quoteContext, location })) }; }
  return { MAX_FILE, MAX_CASE, formats, eligible, files, active, links, label, validate, addFile, linkState, addLink, issues, citation, project, index, pendingReferences, fingerprint };
});
