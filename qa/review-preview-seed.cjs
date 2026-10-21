// Fictional walkthrough data for the loopback-only preview.
const {randomUUID}=require('node:crypto');
module.exports=async function seed(db,people,office){
 async function cmd(who,action,data){
   await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:people[who].id,email:people[who].email,is_anonymous:false})]);
   return (await db.query('select public.workspace_command($1,$2) data',[action,{office_id:office,...data}])).rows[0].data;
 }
 const today=new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
 const first=await cmd('admin','create_case',{id:randomUUID(),title:'Manifestação · revisão da conclusão',client_name:'Cliente fictício A',area:'Cível',assignee_id:people.intern.id,reviewer_id:people.admin.id,review_due_date:today,priority:'high',priority_reason:'Conferência interna combinada para hoje.',matter_name:'Contrato de serviços · exemplo',instructions:'Conferir os documentos de apoio e preparar a manifestação. Destacar decisões que dependem de orientação.'});
 let row=await cmd('intern','save_case',{case_id:first.id,revision:1,document:{ops:[{insert:'MANIFESTAÇÃO — EXEMPLO FICTÍCIO\n\nEsta minuta demonstra a entrega com resumo e contexto para revisão.\n\nA conclusão deve ser conferida pelo advogado responsável antes da aprovação.\n'}]}});
 await cmd('intern','submit',{case_id:first.id,revision:row.revision,delivery_id:randomUUID(),summary:'Primeira minuta organizada com introdução, desenvolvimento e conclusão.',attention:'Conferir especialmente a conclusão. Os nomes e o conteúdo deste exemplo são fictícios.'});
 const second=await cmd('admin','create_case',{id:randomUUID(),title:'Resposta · conferência de documentos',client_name:'Cliente fictício A',assignee_id:people.intern.id,reviewer_id:people.admin.id,matter_id:first.matter_id});
 row=await cmd('intern','save_case',{case_id:second.id,revision:1,document:{ops:[{insert:'RESPOSTA — EXEMPLO FICTÍCIO\n\nA resposta menciona o documento inicial.\n'}]}});
 row=await cmd('intern','submit',{case_id:second.id,revision:row.revision,delivery_id:randomUUID(),summary:'Resposta inicial preparada.',attention:'Solicito conferência da referência ao documento.'});
 const comment=randomUUID();
 await cmd('admin','comment',{case_id:second.id,id:comment,kind:'adjustment',body:'Atualize a referência para o documento revisado e confira a conclusão.',blocking:true});
 row=await cmd('admin','return',{case_id:second.id,revision:row.revision});
 row=await cmd('intern','save_case',{case_id:second.id,revision:row.revision,document:{ops:[{insert:'RESPOSTA — EXEMPLO FICTÍCIO\n\nA resposta menciona o documento revisado.\n\nA conclusão foi ajustada conforme a orientação recebida.\n'}]}});
 await cmd('intern','address_comment',{case_id:second.id,id:comment,addressed:true});
 const third=await cmd('admin','create_case',{id:randomUUID(),title:'Minuta · orientação sobre o escopo',client_name:'Cliente fictício B',assignee_id:people.other.id,reviewer_id:people.admin.id,matter_name:'Atendimento B · exemplo'});
 await cmd('other','comment',{case_id:third.id,id:randomUUID(),kind:'question',blocks_work:true,body:'A entrega deve abranger os dois documentos ou apenas o primeiro? Preciso definir esse escopo para continuar.'});
};
