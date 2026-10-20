// Run with NODE_PATH=/tmp/moonisle-miniapp-qa/node_modules and isolated QA build/fixture.
const a = require('miniprogram-automator');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = '/tmp/moonisle-miniapp-qa';
const round = process.env.QA_ROUND || 'round1';
const output = __dirname;
const checks = [], errors = [];
const timeout=setTimeout(()=>{console.error('Native QA deadline exceeded');process.exit(1)},180000);
const state = data => fs.writeFileSync(path.join(root,'state.json'), JSON.stringify(data));
async function main() {
 const m = await a.connect({wsEndpoint:'ws://127.0.0.1:9430'});
 m.on('exception', e=>errors.push(e));
 const check=(name, condition)=>{assert.ok(condition,name);checks.push(name);console.log('PASS',name)};
 const shot=async name=>m.screenshot({path:path.join(output,'screenshots',`${round}-${name}.png`)});
 const open=async id=>{await m.reLaunch('/pages/nail-detail/nail-detail?id='+id); await new Promise(r=>setTimeout(r,500)); const p=(m.pageMap.clear(), await m.currentPage()); const current=JSON.parse(fs.readFileSync(path.join(root,'state.json'))); await p.waitFor(current.error || current.empty ? '.state-title' : '.product-title'); await p.waitFor(300); return p};
 try {
 state({});
 let p;
 if(process.env.QA_PART !== 'states') {
 await m.evaluate(()=>{require('store/session.js').clearSession();require('utils/booking-flow.js').clearPendingBooking();});
 p=await open('qa-nail');
 check('detail direct entry uses catalog',await (await p.$('.product-title')).text()==='月光石晕染美甲');
 check('48px booking target',Number((await (await p.$('.book-button')).size()).height)>=48);
 check('48px favorite target',Number((await (await p.$('.favorite')).size()).height)>=48);
 await shot('detail');
 await (await p.$('.gallery-swiper')).swipeTo(1);await p.waitFor(350);
 check('swiper updates image count',(await (await p.$('.gallery-count')).text()).startsWith('2/3'));
 await m.mockWxMethod('previewImage',function(options){getApp().__qaPreview={current:options.current,urls:options.urls}; options.success&&options.success({errMsg:'previewImage:ok'}); options.complete&&options.complete({errMsg:'previewImage:ok'});});
 await (await p.$('.gallery-count')).tap();await p.waitFor(200);
 const preview=await m.evaluate(()=>getApp().__qaPreview);
 check('native preview receives current second image',preview.current.endsWith('swatch-2.png') && preview.urls.length===3);
 await m.restoreWxMethod('previewImage');
 await m.pageScrollTo(650);await p.waitFor(300);await shot('detail-bottom');
 const bar=await (await p.$('.action-bar')).offset();
 check('action bar remains reachable after scrolling',Number(bar.top)-Number(await p.scrollTop())>=0 && Number(bar.top)-Number(await p.scrollTop())<800);
 // Cancel guest login. No session or server writes.
 await m.mockWxMethod('showModal',{confirm:false,cancel:true});
 await (await p.$('.book-button')).tap();await p.waitFor(600);
 check('cancelled login stays on detail',((m.pageMap.clear(), await m.currentPage())).path==='pages/nail-detail/nail-detail');
 await m.restoreWxMethod('showModal');
 const profile={id:'qa-member',phone:'13800138000',nickname:'验收账号',balance:0,points:0,pospal:{state:'UNLINKED'}};
 await m.callWxMethod('setStorageSync','member-miniapp-session',{token:'qa-local-only',userId:profile.id,profile});
 await m.callWxMethod('setStorageSync','member-miniapp-legal-consent','2026-10-12-member-sync');
 await m.callWxMethod('removeStorageSync','member-miniapp-favorites-v1:qa-member');
 p=await open('qa-nail');
 await (await p.$('.favorite')).tap();await p.waitFor(250);
 check('favorite saved',(await (await p.$('.favorite')).text())==='已收藏');
 await (await p.$('.favorite')).tap();await p.waitFor(250);
 check('favorite cancelled',(await (await p.$('.favorite')).text())==='收藏');
 await (await p.$('.book-button')).tap();await p.waitFor(700);
 p=(m.pageMap.clear(), await m.currentPage());
 check('booking goes to original route',p.path==='pages/appointment/appointment');
 check('booking keeps selected product',(await (await p.$('.selected-summary')).text()).includes('月光石晕染美甲'));
 await shot('booking');
 await (await p.$('.close-btn')).tap();await p.waitFor(200);
 check('booking panel closes',!(await p.$('.booking-panel')));
 }
 console.log('STAGE list');
 await m.reLaunch('/pages/nail/nail');await new Promise(r=>setTimeout(r,500));p=(m.pageMap.clear(), await m.currentPage());await p.waitFor('.detail-link');
 await (await p.$$('.category-chip'))[1].tap();await p.waitFor(400);
 await m.pageScrollTo(480);await p.waitFor(250);const scroll=Number(await p.scrollTop());
 console.log('STAGE enter detail from list');await (await p.$('.detail-link')).tap();console.log('STAGE return from detail');await new Promise(r=>setTimeout(r,1600));p=(m.pageMap.clear(),await m.currentPage());check('list detail entry navigates',p.path==='pages/nail-detail/nail-detail');await p.waitFor('.product-title');await m.evaluate(()=>{wx.navigateBack({delta:1});return true;});await new Promise(resolve=>setTimeout(resolve,1200));
 p=(m.pageMap.clear(), await m.currentPage());await p.waitFor('.category-chip');
 check('list preserves selected category',(await (await p.$('.category-chip.active')).text())==='款式设计');
 check('list restores scroll position',Math.abs(Number(await p.scrollTop())-scroll)<4);
 await shot('list-return');
 state({error:true});p=await open('qa-nail');
 check('network failure has retry',!!(await p.$('.state-button')));await shot('network-error');
 state({});await (await p.$('.state-button')).tap();await p.waitFor(500);
 check('retry recovers product',!!(await p.$('.product-title')));
 state({empty:true});p=await open('qa-nail');
 check('removed product has no booking action',!(await p.$('.book-button')) && (await (await p.$('.state-title')).text()).includes('暂不可预约'));await shot('removed');
 state({missingData:true});p=await open('qa-nail');
 check('missing photo and price honest',(await (await p.$('.gallery-placeholder')).text()).includes('图片待补充') && (await (await p.$('.product-price')).text()).includes('到店确认'));
 await shot('missing-data');
 state({brokenImage:true});p=await open('qa-nail');await p.waitFor(800);
 check('broken image shows retry',!!(await p.$('.image-retry')));await shot('broken-image');
 state({long:true});p=await open('qa-nail');await shot('long-content');
 const title=await (await p.$('.product-title')).size();check('long title wraps',Number(title.height)>60);
 state({});
 const requests=fs.readFileSync(path.join(root,'requests.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
 check('fixture received no write requests',requests.every(r=>r.method==='GET'));
 check('no real-time member lookup during QA',requests.every(r=>!r.path.endsWith('/members/me/profile')));
 } finally {
 fs.writeFileSync(path.join(output,`${round}-${process.env.QA_PART || 'full'}-native-results.json`),JSON.stringify({checks,errors,system:await m.systemInfo()},null,2));
 await m.disconnect();clearTimeout(timeout);
 }
}
main().catch(e=>{console.error(e);process.exitCode=1});
