const a=require('miniprogram-automator'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{const m=await a.connect({wsEndpoint:'ws://127.0.0.1:9431'});const checks=[];try{
const info=await m.systemInfo();assert.equal(info.windowWidth,320);
for(const id of ['source','r2']){
 await m.reLaunch('/pages/nail-detail/nail-detail?id='+id);m.pageMap.clear();const p=await m.currentPage();await p.waitFor('.product-title');await p.waitFor(700);
 assert.ok(Number((await p.size()).width)<=320);assert.equal(await(await p.$('.gallery-image')).attribute('mode'),'aspectFit');
 await m.screenshot({path:path.join(__dirname,'screenshots','small-detail-'+id+'.png')});checks.push(id+': 320px no overflow and uncropped fit');
}
fs.writeFileSync(path.join(__dirname,'small-results.json'),JSON.stringify({system:info,checks},null,2));console.log('PASS 320px source and R2');
}finally{await m.disconnect()}})().catch(e=>{console.error(e);process.exitCode=1});
