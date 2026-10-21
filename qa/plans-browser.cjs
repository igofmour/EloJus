// Uses a separately installed Playwright; never reads remote credentials or data.
const {chromium}=require(process.env.ELOJUS_PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {start}=require('./plans-preview.cjs');
async function run(){
  const qa=await start();
  let browser;
  try { browser=await chromium.launch({headless:true,...(process.env.ELOJUS_BROWSER_CHANNEL?{channel:process.env.ELOJUS_BROWSER_CHANNEL}:{})}); }
  catch(error){await qa.close();throw error;}
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  const page=await context.newPage(), errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const out=path.resolve(__dirname,'../test-results/plans');fs.mkdirSync(out,{recursive:true});
  const visible=async selector=>{await page.locator(selector).waitFor({state:'visible'});};
  const checkWidth=async()=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const screenshot=async name=>{await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:path.join(out,name+'.png'),fullPage:true});};
  try{
    await page.goto(qa.url+'/planos.html');await visible('#planChoices');
    assert.equal(await page.locator('input[name=plan]').count(),1);
    await page.locator('#reviewPlan').click();await visible('#planError');
    await page.locator('label[for=planEquipe]').click();
    await screenshot('desktop');await checkWidth();
    await page.locator('#reviewPlan').click();await visible('#savePlan');
    await page.route('**/rest/v1/offices?**',route=>route.request().method()==='PATCH'?route.fulfill({status:500,contentType:'application/json',body:'{"message":"internal secret"}'}):route.continue());
    await page.locator('#savePlan').click();await visible('#saveError');
    assert.doesNotMatch(await page.locator('#saveError').textContent(),/secret/);
    assert.equal(await page.locator('#continueContract').isVisible(),false);
    await page.unroute('**/rest/v1/offices?**');
    await page.locator('#savePlan').click();await visible('#savedMessage');
    const saved=(await qa.db.query('select plan_code,plan_selected_at from public.offices where id=$1',[qa.officeId])).rows[0];
    assert.equal(saved.plan_code,'equipe');assert.ok(saved.plan_selected_at);
    assert.equal(qa.mutations.length,1);assert.deepEqual(qa.mutations[0].payload,{plan_code:'equipe'});
    await page.reload();await visible('#savedMessage');assert.equal(qa.mutations.length,1);
    await page.locator('#continueContract').click();await visible('#contractSummary');
    assert.match(await page.locator('.contract-price').textContent(),/129/);
    assert.equal(await page.locator('#paymentUnavailable').isDisabled(),true);
    assert.equal(await page.locator('#paymentLink').getAttribute('href'),null);
    await screenshot('summary-desktop');await checkWidth();
    await page.setViewportSize({width:390,height:844});await screenshot('summary-mobile');await checkWidth();
    await page.goto(qa.url+'/planos.html');await visible('#savedMessage');
    await page.locator('#changePlan').click();await visible('#planChoices');
    await screenshot('mobile');await checkWidth();
    await page.setViewportSize({width:320,height:740});await checkWidth();
    await page.evaluate(()=>{window.qaSignedOut=true;window.dispatchEvent(new CustomEvent('elo-auth-change',{detail:{event:'SIGNED_OUT'}}));});
    await visible('#gateAction');assert.equal(await page.locator('#planReview').isVisible(),false);
    assert.equal(await page.locator('#officeName').textContent(),'');
    // Legacy preference is read without writing; only explicit confirmation changes it.
    await qa.db.query("update public.offices set plan_code='essencial' where id=$1",[qa.officeId]);
    await page.reload();await visible('#previousPlanNote');assert.equal(qa.mutations.length,1);
    await page.goto(qa.url+'/contratacao.html');await visible('#gateAction');
    assert.equal(await page.locator('#contractSummary').isVisible(),false);
    assert.equal(await page.locator('#gateAction').getAttribute('href'),'planos.html');
    await page.evaluate(()=>localStorage.setItem('plan-qa-persona','collaborator'));
    await page.goto(qa.url+'/planos.html');await visible('#gateAction');
    assert.equal(await page.locator('#planChoices').isVisible(),false);
    // Even a direct request from another office/member cannot alter the owner's choice.
    for(const persona of ['other','collaborator']){
      const response=await fetch(qa.url+'/rest/v1/offices?id=eq.'+qa.officeId,{method:'PATCH',headers:{'content-type':'application/json','x-qa-persona':persona},body:JSON.stringify({plan_code:'equipe'})});
      assert.deepEqual(await response.json(),[]);
    }
    assert.equal((await qa.db.query('select plan_code from public.offices where id=$1',[qa.officeId])).rows[0].plan_code,'essencial');
    await page.evaluate(()=>localStorage.setItem('plan-qa-persona','owner'));
    await page.route('**/rest/v1/offices?**',route=>route.abort());
    await page.goto(qa.url+'/planos.html');await visible('#gateError');await visible('#retryLoad');
    await page.unroute('**/rest/v1/offices?**');await page.locator('#retryLoad').click();await visible('#planChoices');
    assert.deepEqual(errors,[]);
    console.log('Plan browser checks passed: selection, PostgreSQL persistence, reload, safe payment state, legacy choices, auth loss, error/retry, owner isolation, desktop and 390/320 px.');
  }finally{await context.close();await browser.close();await qa.close();}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
