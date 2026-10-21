const test=require('node:test'),assert=require('node:assert/strict'),F=require('./dist/case-files.js');
const file=(name='Petição.pdf',size=123)=>({name,size});
const W=require('./dist/writing-files.js');
test('writing upload accepts Word, PDF and TXT but rejects unsupported documents',()=>{
 for(const name of ['Peça.DOCX','Peça.pdf','Peça.txt'])assert.doesNotThrow(()=>W.validate([file(name)]));
 for(const name of ['Peça.doc','arquivo.docx.exe','imagem.png','sem extensão'])assert.throws(()=>W.validate([file(name)]),/invalid_writing_file/);
 assert.throws(()=>W.validate([file('ok.pdf'),file('outro.html')]),/invalid_writing_file/);
});
test('writing file list escapes metadata and keeps read-only files downloadable',()=>{
 const files=[{id:'x" onclick="bad',name:'<img src=x>.pdf',info:'<script>bad</script>',available:true},{id:'pending',name:'pendente.docx',available:false}];
 const html=W.render({files,editable:false});
 assert.doesNotMatch(html,/<img|<script|data-action="addDraftFiles"/);
 assert.match(html,/&lt;img/);assert.match(html,/&quot; onclick=&quot;/);
 assert.match(html,/data-action="downloadFile"/);assert.doesNotMatch(html,/data-id="pending"/);
 assert.doesNotMatch(W.render({editable:true,enabled:false}),/data-action="addDraftFiles"/);
 assert.match(W.render({editable:true}),/data-action="addDraftFiles"/);
});
test('lawyer and assigned intern can attach from the demo editor; other intern and approved piece cannot',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),M=require('./dist/workspace-model.js'),A=require('./dist/attachment-model.js');
 const context={window:{EloAttachments:A,EloModel:M,EloWritingFiles:W}};
 vm.runInNewContext(fs.readFileSync('./dist/attachment-ui.js','utf8'),context);
 const item=M.createSeed().cases.find(c=>c.id==='ELO-004'),render=context.window.EloAttachmentUI.writingFiles;
 for(const actor of ['marina','lucas'])assert.match(render(item,actor),/data-attachment-action="uploadDraft"/);
 assert.doesNotMatch(render(item,'clara'),/uploadDraft/);
 item.status='approved';for(const actor of ['marina','lucas'])assert.doesNotMatch(render(item,actor),/uploadDraft/);
});
test('private file selection rejects executable formats, traversal, empty files and quotas',()=>{
 for(const f of [file('a.html'),file('../a.pdf'),file('a.pdf',0),file('a.pdf',F.limit+1),file('a\u0000.pdf')])assert.throws(()=>F.validate([f]),/invalid_attachment/);
 assert.throws(()=>F.validate(Array.from({length:11},()=>file())),/attachment_limit/);
 assert.throws(()=>F.validate([file('a.pdf',F.limit)],[{byte_size:F.totalLimit}]),/attachment_limit/);
 for(const ext of ['PDF','docx','txt','jpg','jpeg','png'])assert.doesNotThrow(()=>F.validate([file('Document.'+ext)]));
});
test('reservation retry recovers a received upload without sending the same file again',async()=>{
 let uploads=0,completions=0;
 const api={command:async(action)=>action==='prepare'?{object_path:'safe/path',mime_type:'application/pdf'}:(++completions,{uploaded_at:'now'}),upload:async()=>{uploads++;}};
 assert.equal((await F.upload({id:'same-id',file:file()},{case_id:'a'},api)).uploaded_at,'now');assert.equal(uploads,0);assert.equal(completions,1);
});
test('upload response loss is confirmed before reporting failure',async()=>{
 let received=false,uploads=0;
 const api={command:async(action)=>{if(action==='prepare')return{object_path:'path',mime_type:'application/pdf'};if(!received)throw Error('attachment_pending');return{uploaded_at:'now'};},upload:async()=>{uploads++;received=true;throw Error('network');}};
 assert.equal((await F.upload({id:'id',file:file()},{},api)).uploaded_at,'now');assert.equal(uploads,1);
});
test('failed upload is not falsely acknowledged and authorization failures stop before bytes',async()=>{
 let uploads=0;
 const api={command:async action=>{if(action==='prepare')return{};throw Error('access_denied');},upload:async()=>{uploads++;}};
 await assert.rejects(F.upload({id:'id',file:file()},{},api),/access_denied/);assert.equal(uploads,0);
 api.command=async action=>{if(action==='prepare')return{};throw Error('attachment_pending');};api.upload=async()=>{throw Error('offline');};
 await assert.rejects(F.upload({id:'id',file:file()},{},api),/offline/);
});
test('old Supabase schema keeps new features disabled, while unexpected failures are surfaced',async()=>{
 const vm=require('node:vm'),fs=require('node:fs');
 let result={data:null,error:{code:'PGRST202'}};
 const context={window:{EloAuth:{client:()=>({rpc:async()=>result})}}};
 vm.runInNewContext(fs.readFileSync('./dist/shared-api.js','utf8'),context);
 assert.equal((await context.window.EloShared.capabilities()).version,22);
 result={data:{version:23},error:null};assert.equal((await context.window.EloShared.capabilities()).version,23);
 result={data:null,error:{code:'42501',message:'denied'}};await assert.rejects(context.window.EloShared.capabilities(),e=>e.code==='42501');
});
