// Read-only local review of existing files. No proxy, upload, database, or product mutation.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const repo=path.resolve(__dirname,'../../../..');
const photos={
 'source.jpg':'design/product-images/inputs/nail-star-b2bdb426/source.jpg',
 'v1.png':'design/product-images/output/nail-star-photo-opt-v1/nail-star-photo-opt-v1/original.png',
 'r2.png':'design/product-images/output/nail-star-photo-opt-r2/nail-star-photo-opt-r2/original.png',
 'concept.png':'design/product-images/output/concept-pilot-v1/nail-moonmist-concept-v1/original.png'
};
const products=[['source','原始实拍 · 星点法式','source.jpg','用户提供的原始照片。本地图片展示复核，未绑定商品。'],['v1','优化候选 V1 · 保真未通过','v1.png','基于实拍的AI优化候选，甲面图案存在偏差。仅本地复核。'],['r2','优化候选 R2 · 保真未通过','r2.png','基于实拍的第二版AI优化候选，甲面图案仍存在偏差。仅本地复核。'],['concept','月雾贝光 · AI概念图','concept.png','AI生成的款式概念，非门店实拍或库存证明。仅本地复核。']].map(([id,name,file,description])=>({id,name,description,businessType:'NAIL',categoryId:'review',categoryName:'本地复核',images:[`http://127.0.0.1:8771/photos/${file}`],sortOrder:0,isActive:true,createdAt:'',updatedAt:''}));
http.createServer((req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1:8771');
 fs.appendFileSync(path.join(__dirname,'requests.jsonl'),JSON.stringify({method:req.method,path:url.pathname})+'\n');
 if(req.method!=='GET'){res.writeHead(405);res.end('review is read-only');return;}
 const file=photos[url.pathname.replace('/photos/','')];
 if(url.pathname.startsWith('/photos/')&&file){res.setHeader('Content-Type',file.endsWith('.jpg')?'image/jpeg':'image/png');res.end(fs.readFileSync(path.join(repo,file)));return;}
 res.setHeader('Content-Type','application/json');
 if(url.pathname.endsWith('/products'))res.end(JSON.stringify(products));
 else if(url.pathname.endsWith('/categories'))res.end(JSON.stringify([{id:'review',name:'本地复核',businessType:'NAIL'}]));
 else if(url.pathname.startsWith('/api/'))res.end('[]');
 else {res.writeHead(404);res.end('{}');}
}).listen(8771,'127.0.0.1',()=>console.log('Photo review: read-only fixture 8771'));
