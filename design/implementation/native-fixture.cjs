// Isolated simulator fixture. Never proxies or writes to the real service.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = process.env.QA_ROOT || '/tmp/moonisle-miniapp-qa';
const profile = { id: 'qa-member', phone: '13800138000', nickname: '验收账号', balance: 0, points: 0, pospal: { state: 'UNLINKED' } };
const product = { id: 'qa-nail', businessType: 'NAIL', categoryId: 'qa-category', categoryName: '款式设计', name: '月光石晕染美甲', description: '低饱和月光色，清透的晕染层次。\n细节可到店与美甲师沟通。\n\n此作品与构图样片仅用于本地交互验收，非上架商品。', referencePrice: 168, images: [1,2,3].map(n => `http://127.0.0.1:8770/swatch-${n}.png`), isActive: true, sortOrder: 0, createdAt: '', updatedAt: '' };
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1:8770');
  fs.appendFileSync(path.join(root, 'requests.jsonl'), JSON.stringify({ method: req.method, path: url.pathname }) + '\n');
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') { res.writeHead(405); res.end('Local QA: writes disabled'); return; }
  if (/^\/swatch-[123]\.png$/.test(url.pathname)) { res.setHeader('Content-Type', 'image/png'); res.end(fs.readFileSync(path.join(root, url.pathname))); return; }
  let state = {}; try { state = JSON.parse(fs.readFileSync(path.join(root, 'state.json'))); } catch {}
  res.setHeader('Content-Type', 'application/json');
  if (url.pathname.endsWith('/products')) {
    if (state.error) { res.writeHead(503); res.end(JSON.stringify({ message: '验收模拟网络错误' })); return; }
    const item = { ...product };
    if (state.missingData) { item.images=[]; delete item.referencePrice; item.description=''; delete item.categoryName; }
    if (state.long) { item.name='月光石晕染 · 低饱和奶油色与细闪层次的长标题测试'; item.description=product.description.repeat(8); }
    if (state.brokenImage) item.images=['http://127.0.0.1:8770/missing.png'];
    res.end(JSON.stringify(state.empty ? [] : [item, { ...item, id:'qa-nail-2', name:'月光细闪美甲' }]));
  } else if (url.pathname.endsWith('/categories')) res.end(JSON.stringify([{ id: 'qa-category', name: '款式设计', businessType: 'NAIL' }]));
  else if (url.pathname.endsWith('/cached-profile')) res.end(JSON.stringify(profile));
  else if (url.pathname.startsWith('/api/')) res.end('[]');
  else { res.writeHead(404); res.end('{}'); }
}).listen(8770, '127.0.0.1', () => console.log('Read-only QA fixtures on 127.0.0.1:8770'));
