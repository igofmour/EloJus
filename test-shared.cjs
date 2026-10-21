const test=require('node:test');
const assert=require('node:assert/strict');
const Save=require('./dist/shared-save.js');
const doc=text=>({ops:[{insert:text+'\n'}]});
const row={id:'case-a',revision:1,document:doc('Inicial')};
test('Word export uses A4 with normal one-inch margins',async()=>{
 const R=require('./dist/rich-document.js'),D=require('docx'),Zip=require('jszip');
 const document=R.docxDocument({id:'QA',title:'Minuta',documentTitle:'Teste',fullDocument:true,shared:true,sections:[{id:'corpo',omitTitle:true,delta:doc('Texto de teste')}]},D,'A4');
 const zip=await Zip.loadAsync(await D.Packer.toBuffer(document));
 const xml=await zip.file('word/document.xml').async('string');
 assert.match(xml,/<w:pgSz[^>]*w:w="11906"[^>]*w:h="16838"/);
 for(const side of ['top','bottom','left','right'])assert.match(xml,new RegExp(`w:${side}="1440"`));
});
test('shared PDF export includes authored text without demonstration notice or case instructions',()=>{
 const R=require('./dist/rich-document.js');
 const definition=R.pdfDefinition({id:'ELO-1',title:'Caso',documentTitle:'Minuta',fullDocument:true,shared:true,instructions:'INTERNAL_SECRET',sections:[{id:'corpo',omitTitle:true,delta:doc('Texto final')}]},'A4');
 const output=JSON.stringify(definition);assert.match(output,/Texto final/);assert.doesNotMatch(output,/INTERNAL_SECRET|Minuta demonstrativa/);assert.equal(definition.pageSize,'A4');assert.deepEqual(definition.pageMargins,[72,72,72,72]);
});
test('serial saves keep edits typed while a request is in flight',async()=>{
 let release;const calls=[];
 const q=Save.create(row,async(document,revision)=>{calls.push({document,revision});if(calls.length===1)await new Promise(r=>release=r);return {...row,document,revision:revision+1};},async()=>row);
 q.edit(doc('Primeiro'));const saving=q.flush();q.edit(doc('Segundo'));release();assert.equal(await saving,true);assert.equal(calls.length,2);assert.equal(calls[1].revision,2);assert.deepEqual(q.state().draft,doc('Segundo'));assert.equal(q.state().dirty,false);
});
test('conflict preserves local draft without overwriting the remote document',async()=>{
 let calls=0;const remote={...row,revision:2,document:doc('Outro usuário')};
 const q=Save.create(row,async()=>{calls++;throw new Error('version_conflict');},async()=>remote);
 q.edit(doc('Meu texto'));assert.equal(await q.flush(),false);assert.equal(calls,1);assert.equal(q.state().error.message,'version_conflict');assert.equal(q.state().dirty,true);assert.deepEqual(q.state().draft,doc('Meu texto'));assert.equal(q.state().row.revision,1);
});
test('lost response is recovered from exact remote revision with JSONB key order',async()=>{
 const document={ops:[{insert:'Teste\n',attributes:{bold:true,size:'12pt'}}]};
 const remote={...row,revision:2,document:{ops:[{attributes:{size:'12pt',bold:true},insert:'Teste\n'}]}};
 const q=Save.create(row,async()=>{throw new Error('Network');},async()=>remote);q.edit(document);assert.equal(await q.flush(),true);assert.equal(q.state().dirty,false);assert.equal(q.state().row.revision,2);
});
test('network failure does not acknowledge data or drop pending changes',async()=>{
 let offline=true;const q=Save.create(row,async(document,revision)=>{if(offline)throw new Error('offline');return {...row,document,revision:revision+1};},async()=>{throw new Error('offline');});
 q.edit(doc('Preservar'));assert.equal(await q.flush(),false);assert.equal(q.state().dirty,true);offline=false;assert.equal(await q.flush(),true);assert.equal(q.state().dirty,false);
});
test('multiple flush callers share in-flight writes',async()=>{
 let release,calls=0;const q=Save.create(row,async(document,revision)=>{calls++;await new Promise(r=>release=r);return {...row,document,revision:revision+1};},async()=>row);
 q.edit(doc('Salvar uma vez'));const one=q.flush(),two=q.flush();release();assert.deepEqual(await Promise.all([one,two]),[true,true]);assert.equal(calls,1);
});
test('loading a remote version is explicit and cannot run during a save',async()=>{
 let release;const q=Save.create(row,async(document,revision)=>{await new Promise(r=>release=r);return {...row,document,revision:revision+1};},async()=>row);
 q.edit(doc('Trabalho'));const saving=q.flush();assert.throws(()=>q.reset(row),/save_in_progress/);release();await saving;q.reset({...row,revision:9});assert.equal(q.state().row.revision,9);assert.equal(q.state().dirty,false);
});
