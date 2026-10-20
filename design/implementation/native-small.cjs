const a=require('miniprogram-automator'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{const m=await a.connect({wsEndpoint:'ws://127.0.0.1:9430'});try{
 fs.writeFileSync('/tmp/moonisle-miniapp-qa/state.json',JSON.stringify({long:true}));
 let p=await m.reLaunch('/pages/nail-detail/nail-detail?id=qa-nail');await p.waitFor('.product-title');await p.waitFor(600);
 const system=await m.systemInfo();assert.equal(system.windowWidth,320);
 const width=Number((await p.size()).width);assert.ok(width<=320,`page overflow: ${width}`);
 const button=await p.$('.book-button');assert.ok(Number((await button.size()).height)>=48);
 await m.screenshot({path:path.join(__dirname,'screenshots/round2-small-320.png')});
 await m.pageScrollTo(10000);await p.waitFor(400);await m.screenshot({path:path.join(__dirname,'screenshots/round2-small-bottom.png')});
 await button.tap();await p.waitFor(1800);m.pageMap.clear();p=await m.currentPage();await p.waitFor('.booking-panel');
 await m.screenshot({path:path.join(__dirname,'screenshots/round2-small-booking.png')});
 // Native scrolling of the existing scrollable panel to reach submit; do not submit.
 const panel=await p.$('.booking-panel');await panel.touchstart({touches:[{identifier:1,pageX:200,pageY:430}]});await panel.touchmove({touches:[{identifier:1,pageX:200,pageY:130}]});await panel.touchend({changedTouches:[{identifier:1,pageX:200,pageY:130}]});
 await p.waitFor(500);await m.screenshot({path:path.join(__dirname,'screenshots/round2-small-booking-scroll.png')});
 fs.writeFileSync(path.join(__dirname,'small-native-results.json'),JSON.stringify({system,checks:['320px no horizontal overflow','48px book target','long text and bottom action reachable','original booking panel opens'],pageWidth:width},null,2));
 console.log('PASS small screen',width);
 }finally{await m.disconnect()}})().catch(e=>{console.error(e);process.exitCode=1});
