(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.EloSharedSave=factory();})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const clone=value=>JSON.parse(JSON.stringify(value));
  const stable=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
  // Serial writes with compare-and-swap revisions. Failures preserve the draft.
  function create(row,write,read,onState=()=>{}) {
    let current=clone(row),draft=clone(row.document),serial=0,saved=0,running=null,failure=null;
    const state=()=>({row:clone(current),draft:clone(draft),dirty:serial!==saved,busy:!!running,error:failure});
    const emit=()=>onState(state());
    function edit(document){draft=clone(document);serial++;emit();}
    async function flush(){
      if(running){await running;return serial===saved?true:failure?false:flush();}
      if(serial===saved)return true;
      failure=null;
      running=(async()=>{
        while(serial!==saved){
          const sent=serial,document=clone(draft),revision=current.revision;
          try {current=await write(document,revision);saved=sent;}
          catch(error){
            // Recover an acknowledged-by-read write after a lost response.
            try {const latest=await read();if(latest.revision===revision+1&&stable(latest.document)===stable(document)){current=latest;saved=sent;continue;}}catch{}
            failure=error;return false;
          }
        }
        return true;
      })();
      emit();try{return await running;}finally{running=null;emit();}
    }
    function reset(row){if(running)throw new Error('save_in_progress');current=clone(row);draft=clone(row.document);serial=0;saved=0;failure=null;emit();}
    return {state,edit,flush,reset};
  }
  return {create};
});
