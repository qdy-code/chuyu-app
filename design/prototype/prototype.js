'use strict';
// Standalone presentation prototype. No API requests or real booking operations.
const $ = (id) => document.getElementById(id);
const phone = $('phone');
const images = ['assets/swatch-1.svg', 'assets/swatch-2.svg', 'assets/swatch-3.svg'];
const products = [
  { id: 'moon', name: '月光石晕染美甲', price: 168, category: '款式设计', image: 0, description: '低饱和月光色晕染，适合通勤和轻仪式场景。\n\n本原型用构图样片展示照片位置。正式页面将使用门店真实作品图片与完整介绍，不以示意图代替实际效果。' },
  { id: 'mist', name: '雾蓝清透 · 演示款式', price: 168, category: '款式设计', image: 1, description: '此条目用于演示列表滚动、详情返回与多图浏览。\n\n名称、价格和构图均为交互演示内容，不代表门店在售商品。' },
  { id: 'care', name: '基础护理 · 演示项目', price: null, category: '基础护理', image: 2, description: '未设置参考价时，显示“价格请咨询门店”。\n\n服务内容、时长与实际金额以门店确认为准。' },
];
const icon = (name) => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
const esc = (v) => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let route = {view:'list', product:'moon', overlay:null};
let category = '全部', scenario = 'normal', galleryIndex = 0, listScroll = 0;
let detailKey = '', lastFocused = null, toastTimer, renderRevision = 0, galleryFrame;
let booking = {step:'choose', date:'', time:'', note:'', product:'moon'};
let favorites = new Set();
const favoriteKey = 'moonisle-design-prototype-favorites-v1';
try { const saved = JSON.parse(sessionStorage.getItem(favoriteKey) || '[]'); if (Array.isArray(saved)) favorites = new Set(saved.filter(v=>typeof v==='string')); } catch {}
const reduced = () => $('reduce').checked || matchMedia('(prefers-reduced-motion: reduce)').matches;
const currentProduct = () => products.find(p=>p.id===route.product) || products[0];
const productImages = (p) => [images[p.image], images[(p.image+1)%3], images[(p.image+2)%3]];
const displayName = p => scenario==='long' ? `${p.name}：低饱和月光渐变与细腻晕染的长标题展示示例` : p.name;
const price = p => (scenario==='missing'||p.price===null) ? '价格请咨询门店' : `¥${p.price.toFixed(2)}`;
function toast(message) { clearTimeout(toastTimer); $('toast').textContent=message; $('toast').classList.add('visible'); toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),2600); }
function animate(el, name, duration) { if(reduced()) return; el.classList.remove(name); void el.offsetWidth; el.classList.add(name); setTimeout(()=>el.classList.remove(name),duration); }
function path(next) { return `#${next.view==='detail'?'detail/'+next.product:'list'}${next.overlay?'/'+next.overlay:''}`; }
function clearToast() { clearTimeout(toastTimer); $('toast').classList.remove('visible'); }
function go(next) {
  if(route.overlay || JSON.stringify(route)===JSON.stringify(next)) return;
  clearToast();
  lastFocused=document.activeElement;
  if(route.view==='list') listScroll=$('list-page').scrollTop;
  history.pushState({prototype:true,...next},'',path(next));
  route=next; render(true);
}
function back() { if(route.overlay||route.view==='detail') history.back(); }
function stateBlock(title, copy, action='retry') { return `<div class="state">${icon('image')}<h2>${title}</h2><p>${copy}</p><button class="button primary" data-action="${action}">${action==='retry'?'重新加载':'返回作品列表'}</button></div>`; }
function renderList() {
  const target=$('catalog');
  if(scenario==='loading') target.innerHTML='<div class="skeleton" role="status"><div class="skeleton-image"></div><div class="skeleton-line"></div><div class="skeleton-line short"></div><p class="fine">正在加载作品…</p></div>';
  else if(scenario==='error') target.innerHTML=stateBlock('作品暂未加载','请重试，或稍后再来看看。');
  else if(scenario==='empty') target.innerHTML='<div class="state"><h2>新作品正在准备中</h2><p>暂时没有上架作品，可以先预约到店沟通。</p><button class="button primary" data-action="generic-book">预约到店</button></div>';
  else target.innerHTML=products.filter(p=>category==='全部'||p.category===category).map(p=>`<article class="product-card"><button class="cover-button" data-action="preview-list" data-product="${p.id}" aria-label="查看${esc(p.name)}大图">${scenario==='missing'?`<div class="placeholder">${icon('image')}图片待补充</div>`:`<img src="${images[p.image]}" alt="${esc(p.name)}的构图示意，非门店实拍"/><span class="sample-label">构图样片 · 非实拍</span>`}</button><div class="card-body"><div class="card-heading"><h3>${esc(displayName(p))}</h3><button class="icon-button favorite" data-action="favorite" data-product="${p.id}" aria-label="收藏${esc(p.name)}" aria-pressed="${favorites.has(p.id)}">${icon('heart')}</button></div><div class="price"><small>参考价</small><strong>${price(p)}</strong></div><div class="card-actions"><button class="button secondary" data-action="detail" data-product="${p.id}">查看详情</button><button class="button primary" data-action="quick-book" data-product="${p.id}">预约此款</button></div></div></article>`).join('');
  document.querySelectorAll('[data-category]').forEach(b=>{b.classList.toggle('selected',b.dataset.category===category);b.setAttribute('aria-pressed',String(b.dataset.category===category));});
}
function renderDetail() {
  const p=currentProduct(), key=p.id+':'+scenario;
  if(key===detailKey) return;
  detailKey=key;
  const el=$('detail-page');
  if(scenario==='loading') {el.innerHTML='<div class="skeleton" role="status"><div class="skeleton-image"></div><div class="skeleton-line"></div><div class="skeleton-line short"></div><p>正在加载款式…</p></div>';return;}
  if(scenario==='error') {el.innerHTML=stateBlock('款式暂未加载','当前无法确认商品信息，请重新加载。');return;}
  if(scenario==='empty') {el.innerHTML=stateBlock('该款式暂不可预约','已下架或暂不可用，可以返回看看其他作品。','back');return;}
  const photos=productImages(p);
  el.innerHTML=`${scenario==='missing'?`<div class="placeholder">${icon('image')}<span>图片待补充</span></div>`:`<div class="gallery"><div class="gallery-track" id="gallery-track" aria-label="作品图片，可横向滑动">${photos.map((src,i)=>`<button class="gallery-slide" data-action="preview" data-index="${i}" aria-label="查看第${i+1}张大图"><img src="${src}" alt="第${i+1}张构图样片，非门店实拍"/><span class="sample-label">构图样片 · 非实拍</span></button>`).join('')}</div><div class="gallery-controls"><button class="icon-button" data-action="previous" aria-label="上一张">${icon('back')}</button><button class="text-button" data-action="preview" id="image-count"></button><button class="icon-button" data-action="next" aria-label="下一张">${icon('next')}</button></div></div>`}
  <div class="product-info"><h1>${esc(displayName(p))}</h1><div class="price"><small>参考价</small><strong>${price(p)}</strong></div><span class="category-label">${p.category}</span></div><section class="detail-section"><h2>款式介绍</h2><p>${esc(p.description)}${scenario==='long'?'\n\n'+('长文演示：完整介绍自然换行，保留阅读空间，底部预约入口保持可达。'.repeat(12)):''}</p></section><section class="detail-section"><h2>${icon('calendar')}预约前了解</h2><ul><li>参考价、服务时长及卸甲等加项，请与门店确认。</li><li>提交的是预约申请，请等待门店确认后再到店。</li></ul></section><section class="detail-section"><h2>到店与联系</h2><p>款式咨询或预约变更，可留言联系门店。</p><button class="button secondary" data-action="contact">留言给门店</button></section>`;
  const track=$('gallery-track');
  if(track) track.addEventListener('scroll',()=>{cancelAnimationFrame(galleryFrame);galleryFrame=requestAnimationFrame(()=>{galleryIndex=Math.round(track.scrollLeft/track.clientWidth);updateGallery();});},{passive:true});
  el.scrollTop=0;
  requestAnimationFrame(()=>setGallery(galleryIndex,false));
}
function updateGallery() {
  if($('image-count')) $('image-count').textContent=`查看大图 · ${galleryIndex+1} / 3`;
  $('detail-page').querySelectorAll('[data-action="previous"]').forEach(b=>b.disabled=galleryIndex===0);
  $('detail-page').querySelectorAll('[data-action="next"]').forEach(b=>b.disabled=galleryIndex===2);
}
function setGallery(index,smooth=true) {
  galleryIndex=Math.max(0,Math.min(2,index));
  const track=$('gallery-track');
  if(track) track.scrollTo({left:track.clientWidth*galleryIndex,behavior:smooth&&!reduced()?'smooth':'instant'});
  updateGallery();
}
function updateFavorites() {
  phone.querySelectorAll('[data-action="favorite"]').forEach(b=>{const id=b.dataset.product||route.product;const saved=favorites.has(id);b.setAttribute('aria-pressed',String(saved));b.setAttribute('aria-label',`${saved?'取消收藏':'收藏'}${products.find(p=>p.id===id)?.name||''}`);const span=b.querySelector('span');if(span)span.textContent=saved?'已收藏':'收藏';});
}
function toggleFavorite(button) {
  const id=button.dataset.product||route.product;
  if($('fail-save').checked){toast('收藏未保存，请重试。原状态已保留。');return;}
  const next=new Set(favorites);next.has(id)?next.delete(id):next.add(id);
  try {sessionStorage.setItem(favoriteKey,JSON.stringify([...next]));}catch{toast('此浏览器无法保存演示收藏，请检查存储设置。');return;}
  favorites=next;updateFavorites();animate(button,'pop',160);toast(favorites.has(id)?'已收藏 · 仅保存在本次原型会话':'已取消收藏');
}
function dateKey(date) {return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
function openBooking(product) {
  const tomorrow=new Date();tomorrow.setDate(tomorrow.getDate()+1);
  booking={step:'choose',date:dateKey(tomorrow),time:'',note:'',product};
  go({...route,overlay:'booking'});
}
function renderBooking() {
  const p=products.find(p=>p.id===booking.product);
  const body= booking.step==='done' ? `<div class="state">${icon('check')}<h2>预约演示已完成</h2><p>没有提交真实预约。正式流程会显示预约申请结果，并等待门店确认。</p><button class="button primary" data-action="close">返回继续浏览</button></div>` : booking.step==='confirm' ? `<div class="sheet-summary"><div><strong>${esc(p?.name||'到店沟通款式')}</strong><p>${booking.date} ${booking.time} · 演示时段</p></div></div><p class="fine">确认页示意。真实接入将沿用现有登录、手机号和时段校验，不会自动提交。</p>${booking.note?`<p class="inline-status">备注：${esc(booking.note)}</p>`:''}<button class="button primary" data-action="demo-submit">演示提交（不创建预约）</button><button class="button secondary" data-action="edit-booking">返回修改</button>` : `<div class="sheet-summary">${p?`<img src="${images[p.image]}" alt="构图样片"/>`:icon('calendar')}<div><strong>${esc(p?.name||'到店沟通款式')}</strong><p>${p?'保留当前所选款式':'无需预先选择款式'}</p></div></div><p class="fine">原型时段仅供体验，不代表门店排期。</p><label for="book-date">到店日期</label><input id="book-date" type="date" value="${booking.date}" min="${dateKey(new Date())}"/><label>到店时间</label><div class="time-grid">${['10:00','11:30','13:00','14:30','16:00','17:30'].map((time,i)=>`<button class="time ${booking.time===time?'selected':''}" data-time="${time}" aria-pressed="${booking.time===time}" ${i===3?'disabled':''}>${time}${i===3?' 已满':''}</button>`).join('')}</div><label for="book-note">备注（选填）</label><textarea id="book-note" maxlength="200" placeholder="例如：需要卸甲">${esc(booking.note)}</textarea><button class="button primary" id="continue-book" data-action="confirm-booking" ${!booking.time?'disabled':''}>继续确认</button><p class="fine">正式使用需完成登录与手机号确认。此处不连接账号或业务系统。</p>`;
  $('overlay').innerHTML=`<section class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title" tabindex="-1"><div class="handle"></div><div class="sheet-heading"><h2 id="sheet-title">${booking.step==='confirm'?'确认到店安排':booking.step==='done'?'演示回执':'预约到店'}</h2><button class="icon-button" data-action="close" aria-label="关闭预约面板">${icon('close')}</button></div>${body}</section>`;
  $('book-date')?.addEventListener('change',e=>{booking.date=e.target.value;booking.time='';renderBooking();$('book-date')?.focus();});
  $('book-note')?.addEventListener('input',e=>booking.note=e.target.value);
}
function renderViewer() {
  const p=currentProduct();
  $('overlay').innerHTML=`<section class="viewer" role="dialog" aria-modal="true" aria-label="图片预览" tabindex="-1"><div class="viewer-head"><span>构图样片 · 非门店实拍</span><button class="icon-button" data-action="close" aria-label="关闭大图">${icon('close')}</button></div><div class="viewer-main"><img id="viewer-image" src="${productImages(p)[galleryIndex]}" alt="第${galleryIndex+1}张构图样片"/></div><div class="viewer-footer"><button class="icon-button" data-action="viewer-previous" aria-label="上一张图片" ${galleryIndex===0?'disabled':''}>${icon('back')}</button><span>${galleryIndex+1} / 3</span><button class="icon-button" data-action="viewer-next" aria-label="下一张图片" ${galleryIndex===2?'disabled':''}>${icon('next')}</button></div></section>`;
  let start=null;
  $('viewer-image').addEventListener('pointerdown',e=>{start={x:e.clientX,y:e.clientY};e.currentTarget.setPointerCapture(e.pointerId);});
  $('viewer-image').addEventListener('pointerup',e=>{if(!start)return;const dx=e.clientX-start.x,dy=e.clientY-start.y;start=null;if(Math.abs(dx)>40&&Math.abs(dx)>Math.abs(dy)){galleryIndex=Math.max(0,Math.min(2,galleryIndex+(dx<0?1:-1)));renderViewer();}});
  $('viewer-image').addEventListener('pointercancel',()=>start=null);
}
async function render(enter=false) {
  const version=++renderRevision, overlay=$('overlay');
  if(!route.overlay&&!overlay.hidden){overlay.classList.add('closing');await new Promise(r=>setTimeout(r,reduced()?0:180));if(version!==renderRevision)return;overlay.hidden=true;overlay.classList.remove('closing');overlay.innerHTML='';$('app-shell').inert=false;}
  const detail=route.view==='detail';
  $('list-page').hidden=detail;$('detail-page').hidden=!detail;$('back').hidden=!detail;$('tabbar').hidden=detail;
  $('action-bar').hidden=!detail||['loading','error','empty'].includes(scenario);
  $('nav-title').textContent=detail?'商品详情':'美甲';$('screen-label').textContent=detail?'商品详情':'美甲作品库';
  if(detail){renderDetail();updateFavorites();}else $('list-page').scrollTop=listScroll;
  if(route.overlay){$('app-shell').inert=true;overlay.hidden=false;overlay.classList.remove('closing');if(route.overlay==='viewer')renderViewer();else renderBooking();overlay.querySelector('[role="dialog"]')?.focus();}
  else {if(detail)setGallery(galleryIndex,false);if(lastFocused?.isConnected&&!lastFocused.closest('[hidden]'))lastFocused.focus({preventScroll:true});else if(detail)$('back').focus({preventScroll:true});}
  if(enter&&!route.overlay)animate(detail?$('detail-page'):$('list-page'),'enter',220);
}
phone.addEventListener('click',e=>{
  const button=e.target.closest('button');if(!button||button.disabled)return;
  if(button.dataset.category){category=button.dataset.category;listScroll=0;renderList();$('list-page').scrollTop=0;animate($('catalog'),'catalog-enter',140);return;}
  if(button.dataset.time){booking.time=button.dataset.time;phone.querySelectorAll('[data-time]').forEach(b=>{const yes=b.dataset.time===booking.time;b.classList.toggle('selected',yes);b.setAttribute('aria-pressed',String(yes));});$('continue-book').disabled=!booking.date;return;}
  const action=button.dataset.action,pid=button.dataset.product||route.product;
  if(action==='detail'){galleryIndex=0;detailKey='';go({view:'detail',product:pid,overlay:null});}
  else if(action==='favorite')toggleFavorite(button);
  else if(action==='preview'||action==='preview-list'){if(scenario==='missing'){toast('图片待补充，暂无可预览图片。');return;}if(action==='preview-list')galleryIndex=0;else if(button.dataset.index!==undefined)galleryIndex=Number(button.dataset.index);go({...route,product:pid,overlay:'viewer'});}
  else if(action==='previous'||action==='next')setGallery(galleryIndex+(action==='next'?1:-1));
  else if(action==='viewer-previous'||action==='viewer-next'){galleryIndex=Math.max(0,Math.min(2,galleryIndex+(action==='viewer-next'?1:-1)));renderViewer();$('overlay').querySelector('[role="dialog"]')?.focus();}
  else if(action==='book'||action==='quick-book')openBooking(pid);
  else if(action==='generic-book')openBooking(null);
  else if(action==='close'||action==='back')back();
  else if(action==='confirm-booking'){if(!booking.time||!booking.date||booking.date<dateKey(new Date())){toast('请选择有效的到店日期和演示时段。');return;}booking.note=$('book-note').value;booking.step='confirm';renderBooking();$('overlay').querySelector('[role="dialog"]')?.focus();}
  else if(action==='demo-submit'){booking.step='done';renderBooking();$('overlay').querySelector('[role="dialog"]')?.focus();}
  else if(action==='edit-booking'){booking.step='choose';renderBooking();$('overlay').querySelector('[role="dialog"]')?.focus();}
  else if(action==='retry'){scenario='normal';$('scenario').value='normal';detailKey='';renderList();render();toast('已恢复演示内容');}
  else if(action==='contact')toast('此处衔接现有留言页；原型不发送留言。');
  else if(action==='other-tab')toast('本轮只演示美甲详情，其他业务入口保留。');
});
$('back').addEventListener('click',back);
$('overlay').addEventListener('click',e=>{if(e.target===$('overlay'))back();});
document.addEventListener('keydown',e=>{
  if(!route.overlay)return;
  if(e.key==='Escape'){e.preventDefault();back();}
  if(e.key==='Tab'){const nodes=[...$('overlay').querySelectorAll('button:not(:disabled),input,textarea')];if(!nodes.length)return;const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&(document.activeElement===first||!nodes.includes(document.activeElement))){e.preventDefault();last.focus();}else if(!e.shiftKey&&(document.activeElement===last||!nodes.includes(document.activeElement))){e.preventDefault();first.focus();}}
});
function readRouteFromHash() { const match=location.hash.match(/^#detail\/(moon|mist|care)(?:$|\/)/); return match?{view:'detail',product:match[1],overlay:null}:{view:'list',product:'moon',overlay:null}; }
window.addEventListener('popstate',e=>{clearToast();route=e.state?.prototype?{view:e.state.view,product:e.state.product,overlay:e.state.overlay}:readRouteFromHash();render();});
window.addEventListener('hashchange',()=>{if(!history.state?.prototype){route=readRouteFromHash();render();}});
$('theme').addEventListener('change',e=>phone.dataset.theme=e.target.value);
$('reduce').checked=matchMedia('(prefers-reduced-motion: reduce)').matches;
$('reduce').addEventListener('change',e=>phone.classList.toggle('reduced',e.target.checked));
$('width').addEventListener('change',e=>{document.querySelector('.preview-wrap').style.setProperty('--preview-width',e.target.value+'px');$('size-label').textContent=e.target.value+'px';phone.classList.toggle('compact',Number(e.target.value)<360);requestAnimationFrame(()=>setGallery(galleryIndex,false));});
$('scenario').addEventListener('change',e=>{scenario=e.target.value;detailKey='';renderList();if(route.overlay){route={...route,overlay:null};history.replaceState({prototype:true,...route},'',path(route));}render();});
$('reset').addEventListener('click',()=>{scenario='normal';category='全部';galleryIndex=0;listScroll=0;detailKey='';favorites=new Set();try{sessionStorage.removeItem(favoriteKey);}catch{}$('scenario').value='normal';$('fail-save').checked=false;route={view:'list',product:'moon',overlay:null};history.replaceState({prototype:true,...route},'','#list');renderList();render();toast('已重置演示内容');});
$('brand-link').addEventListener('click',e=>{e.preventDefault();$('reset').click();});
// Allow a direct detail entry without relying on an earlier list click.
const direct=location.hash.match(/^#detail\/(moon|mist|care)/);
history.replaceState({prototype:true,view:'list',product:'moon',overlay:null},'','#list');
renderList();render();
if(direct)go({view:'detail',product:direct[1],overlay:null});
