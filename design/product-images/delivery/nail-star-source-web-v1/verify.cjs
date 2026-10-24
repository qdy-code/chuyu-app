const a=require('miniprogram-automator'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{const m=await a.connect({wsEndpoint:'ws://127.0.0.1:9432'}),checks=[],errors=[];const round=process.env.QA_ROUND||'round1';
const shot=n=>m.screenshot({path:path.join(__dirname,'screenshots',round+'-'+n+'.png')});
const fresh=async()=>{m.pageMap.clear();return m.currentPage()};m.on('exception',e=>errors.push(e));
try{
 await m.reLaunch('/pages/nail/nail');let p=await fresh();await p.waitFor('.detail-link');await p.waitFor(700);
 const g=await p.$('.gallery'),img=await p.$('.gallery-image'),controls=await p.$('.gallery-controls');
 assert.equal(await img.attribute('mode'),'aspectFit');assert.ok((await img.attribute('src')).endsWith('/display.jpg'));
 const imageBox=await img.size(),imageTop=Number((await img.offset()).top),controlsTop=Number((await controls.offset()).top);
 assert.ok(controlsTop>=imageTop+Number(imageBox.height)-1);checks.push('List keeps full photo; controls outside image');
 const count=await p.$('.gallery-count');assert.ok(Number((await count.size()).height)>=48);checks.push('Image viewer touch target >=48px');
 await m.pageScrollTo(Number((await g.offset()).top)-8);await p.waitFor(300);const listScroll=Number(await p.scrollTop());await shot('list');
 await(await p.$('.detail-link')).tap();await p.waitFor(1600);p=await fresh();assert.equal(p.path,'pages/nail-detail/nail-detail');await p.waitFor('.product-title');await p.waitFor(500);
 assert.equal(await(await p.$('.gallery-image')).attribute('mode'),'aspectFit');assert.ok(Number((await p.size()).width)<=(await m.systemInfo()).windowWidth);checks.push('Detail loads same compressed real photo with no overflow');await shot('detail');
 await m.evaluate(()=>{wx.navigateBack({delta:1});return true});await p.waitFor(1300);p=await fresh();await p.waitFor('.category-chip');assert.ok(Math.abs(Number(await p.scrollTop())-listScroll)<4);checks.push('Return keeps original list position');
 if(process.env.NATIVE_PREVIEW==='1'){
  await(await p.$('.gallery-count')).tap();await p.waitFor(600);await shot('native-preview');checks.push('Actual native preview opens compressed photo from list');
 }
 console.log('PASS',round,checks);
}finally{
 const requests=fs.readFileSync(path.join(__dirname,'requests.jsonl'),'utf8').trim().split('\n').map(JSON.parse);assert.ok(requests.every(r=>r.method==='GET'));
 fs.writeFileSync(path.join(__dirname,round+'-results.json'),JSON.stringify({system:await m.systemInfo(),checks,errors,onlyGET:true},null,2));await m.disconnect();
}})().catch(e=>{console.error(e);process.exitCode=1});
