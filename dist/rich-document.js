(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./guided-model.js'));
  else root.EloRich = factory(root.EloGuided);
})(typeof globalThis === 'object' ? globalThis : this, function (G) {
  'use strict';
  const sizes = ['10pt', '11pt', '12pt', '14pt', '16pt', '18pt', '24pt'];
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function attrs(source = {}, block = false) {
    const out = {};
    if (block) {
      if ([1, 2].includes(source.header)) out.header = source.header;
      else if (['ordered', 'bullet'].includes(source.list)) out.list = source.list;
      else if (source.blockquote === true) out.blockquote = true;
      if (['center', 'right', 'justify'].includes(source.align)) out.align = source.align;
      if (Number.isInteger(source.indent) && source.indent > 0) out.indent = Math.min(8, source.indent);
    } else {
      for (const key of ['bold', 'italic', 'underline', 'strike']) if (source[key] === true) out[key] = true;
      if (sizes.includes(source.size) && source.size !== '11pt') out.size = source.size;
    }
    return out;
  }
  // Only text inserts and explicitly supported formatting survive storage/paste/export.
  // No stored HTML, embeds, URLs, style strings, or arbitrary attributes are rendered.
  function delta(section = {}) {
    const ops = [], input = Array.isArray(section.delta?.ops) ? section.delta.ops : [{ insert: String(section.text || '') + '\n' }];
    function add(insert, attributes) {
      if (!insert) return;
      const previous = ops.at(-1), a = Object.keys(attributes).length ? attributes : undefined;
      if (previous && JSON.stringify(previous.attributes) === JSON.stringify(a)) previous.insert += insert;
      else ops.push(a ? { insert, attributes: a } : { insert });
    }
    for (const op of input) {
      if (!op || typeof op.insert !== 'string') continue;
      const pieces = op.insert.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').split('\n');
      pieces.forEach((piece, i) => { add(piece, attrs(op.attributes)); if (i < pieces.length - 1) add('\n', attrs(op.attributes, true)); });
    }
    if (!ops.length || !ops.at(-1).insert.endsWith('\n')) add('\n', {});
    return { ops };
  }
  function text(section) { return delta(section).ops.map(op => op.insert).join('').replace(/\n$/, ''); }
  function lines(section) {
    const result = []; let runs = [];
    for (const op of delta(section).ops) {
      const pieces = op.insert.split('\n');
      pieces.forEach((piece, i) => {
        if (piece) runs.push({ text: piece, ...attrs(op.attributes) });
        if (i < pieces.length - 1) { result.push({ runs, ...attrs(op.attributes, true) }); runs = []; }
      });
    }
    return result;
  }
  function inlineHTML(run) {
    let html = escape(run.text);
    for (const [key, tag] of [['bold', 'strong'], ['italic', 'em'], ['underline', 'u'], ['strike', 's']]) if (run[key]) html = `<${tag}>${html}</${tag}>`;
    return run.size ? `<span style="font-size:${run.size}">${html}</span>` : html;
  }
  function withMarkers(section) {
    let counters = [], types = [], group = 0, previousList = false;
    return lines(section).map(line => {
      const level = line.indent || 0;
      if (!line.list) { counters = []; types = []; previousList = false; return line; }
      if (!previousList) group++;
      if (types[level] !== line.list) counters[level] = 0;
      counters[level] = (counters[level] || 0) + 1;
      counters.length = types.length = level + 1; types[level] = line.list; previousList = true;
      const n = counters[level];
      const alpha = value => value > 26 ? alpha(Math.floor((value - 1) / 26)) + String.fromCharCode(97 + (value - 1) % 26) : String.fromCharCode(96 + value);
      const roman = value => { let s = ''; for (const [v, token] of [[1000,'m'],[900,'cm'],[500,'d'],[400,'cd'],[100,'c'],[90,'xc'],[50,'l'],[40,'xl'],[10,'x'],[9,'ix'],[5,'v'],[4,'iv'],[1,'i']]) while (value >= v) { s += token; value -= v; } return s; };
      return { ...line, ordinal: n, group, marker: line.list === 'bullet' ? '•' : `${level % 3 === 1 ? alpha(n) : level % 3 === 2 ? roman(n) : n}.` };
    });
  }
  function html(section) {
    return withMarkers(section).map(line => {
      const tag = line.header ? 'h' + (line.header + 2) : line.blockquote ? 'blockquote' : 'p';
      const style = `text-align:${line.align || 'left'};${line.indent ? 'margin-left:' + line.indent * 1.5 + 'em;' : ''}`;
      const content = line.runs.map(inlineHTML).join('') || '<br>';
      return line.list ? `<div class="rich-list-line" style="${style}"><span aria-hidden="true">${line.marker}</span><p>${content}</p></div>` : `<${tag} style="${style}">${content}</${tag}>`;
    }).join('');
  }
  function equal(a, b) { return JSON.stringify(delta(a)) === JSON.stringify(delta(b)); }
  function pageSize(size) { return size === 'A4' ? { width: 11906, height: 16838, pdf: 'A4' } : { width: 12240, height: 15840, pdf: 'LETTER' }; }
  function docxDocument(item, D, size = 'LETTER') {
    item = G.document(item);
    const children = [], numbering = [], page = pageSize(size);
    const para = (text, options = {}) => new D.Paragraph({ children: [new D.TextRun({ text, color: '000000' })], ...options });
    if (!item.fullDocument) {
    children.push(para('ELOJUS', { spacing: { after: 180 }, style: 'Brand' }));
    children.push(para(item.documentTitle, { heading: D.HeadingLevel.TITLE, keepNext: true }));
    children.push(para(item.title, { spacing: { after: 100 }, keepNext: true }));
    children.push(para(`${item.id} · ${item.client}`, { style: 'Metadata', spacing: { after: 300 } }));
    }
    for (const [sectionIndex, section] of item.sections.entries()) {
      if (!section.omitTitle) children.push(para(section.title, { heading: D.HeadingLevel.HEADING_1, keepNext: true }));
      for (const line of withMarkers(section)) {
        const reference = `list-${sectionIndex}-${numbering.length}`, level = line.indent || 0;
        // One numbering definition per paragraph gives exact restarts, mixed list
        // types, and indentation while retaining native editable Word lists.
        if (line.list) numbering.push({ reference, levels: Array.from({ length: 9 }, (_, i) => ({ level: i, format: line.list === 'bullet' ? D.LevelFormat.BULLET : [D.LevelFormat.DECIMAL, D.LevelFormat.LOWER_LETTER, D.LevelFormat.LOWER_ROMAN][i % 3], text: line.list === 'bullet' ? '•' : `%${i + 1}.`, start: i === level ? line.ordinal : 1, alignment: D.AlignmentType.LEFT, style: { paragraph: { indent: { left: 360 * (i + 1), hanging: 270 } }, run: { font: 'Arial', color: '000000', size: 22 } } })) });
        const baseSize = line.header === 1 ? 15 : line.header === 2 ? 13 : 11;
        const runs = line.runs.map(run => new D.TextRun({ text: run.text, font: 'Arial', size: 2 * (run.size ? parseInt(run.size) : baseSize), bold: Boolean(run.bold || line.header), italics: Boolean(run.italic || line.blockquote), underline: run.underline ? { type: D.UnderlineType.SINGLE } : undefined, strike: Boolean(run.strike), color: '000000' }));
        children.push(new D.Paragraph({ children: runs.length ? runs : [new D.TextRun('')], heading: line.header ? (line.header === 1 ? D.HeadingLevel.HEADING_2 : D.HeadingLevel.HEADING_3) : undefined, keepNext: Boolean(line.header), widowControl: true, alignment: ({ center: D.AlignmentType.CENTER, right: D.AlignmentType.RIGHT, justify: D.AlignmentType.JUSTIFIED })[line.align] || D.AlignmentType.LEFT, numbering: line.list ? { reference, level } : undefined, indent: !line.list && (level || line.blockquote) ? { left: 360 * (level + (line.blockquote ? 1 : 0)), right: line.blockquote ? 240 : 0 } : undefined, spacing: { before: line.header ? 140 : 0, after: line.list ? 70 : 140, line: 300 } }));
      }
    }
    if (!item.shared) children.push(para('Minuta demonstrativa. Conteúdo fictício, sujeito à revisão profissional.', { style: 'Metadata', spacing: { before: 240 } }));
    return new D.Document({ creator: 'EloJus', title: item.documentTitle, description: item.title, numbering: { config: numbering }, styles: { default: { document: { run: { font: 'Arial', size: 22, color: '000000' }, paragraph: { spacing: { after: 140, line: 300 } } }, title: { run: { font: 'Arial', size: 40, color: '000000', bold: true }, paragraph: { spacing: { after: 180 } } }, heading1: { run: { font: 'Arial', size: 28, bold: true, color: '000000' }, paragraph: { spacing: { before: 260, after: 120 } } }, heading2: { run: { font: 'Arial', size: 30, color: '000000', bold: true } }, heading3: { run: { font: 'Arial', size: 26, color: '000000', bold: true } } }, paragraphStyles: [{ id: 'Metadata', name: 'Metadados', basedOn: 'Normal', run: { size: 18, color: '555555' } }, { id: 'Brand', name: 'Marca', basedOn: 'Normal', run: { size: 18, bold: true, color: '000000' } }] }, sections: [{ properties: { page: { size: { width: page.width, height: page.height }, margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } }, footers: { default: new D.Footer({ children: [new D.Paragraph({ alignment: D.AlignmentType.RIGHT, children: [new D.TextRun({ children: [D.PageNumber.CURRENT, ' / ', D.PageNumber.TOTAL_PAGES], size: 18, color: '555555' })] })] }) }, children }] });
  }
  function pdfDefinition(item, size = 'LETTER') {
    item = G.document(item);
    const content = [{ text: 'ELOJUS', fontSize: 9, bold: true, margin: [0, 0, 0, 12] }, { text: item.documentTitle, fontSize: 20, bold: true, margin: [0, 0, 0, 10], headlineLevel: 1 }, { text: item.title, margin: [0, 0, 0, 6] }, { text: `${item.id} · ${item.client}`, style: 'metadata', margin: [0, 0, 0, 22] }];
    if (item.fullDocument) content.length = 0;
    for (const section of item.sections) {
      if (!section.omitTitle) content.push({ text: section.title, fontSize: 14, bold: true, margin: [0, 10, 0, 9], headlineLevel: 1 });
      for (const line of withMarkers(section)) {
        const fontSize = line.header === 1 ? 15 : line.header === 2 ? 13 : 11;
        const node = { text: line.runs.length ? line.runs.map(run => ({ text: run.text, bold: Boolean(run.bold || line.header), italics: Boolean(run.italic || line.blockquote), fontSize: run.size ? parseInt(run.size) : fontSize, decoration: [run.underline ? 'underline' : '', run.strike ? 'lineThrough' : ''].filter(Boolean) })) : ' ', alignment: line.align || 'left', margin: [0, line.header ? 6 : 0, 0, line.list ? 5 : 10] };
        if (line.header) node.headlineLevel = 2;
        const indent = (line.indent || 0) * 18 + (line.blockquote ? 18 : 0);
        if (line.list) content.push({ columns: [{ width: 20, text: line.marker }, { width: '*', ...node }], margin: [indent, 0, 0, 0] });
        else { node.margin[0] = indent; if (line.blockquote) node.margin[2] = 12; content.push(node); }
      }
    }
    if (!item.shared) content.push({ text: 'Minuta demonstrativa. Conteúdo fictício, sujeito à revisão profissional.', style: 'metadata', margin: [0, 14, 0, 0] });
    // Keep headings with the first short paragraph; long text can still paginate.
    const paginated = [];
    const length = node => typeof node?.text === 'string' ? node.text.length : Array.isArray(node?.text) ? node.text.reduce((n, run) => n + String(run.text || '').length, 0) : Infinity;
    for (let i = 0; i < content.length; i++) {
      const node = content[i], next = content[i + 1];
      if (node.headlineLevel && next && !next.headlineLevel && length(next) < 900) { paginated.push({ stack: [node, next], unbreakable: true }); i++; }
      else paginated.push(length(node) < 900 && !node.headlineLevel ? { ...node, unbreakable: true } : node);
    }
    return { info: { title: item.documentTitle, author: 'EloJus', subject: item.title }, pageSize: pageSize(size).pdf, pageMargins: [72, 72, 72, 72], defaultStyle: { font: 'Roboto', fontSize: 11, lineHeight: 1.2, color: '#000000' }, styles: { metadata: { fontSize: 9, color: '#555555' } }, content: paginated, footer: (page, count) => ({ text: `${page} / ${count}`, alignment: 'right', fontSize: 9, color: '#555555', margin: [72, 18, 72, 0] }), pageBreakBefore: (node, following) => Boolean(node.headlineLevel && following.length === 0) };
  }
  return { sizes, delta, text, lines, html, equal, withMarkers, docxDocument, pdfDefinition };
});
