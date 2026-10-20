const a=require('miniprogram-automator'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const m=await a.connect({wsEndpoint:'ws://127.0.0.1:9431'}),checks=[],metrics=[],exceptions=[];
 const shot=name=>m.screenshot({path:path.join(__dirname,'screenshots',name+'.png')});
 const fresh=async()=>{m.pageMap.clear();return m.currentPage()};
 m.on('exception',e=>exceptions.push(e));
 try{
 for(const id of ['source','v1','r2','concept']){
  await m.reLaunch('/pages/nail-detail/nail-detail?id='+id);const p=await fresh();await p.waitFor('.product-title');await p.waitFor(700);
  const img=await p.$('.gallery-image'),title=await(await p.$('.product-title')).text();
  assert.equal(await img.attribute('mode'),'aspectFit');assert.ok(!(await p.$('.image-retry')));
  assert.ok((await(await p.$('.product-price')).text()).includes('到店确认'));
  metrics.push({id,context:'detail',title,imageMode:await img.attribute('mode'),gallery:await(await p.$('.gallery')).size(),page:await p.size()});
  checks.push(id+': detail renders, fits image, no invented price');await shot('detail-'+id);console.log('PASS detail',id);
 }
 await m.reLaunch('/pages/nail/nail');const p=await fresh();await p.waitFor('.product-card');await p.waitFor(800);
 const cards=await p.$$('.product-card'),galleries=await p.$$('.gallery');assert.equal(cards.length,4);
 const tops=[];for(const g of galleries)tops.push(Number((await g.offset()).top));
 for(let i=0;i<cards.length;i++){
  const id=['source','v1','r2','concept'][i];await m.pageScrollTo(Math.max(0,tops[i]-8));await p.waitFor(350);await shot('list-'+id);
  const img=await cards[i].$('.gallery-image');assert.equal(await img.attribute('mode'),'aspectFill');
  metrics.push({id,context:'list',imageMode:await img.attribute('mode'),gallery:await galleries[i].size()});checks.push(id+': list aspectFill captured');console.log('PASS list',id);
 }
 await m.reLaunch('/pages/nail-detail/nail-detail?id=source');const detail=await fresh();await detail.waitFor('.gallery-count');await detail.waitFor(500);
 await(await detail.$('.gallery-count')).tap();await detail.waitFor(700);await shot('native-preview-source');checks.push('actual wx.previewImage opened on source photo');
 }finally{
 const requests=fs.readFileSync(path.join(__dirname,'requests.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
 assert.ok(requests.every(r=>r.method==='GET'));
 fs.writeFileSync(path.join(__dirname,'native-results.json'),JSON.stringify({system:await m.systemInfo(),checks,metrics,exceptions,onlyGET:true},null,2));await m.disconnect();
 }
})().catch(e=>{console.error(e);process.exitCode=1});
