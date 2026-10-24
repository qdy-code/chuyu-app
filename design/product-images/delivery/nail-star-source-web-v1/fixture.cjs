const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=__dirname;
http.createServer((req,res)=>{
 const u=new URL(req.url,'http://127.0.0.1:8772');
 fs.appendFileSync(path.join(root,'requests.jsonl'),JSON.stringify({method:req.method,path:u.pathname})+'\n');
 if(req.method!=='GET'){res.writeHead(405);res.end('read-only visual QA');return;}
 if(u.pathname==='/display.jpg'){res.setHeader('Content-Type','image/jpeg');res.end(fs.readFileSync(path.join(root,'display.jpg')));return;}
 res.setHeader('Content-Type','application/json');
 if(u.pathname.endsWith('/products'))res.end(JSON.stringify([{id:'nail-star-review',businessType:'NAIL',categoryId:'review',categoryName:'本地验收',name:'星点法式 · 本地验收',description:'原始实拍的压缩展示版。用于验证完整构图与看图操作，尚未绑定上架商品。',images:['http://127.0.0.1:8772/display.jpg'],isActive:true,sortOrder:0,createdAt:'',updatedAt:''}]));
 else if(u.pathname.endsWith('/categories'))res.end(JSON.stringify([{id:'review',businessType:'NAIL',name:'本地验收'}]));
 else if(u.pathname.startsWith('/api/'))res.end('[]');else{res.writeHead(404);res.end('{}');}
}).listen(8772,'127.0.0.1',()=>console.log('Read-only delivery QA fixture 8772'));
