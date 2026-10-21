const test=require('node:test');
const assert=require('node:assert/strict');
const D=require('./dist/demo-preview.js');
const local={protocol:'http:',hostname:'127.0.0.1',port:'8768'};
test('demo entry is local and limited to administrators, without impersonating an authenticated session',()=>{
  assert.equal(D.canLaunch(local,'admin'),true);
  for(const role of ['collaborator','reviewer',undefined])assert.equal(D.canLaunch(local,role),false);
  for(const hostname of ['elojus.com.br','127.0.0.1.example.com','192.168.1.1'])assert.equal(D.canLaunch({...local,hostname},'admin'),false);
  assert.equal(D.canLaunch({...local,protocol:'https:'},'admin'),false);
  assert.equal(D.canLaunch({...local,port:'9999'},'admin'),false);
  assert.equal(D.canLaunch(local,'admin',{persona:'admin'}),false);
  assert.equal(D.destination('previewSara',{location:local,role:'admin'}),'http://127.0.0.1:8772/index.html?persona=intern#inicio');
});
test('demo switching accepts only known personas and return has no untrusted redirect',()=>{
  const context={location:local,preview:{persona:'intern'},role:'collaborator'};
  assert.equal(D.destination('previewPersona',{...context,persona:'admin'}),'/index.html?persona=admin#inicio');
  assert.equal(D.destination('previewPersona',{...context,persona:'other'}),null);
  assert.equal(D.destination('previewPersona',{...context,persona:'https://example.com'}),null);
  assert.equal(D.destination('previewPersona',{...context,preview:null,persona:'admin'}),null);
  assert.equal(D.destination('previewReturn',context),'http://127.0.0.1:8768/index.html#inicio');
  assert.equal(D.banner(null),'');
  assert.match(D.banner({persona:'intern'}),/Sara · estagiária/);
});
test('unavailable or wrong preview server gives an actionable error and never sends credentials',async()=>{
  let options;
  await D.checkAvailable(async(url,opts)=>{options=opts;return {ok:true,json:async()=>({demo:'elojus-local'})};});
  assert.equal(options.credentials,'omit');
  for(const fetcher of [async()=>{throw Error('offline');},async()=>({ok:false}),async()=>({ok:true,json:async()=>({demo:'wrong'})})]){
    await assert.rejects(()=>D.checkAvailable(fetcher),/demonstração da Sara está indisponível/);
  }
});
