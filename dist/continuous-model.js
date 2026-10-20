(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./rich-document.js'), require('./guided-model.js'), require('./attachment-model.js'));
  else root.EloContinuous = factory(root.EloRich, root.EloGuided, root.EloAttachments);
})(typeof globalThis === 'object' ? globalThis : this, function (R, G, A) {
  'use strict';
  const clone = value => JSON.parse(JSON.stringify(value));
  function ensureBody(item) {
    // Approved documents remain frozen; migration is idempotent for editable cases.
    if (item.editorMode === 'continuous' || item.status === 'approved') return false;
    const previous = item.sections.filter(s => s.scope !== 'internal'), ids = new Set(previous.map(s => s.id));
    const ops = [], starts = new Map();
    for (const section of previous) {
      if (!R.text(section).trim()) continue;
      if (ops.length) ops.push({ insert: '\n' });
      if (section.title) ops.push({ insert: section.title }, { insert: '\n', attributes: { header: 2 } });
      starts.set(section.id, ops.reduce((n, op) => n + op.insert.length, 0));
      ops.push(...R.delta(section).ops);
    }
    const body = { id: 'corpo', title: 'Texto da peça', omitTitle: true, delta: { ops: ops.length ? ops : [{ insert: '\n' }] } };
    body.delta = R.delta(body); body.text = R.text(body);
    // Keep a lossless copy and leave historical versions untouched.
    item.sectionArchive = clone(item.sections);
    item.sections = [body, ...item.sections.filter(s => s.scope === 'internal')];
    for (const link of item.documentLinks || []) if (ids.has(link.sectionId)) {
      const source = previous.find(s => s.id === link.sectionId);
      link.sourceSectionId = link.sectionId; link.sourceSectionTitle = source.title;
      if (!link.quote && source.text.trim()) link.quote = source.text;
      const position = quotePosition(source, link);
      if (position >= 0) {
        const at = starts.get(source.id) + position;
        if (body.text.slice(at, at + link.quote.length) === link.quote) link.quoteContext = { before: body.text.slice(Math.max(0, at - 80), at), after: body.text.slice(at + link.quote.length, at + link.quote.length + 80) };
      }
      link.sectionId = body.id;
    }
    for (const comment of item.comments || []) if (ids.has(comment.sectionId)) {
      const source = previous.find(s => s.id === comment.sectionId);
      comment.sourceSectionId = comment.sectionId; comment.sourceSectionTitle = source.title;
      if (!comment.quote && source.text.trim()) comment.quote = source.text.slice(0, 500);
      comment.sectionId = body.id;
    }
    item.editorMode = 'continuous';
    return true;
  }
  function quotePosition(section, link) {
    const text = R.text(section), context = link.quoteContext, matches = [];
    if (!link.quote) return -1;
    for (let from = 0, at; (at = text.indexOf(link.quote, from)) !== -1; from = at + link.quote.length) {
      if (!context || (text.slice(Math.max(0, at - context.before.length), at) === context.before && text.slice(at + link.quote.length, at + link.quote.length + context.after.length) === context.after)) matches.push(at);
    }
    return matches.length === 1 ? matches[0] : -1;
  }
  function ensure(item) {
    if (item.fullDocument || item.status === 'approved') return false;
    // The original data is retained once, including pre-v0.7 structured documents.
    item.fullDocumentArchive = { sections: clone(item.sections), guided: item.guided ? clone(item.guided) : undefined, documentTitle: item.documentTitle };
    ensureBody(item);
    const previous = G.finalSections(item), projected = G.document(item), fields = item.guided?.fields;
    const sections = projected.sections.filter(s => s.id !== 'partes' || fields?.autor.trim() || fields?.reu.trim());
    const hasContent = sections.some(s => R.text(s).trim()) || fields?.acao.trim();
    const ops = [], starts = new Map();
    const append = (section, title = '') => {
      if (!R.text(section).trim()) return;
      if (ops.length) ops.push({ insert: '\n' });
      if (title) ops.push({ insert: title }, { insert: '\n', attributes: { header: 2 } });
      starts.set(section.id, ops.reduce((n, op) => n + op.insert.length, 0));
      ops.push(...R.delta(section).ops);
    };
    // Address and parties precede the editable action title and the existing body.
    let titleInserted = false;
    for (const section of sections) {
      if (!['juizo', 'processo', 'partes', 'representacao'].includes(section.id) && !titleInserted) {
        if (hasContent && !previous.some(s => R.text(s).split('\n').some(line => line.trim() === projected.documentTitle))) append({ id: 'titulo', delta: { ops: [{ insert: projected.documentTitle }, { insert: '\n', attributes: { header: 1, align: 'center' } }] } });
        titleInserted = true;
      }
      append(section, section.omitTitle || ['juizo', 'processo', 'partes', 'representacao', 'fecho'].includes(section.id) ? '' : section.title);
    }
    // A title entered on its own is also authored content and must survive migration.
    if (!titleInserted && (hasContent || fields?.acao.trim())) append({ id: 'titulo', text: fields?.acao || projected.documentTitle });
    const body = { id: 'corpo', title: 'Texto da peça', omitTitle: true, delta: R.delta({ delta: { ops } }) };
    body.text = R.text(body);
    for (const link of A.links(item)) {
      const source = previous.find(s => s.id === link.sectionId), offset = starts.get(link.sectionId);
      if (!source || offset === undefined) continue;
      const position = quotePosition(source, link);
      // Only rebase known anchors; an already stale or ambiguous link stays pending.
      if (position >= 0) {
        const at = offset + position;
        link.quoteContext = { before: body.text.slice(Math.max(0, at - 80), at), after: body.text.slice(at + link.quote.length, at + link.quote.length + 80) };
      }
      link.sectionId = 'corpo';
    }
    for (const comment of item.comments || []) {
      const source = sections.find(s => s.id === comment.sectionId);
      if (source && source.id !== 'corpo') {
        comment.sourceSectionId ||= source.id; comment.sourceSectionTitle ||= source.title;
        if (!comment.quote) comment.quote = R.text(source).slice(0, 500);
        comment.sectionId = 'corpo';
      }
    }
    item.sections = [body, ...item.sections.filter(s => s.scope === 'internal')];
    item.fullDocument = true;
    return true;
  }
  function upgrade(state) { for (const item of state.cases) ensure(item); return state; }
  return { ensure, upgrade };
});
