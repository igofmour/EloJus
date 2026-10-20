'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const M = require('./dist/workspace-model'), G = require('./dist/guided-model'), A = require('./dist/attachment-model'), R = require('./dist/rich-document'), C = require('./dist/continuous-model');
const seed = () => G.upgrade(M.createSeed());
const example = (type = 'initial') => seed().cases.find(c => c.guided?.type === type);
const initial = example(), oldFields = M.clone(initial.guided.fields);
initial.comments.push({id:'c-address',sectionId:'juizo',text:'Conferir competência.',quote:''},{id:'c-close',sectionId:'fecho',text:'Conferir OAB.',quote:''});
initial.guided.notes = 'NOTA_INTERNA_NAO_EXPORTAR';
const original = M.clone(initial);
C.ensure(initial);
assert.equal(initial.fullDocument,true);
assert.equal(G.document(initial).sections.length,1);
assert.deepEqual(initial.fullDocumentArchive.sections,original.sections);
for (const key of ['juizo','autor','reu','representacao','acao','valor','conciliacao','localData','assinatura']) assert.ok(initial.sections[0].text.includes(oldFields[key]),key);
assert.ok(initial.comments.every(c=>c.sectionId==='corpo'));
assert.equal(initial.comments[0].quote,oldFields.juizo);
assert.ok(initial.comments[1].quote.includes(oldFields.assinatura));
assert.deepEqual(G.document(initial).sections,G.finalSections(initial),'preview is exactly authored content');
assert.equal(initial.sections[0].text.split(oldFields.acao).length,2,'action title occurs once');
// Existing v0.7 body with rich text and duplicate phrases, one valid contextual link and one stale link.
const v7=example(), body={id:'corpo',title:'Texto da peça',omitTitle:true,delta:{ops:[{insert:'Trecho comum',attributes:{bold:true}},{insert:'\nSegunda ocorrência: Trecho comum\n'}]}};
body.text=R.text(body);v7.sections=[body];v7.editorMode='continuous';v7.sectionArchive=[{id:'original',text:'ARCHIVE'}];
A.addFile(v7,{id:'f',name:'comprovante.txt',size:10,sha256:'1',availability:'ready'});
A.addLink(v7,{id:'l',attachmentId:'f',sectionId:'corpo',quote:'Trecho comum',quoteContext:{before:'',after:'\nSegunda ocorrência: '}});
v7.documentLinks.push({id:'stale',attachmentId:'f',sectionId:'corpo',quote:'Segunda ocorrência',quoteContext:{before:'CONTEXTO_QUE_MUDOU',after:''}});
const v7old=M.clone(v7);C.ensure(v7);
assert.deepEqual(v7.sectionArchive,v7old.sectionArchive);
assert.deepEqual(v7.fullDocumentArchive.sections,v7old.sections);
assert.equal(A.linkState(v7,v7.documentLinks[0]),'');
assert.match(A.linkState(v7,v7.documentLinks[1]),/Trecho alterado/,'stale anchors cannot silently become valid');
assert.ok(v7.sections[0].delta.ops.some(op=>op.attributes?.bold));
assert.equal(v7.sections[0].text.split('Trecho comum').length,3);
assert.ok(!A.pendingReferences(v7),'migrated references are already editable text');
const stable=JSON.stringify(v7);C.ensure(v7);assert.equal(JSON.stringify(v7),stable);
// Once migrated, archived form values cannot reappear, even after reloading or clearing all text.
const edited=M.clone(initial);
const finalText='Ao Juízo da Comarca Nova — fictícia\n\nAutora: Pessoa Nova — fictícia\nRé: Empresa Nova — fictícia\n\nDemanda com título editado\n\nTexto integral revisado.\n\nCidade Nova, 19 de outubro de 2026.\nAdvogada Nova — OAB fictícia\n';
edited.sections[0].delta={ops:[{insert:finalText}]};edited.sections[0].text=R.text(edited.sections[0]);
for(const r of G.requirements(edited)){assert.ok(r.manual);G.review(edited,r.id,'checked','','marina');}
assert.ok(G.requirements(edited).every(r=>r.done),'entire conference reads full text rather than old fields');
const fp=G.fingerprint(edited);edited.guided.fields.juizo='CAMPO_ARQUIVADO';edited.guided.annexes='ANEXO_ARQUIVADO';assert.equal(G.fingerprint(edited),fp);
edited.sections[0].delta.ops[0].insert+='Nova frase.\n';edited.sections[0].text=R.text(edited.sections[0]);
assert.ok(G.requirements(edited).every(r=>!r.done),'any text edit invalidates all previous checks');
const reloaded=JSON.parse(JSON.stringify(edited));C.ensure(reloaded);assert.deepEqual(G.document(reloaded).sections,reloaded.sections);
const empty=M.clone(edited);empty.sections[0].delta={ops:[{insert:'\n'}]};empty.sections[0].text='';C.ensure(empty);
assert.equal(G.document(empty).sections[0].text,'');assert.ok(G.requirements(empty).every(r=>!r.present));assert.equal(M.transition(empty,'submit','marina').ok,false);
const fresh=G.create(initial,'ELO-999','defense');C.ensure(fresh);assert.equal(fresh.sections[0].text,'');assert.equal(fresh.fullDocumentArchive.guided.fields.juizo,'');
const titleOnly=G.create(initial,'ELO-998','initial');titleOnly.guided.fields.acao='Título isolado';C.ensure(titleOnly);assert.equal(titleOnly.sections[0].text,'Título isolado');
const frozen=example();frozen.status='approved';const frozenJSON=JSON.stringify(frozen);C.ensure(frozen);assert.equal(JSON.stringify(frozen),frozenJSON);
const defense=example('defense');const process=defense.guided.fields.processo;C.ensure(defense);assert.ok(defense.sections[0].text.includes(process));assert.ok(defense.sections[0].text.includes('Marina Exemplo'));
// References are inserted explicitly once, remain editable, and never regenerate during export.
const refs=G.create(initial,'ELO-997','initial');C.ensure(refs);refs.sections[0].text='Uma alegação.';delete refs.sections[0].delta;
A.addFile(refs,{id:'new',name:'novo.txt',size:10,sha256:'2'});A.addLink(refs,{id:'newlink',attachmentId:'new',sectionId:'corpo',quote:'Uma alegação.'});
const pending=A.pendingReferences(refs);assert.ok(pending.includes('Doc. 01 — novo.txt'));assert.ok(!G.document(refs).sections[0].text.includes('novo.txt'));
refs.sections[0].text+='\n\n'+pending;assert.equal(A.pendingReferences(refs),'');
M.transition(edited,'saveVersion','marina');assert.deepEqual(edited.versions.at(-1).sections,G.document(edited).sections);
console.log('PASS: whole-document migration from structured and v0.7 drafts, all fields, rich text, anchors, archives, blank drafts, idempotence, approval freeze, comments, explicit references and full-text conference.');
(async()=>{
 const D=require('docx'),ZIP=require('jszip'), pdf=require('./dist/vendor/pdfmake.min.js');pdf.addVirtualFileSystem(require('./dist/vendor/vfs_fonts.js'));
 const context={window:{EloGuided:G},EloRich:R,Blob};vm.runInNewContext(fs.readFileSync('dist/document-export.js','utf8'),context);
 const out=path.join(__dirname,'qa/full-document');fs.mkdirSync(out,{recursive:true});
 for(const [stem,item] of [['initial',initial],['defense',defense],['edited',edited]]){
   const txt=await(await context.window.EloExport.create(item,'txt','A4')).text();
   assert.equal(txt.replace(/^\uFEFF/,''),R.text(item.sections[0])+'\n\nMinuta demonstrativa. Conteúdo fictício, sujeito à revisão profissional.');
   const buffer=await D.Packer.toBuffer(R.docxDocument(item,D,'A4')),xml=await(await ZIP.loadAsync(buffer)).file('word/document.xml').async('string');
   const definition=R.pdfDefinition(item,'A4');
   for(const content of [txt,xml,JSON.stringify(definition)]){
     assert.ok(!content.includes('NOTA_INTERNA_NAO_EXPORTAR'));assert.ok(!content.includes('Texto da peça'));
     if(stem==='edited') for(const old of [oldFields.juizo,oldFields.autor,oldFields.assinatura,oldFields.acao,'CAMPO_ARQUIVADO','ANEXO_ARQUIVADO'])assert.ok(!content.includes(old));
   }
   const pdfBuffer=await new Promise(resolve=>pdf.createPdf(definition).getBuffer(resolve));
   fs.writeFileSync(path.join(out,stem+'.txt'),txt);fs.writeFileSync(path.join(out,stem+'.docx'),buffer);fs.writeFileSync(path.join(out,stem+'.pdf'),pdfBuffer);
 }
 console.log('PASS: TXT/DOCX/PDF use the complete edited document; old title, address, parties, signature, annex fields and notes do not leak back.');
})().catch(error=>{console.error(error);process.exitCode=1});
